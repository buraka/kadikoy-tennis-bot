export const DATE_FORMAT = 'DD MMM dddd HH:mm';
export const AVAILABLE_HOUR_DATE_FORMAT = 'YYYY-MM-DDTHH:mm';
export const OLLEYY_DATE_FORMAT = 'DD.MM.YYYY';
export const DATE_FORMAT_WITHOUT_HOUR = 'DD MMM dddd';

export function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
