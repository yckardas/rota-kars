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
  const agency = outbox.find((m) => m.recipient === "ekip@rotakars.test");
  assert.match(agency.subject, /Konaklama talebi: TL-.* · Ani, Çıldır ve Kars/);
  assert.match(agency.body, /Kişi: 3 \(1 çocuk dahil\)/);
  assert.match(agency.body, /Bütçe: Orta/);
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
