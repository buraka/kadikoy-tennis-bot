// Fetches every tennis court and prints parsed slots, without DynamoDB or push.
// LOGIN=1 logs in with the member credentials from SSM first (AWS_PROFILE=tennis).
import { getCourtSlots, getTennisCourts, login } from '../kadikoy';
import { getSecrets } from '../secrets';

(async () => {
    if (process.env.LOGIN === '1') {
        const { kadikoyTc, kadikoyPassword } = await getSecrets();
        if (!kadikoyTc || !kadikoyPassword) throw new Error('KADIKOY_TC / KADIKOY_PASSWORD missing in SSM');
        await login(kadikoyTc, kadikoyPassword);
        console.log('login ok');
    }
    const courts = await getTennisCourts();
    for (const court of courts) {
        const { slots, loggedIn } = await getCourtSlots(court);
        const count = (status: string) => slots.filter((s) => s.status === status).length;
        const days = new Set(slots.map((s) => s.date.slice(0, 10))).size;
        console.log(`${court.name}${loggedIn ? ' (uye)' : ''}: ${days} gun, ${slots.length} slot, available=${count('available')} upcoming=${count('upcoming')} sold=${count('sold')} held=${count('held')} past=${count('past')}`);
    }
})();
