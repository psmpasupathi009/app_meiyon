/** Cookie names — edge-safe (no Prisma / Node crypto). */
export const ACCESS_COOKIE = "meiyon_op_access";

/** Legacy refresh cookie — cleared on logout only (refresh tokens removed). */
export const LEGACY_REFRESH_COOKIE = "meiyon_op_refresh";

/** Access JWT cookie max-age (matches ACCESS_TTL in jwt.ts). */
export const ACCESS_COOKIE_MAX_AGE_SEC = 7 * 24 * 60 * 60;
