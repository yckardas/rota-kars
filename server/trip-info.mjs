// Rezervasyonda müşterinin yazdığı yolculuk bilgileri: alınış yeri (otel adı ya da adres),
// çocuklar (yaşlar, çocuk koltuğu) ve serbest not. Hepsi isteğe bağlıdır ve fiyatı
// değiştirmez; acente operasyonu için alınır.
//
// Kişisel veri: alınış yeri ve not veritabanında kimlik numaraları gibi şifreli
// (server/pii.mjs) tutulur. Tur tarihinden sonra saklama işi bunları siler
// (server/privacy.mjs), anonimleştirmede de temizlenir.
import { z } from "zod";

export const PICKUP_MAX = 200;
export const CHILD_AGES_MAX = 60;
export const NOTE_MAX = 500;

// Kontrol karakterleri atılır; tek satırlık alanlarda satır sonu boşluğa döner.
const tidy = (s, { multiline = false } = {}) =>
  (multiline
    ? String(s)
        .replace(/\r\n?/g, "\n")
        .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
    : String(s).replace(/[\u0000-\u001f\u007f]+/g, " ")
  )
    .replace(/[ \t]{2,}/g, " ")
    .trim();
const text = (max, message, options) =>
  z
    .string()
    .max(max * 2)
    .transform((s) => tidy(s, options))
    .refine((s) => s.length <= max, { message });

export const pickupAddressSchema = text(
  PICKUP_MAX,
  `Alınış yeri en fazla ${PICKUP_MAX} karakter olabilir.`,
);
export const tripInfoSchema = {
  pickupAddress: pickupAddressSchema.default(""),
  // Yalnız "yanımızda çocuk var" işaretlenince gönderilir.
  children: z
    .object({
      ages: text(
        CHILD_AGES_MAX,
        `Çocuk yaşları en fazla ${CHILD_AGES_MAX} karakter olabilir.`,
      ).default(""),
      seat: z.boolean().default(false),
    })
    .strict()
    .nullable()
    .optional(),
  note: text(NOTE_MAX, `Not en fazla ${NOTE_MAX} karakter olabilir.`, {
    multiline: true,
  }).default(""),
};

// Kayda yazılan alanlar (şifreleme çağıran tarafta yapılır).
export const childrenRecord = (children) =>
  children ? { ages: children.ages || "", seat: Boolean(children.seat) } : null;

// "yaşları 4 ve 9 · çocuk koltuğu gerekiyor"
export function childrenDetail(children) {
  if (!children) return "";
  return [
    children.ages ? `yaşları ${children.ages}` : "yaş belirtilmedi",
    children.seat && "çocuk koltuğu gerekiyor",
  ]
    .filter(Boolean)
    .join(" · ");
}
export const childrenLine = (children) =>
  children ? `Çocuk: ${childrenDetail(children)}` : "";

// E-posta ve bildirimler için okunur satırlar. customer: müşteriye giden metin.
export function tripInfoLines(r, { customer = false } = {}) {
  return [
    r.pickup_address && `Alınış yeri: ${r.pickup_address}`,
    childrenLine(r.children),
    r.customer_note &&
      `${customer ? "Notunuz" : "Müşteri notu"}: ${r.customer_note}`,
  ].filter(Boolean);
}
