import { PIN_LENGTH } from "@/lib/auth/constants";

const WEAK_PINS = new Set([
  "000000",
  "111111",
  "222222",
  "333333",
  "444444",
  "555555",
  "666666",
  "777777",
  "888888",
  "999999",
  "123456",
  "654321",
  "112233",
  "121212",
  "012345",
  "987654",
]);

/** Shared client + server weak-PIN rules (no Node-only deps). */
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
