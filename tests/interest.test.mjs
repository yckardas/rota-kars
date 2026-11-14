// Bekleme listesi (dolu sefer, yer açılınca herkese haber) ve talep toplama modu
// (Tiflis gibi yeterli talep olursa yapılan turlar için ücretsiz ön kayıt).
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";

const AGENT = { id: "ops-1", role: "operations", name: "Operasyon" };
async function fixture(t) {
  let now = Date.parse("2026-10-17T06:00:00Z");
  const env = { AGENCY_EMAIL: "ekip@rotakars.test", PUBLIC_BASE_URL: "https://rotakarsturizm.com" };
  const store = await openStore(":memory:", { clock: () => now, env, seed: false });
  const app = createApp(store, {
    env: { ...env, ADMIN_PASSWORD: "ilk-kurulum-parolasi" },
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
    const type = r.headers.get("content-type") || "";
    return { status: r.status, json: type.includes("json") ? await r.json() : null, text: type.includes("html") ? await r.text() : "" };
  };
  await call("/admin/login", { password: "ilk-kurulum-parolasi" });
  const departure = (tourId, extra = {}) =>
    store.departures.save({
      tourId,
      date: "2026-10-24",
      startTime: "05:00",
      pickup: "Kars",
      guideName: "",
      guidePhone: "",
      price: null,
      vehicleModel: "vip-midibus",
      passengerSeats: 18,
      active: true,
      ...extra,
    });
  const outbox = () => store.db.find("notification_outbox", {}, { sort: { created_at: 1 } });
  return { store, call, departure, outbox, advance: (ms) => (now += ms) };
}
const person = (extra = {}) => ({
  name: "Ön Kayıt Misafir",
  email: "onkayit@example.com",
  phone: "05551112233",
  count: 2,
  consent: true,
  ...extra,
});

test("Tiflis starts in demand mode: no seat sales, free pre-registration instead", async (t) => {
  const { store, call, departure, outbox } = await fixture(t);
  const tiflis = (await call("/catalog")).json.tours.find((x) => x.id === "tiflis");
  assert.equal(tiflis.mode, "demand");
  assert.equal(tiflis.demand.threshold, 14);
  assert.equal(tiflis.demand.count, undefined, "ilerleme varsayılan olarak gizli");
  assert.equal(tiflis.next, undefined);
  const d = await departure("tiflis");
  await assert.rejects(store.hold(d.id, [1]), (e) => e.status === 409, "talep toplamada koltuk satılmaz");

  const r = await call("/interest", { kind: "prereg", tourId: "tiflis", preferredDate: "Mart 2027", ...person() });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.match(r.json.reference, /^BK-/);
  // Aynı e-posta yeniden gönderirse yeni kayıt açılmaz, kişi sayısı güncellenir.
  const again = await call("/interest", { kind: "prereg", tourId: "tiflis", ...person({ count: 3 }) });
  assert.equal(again.json.updated, true);
  assert.equal(await store.interest.demandCount("tiflis"), 3);
  const mails = await outbox();
  assert.equal(mails.filter((m) => m.recipient === "onkayit@example.com").length, 1);
  assert.match(mails.find((m) => m.recipient === "onkayit@example.com").body, /ücretsiz bir ön kayıttır; ödeme alınmaz/);
  assert.match(mails.find((m) => m.recipient === "ekip@rotakars.test").subject, /Ön kayıt: Tiflis Turu · 2 kişi/);

  // Panelden ilerleme açılınca sitede sayı görünür.
  const mode = await call("/admin/operations/tiflis/mode", { mode: "demand", threshold: 10, showProgress: true });
  assert.equal(mode.status, 200, JSON.stringify(mode.json));
  const shown = (await call("/catalog")).json.tours.find((x) => x.id === "tiflis");
  assert.deepEqual(shown.demand, { threshold: 10, showProgress: true, count: 3 });
  // Online satıştaki tura ön kayıt alınmaz.
  assert.equal((await call("/interest", { kind: "prereg", tourId: "ani-cildir", ...person() })).status, 409);
});

test("opening sales notifies every pre-registered guest with a booking link", async (t) => {
  const { store, call, departure, outbox } = await fixture(t);
  await call("/interest", { kind: "prereg", tourId: "tiflis", ...person() });
  await call("/interest", { kind: "prereg", tourId: "tiflis", ...person({ email: "ikinci@example.com", count: 4 }) });
  assert.equal((await call("/admin/operations/tiflis/open-sales", {})).status, 409, "sefer olmadan satış açılmaz");
  const d = await departure("tiflis");
  const opened = await call("/admin/operations/tiflis/open-sales", {});
  assert.equal(opened.status, 200, JSON.stringify(opened.json));
  assert.equal(opened.json.notified, 2);
  const sale = (await outbox()).filter((m) => m.kind === "interest_open");
  assert.equal(sale.length, 2);
  assert.equal(sale[0].action_url, "https://rotakarsturizm.com/rezervasyon/tiflis");
  assert.match(sale[0].body, /2026-10-24 05:00/);
  assert.equal((await call("/catalog")).json.tours.find((x) => x.id === "tiflis").mode, "online");
  assert.ok(await store.hold(d.id, [1]), "satış açılınca koltuk seçilebilir");
  const list = (await call("/admin/interest")).json;
  assert.ok(list.items.every((i) => i.status === "notified"));
});

test("waitlist on a full departure: everyone waiting hears when seats free up", async (t) => {
  const { store, call, departure, outbox } = await fixture(t);
  const d = await departure("ani-cildir", { vehicleModel: "binek", passengerSeats: 4 });
  assert.equal(
    (await call("/interest", { kind: "waitlist", tourId: "ani-cildir", departureId: d.id, ...person() })).status,
    409,
    "yer varken bekleme listesi yerine rezervasyon",
  );
  const booked = await store.adminReserve(
    { departureId: d.id, seats: [1, 2, 3], name: "Dolu Grup", phone: "05550000000", passengers: ["A B", "C D", "E F"], paymentMode: "on_tour", confirm: true },
    AGENT,
  );
  const a = await call("/interest", { kind: "waitlist", tourId: "ani-cildir", departureId: d.id, ...person() });
  assert.equal(a.status, 201, JSON.stringify(a.json));
  await call("/interest", {
    kind: "waitlist",
    tourId: "ani-cildir",
    departureId: d.id,
    ...person({ email: "tek@example.com", count: 1 }),
  });
  assert.equal((await store.interest.notifyOpenings()).notified, 0, "hâlâ dolu");

  await store.workflow.cancel(booked.reference);
  const run = await store.interest.notifyOpenings();
  assert.equal(run.notified, 2, "bekleyen herkese aynı anda");
  const openings = (await outbox()).filter((m) => m.kind === "interest_opening");
  assert.equal(openings.length, 2);
  assert.equal(openings[0].action_url, "https://rotakarsturizm.com/rezervasyon/ani-cildir?date=2026-10-24");
  assert.equal((await store.interest.notifyOpenings()).notified, 0, "ikinci kez gönderilmez");
});

test("guests can leave the list from the e-mail link; KVKK export and erase include it", async (t) => {
  const { store, call } = await fixture(t);
  await call("/interest", { kind: "prereg", tourId: "tiflis", ...person() });
  const [row] = await store.interest.list();
  const left = await call(`/interest/${row.token}/cancel`);
  assert.equal(left.status, 200);
  assert.match(left.text, /Listeden çıkarıldınız/);
  assert.equal((await store.interest.list())[0].status, "cancelled");
  assert.equal(await store.interest.demandCount("tiflis"), 0);
  assert.equal((await call("/interest/" + "0".repeat(36) + "/cancel")).status, 404);

  const exported = await store.privacy.exportByEmail("onkayit@example.com");
  assert.equal(exported.waitlistAndPreRegistrations.length, 1);
  assert.equal(exported.waitlistAndPreRegistrations[0].tour, "tiflis");
  await store.privacy.eraseByEmail("onkayit@example.com");
  assert.equal((await store.interest.list()).length, 0, "silme talebinde ilgi listesi kaydı da silinir");
});
