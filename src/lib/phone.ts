/** Builds a tel: href from a Turkish phone number such as "0545 935 34 10" or "905464802136". */
export function telHref(phone: string) {
  let digits = (phone || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = "90" + digits.slice(1);
  else if (digits.length === 10) digits = "90" + digits;
  return "tel:+" + digits;
}
/** Returns a same-site relative path from an untrusted `next` value, or null. */
export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || /[\u0000-\u001f]/.test(value)) return null;
  return value;
}
