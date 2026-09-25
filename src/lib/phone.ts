const PREFIX = "+880";
/** 01XXXXXXXXX minus the leading 0, so 10 digits. Landlines are 9. */
export const MAX_LOCAL_DIGITS = 10;

/** Strips the +880 prefix (and a leading 0) so a field shows only the local part. */
export function toLocalDigits(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/^\+?880/, "")
    .replace(/\D/g, "")
    .replace(/^0+/, "")
    .slice(0, MAX_LOCAL_DIGITS);
}

/** Back to what the API stores: +880 then the local digits. Empty in, empty out. */
export function toE164(localDigits: string): string {
  const digits = toLocalDigits(localDigits);
  return digits ? `${PREFIX}${digits}` : "";
}

export { PREFIX as PHONE_PREFIX };
