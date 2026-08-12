/** OTP is short-lived SMS code (4 digits from 2factor). */
export const OTP_LENGTH = 4;

/**
 * Login PIN stays 6 digits — ~1,000,000 combinations vs 10,000 for 4 digits.
 * Better for a law-foundation portal where PIN is the everyday credential.
 */
export const PIN_LENGTH = 6;
