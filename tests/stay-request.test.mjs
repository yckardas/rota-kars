// Tur sayfasından konaklama talebi: tarih, kişi, oda tercihi ve iletişim alınır,
// talep panele düşer, müşteriye "alındı" e-postası gider; acente otelle görüşürken
// durumu "Otelle görüşülüyor → Teklif iletildi → Onaylandı / Olmadı" diye takip eder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";

async function fixture(t) {
  const store = await openStore(":memory:", { env: { AGENCY_EMAIL: "ekip@rotakars.test" } });
  const app = createApp(store, {
    env: { ADMIN_PASSWORD: "ilk-kurulum-parolasi" },
    reviewsService: { get: async () => ({ status: "not_configured", reviews: [] }) },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const root = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const call = async (path, body) => {
    const r = await fetch(root + "/api" + path, {
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      headers: { "Content-Type": "application/json", "X-Rota-Client": "web", ...(cookie ? { Cookie: cookie } : {}) },
    });
    if (path === "/admin/login") cookie = r.headers.get("set-cookie").split(";")[0];
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  return { store, call };
}
const stay = {
  kind: "hotel",
  name: "Konaklama Misafir",
  email: "misafir@example.com",
  phone: "05551112233",
  checkIn: "2027-02-01",
  checkOut: "2027-02-03",
  guests: 3,
  children: 1,
  rooms: 1,
  roomType: "triple",
  budget: "standard",
  tourId: "ani-cildir",
  notes: "Merkeze yakın olsun.",
  consent: true,
};

test("stay request from a tour page keeps room details and notifies both sides", async (t) => {
  const { store, call } = await fixture(t);
  const r = await call("/requests", stay);
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.match(r.json.reference, /^TL-/);
  const [row] = (await store.dashboard()).requests;
  assert.equal(row.kind, "hotel");
  assert.equal(row.body.tourId, "ani-cildir");
  assert.equal(row.body.roomType, "triple");
  assert.equal(row.body.children, 1);
  const outbox = await store.db.find("notification_outbox", {});
  const customer = outbox.find((m) => m.recipient === "misafir@example.com");
  assert.ok(customer, "müşteriye alındı e-postası");
  assert.match(customer.subject, /Konaklama talebi alındı \(TL-/);
  assert.match(customer.body, /Tur: Ani, Çıldır ve Kars/);
  assert.match(customer.body, /Oda: 1 × Üç kişilik/);
  assert.match(customer.body, /kesin rezervasyon değildir/);
  // Formdaki serbest metin (ad, not) müşteriye giden otomatik yanıta girmez; acente görür.
  assert.doesNotMatch(customer.body, /Merkeze yakın|Konaklama Misafir/);
  const agency = outbox.find((m) => m.recipient === "ekip@rotakars.test");
  assert.match(agency.subject, /Konaklama talebi: TL-.* · Ani, Çıldır ve Kars/);
  assert.match(agency.body, /Kişi: 3 \(1 çocuk dahil\)/);
  assert.match(agency.body, /Bütçe: Orta/);
  assert.match(agency.body, /Not: Merkeze yakın olsun\./);
  assert.match(agency.body, /Ad: Konaklama Misafir/);
});

test("request form cannot be used to flood one address: customer replies are capped per day", async (t) => {
  const { store, call } = await fixture(t);
  for (let i = 0; i < 5; i++) {
    const r = await call("/requests", { ...stay, notes: "Hesabınız askıya alındı: https://evil.example/" + i });
    assert.equal(r.status, 201, JSON.stringify(r.json));
  }
  const outbox = await store.db.find("notification_outbox", {});
  const toCustomer = outbox.filter((m) => m.recipient === "misafir@example.com");
  assert.equal(toCustomer.length, 3, "günde en fazla 3 otomatik yanıt");
  assert.ok(toCustomer.every((m) => !/evil\.example/.test(m.body)));
  assert.equal(outbox.filter((m) => m.recipient === "ekip@rotakars.test").length, 5, "acente her talebi görür");
  assert.equal((await store.dashboard()).requests.length, 5);
});

test("invalid room details are rejected", async (t) => {
  const { call } = await fixture(t);
  for (const bad of [{ roomType: "suite" }, { rooms: 0 }, { budget: "luxury" }, { tourId: "yok" }, { children: -1 }])
    assert.equal((await call("/requests", { ...stay, ...bad })).status, 400, JSON.stringify(bad));
});

test("agency tracks the hotel conversation with stay-specific status names", async (t) => {
  const { store, call } = await fixture(t);
  await call("/requests", stay);
  const [row] = (await store.dashboard()).requests;
  await call("/admin/login", { password: "ilk-kurulum-parolasi" });
  const step = await call("/admin/requests/" + row.id, { status: "in_progress" });
  assert.equal(step.status, 200, JSON.stringify(step.json));
  assert.equal(step.json.status, "in_progress");
  assert.equal(step.json.notes.at(-1).text, "Durum: Otelle görüşülüyor");
  const won = await call("/admin/requests/" + row.id, { status: "won", note: "Kars Otel, 2 gece, 4.800 TL" });
  assert.deepEqual(
    won.json.notes.map((n) => n.text),
    ["Durum: Otelle görüşülüyor", "Durum: Konaklama onaylandı", "Kars Otel, 2 gece, 4.800 TL"],
  );
  assert.equal((await call("/admin/requests/" + row.id, { status: "bogus" })).status, 400);
});

test("tour info request carries the tour name and requires a tour", async (t) => {
  const { store, call } = await fixture(t);
  const ask = {
    kind: "tour-info",
    name: "Bilgi Misafir",
    email: "bilgi@example.com",
    phone: "05551112233",
    checkIn: "2027-02-01",
    guests: 2,
    tourId: "ani-cildir",
    notes: "Fiyat nedir?",
    consent: true,
  };
  const r = await call("/requests", ask);
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const [row] = (await store.dashboard()).requests;
  assert.equal(row.kind, "tour-info");
  assert.equal(row.body.tourId, "ani-cildir");
  const outbox = await store.db.find("notification_outbox", {});
  const agency = outbox.find((m) => m.recipient === "ekip@rotakars.test");
  assert.match(agency.subject, /Tur bilgi \/ fiyat talebi: TL-.* · Ani, Çıldır ve Kars/);
  const customer = outbox.find((m) => m.recipient === "bilgi@example.com");
  assert.match(customer.subject, /Tur bilgi \/ fiyat talebi alındı/);
  assert.match(customer.body, /Tur: Ani, Çıldır ve Kars/);
  const { tourId, ...noTour } = ask;
  assert.equal((await call("/requests", noTour)).status, 400);
});

test("contact page message needs only contact details and a message", async (t) => {
  const { store, call } = await fixture(t);
  const msg = {
    kind: "message",
    name: "Mesaj Misafir",
    email: "mesaj@example.com",
    phone: "05551112233",
    notes: "Aralık sonu için 5 kişilik grup sorusu.",
    consent: true,
  };
  const r = await call("/requests", msg);
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const [row] = (await store.dashboard()).requests;
  assert.equal(row.kind, "message");
  assert.equal(row.body.checkIn, undefined);
  const outbox = await store.db.find("notification_outbox", {});
  const agency = outbox.find((m) => m.recipient === "ekip@rotakars.test");
  assert.match(agency.subject, /İletişim mesajı: TL-/);
  assert.match(agency.body, /Not: Aralık sonu için 5 kişilik grup sorusu\./);
  assert.doesNotMatch(agency.body, /Kişi:|Tarih:/);
  const customer = outbox.find((m) => m.recipient === "mesaj@example.com");
  assert.match(customer.body, /Mesajınızı aldık/);
  assert.doesNotMatch(customer.body, /kesin rezervasyon/);
  // Boş mesaj kabul edilmez.
  const empty = await call("/requests", { ...msg, notes: " " });
  assert.equal(empty.status, 400);
  assert.equal(empty.json.message, "Mesajınızı yazın.");
});

test("other request kinds still require a date and a guest count", async (t) => {
  const { call } = await fixture(t);
  const { checkIn, ...noDate } = stay;
  const a = await call("/requests", noDate);
  assert.equal(a.status, 400);
  assert.equal(a.json.message, "Bir tarih seçin.");
  const { guests, ...noGuests } = stay;
  const b = await call("/requests", noGuests);
  assert.equal(b.status, 400);
  assert.equal(b.json.message, "Kişi sayısını yazın.");
  const back = await call("/requests", { ...stay, checkOut: stay.checkIn });
  assert.equal(
    back.json.message,
    "Çıkış tarihi giriş tarihinden sonra olmalıdır.",
  );
});
