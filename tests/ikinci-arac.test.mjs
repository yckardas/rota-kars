// Satışa kapalı koltuklar ve sefere ek araç (2026-11-24 müşteri isteği): acenta arka
// dörtlüyü online satışa kapatır, dolan tarihe ikinci araç ekler; müşteri o tarihi tek
// satır görür ve sıradaki uygun araca yönlendirilir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";

const TOUR = "ani-cildir";
const DATE = "2027-03-10";
async function fixture(t) {
  const store = await openStore(":memory:", { seed: false });
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
  const call = async (path, { body, cookie, method } = {}) => {
    const r = await fetch(root + "/api" + path, {
      method: method || (body ? "POST" : "GET"),
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        "Content-Type": "application/json",
        "X-Rota-Client": "web",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: r.status, json, text };
  };
  const login = async (path, body, cookie) =>
    (
      await fetch(root + "/api" + path, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json", "X-Rota-Client": "web", ...(cookie ? { Cookie: cookie } : {}) },
      })
    ).headers.get("set-cookie")?.split(";")[0];
  const boot = await login("/admin/login", { password: "ilk-kurulum-parolasi" });
  const owner = await login(
    "/admin/users",
    { email: "sahip@rotakars.test", name: "Sahip", password: "sahip-parolasi-2026", role: "owner" },
    boot,
  );
  const saveDep = (extra = {}) =>
    call("/admin/departures", {
      body: {
        tourId: TOUR,
        date: DATE,
        startTime: "09:00",
        pickup: "Kars Garı",
        guideName: "Ali",
        guidePhone: "05550000000",
        vehicleModel: "vip-midibus",
        passengerSeats: 19,
        active: true,
        ...extra,
      },
      cookie: owner,
    });
  const addVehicle = async (id) => {
    const r = await call(`/admin/departures/${id}/vehicles`, { body: {}, cookie: owner });
    assert.equal(r.status, 201, r.text);
    return r.json;
  };
  const adminList = async () => (await call(`/admin/departures?tourId=${TOUR}`, { cookie: owner })).json;
  const departure = async (extra = {}) => {
    const r = await call("/admin/departures", {
      body: {
        tourId: TOUR,
        date: DATE,
        startTime: "09:00",
        pickup: "Kars Garı",
        guideName: "Ali",
        guidePhone: "05550000000",
        vehicleModel: "vip-midibus",
        passengerSeats: 19,
        active: true,
        ...extra,
      },
      cookie: owner,
    });
    assert.equal(r.status, 200, r.text);
    return r.json;
  };
  const book = (departureId, seats, cookie = owner, email) =>
    call("/admin/reservations", {
      body: {
        departureId,
        seats,
        name: "Telefon Müşteri",
        phone: "05551112233",
        ...(email ? { email } : {}),
        passengers: seats.map((n) => "Yolcu " + n),
        paymentMode: "on_tour",
        confirm: true,
      },
      cookie,
    });
  const close = (id, seats) => call(`/admin/departures/${id}/closed-seats`, { body: { seats }, cookie: owner });
  const seatsOf = async (id, admin = false) =>
    (await call(admin ? `/admin/departures/${id}/seats` : `/departures/${id}/seats`, admin ? { cookie: owner } : {})).json.seats;
  const status = (seats, n) => seats.find((s) => s.number === n).status;
  const publicList = async () => (await call(`/tours/${TOUR}/departures`)).json;
  return { store, call, owner, departure, saveDep, addVehicle, adminList, book, close, seatsOf, status, publicList };
}

test("closed seats look occupied online, closed to the agent, and are not sold online", async (t) => {
  const { call, departure, book, close, seatsOf, status, publicList } = await fixture(t);
  const d = await departure();
  const closed = await close(d.id, [15, 16, 17, 18]);
  assert.equal(closed.status, 200, closed.text);
  const pub = await call(`/departures/${d.id}/seats`);
  assert.doesNotMatch(pub.text, /closed/);
  for (const n of [15, 16, 17, 18]) {
    assert.equal(status(pub.json.seats, n), "occupied");
    assert.equal(status(await seatsOf(d.id, true), n), "closed");
  }
  const row = (await publicList()).find((x) => x.date === DATE);
  assert.equal(row.available, 14);
  assert.doesNotMatch(JSON.stringify(row), /closed/);
  const hold = await call("/holds", { body: { departureId: d.id, seats: [15] } });
  assert.equal(hold.status, 409);
  assert.match(hold.json.message, /satışa kapalı/);
  assert.equal((await call("/holds", { body: { departureId: d.id, seats: [1] } })).status, 201);
  const agent = await book(d.id, [15]);
  assert.equal(agent.status, 201, agent.text);
});

test("a cancelled booking on a closed seat returns it to closed", async (t) => {
  const { store, departure, book, close, seatsOf, status, publicList } = await fixture(t);
  const d = await departure();
  await close(d.id, [15]);
  const r = await book(d.id, [15]);
  assert.equal(status(await seatsOf(d.id, true), 15), "occupied");
  await store.workflow.cancel(r.json.reference);
  assert.equal(status(await seatsOf(d.id, true), 15), "closed");
  assert.equal(status(await seatsOf(d.id), 15), "occupied");
  assert.equal((await publicList()).find((x) => x.date === DATE).available, 17);
});

test("closing a sold seat is refused; changing the vehicle drops closed seats beyond capacity", async (t) => {
  const { departure, book, close } = await fixture(t);
  const d = await departure();
  await book(d.id, [3]);
  const sold = await close(d.id, [3]);
  assert.equal(sold.status, 409);
  assert.match(sold.json.message, /dolu/);
  assert.equal((await close(d.id, [99])).status, 400);
  assert.equal((await close(d.id, [17, 18])).status, 200);
  // Kayıtlı yolcu olan seferde araç değişmez; kayıtsız yeni sefer üzerinde dene.
  const e = await departure({ startTime: "14:00" });
  await close(e.id, [17, 18]);
  const changed = await departure({ id: e.id, startTime: "14:00", vehicleModel: "vip-minibus", passengerSeats: 9 });
  assert.deepEqual(changed.closed_seats, []);
});

test("overview does not count closed seats as booked", async (t) => {
  const { call, owner, departure, book, close } = await fixture(t);
  const soon = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const d = await departure({ date: soon });
  await close(d.id, [15, 16, 17, 18]);
  await book(d.id, [1, 2]);
  const week = (await call("/admin/overview", { cookie: owner })).json.week;
  assert.equal(week.booked, 2);
  assert.equal(week.capacity, 18);
});

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

test("added vehicle copies the shared plan and the date shows once", async (t) => {
  const { departure, addVehicle, book, publicList } = await fixture(t);
  const v1 = await departure({ vehicleId: "36ABN916" });
  const v2 = await addVehicle(v1.id);
  assert.equal(v2.vehicle_no, 2);
  assert.equal(v2.group_id, v1.id);
  assert.equal(v2.vehicle_id, "");
  assert.equal(v2.guide_name, "");
  assert.deepEqual([v2.date, v2.start_time, v2.price, v2.pickup], [v1.date, v1.start_time, v1.price, v1.pickup]);
  assert.equal(v2.vehicle.passengerSeats, 19);
  let rows = (await publicList()).filter((x) => x.date === DATE);
  assert.equal(rows.length, 1, "aynı tarih tek satır");
  assert.equal(rows[0].id, v1.id);
  assert.equal(rows[0].available, 36);
  assert.deepEqual(rows[0].vehicles, [
    { id: v1.id, available: 18 },
    { id: v2.id, available: 18 },
  ]);
  assert.doesNotMatch(JSON.stringify(rows[0]), /"plate"/);
  assert.equal((await book(v1.id, range(1, 18))).status, 201);
  rows = (await publicList()).filter((x) => x.date === DATE);
  assert.equal(rows[0].id, v2.id);
  assert.equal(rows[0].available, 18);
});

test("online holds fill vehicle 1 first; agents are exempt", async (t) => {
  const { call, departure, addVehicle, book } = await fixture(t);
  const v1 = await departure();
  const v2 = await addVehicle(v1.id);
  await book(v1.id, range(1, 16));
  const early = await call("/holds", { body: { departureId: v2.id, seats: [1] } });
  assert.equal(early.status, 409);
  assert.match(early.json.message, /Önce diğer araç/);
  assert.equal((await call("/holds", { body: { departureId: v2.id, seats: [1, 2, 3] } })).status, 201, "3 kişi 1. araca sığmaz");
  assert.equal((await book(v2.id, [5])).status, 201);
});

test("vehicle 2 alone is listed when vehicle 1 is inactive", async (t) => {
  const { departure, addVehicle, publicList } = await fixture(t);
  const v1 = await departure();
  const v2 = await addVehicle(v1.id);
  await departure({ id: v1.id, active: false });
  const row = (await publicList()).find((x) => x.date === DATE);
  assert.equal(row.id, v2.id);
  assert.deepEqual(row.vehicles, [{ id: v2.id, available: 18 }]);
});

test("shared fields sync across the group and respect locks on any vehicle", async (t) => {
  const { call, owner, departure, saveDep, addVehicle, adminList, book } = await fixture(t);
  const v1 = await departure();
  const v2 = await addVehicle(v1.id);
  await departure({ id: v1.id, startTime: "07:00", pickup: "Otel" });
  let second = (await adminList()).find((x) => x.id === v2.id);
  assert.equal(second.start_time, "07:00");
  assert.equal(second.pickup, "Otel");
  assert.equal(second.guide_name, "", "rehber araca özel");
  await book(v2.id, [1]);
  const moved = await saveDep({ id: v1.id, startTime: "07:00", date: "2027-03-11" });
  assert.equal(moved.status, 409, "2. araçta kayıt varken ortak tarih değişmez");
  const twin = await saveDep({ startTime: "07:00" });
  assert.equal(twin.status, 409);
  assert.match(twin.json.message, /Araç ekle/);
  assert.equal((await saveDep({ startTime: "15:00" })).status, 200, "aynı gün farklı saat ayrı sefer");
  const v3 = await addVehicle(v2.id);
  assert.equal(v3.vehicle_no, 3);
  assert.equal(v3.group_id, v1.id);
  const first = await call(`/admin/departures/${v1.id}`, { method: "DELETE", cookie: owner });
  assert.equal(first.status, 409);
  assert.match(first.json.message, /diğer araçları/);
  assert.equal((await call(`/admin/departures/${v3.id}`, { method: "DELETE", cookie: owner })).status, 200);
  second = (await adminList()).find((x) => x.id === v2.id);
  assert.equal(second.vehicle_no, 2);
});

test("waitlist hears about an added vehicle", async (t) => {
  const { store, call, departure, addVehicle, book } = await fixture(t);
  const v1 = await departure();
  await book(v1.id, range(1, 18));
  const wait = await call("/interest", {
    body: {
      kind: "waitlist",
      tourId: TOUR,
      departureId: v1.id,
      count: 2,
      name: "Bekleyen Misafir",
      email: "bekleyen@example.com",
      phone: "05551112233",
      consent: true,
    },
  });
  assert.equal(wait.status, 201, wait.text);
  assert.equal((await store.interest.notifyOpenings()).notified, 0);
  const v2 = await addVehicle(v1.id);
  assert.equal((await store.interest.notifyOpenings()).notified, 1);
  const mail = await store.db.one("notification_outbox", { kind: "interest_opening" });
  assert.ok(mail);
  // 2. araç numarasıyla açılan sayfadan bekleme listesine yazılan da gruba bağlanır.
  await book(v2.id, range(1, 18));
  const late = await call("/interest", {
    body: { kind: "waitlist", tourId: TOUR, departureId: v2.id, count: 1, name: "Geç Gelen", email: "gec@example.com", phone: "05551112233", consent: true },
  });
  assert.equal(late.status, 201, late.text);
  assert.equal((await store.db.one("interest_list", { email: "gec@example.com" })).departure_id, v1.id);
});

test("a shared pickup change emails every vehicle's customers; a guide change only its own", async (t) => {
  const { store, departure, addVehicle, book } = await fixture(t);
  const v1 = await departure();
  const v2 = await addVehicle(v1.id);
  await book(v1.id, [1], undefined, "birinci@example.com");
  await book(v2.id, [1], undefined, "ikinci@example.com");
  const mails = async () =>
    (await store.db.find("notification_outbox", { kind: "pickup_updated" })).map((m) => m.recipient || m.email).sort();
  await departure({ id: v1.id, pickup: "Kars Garı önü" });
  assert.deepEqual(await mails(), ["birinci@example.com", "ikinci@example.com"]);
  await departure({ id: v2.id, pickup: "Kars Garı önü", guideName: "Veli" });
  assert.deepEqual(await mails(), ["birinci@example.com", "ikinci@example.com", "ikinci@example.com"]);
});

test("the same-date check also sees old departures saved without a start time", async (t) => {
  const { store, saveDep } = await fixture(t);
  await store.db.insert("departures", "eski-kayit", {
    id: "eski-kayit",
    tour_id: TOUR,
    date: DATE,
    price: null,
    active: 1,
    vehicle_model: "vip-midibus",
    passenger_seats: 19,
  });
  const shown = (await store.departures.list({ tourId: TOUR, date: DATE }))[0].start_time;
  const twin = await saveDep({ startTime: shown });
  assert.equal(twin.status, 409, twin.text);
});
