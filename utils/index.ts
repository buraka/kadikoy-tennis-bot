import moment from 'moment';
import { ISTANBUL_UTC_OFFSET_MINUTES } from '../constants';

// Slots are stored as Istanbul wall-clock time without offset, e.g. 2026-09-28T18:00
export const SLOT_DATE_FORMAT = 'YYYY-MM-DDTHH:mm';
export const KADIKOY_DATE_FORMAT = 'DD.MM.YYYY';

export const nowInIstanbul = () => moment().utcOffset(ISTANBUL_UTC_OFFSET_MINUTES);

export function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

// Weekend or evening slots are the hard ones to get; highlighted in messages and filterable in the app
export const isPrimeTime = (slot: string) => {
    const date = moment(slot, SLOT_DATE_FORMAT);
    return date.day() === 6 || date.day() === 0 || date.hour() >= 18;
}
