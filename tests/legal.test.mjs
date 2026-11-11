import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { openStore } from "../server/store.mjs";
import { createApp } from "../server/app.mjs";
import { business, tours } from "../server/catalog.mjs";
import {
  LEGAL_VERSION,
  cancellationRules,
  freeCancelDays,
  isLateBooking,
  preInfoText,
} from "../server/legal.mjs";

async function fixture(t) {
  const store = await openStore(":memory:"),
    password = randomBytes(32).toString("hex");
  const server = createApp(store, { env: { ADMIN_PASSWORD: password } }).listen(
    0,
    "127.0.0.1",
  );
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const base = "http://127.0.0.1:" + server.address().port;
  const req = async (path, body) => {
    const res = await fetch(base + "/api" + path, {
      ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
      headers: { "Content-Type": "application/json", "X-Rota-Client": "web" },
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  return { store, req };
}
const TR = { nationality: "TR", idNumber: "10000000146", gender: "K" },
  DE = { nationality: "DE", idNumber: "C01X00T47", gender: "E" };
const contact = {
  name: "Ayşe Yılmaz",
  email: "ayse@example.com",
  phone: "05551112233",
};

test("künye bilgileri belgelerle aynı ve katalogda yayımlanıyor", async (t) => {
  assert.equal(
    business.legalName,
    "Rota Kars Turizm Taşımacılık Seyahat Acentası Limited Şirketi",
  );
  assert.equal(business.mersis, "0735187296600001");
  assert.equal(business.taxNo, "7351872966");
  assert.equal(business.tradeRegistryNo, "8625");
  assert.equal(business.kep, "rotakarsturizm@hs01.kep.tr");
  const { req } = await fixture(t);
  const catalog = (await req("/catalog")).json;
  assert.equal(catalog.business.mersis, business.mersis);
  assert.doesNotMatch(catalog.cancellationPolicy, /güvence paketi|uçaklı/);
});

test("iptal kuralları: yurt içi 3 gün, yurt dışı 5 gün; geç iptalde kapora, gelmemede tutar kesilir", () => {
  const ani = tours.find((x) => x.id === "ani-cildir"),
    batum = tours.find((x) => x.id === "batum");
  assert.equal(freeCancelDays(ani), 3);
  assert.equal(freeCancelDays(batum), 5);
  const rules = cancellationRules(batum).join("\n");
  assert.match(rules, /5 gün \(120 saat\)/);
  assert.match(rules, /kapora \(toplam bedelin %30'u\) iade edilmez/);
  assert.match(rules, /gelmeme\) ödediğiniz tutar iade edilmez/);
  const now = Date.parse("2026-12-01T09:00:00+03:00");
  assert.equal(isLateBooking(batum, "2026-12-05", "07:00", now), true);
  assert.equal(isLateBooking(ani, "2026-12-05", "07:00", now), false);
});

test("ön bilgilendirme formu kart verisinin yolunu doğru anlatır, son dakika uyarısı verir", () => {
  const batum = tours.find((x) => x.id === "batum");
  const text = preInfoText({
    tour: batum,
    date: "2026-12-02",
    startTime: "07:00",
    customer: contact,
    passengers: [{ name: "Ayşe Yılmaz", seat: 1, nationality: "TR" }],
    unitPrice: 200000,
    count: 1,
    discount: 0,
    total: 200000,
    deposit: 60000,
    paymentMode: "deposit",
    onlinePayment: true,
    createdAt: Date.parse("2026-12-01T09:00:00+03:00"),
  });
  assert.match(text, /Vakıfbank sanal POS/);
  assert.doesNotMatch(text, /sunucumuza ulaşmaz/);
  assert.match(text, /Son dakika rezervasyonu/);
  assert.match(text, /kalan 1\.400,00 TL tur günü hareketten önce ödenir/);
  assert.match(text, /yurt dışı turdur/);
});

test("rezervasyonda ön bilgilendirme onayı kaydedilir, e-postaya eklenir; onayda sözleşme kurulur", async (t) => {
  const { req, store } = await fixture(t),
    d = (await store.listDepartures("ani-cildir"))[0];
  const preview = await req("/reservations/pre-info", {
    departureId: d.id,
    seats: [3, 4],
    ...contact,
    passengers: [
      { name: "Ayşe Yılmaz", nationality: "TR" },
      { name: "Jonas Weber", nationality: "DE" },
    ],
    paymentMode: "deposit",
  });
  assert.equal(preview.status, 200);
  assert.match(preview.json.text, /MERSİS: 0735187296600001/);
  assert.match(preview.json.text, /Jonas Weber \(DE\) · koltuk 4/);
  assert.equal(preview.json.freeCancelDays, 3);

  const hold = (await req("/holds", { departureId: d.id, seats: [3, 4] })).json;
  const body = {
    holdToken: hold.token,
    ...contact,
    passengers: ["Ayşe Yılmaz", "Jonas Weber"],
    passengerDetails: [TR, DE],
    paymentMode: "deposit",
    consent: true,
  };
  // Birden çok yolcuda başkası adına bilgi girme beyanı zorunlu.
  assert.equal((await req("/reservations", body)).status, 400);
  const created = await req("/reservations", {
    ...body,
    othersDeclaration: true,
  });
  assert.equal(created.status, 201);
  const ref = created.json.reference;

  const saved = await store.db.one("reservations", { reference: ref });
  assert.equal(saved.legal_version, LEGAL_VERSION);
  assert.equal(saved.others_declared, true);
  assert.ok(saved.pre_info_accepted_at);
  assert.match(saved.pre_info_text, new RegExp("Ön rezervasyon no: " + ref));
  const consents = (await store.db.find("consents", {}))
    .map((c) => c.type)
    .sort();
  assert.deepEqual(consents, ["kvkk_notice", "others_declaration", "pre_info"]);
  const createdMail = (await store.db.find("notification_outbox", {})).find(
    (m) => m.kind === "reservation_created",
  );
  assert.match(createdMail.body, /ÖN BİLGİLENDİRME FORMU/);

  const r = await store.workflow.get(ref);
  await store.workflow.payment(ref, {
    amount: r.deposit,
    method: "bank",
    externalReference: "DEKONT-1",
  });
  await store.workflow.confirm(ref);
  const confirmed = await store.db.one("reservations", { reference: ref });
  assert.match(confirmed.contract_text, /TUR HİZMET SÖZLEŞMESİ/);
  assert.match(confirmed.contract_text, /acente onayı/);
  assert.equal(confirmed.contract_version, LEGAL_VERSION);
  const confirmMail = (await store.db.find("notification_outbox", {})).find(
    (m) => m.kind === "reservation_confirmed",
  );
  assert.match(confirmMail.body, /TUR HİZMET SÖZLEŞMESİ/);
  assert.match(confirmMail.body, /ÖN BİLGİLENDİRME FORMU/);
});
