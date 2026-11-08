// İngilizce sözlük: anahtar sitedeki Türkçe metnin kendisidir. {ad} biçimindeki
// yer tutucular t() ile doldurulur. Bölümler ayrı dosyalardadır.
import { site } from "./site";
import { booking } from "./booking";
import { member } from "./member";
export const en: Record<string, string> = { ...site, ...booking, ...member };
