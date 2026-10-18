// İki adımlı doğrulama: RFC 6238 TOTP (Google Authenticator, Microsoft
// Authenticator, 1Password vb. ile uyumlu). 30 sn adım, 6 hane, SHA-1.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer) {
  let bits = 0,
    value = 0,
    out = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  const clean = String(text).toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0,
    value = 0;
  const out = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error("Geçersiz base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

export function hotp(secret, counter) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const offset = mac[mac.length - 1] & 15;
  const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, "0");
}

export const totpStep = (now = Date.now()) => Math.floor(now / 30000);

// Saat kaymasına karşı ±1 adım kabul edilir. Doğrulanan adım döner; aynı kodun
// tekrar kullanılmasını önlemek için çağıran taraf son adımı saklar.
export function verifyTotp(secret, code, { now = Date.now(), lastStep = -1, window = 1 } = {}) {
  if (!/^\d{6}$/.test(String(code || ""))) return null;
  const step = totpStep(now);
  for (let d = -window; d <= window; d++) {
    const s = step + d;
    if (s <= lastStep) continue;
    const expected = Buffer.from(hotp(secret, s));
    if (timingSafeEqual(expected, Buffer.from(String(code)))) return s;
  }
  return null;
}

export const otpauthUrl = (secret, account, issuer = "Rota Kars Yönetim") =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
