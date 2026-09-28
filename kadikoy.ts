import axios from 'axios';
import * as cheerio from 'cheerio';
import moment from 'moment';
import { DEFAULT_AGE, KADIKOY_BASE_URL, TENNIS_BRANCH_NAME } from './constants';
import { KADIKOY_DATE_FORMAT, SLOT_DATE_FORMAT } from './utils';

export interface Court {
    key: string; // encrypted salon id, stable across sessions
    name: string;
    branchId: string;
    facilityId: string;
}

// upcoming = listed but not on sale yet ("Gelecek seansları satın alamazsınız")
// held = in someone else's cart; it comes back as available (and notifies) if the cart expires
export type SlotStatus = 'available' | 'sold' | 'held' | 'past' | 'upcoming' | 'unknown';

export interface Slot {
    date: string; // SLOT_DATE_FORMAT, Istanbul time
    status: SlotStatus;
}

const http = axios.create({
    baseURL: KADIKOY_BASE_URL,
    timeout: 20000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
});

// Minimal cookie jar: the member session (login) lives in cookies, and Lambda keeps it between runs
let cookies: Record<string, string> = {};

export const getCookies = () => ({ ...cookies });
export const setCookies = (value: Record<string, string>) => { cookies = { ...value }; };

http.interceptors.request.use((config) => {
    const header = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    if (header) config.headers.set('Cookie', header);
    return config;
});
http.interceptors.response.use((res) => {
    const setCookie = res.headers['set-cookie'] || [];
    for (const line of setCookie) {
        const [pair, ...attributes] = line.split(';');
        const index = pair.indexOf('=');
        const name = pair.slice(0, index).trim();
        const value = pair.slice(index + 1).trim();
        const expired = attributes.some((a) => /expires=thu, 01 jan 1970/i.test(a.trim()));
        if (!value || expired) delete cookies[name]; else cookies[name] = value;
    }
    return res;
});

const postForm = async <T>(url: string, data: Record<string, string | number>): Promise<T> => {
    const res = await http.post<T>(url, new URLSearchParams(data as Record<string, string>).toString());
    return res.data;
};

const getTennisBranchId = async (): Promise<string> => {
    const res = await http.get<string>('/Tab?name=Kiralik');
    const $ = cheerio.load(res.data);
    const option = $('#KiralikBransList option')
        .toArray()
        .find((el) => $(el).text().trim() === TENNIS_BRANCH_NAME);
    const branchId = option && $(option).attr('value');
    if (!branchId) {
        throw new Error(`Branch "${TENNIS_BRANCH_NAME}" not found on Kiralik tab`);
    }
    return branchId;
};

// Discovers every tennis court (facility + salon) listed on the site
export const getTennisCourts = async (): Promise<Court[]> => {
    const branchId = await getTennisBranchId();
    const facilities = await postForm<{ tesisAd: string; edTesisID: string }[]>(
        '/Seans/KiralikTesisListBransID',
        { EDBransID: branchId },
    );

    const courtsByFacility = await Promise.all(facilities.map(async (facility) => {
        const salons = await postForm<{ salonAd: string; edSalonID: string }[]>(
            '/Seans/KiralikSalonListTesisIDBransID',
            { EDBransID: branchId, EDTesisID: facility.edTesisID },
        );
        return (salons || []).map((salon) => ({
            key: salon.edSalonID,
            name: `${facility.tesisAd} - ${salon.salonAd}`,
            branchId,
            facilityId: facility.edTesisID,
        }));
    }));
    return courtsByFacility.flat();
};

// Tooltip text on each slot's cart button
const getSlotStatus = (title: string | undefined): SlotStatus => {
    if (!title) return 'unknown';
    // Members see "Sepete eklenebilir"; visitors see the same free slot as "Giriş Yap"
    if (title.includes('Sepete eklenebilir') || title.includes('Giriş Yap')) return 'available';
    if (title.includes('satın alındı')) return 'sold';
    if (title.includes('sepetinde')) return 'held';
    if (title.includes('Geçmiş')) return 'past';
    if (title.includes('Gelecek')) return 'upcoming';
    console.warn('unknown slot tooltip:', title);
    return 'unknown';
};

// Parses the weekly calendar returned by /Satis/Rezervasyon
export const parseSlots = (html: string): Slot[] => {
    const $ = cheerio.load(html);
    const days = $('.tarih').closest('.col-md-1');
    if (days.length === 0) {
        throw new Error('No day columns found in reservation page, layout may have changed');
    }

    const slots: Slot[] = [];
    days.each((_, day) => {
        const dayStr = $(day).find('.tarih').first().text().trim();
        const dayDate = moment(dayStr, KADIKOY_DATE_FORMAT, true);
        if (!dayDate.isValid()) return;

        $(day).children('.d-flex.align-items-center').each((_, row) => {
            const time = $(row).find('.fw-semibold').first().text().trim(); // "08:00 - 09:00"
            const start = time.split('-')[0].trim();
            const [hour, minute] = start.split(':').map(Number);
            if (Number.isNaN(hour)) return;

            const title = $(row).find('[data-bs-original-title]').attr('data-bs-original-title');
            slots.push({
                date: dayDate.clone().hour(hour).minute(minute || 0).format(SLOT_DATE_FORMAT),
                status: getSlotStatus(title),
            });
        });
    });
    return slots;
};

// Anonymous pages link to the login form in the header; a member session doesn't
export const isLoggedInPage = (html: string) => !html.includes('href="/Uye/UyeGiris"');

export const isLoggedIn = async () => isLoggedInPage((await http.get<string>('/')).data);

// Member login (TC kimlik no + password). Members see ~2 weeks of slots, visitors only the current week.
export const login = async (tcNo: string, password: string) => {
    const page = await http.get<string>('/Uye/UyeGiris');
    const $ = cheerio.load(page.data);
    const form: Record<string, string> = {};
    $('#kt_sign_in_form input[name]').each((_, input) => {
        form[$(input).attr('name')!] = $(input).attr('value') || '';
    });
    form.TCno = tcNo;
    form.Sifre = password;

    // Stop at the redirect so its Set-Cookie (the auth cookie) is captured
    await http.post('/Uye/UyeGiris', new URLSearchParams(form).toString(), {
        maxRedirects: 0,
        validateStatus: (status) => status < 400,
    });
    if (!(await isLoggedIn())) {
        throw new Error('Kadikoy login failed (check /tennis/KADIKOY_TC and /tennis/KADIKOY_PASSWORD)');
    }
};

export const getCourtSlots = async (court: Court): Promise<{ slots: Slot[]; loggedIn: boolean }> => {
    const html = await postForm<string>('/Satis/Rezervasyon', {
        Yas: DEFAULT_AGE,
        KiralikBransID: court.branchId,
        KiralikTesisID: court.facilityId,
        KiralikSalonID: court.key,
    });
    return { slots: parseSlots(html), loggedIn: isLoggedInPage(html) };
};
