export function normalizeMobile(input: string): string | null {
  const digits = input.replace(/\D/g, "");

  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91") && /^91[6-9]/.test(digits)) {
    return digits;
  }

  return null;
}

export function displayMobile(mobile91: string): string {
  return mobile91.startsWith("91") ? mobile91.slice(2) : mobile91;
}

/** Bootstrap admin mobile from `ADMIN_MOBILE` (legacy: `ADMIN_MOBILE_1`). */
export function getEnvAdminMobile(): string | null {
  return normalizeMobile(
    process.env.ADMIN_MOBILE ?? process.env.ADMIN_MOBILE_1 ?? ""
  );
}

/** True when this mobile is the env bootstrap admin (first-time setup only). */
export function isEnvAdminMobile(mobile91: string): boolean {
  const admin = getEnvAdminMobile();
  return Boolean(admin && mobile91 === admin);
}
