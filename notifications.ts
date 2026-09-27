import moment from 'moment';
import { Court } from './kadikoy';
import { ApnsEnvironment, Device, deleteDevice, listDevices } from './devices';
import { isInvalidToken, sendPushes } from './apns';
import { getSecrets } from './secrets';
import { SLOT_DATE_FORMAT, isPrimeTime } from './utils';

export interface CourtNewSlots {
    court: Court;
    slots: string[];
}

const MAX_BODY_LINES = 6;

const formatSlot = (slot: string) => moment(slot, SLOT_DATE_FORMAT).locale('tr').format('DD MMM ddd HH:mm');

// KALAMIŞ SPOR MERKEZİ - TENİS KORTU 1 → Kalamış 1
const shortCourtName = (name: string) => {
    const [facility, court] = name.split(' - ');
    const place = facility.split(' ')[0];
    const number = (court || '').match(/\d+$/)?.[0];
    return (number ? `${place} ${number}` : place).toLocaleLowerCase('tr').replace(/(^|\s)\S/g, (c) => c.toLocaleUpperCase('tr'));
};

export const buildMessage = (device: Device, newSlots: CourtNewSlots[]) => {
    const lines: string[] = [];
    let firstCourt: Court | undefined;
    for (const { court, slots: courtSlots } of newSlots) {
        if (device.courts.length > 0 && !device.courts.includes(court.key)) continue;
        const slots = device.primeOnly ? courtSlots.filter(isPrimeTime) : courtSlots;
        for (const slot of slots) {
            firstCourt = firstCourt || court;
            lines.push(`${shortCourtName(court.name)} · ${formatSlot(slot)}`);
        }
    }
    if (lines.length === 0 || !firstCourt) return undefined;
    const body = lines.slice(0, MAX_BODY_LINES).join('\n')
        + (lines.length > MAX_BODY_LINES ? `\n+${lines.length - MAX_BODY_LINES} slot daha` : '');
    return {
        title: lines.length === 1 ? 'Boş kort açıldı' : `${lines.length} boş kort slotu açıldı`,
        body,
        // Tapping the notification opens this court's calendar (see /go in handler.ts)
        court: { b: firstCourt.branchId, t: firstCourt.facilityId, s: firstCourt.key },
    };
};

export const notifyDevices = async (newSlots: CourtNewSlots[]) => {
    if (newSlots.length === 0) return;

    const secrets = await getSecrets();
    const teamId = process.env.APNS_TEAM_ID;
    const bundleId = process.env.APNS_BUNDLE_ID;
    if (!secrets.apnsKey || !secrets.apnsKeyId || !teamId || !bundleId) {
        console.warn('APNs is not configured, skipping push');
        return;
    }
    const credentials = { key: secrets.apnsKey, keyId: secrets.apnsKeyId, teamId, bundleId };

    const devices = await listDevices();
    for (const environment of ['production', 'sandbox'] as ApnsEnvironment[]) {
        const messages = devices
            .filter((device) => device.environment === environment)
            .flatMap((device) => {
                const message = buildMessage(device, newSlots);
                return message ? [{ token: device.token, ...message }] : [];
            });

        const results = await sendPushes(credentials, environment, messages);
        for (const result of results) {
            if (result.status === 200) continue;
            console.warn('push failed', { environment, status: result.status, reason: result.reason });
            if (isInvalidToken(result)) {
                await deleteDevice(result.token);
            }
        }
        console.log(`push ${environment}: ${results.filter((r) => r.status === 200).length}/${messages.length} sent`);
    }
};
