import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { openStore } from "../server/store.mjs";
import { createApp } from "../server/app.mjs";
import {
  makeVehicle,
  fleetVehicles,
  seatPlans,
} from "../server/operations.mjs";
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
  let cookie = "";
  const req = (path, body) =>
    fetch(base + "/api" + path, {
      ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
      headers: {
        "Content-Type": "application/json",
        "X-Rota-Client": "web",
        Cookie: cookie,
      },
    });
  return {
    store,
    req,
    async login() {
      const r = await req("/admin/login", { password });
      cookie = r.headers.get("set-cookie").split(";")[0];
    },
  };
}
const plan = (d, extra) => ({
  tourId: d.tour_id,
  date: d.date,
  startTime: d.start_time,
  price: d.price,
  pickup: d.pickup,
  guideName: "",
  guidePhone: "",
  vehicleModel: d.vehicle.modelId || "vip-midibus",
  passengerSeats: d.vehicle.passengerSeats,
  active: true,
  ...extra,
});
test("her aracın standart planı: numaralar 1'den satılabilir koltuğa kesintisiz, satırlar eşit genişlikte", () => {
  for (const unit of fleetVehicles) {
    const plan = seatPlans[unit.plan];
    assert.ok(plan, unit.name + " için plan yok");
    const [cockpit, ...rows] = plan;
    assert.deepEqual(
      [cockpit[0], cockpit[cockpit.length - 1]],
      ["driver", "guide"],
    );
    for (const row of rows) assert.equal(row.length, cockpit.length);
    const seats = rows.flat().filter((c) => typeof c === "number");
    const sellable = makeVehicle(
      unit.vehicleModel,
      unit.passengerSeats,
    ).sellableSeats;
    assert.deepEqual(
      seats,
      Array.from({ length: sellable }, (_, i) => i + 1),
      unit.name,
    );
  }
});
test("binek araç sınıfı koridorsuz üç arka koltuk üretir", () => {
  const car = makeVehicle("binek", 4);
  assert.equal(car.sellableSeats, 3);
  assert.deepEqual(car.layout, [
    ["driver", null, "guide"],
    [1, 2, 3],
  ]);
});
test("sefere filodan araç atanır; sınıf araçtan gelir, aynı gün çakışma engellenir, plaka halka açık değil", async (t) => {
  const { store: s, req, login } = await fixture(t),
    d = (await s.listDepartures("ani-cildir"))[0];
  assert.equal((await req("/admin/vehicles")).status, 401);
  await login();
  const fleet = await (await req("/admin/vehicles")).json();
  assert.equal(fleet.length, 7);
  assert.ok(!JSON.stringify(fleet).toLocaleLowerCase("tr").includes("özmal"));

  // Sınıf ve kapasite gönderilenden değil, seçilen araçtan alınır.
  const saved = await req(
    "/admin/departures",
    plan(d, {
      id: d.id,
      vehicleId: "36ABN916",
      vehicleModel: "coach",
      passengerSeats: 46,
    }),
  );
  assert.equal(saved.status, 200);
  const body = await saved.json();
  assert.equal(body.vehicle.modelId, "vip-midibus");
  assert.equal(body.vehicle.passengerSeats, 19);
  assert.equal(body.vehicle.sellableSeats, 18);
  assert.equal(body.vehicle.unit.plate, "36 ABN 916");
  assert.equal(body.vehicle.shape, "midibus");
  assert.deepEqual(body.vehicle.layout[1], [1, 2, null, "door"]);

  // Aynı araç aynı gün ikinci sefere atanamaz; başka araç atanabilir.
  const clash = await req(
    "/admin/departures",
    plan(d, { startTime: "15:00", vehicleId: "36ABN916" }),
  );
  assert.equal(clash.status, 409);
  const other = await req(
    "/admin/departures",
    plan(d, { startTime: "15:00", vehicleId: "36EA491" }),
  );
  assert.equal(other.status, 200);

  const pub = await (await req("/tours/ani-cildir/departures")).json();
  const mine = pub.find((x) => x.id === d.id);
  assert.equal(mine.vehicle.unit.name, "Mercedes Sprinter");
  assert.ok(!JSON.stringify(pub).includes("ABN 916"));
  assert.ok(!JSON.stringify(pub).includes("EA 491"));

  assert.equal(
    (await req("/admin/departures", plan(d, { id: d.id, vehicleId: "YOK" })))
      .status,
    400,
  );
});
