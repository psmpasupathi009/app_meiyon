import bcrypt from "bcryptjs";
import { PIN_LENGTH } from "@/lib/auth/constants";

export { isWeakPin } from "@/lib/auth/pin-rules";

export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;
export const BCRYPT_ROUNDS = 12;

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
