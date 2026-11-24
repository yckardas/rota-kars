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
  const book = (departureId, seats, cookie = owner) =>
    call("/admin/reservations", {
      body: {
        departureId,
        seats,
        name: "Telefon Müşteri",
        phone: "05551112233",
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
  return { store, call, owner, departure, book, close, seatsOf, status, publicList };
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
