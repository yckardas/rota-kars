import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
// Vakıfbank VPOS 724 + 3D Secure: MPI kayıt sorgusu -> kartı veren bankanın SMS
// sayfası (ACS) -> VPOS satış onayı (sunucudan sunucuya). Uç noktalar ve alan
// adları VPOS 724 / MPI modeline göre yazıldı; banka entegrasyon dokümanıyla
// karşılaştırılmalıdır. Adresler VAKIFBANK_MPI_URL / VAKIFBANK_VPOS_URL ile kod
// değişmeden ayarlanabilir. Ayrıntı: docs/VAKIFBANK-SANAL-POS.md
export const vakifbankEndpoints = {
  test: {
    mpi: "https://3dsecuretest.vakifbank.com.tr:4443/MPIAPI/MPI_Enrollment.aspx",
    vpos: "https://onlineodemetest.vakifbank.com.tr:4443/VposService/v3/Vposreq.aspx",
  },
  production: {
    mpi: "https://3dsecure.vakifbank.com.tr:4443/MPIAPI/MPI_Enrollment.aspx",
    vpos: "https://onlineodeme.vakifbank.com.tr:4443/VposService/v3/Vposreq.aspx",
  },
};
export const brands = { visa: "100", mastercard: "200", troy: "300" };
export function luhn(pan) {
  let sum = 0;
  for (let i = 0; i < pan.length; i++) {
    let d = Number(pan[pan.length - 1 - i]);
    if (i % 2) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return sum % 10 === 0;
}
export function cardBrand(pan) {
  if (/^4/.test(pan)) return "visa";
  const two = Number(pan.slice(0, 2)),
    four = Number(pan.slice(0, 4));
  if ((two >= 51 && two <= 55) || (four >= 2221 && four <= 2720))
    return "mastercard";
  if (/^(9792|65)/.test(pan)) return "troy";
  return null;
}
export const maskPan = (pan) => pan.slice(0, 6) + "******" + pan.slice(-4);
// Banka tutarları iki haneli ondalık metindir ("1250.50"); sitede tutarlar kuruştur.
export const bankAmount = (kurus) => (kurus / 100).toFixed(2);
// 3D dönüşünde tutar "1250.50" ya da kuruş ("125050") olarak gelebilir.
export function parseBankAmount(value) {
  if (/^\d+\.\d{2}$/.test(value)) return Math.round(Number(value) * 100);
  if (/^\d+$/.test(value)) return Number(value);
  return NaN;
}
const XML_OUT = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  "'": "&apos;",
  '"': "&quot;",
};
const XML_IN = { lt: "<", gt: ">", amp: "&", apos: "'", quot: '"' };
export const xmlEscape = (v) =>
  String(v).replace(/[<>&'"]/g, (c) => XML_OUT[c]);
export function xmlValue(xml, tag) {
  const match = new RegExp(
    `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`,
    "i",
  ).exec(xml);
  return match
    ? match[1].trim().replace(/&(lt|gt|amp|apos|quot);/g, (_, n) => XML_IN[n])
    : "";
}
export function vposXml(fields) {
  return (
    "<VposRequest>" +
    Object.entries(fields)
      .filter(([, v]) => v !== "" && v != null)
      .map(([k, v]) => `<${k}>${xmlEscape(v)}</${k}>`)
      .join("") +
    "</VposRequest>"
  );
}
// Kart bilgisi yalnız kayıt sorgusundan bankanın 3D dönüşüne kadar (birkaç dakika)
// yaşar: süreç dışına çıkmayan bir anahtarla bellekte AES-256-GCM şifreli tutulur,
// veritabanına ve loglara yazılmaz, ilk kullanımda ve 15 dakika sonra silinir.
// Sunucu yeniden başlarsa müşteri kartı yeniden girer.
export function createCardVault(ttl = 15 * 60000) {
  const key = randomBytes(32),
    items = new Map();
  const sweep = () => {
    const now = Date.now();
    for (const [id, item] of items) if (item.until < now) items.delete(id);
  };
  return {
    put(id, card) {
      sweep();
      const iv = randomBytes(12),
        cipher = createCipheriv("aes-256-gcm", key, iv),
        data = Buffer.concat([
          cipher.update(JSON.stringify(card)),
          cipher.final(),
        ]);
      items.set(id, {
        data,
        iv,
        tag: cipher.getAuthTag(),
        until: Date.now() + ttl,
      });
    },
    take(id) {
      sweep();
      const item = items.get(id);
      items.delete(id);
      if (!item) return null;
      const decipher = createDecipheriv("aes-256-gcm", key, item.iv);
      decipher.setAuthTag(item.tag);
      return JSON.parse(
        Buffer.concat([
          decipher.update(item.data),
          decipher.final(),
        ]).toString(),
      );
    },
    drop(id) {
      items.delete(id);
    },
  };
}
// Kart formundan gelen bilgiyi doğrular; hata mesajı müşteriye gösterilir.
export function parseCard(input, now = new Date()) {
  const fail = (message) => {
    const error = new Error(message);
    error.status = 400;
    throw error;
  };
  const pan = String(input?.pan ?? "").replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(pan) || !luhn(pan))
    fail("Kart numarası geçerli değil.");
  if (!cardBrand(pan)) fail("Visa, Mastercard veya Troy kartı kullanın.");
  const expiry = /^(\d{2})\s*\/\s*(\d{2}|\d{4})$/.exec(
    String(input?.expiry ?? "").trim(),
  );
  if (!expiry) fail("Son kullanma tarihini AA/YY biçiminde girin.");
  const month = expiry[1],
    year = expiry[2].length === 2 ? "20" + expiry[2] : expiry[2];
  if (Number(month) < 1 || Number(month) > 12)
    fail("Son kullanma ayı geçerli değil.");
  if (
    Number(year) * 100 + Number(month) <
    now.getFullYear() * 100 + now.getMonth() + 1
  )
    fail("Kartın son kullanma tarihi geçmiş.");
  const cvv = String(input?.cvv ?? "").trim();
  if (!/^\d{3,4}$/.test(cvv)) fail("Güvenlik kodu (CVV) geçerli değil.");
  const holder = String(input?.holder ?? "")
    .slice(0, 60)
    .replace(/[^\p{L}\s.'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (holder.length < 3) fail("Kart üzerindeki ismi girin.");
  return { holder, pan, month, year, cvv };
}
// VAKIFBANK_ENV: simulator (siteye gömülü banka, tahsilat yok) | test | production.
export function vakifbankConfig(env, origin) {
  const mode = ["test", "production"].includes(env.VAKIFBANK_ENV)
    ? env.VAKIFBANK_ENV
    : "simulator";
  const simulator = mode === "simulator";
  return {
    mode,
    simulator,
    merchantId: simulator ? "SIM000001" : env.VAKIFBANK_MERCHANT_ID || "",
    password: simulator ? "simulator" : env.VAKIFBANK_MERCHANT_PASSWORD || "",
    terminalNo: simulator ? "SIM00001" : env.VAKIFBANK_TERMINAL_NO || "",
    mpiUrl: simulator
      ? origin + "/__bank/vakifbank/mpi"
      : env.VAKIFBANK_MPI_URL || vakifbankEndpoints[mode].mpi,
    vposUrl: simulator
      ? origin + "/__bank/vakifbank/vpos"
      : env.VAKIFBANK_VPOS_URL || vakifbankEndpoints[mode].vpos,
  };
}
export function createVakifbankGateway(bank, send = fetch) {
  const post = async (url, body) => {
    const response = await send(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error("bank_http_" + response.status);
    return response.text();
  };
  const vpos = async (fields) => {
    const xml = await post(
      bank.vposUrl,
      new URLSearchParams({
        prmstr: vposXml({
          MerchantId: bank.merchantId,
          Password: bank.password,
          TerminalNo: bank.terminalNo,
          ...fields,
        }),
      }),
    );
    const resultCode = xmlValue(xml, "ResultCode");
    return {
      ok: resultCode === "0000",
      resultCode,
      resultDetail: xmlValue(xml, "ResultDetail"),
      transactionId: xmlValue(xml, "TransactionId"),
      authCode: xmlValue(xml, "AuthCode"),
      rrn: xmlValue(xml, "Rrn"),
    };
  };
  return {
    async enroll({ id, card, amount, successUrl, failureUrl }) {
      const brand = cardBrand(card.pan);
      const xml = await post(
        bank.mpiUrl,
        new URLSearchParams({
          MerchantId: bank.merchantId,
          MerchantPassword: bank.password,
          VerifyEnrollmentRequestId: id,
          Pan: card.pan,
          ExpiryDate: card.year.slice(2) + card.month,
          PurchaseAmount: bankAmount(amount),
          Currency: "949",
          BrandName: brand ? brands[brand] : "",
          SuccessUrl: successUrl,
          FailureUrl: failureUrl,
          SessionInfo: id,
        }),
      );
      return {
        status: xmlValue(xml, "Status"),
        acsUrl: xmlValue(xml, "ACSUrl"),
        paReq: xmlValue(xml, "PaReq"),
        termUrl: xmlValue(xml, "TermUrl"),
        md: xmlValue(xml, "MD"),
        error:
          xmlValue(xml, "ErrorMessage") || xmlValue(xml, "MessageErrorCode"),
      };
    },
    sale({ id, card, amount, eci, cavv, clientIp }) {
      return vpos({
        TransactionType: "Sale",
        TransactionId: id,
        CurrencyAmount: bankAmount(amount),
        CurrencyCode: "949",
        Pan: card.pan,
        Expiry: card.year + card.month,
        Cvv: card.cvv,
        CardHoldersName: card.holder,
        ECI: eci,
        CAVV: cavv,
        MpiTransactionId: id,
        OrderId: id,
        ClientIp: clientIp,
        TransactionDeviceSource: "0",
      });
    },
    // Aynı gün yapılan işlem iptal (Cancel), sonraki günler iade (Refund) edilir.
    reverse({ reference, amount, sameDay, clientIp }) {
      return vpos(
        sameDay
          ? {
              TransactionType: "Cancel",
              ReferenceTransactionId: reference,
              ClientIp: clientIp,
            }
          : {
              TransactionType: "Refund",
              ReferenceTransactionId: reference,
              CurrencyAmount: bankAmount(amount),
              CurrencyCode: "949",
              ClientIp: clientIp,
            },
      );
    },
  };
}
