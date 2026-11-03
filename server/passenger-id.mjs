import { z } from "zod";
// Yolcu kimlik bilgileri: turizm taşımacılığında yolcu listesinin U-ETDS
// bildirimi için ad soyad, uyruk, T.C. kimlik / pasaport numarası ve cinsiyet
// gerekir. Tam numara yalnız panelde görünür; müşteriye dönen yanıtlarda maskelenir.
export function tcknValid(value) {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const d = [...value].map(Number),
    odd = d[0] + d[2] + d[4] + d[6] + d[8],
    even = d[1] + d[3] + d[5] + d[7];
  return (
    (((odd * 7 - even) % 10) + 10) % 10 === d[9] &&
    d.slice(0, 10).reduce((n, x) => n + x, 0) % 10 === d[10]
  );
}
export const passengerDetail = z
  .object({
    // Uyruk: ISO 3166-1 alfa-2 ülke kodu (U-ETDS bu kodu bekler), ör. "TR", "DE".
    nationality: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Uyruk için bir ülke seçin."),
    idNumber: z
      .string()
      .transform((s) => s.replace(/[\s-]/g, "").toUpperCase())
      .pipe(z.string().min(5).max(20)),
    gender: z.enum(["K", "E"]),
  })
  .superRefine((p, ctx) => {
    if (p.nationality === "TR") {
      if (!tcknValid(p.idNumber))
        ctx.addIssue({
          code: "custom",
          path: ["idNumber"],
          message: "Geçerli bir T.C. kimlik numarası girin.",
        });
    } else if (!/^[A-Z0-9]{5,20}$/.test(p.idNumber))
      ctx.addIssue({
        code: "custom",
        path: ["idNumber"],
        message: "Pasaport numarası yalnız harf ve rakamdan oluşmalı.",
      });
  });
// CSV ve panelde ülke kodunun Türkçe adı.
export const countryName = (code) => {
  try {
    return new Intl.DisplayNames(["tr"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
};
export const maskId = (value = "") =>
  value.length > 3 ? "•".repeat(value.length - 3) + value.slice(-3) : "•••";
export const maskDetails = (details = []) =>
  details.map((p) => ({ ...p, idNumber: maskId(p.idNumber) }));
