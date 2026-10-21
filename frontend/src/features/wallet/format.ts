/** "1234.5" -> "₹1,234.50". Works on the decimal string so no float rounding is involved. */
export function formatInr(value: string | number): string {
  const [whole, fraction = ""] = String(value).replace("-", "").split(".");
  const grouped = new Intl.NumberFormat("en-IN").format(Number(whole));
  const sign = String(value).startsWith("-") ? "-" : "";
  return `${sign}₹${grouped}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** True when the string is a positive amount with at most 2 decimals, up to 99,999,999.99. */
export function isValidAmount(text: string): boolean {
  return /^\d{1,8}(\.\d{1,2})?$/.test(text) && Number(text) > 0;
}

/** Keeps one idempotency key until the request succeeds, so a retry cannot apply twice. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
