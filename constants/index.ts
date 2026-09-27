export const KADIKOY_BASE_URL = 'https://spor.kadikoy.bel.tr';
export const KADIKOY_RESERVATION_URL = `${KADIKOY_BASE_URL}/AnaSayfa/AnaSayfa`;

// Branch name as it appears in the "Saha Rezervasyon" tab
export const TENNIS_BRANCH_NAME = 'TENİS';

// Rezervasyon form requires an age; any adult age works
export const DEFAULT_AGE = 30;

// Kadikoy slots are in Istanbul time (UTC+3, no DST), Lambda runs in UTC
export const ISTANBUL_UTC_OFFSET_MINUTES = 180;
