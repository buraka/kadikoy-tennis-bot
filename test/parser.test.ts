import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';
import { isLoggedInPage, parseSlots, Slot } from '../kadikoy';
import { buildMessage } from '../notifications';
import { isPrimeTime } from '../utils';

// Real pages captured 2026-09-27: anonymous view (current week) and member view (2 weeks)
const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');
const countBy = (slots: Slot[]) => slots.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
}, {});

test('anonymous page shows only the current week', () => {
    const html = fixture('anonymous-week1.html');
    const slots = parseSlots(html);
    assert.equal(new Set(slots.map((s) => s.date.slice(0, 10))).size, 7);
    assert.deepEqual(countBy(slots), { sold: 90, past: 1 });
    assert.equal(isLoggedInPage(html), false);
});

test('member page shows two weeks with bookable and not-yet-open slots', () => {
    const slots = parseSlots(fixture('member-week2.html'));
    const days = [...new Set(slots.map((s) => s.date.slice(0, 10)))];
    assert.equal(days.length, 14);
    assert.equal(days[0], '2026-09-21');
    assert.equal(days[13], '2026-10-04');
    // "Sepete eklenebilir" = available; "Gelecek seansları satın alamazsınız" = upcoming, not bookable
    assert.deepEqual(countBy(slots), { sold: 133, past: 5, available: 37, upcoming: 7 });
    assert.ok(slots.some((s) => s.date === '2026-09-28T13:00' && s.status === 'available'));
});

test('prime time is weekend or from 18:00', () => {
    assert.equal(isPrimeTime('2026-10-03T10:00'), true); // Saturday
    assert.equal(isPrimeTime('2026-10-04T08:00'), true); // Sunday
    assert.equal(isPrimeTime('2026-10-02T17:00'), false); // Friday afternoon
    assert.equal(isPrimeTime('2026-09-30T18:00'), true); // weekday evening
});

test('push message respects court and prime filters', () => {
    const court = (key: string, name: string) => ({ key, name, branchId: 'branch', facilityId: `facility-${key}` });
    const newSlots = [
        { court: court('k1', 'KALAMIŞ SPOR MERKEZİ - TENİS KORTU 1'), slots: ['2026-09-29T09:00', '2026-10-03T10:00'] },
        { court: court('k2', 'ÖZGÜRLÜK PARKI SPOR MERKEZİ - TENİS KORTU'), slots: ['2026-09-30T19:00'] },
    ];
    const device = { token: 't', environment: 'sandbox' as const, courts: [] as string[], primeOnly: false };

    const all = buildMessage(device, newSlots)!;
    assert.equal(all.title, '3 boş kort slotu açıldı');
    assert.match(all.body, /^Kalamış 1 · 29 Eyl Sal 09:00/);
    assert.deepEqual(all.court, { b: 'branch', t: 'facility-k1', s: 'k1' });

    const onlyOzgurluk = buildMessage({ ...device, courts: ['k2'] }, newSlots)!;
    assert.equal(onlyOzgurluk.body, 'Özgürlük · 30 Eyl Çar 19:00');
    assert.equal(onlyOzgurluk.court.s, 'k2');

    const prime = buildMessage({ ...device, primeOnly: true }, newSlots)!;
    assert.equal(prime.title, '2 boş kort slotu açıldı');

    assert.equal(buildMessage({ ...device, courts: ['k1'], primeOnly: true }, [newSlots[0]])?.body, 'Kalamış 1 · 03 Eki Cmt 10:00');
    assert.equal(buildMessage({ ...device, courts: ['k2'] }, [newSlots[0]]), undefined);
});
