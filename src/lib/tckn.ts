// T.C. kimlik numarası denetimi (sunucudaki server/passenger-id.mjs ile aynı kural).
export function tcknValid(value: string) {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const d = [...value].map(Number),
    odd = d[0] + d[2] + d[4] + d[6] + d[8],
    even = d[1] + d[3] + d[5] + d[7];
  return (
    (((odd * 7 - even) % 10) + 10) % 10 === d[9] &&
    d.slice(0, 10).reduce((n, x) => n + x, 0) % 10 === d[10]
  );
}
export const maskId = (value = "") =>
  value.length > 3 ? "•".repeat(value.length - 3) + value.slice(-3) : value;
