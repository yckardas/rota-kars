import express from "express";
import { randomBytes } from "node:crypto";
import { bankAmount, xmlValue } from "./vakifbank.mjs";
// Vakıfbank MPI, kartı veren bankanın 3D sayfası (ACS) ve VPOS için yerel taklit.
// Yalnız PAYMENT_PROVIDER=vakifbank + VAKIFBANK_ENV=simulator iken açılır; üretimde
// PAYMENT_ALLOW_TEST=1 olmadan açılamaz. Banka test bilgilerini vermeden tüm ödeme
// akışını uçtan uca denemeye ve bankaya göstermeye yarar. Tahsilat yapmaz.
// Kartlar: Luhn'a uygun her Visa/Mastercard/Troy başarılı olur; 0002 ile biten kart
// satışta reddedilir; 4000 0000 0000 0101 3D Secure'a kayıtlı değildir.
const esc = (v) =>
  String(v ?? "").replace(
    /[<>&'"]/g,
    (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&#39;", '"': "&quot;" })[
        c
      ],
  );
export const NOT_ENROLLED_CARD = "4000000000000101";
const page = (title, body) =>
  `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="only light"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#eef1f6;margin:0;display:grid;place-items:center;min-height:100vh;color:#14213d}.box{background:#fff;border-radius:14px;box-shadow:0 10px 40px #0002;padding:28px;max-width:380px;width:calc(100% - 32px)}.sim{background:#ffe8a3;color:#5c4300;font-size:13px;font-weight:700;padding:8px 12px;border-radius:8px;margin-bottom:16px}.bank{font-weight:800;font-size:20px;color:#b8860b;margin-bottom:6px}dl{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:14px}dt{color:#667}dd{margin:0}input{width:100%;box-sizing:border-box;font-size:20px;letter-spacing:6px;text-align:center;padding:10px;border:1px solid #ccd;border-radius:8px;margin:10px 0}button{width:100%;padding:12px;border:0;border-radius:8px;font-size:16px;font-weight:700;margin-top:8px;cursor:pointer}.ok{background:#14532d;color:#fff}.no{background:#e5e7eb}</style></head><body><div class="box">${body}</div><script src="/payment-autosubmit.js"></script></body></html>`;
const hidden = (fields) =>
  Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("");
const decode = (paReq) => {
  try {
    return JSON.parse(Buffer.from(String(paReq), "base64url").toString("utf8"));
  } catch {
    return null;
  }
};
function mpi(form) {
  const id = form.get("VerifyEnrollmentRequestId") || "",
    pan = form.get("Pan") || "";
  if (pan === NOT_ENROLLED_CARD)
    return "<IPaySecure><Message><VERes><Status>N</Status></VERes></Message></IPaySecure>";
  const paReq = Buffer.from(
    JSON.stringify({
      id,
      amount: form.get("PurchaseAmount"),
      success: form.get("SuccessUrl"),
      failure: form.get("FailureUrl"),
      merchant: form.get("MerchantId"),
      brand: form.get("BrandName"),
      last4: pan.slice(-4),
    }),
  ).toString("base64url");
  return `<IPaySecure><Message ID="${esc(id)}"><VERes><Status>Y</Status><PaReq>${paReq}</PaReq><TermUrl>${esc(form.get("SuccessUrl"))}</TermUrl><MD>${esc(id)}</MD><ACSUrl>/__bank/vakifbank/acs</ACSUrl></VERes></Message><VerifyEnrollmentRequestId>${esc(id)}</VerifyEnrollmentRequestId></IPaySecure>`;
}
function vpos(form) {
  const xml = form.get("prmstr") || "",
    type = xmlValue(xml, "TransactionType"),
    declined = type === "Sale" && xmlValue(xml, "Pan").endsWith("0002"),
    amount = xmlValue(xml, "CurrencyAmount") || bankAmount(0);
  return `<VposResponse><MerchantId>${esc(xmlValue(xml, "MerchantId"))}</MerchantId><TransactionType>${esc(type)}</TransactionType><TransactionId>${declined ? "" : "SIM" + randomBytes(8).toString("hex").toUpperCase()}</TransactionId><ResultCode>${declined ? "0051" : "0000"}</ResultCode><ResultDetail>${declined ? "Yetersiz bakiye (simülasyon)" : "İşlem başarılı (simülasyon)"}</ResultDetail><AuthCode>${declined ? "" : String(100000 + Math.floor(Math.random() * 900000))}</AuthCode><Rrn>${declined ? "" : randomBytes(6).toString("hex")}</Rrn><CurrencyAmount>${esc(amount)}</CurrencyAmount></VposResponse>`;
}
// Sunucudan bankaya giden MPI/VPOS istekleri HTTP'ye çıkmadan burada yanıtlanır.
export function simulatorFetch(url, { body } = {}) {
  const form = new URLSearchParams(String(body ?? "")),
    path = new URL(url, "http://simulator.invalid").pathname,
    xml =
      path === "/__bank/vakifbank/mpi"
        ? mpi(form)
        : path === "/__bank/vakifbank/vpos"
          ? vpos(form)
          : null;
  return Promise.resolve(
    xml === null
      ? new Response("not found", { status: 404 })
      : new Response(xml, { headers: { "Content-Type": "application/xml" } }),
  );
}
// Tarayıcının geçtiği 3D Secure sayfası (kartı veren bankanın SMS adımı).
export function attachBankSimulator(
  app,
  { merchantName = "Rota Kars Turizm" } = {},
) {
  const form = express.urlencoded({ extended: false, limit: "16kb" });
  const send = (r, html) =>
    r
      .set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex" })
      .type("html")
      .send(html);
  app.post("/__bank/vakifbank/acs", form, (q, r) => {
    const req = decode(q.body?.PaReq);
    if (!req) return send(r.status(400), page("Hata", "Geçersiz istek."));
    send(
      r,
      page(
        "VakıfBank 3D Secure",
        `<div class="sim">SİMÜLASYON · Gerçek banka sayfası değildir</div><div class="bank">VakıfBank 3D Secure</div><dl><dt>İşyeri</dt><dd>${esc(merchantName)}</dd><dt>Tutar</dt><dd>${esc(req.amount)} TL</dd><dt>Kart</dt><dd>**** ${esc(req.last4)}</dd></dl><form method="post" action="/__bank/vakifbank/acs/complete">${hidden({ PaReq: q.body.PaReq })}<label>SMS doğrulama kodu<input name="code" value="123456" inputmode="numeric" maxlength="6"></label><button class="ok" name="decision" value="Y">Onayla</button><button class="no" name="decision" value="N">İptal et</button></form>`,
      ),
    );
  });
  app.post("/__bank/vakifbank/acs/complete", form, (q, r) => {
    const req = decode(q.body?.PaReq);
    if (!req) return send(r.status(400), page("Hata", "Geçersiz istek."));
    const approved = q.body.decision === "Y";
    const fields = {
      Status: approved ? "Y" : "N",
      MerchantId: req.merchant,
      VerifyEnrollmentRequestId: req.id,
      SessionInfo: req.id,
      PurchAmount: req.amount,
      PurchCurrency: "949",
      // Kartı veren bankanın tam doğrulama ECI'si: Mastercard 02, Visa/Troy 05.
      Eci: approved ? (req.brand === "200" ? "02" : "05") : "07",
      Cavv: approved ? randomBytes(20).toString("base64") : "",
      ErrorCode: approved ? "" : "2001",
    };
    send(
      r,
      page(
        "Yönlendiriliyor",
        `<div class="sim">SİMÜLASYON</div><form method="post" action="${esc(approved ? req.success : req.failure)}" data-autosubmit><p>İşyerine dönülüyor…</p>${hidden(fields)}<button class="ok">Devam</button></form>`,
      ),
    );
  });
}
