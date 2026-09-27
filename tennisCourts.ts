import { Court, getCookies, getCourtSlots, getTennisCourts, isLoggedIn, login, setCookies } from './kadikoy';
import { getCourtState, getSessionCookies, saveCourtState, saveSessionCookies } from './store';
import { getSecrets } from './secrets';
import { CourtNewSlots, notifyDevices } from './notifications';
import { Snapshot, writeSnapshot } from './snapshot';
import { SLOT_DATE_FORMAT, nowInIstanbul } from './utils';

// Reuses the stored member session and logs in only when it has expired.
// Returns whether the scan runs as a member (2 weeks visible) or anonymously (current week).
const ensureSession = async (): Promise<boolean> => {
    setCookies(await getSessionCookies());
    if (await isLoggedIn()) return true;

    const { kadikoyTc, kadikoyPassword } = await getSecrets();
    if (!kadikoyTc || !kadikoyPassword) {
        console.warn('no Kadikoy credentials, scanning anonymously (current week only)');
        return false;
    }
    console.log('session expired, logging in');
    await login(kadikoyTc, kadikoyPassword);
    await saveSessionCookies(getCookies());
    return true;
}

const getAvailableSlots = async (court: Court, member: boolean): Promise<string[]> => {
    const now = nowInIstanbul().format(SLOT_DATE_FORMAT);
    const { slots, loggedIn } = await getCourtSlots(court);
    // A member scan that silently fell back to the one-week view would drop next week's slots,
    // and they would come back as "new" on the next run; skip the court instead
    if (member && !loggedIn) {
        throw new Error('session lost during scan');
    }
    return slots
        .filter((slot) => slot.status === 'available' && slot.date > now)
        .map((slot) => slot.date);
}

// Runs fn for every court in parallel; a failing court is logged and skipped
const forEachCourt = async <T>(fn: (court: Court) => Promise<T>) => {
    const courts = await getTennisCourts();
    console.log('courts:', courts.map((c) => c.name));
    const results = await Promise.allSettled(courts.map(fn));
    results.forEach((result, i) => {
        if (result.status === 'rejected') {
            console.error(`court failed: ${courts[i].name}`, result.reason);
        }
    });
    return results;
}

const checkCourts = async () => {
    const snapshot: Snapshot = { updatedAt: new Date().toISOString(), courts: [] };
    const newSlotsByCourt: CourtNewSlots[] = [];

    const member = await ensureSession();
    const cookiesBefore = JSON.stringify(getCookies());

    await forEachCourt(async (court) => {
        const availableSlots = await getAvailableSlots(court, member);
        snapshot.courts.push({ key: court.key, name: court.name, branchId: court.branchId, facilityId: court.facilityId, availableSlots });

        const previous = await getCourtState(court.key);
        const previousSlots = previous?.availableSlots || [];

        // check and alert if new slot found
        const newSlots = availableSlots.filter((date) => !previousSlots.includes(date));
        console.log('newSlots:', newSlots, { courtName: court.name });
        if (newSlots.length > 0) {
            newSlotsByCourt.push({ court, slots: newSlots });
        }

        // update available slots if necessary
        if (previousSlots.join(' - ') !== availableSlots.join(' - ')) {
            await saveCourtState({ courtKey: court.key, name: court.name, availableSlots });
        }
    });

    // Sliding session expiry: keep refreshed cookies for the next run
    if (member && JSON.stringify(getCookies()) !== cookiesBefore) {
        await saveSessionCookies(getCookies());
    }

    snapshot.courts.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    await Promise.all([
        writeSnapshot(snapshot),
        notifyDevices(newSlotsByCourt).catch((error) => console.error('push failed', error)),
    ]);
}

export { checkCourts };
