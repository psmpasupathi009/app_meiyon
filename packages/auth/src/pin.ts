import bcrypt from "bcryptjs";
import { PIN_LENGTH, BCRYPT_ROUNDS, PIN_MAX_ATTEMPTS, PIN_LOCK_MINUTES } from "./constants";

export { PIN_MAX_ATTEMPTS, PIN_LOCK_MINUTES };

const WEAK_PINS = new Set([
  "000000", "111111", "222222", "333333", "444444", "555555",
  "666666", "777777", "888888", "999999", "123456", "654321",
  "112233", "121212", "012345", "987654",
]);

export function isWeakPin(pin: string): boolean {
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) return true;
  if (WEAK_PINS.has(pin)) return true;
  let ascending = true;
  let descending = true;
  for (let i = 1; i < pin.length; i++) {
    if (Number(pin[i]) !== Number(pin[i - 1]) + 1) ascending = false;
    if (Number(pin[i]) !== Number(pin[i - 1]) - 1) descending = false;
  }
  return ascending || descending;
}

export async function hashPin(pin: string): Promise<string> {
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) {
    throw new Error("Invalid PIN length");
  }
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

export async function verifyPin(pin: string, pinHash: string): Promise<boolean> {
  return bcrypt.compare(pin, pinHash);
}

export function isPinLocked(pinLockedUntil?: Date | null): boolean {
  if (!pinLockedUntil) return false;
  return pinLockedUntil.getTime() > Date.now();
}

export function pinLockRetryAfterSec(pinLockedUntil?: Date | null): number {
  if (!pinLockedUntil) return 0;
  return Math.max(1, Math.ceil((pinLockedUntil.getTime() - Date.now()) / 1000));
}
