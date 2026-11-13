import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { openStore } from "../server/store.mjs";
import { createApp } from "../server/app.mjs";
import { tcknValid } from "../server/passenger-id.mjs";
import { piiCipher } from "../server/pii.mjs";
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
  const req = (path, body, method) =>
    fetch(base + "/api" + path, {
      ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
      ...(method ? { method } : {}),
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
    async member(email) {
      const r = await req("/auth/register", {
        name: "Ayşe Yılmaz",
        email,
        password: "long-test-password",
        consent: true,
      });
      cookie = r.headers.get("set-cookie").split(";")[0];
    },
  };
}
const TR = { nationality: "TR", idNumber: "10000000146", gender: "K" },
  DE = { nationality: "de", idNumber: "c01x 00t47", gender: "E" };
const booking = (token, extra) => ({
  holdToken: token,
  name: "Ayşe Yılmaz",
  email: "ayse@example.com",
  phone: "05551112233",
  passengers: ["Ayşe Yılmaz", "Jonas Weber"],
  passengerDetails: [TR, DE],
  paymentMode: "deposit",
  consents: { preInfo: true, contract: true, cancellation: true, privacy: true },
  othersDeclaration: true,
  ...extra,
});
test("T.C. kimlik numarası sağlama kuralı", () => {
  assert.equal(tcknValid("10000000146"), true);
  assert.equal(tcknValid("10000000145"), false);
  assert.equal(tcknValid("01000000146"), false);
  assert.equal(tcknValid("1000000014"), false);
});
test("tek rezervasyonda en fazla 4 koltuk", async (t) => {
  const { req, store } = await fixture(t),
    d = (await store.listDepartures("ani-cildir"))[0];
  assert.equal(
    (await req("/holds", { departureId: d.id, seats: [1, 2, 3, 4, 5] })).status,
    400,
  );
  assert.equal(
    (await req("/holds", { departureId: d.id, seats: [1, 2, 3, 4] })).status,
    201,
  );
});
test("yolcu kimlikleri zorunlu, doğrulanır, müşteriye maskeli döner, panel CSV'sinde tam yer alır", async (t) => {
  const { req, store, login } = await fixture(t),
    d = (await store.listDepartures("ani-cildir"))[0];
  const hold = await (
    await req("/holds", { departureId: d.id, seats: [3, 4] })
  ).json();

  const missing = booking(hold.token);
  delete missing.passengerDetails;
  assert.equal((await req("/reservations", missing)).status, 400);
  assert.equal(
    (
      await req(
        "/reservations",
        booking(hold.token, {
          passengerDetails: [{ ...TR, idNumber: "10000000145" }, DE],
        }),
      )
    ).status,
    400,
  );

  const created = await req("/reservations", booking(hold.token));
  assert.equal(created.status, 201);
  const r = await created.json();
  const text = JSON.stringify(r);
  assert.ok(!text.includes("10000000146"));
  assert.ok(!text.includes("C01X00T47"));
  assert.equal(r.passenger_details[0].idNumber.slice(-3), "146");
  assert.equal(r.passenger_details[1].nationality, "DE");

  const lookup = await (
    await req("/reservations/lookup", {
      reference: r.reference,
      email: "ayse@example.com",
    })
  ).json();
  assert.ok(!JSON.stringify(lookup).includes("10000000146"));

  await login();
  const csv = await (
    await req("/admin/departures/" + d.id + "/passengers.csv")
  ).text();
  assert.match(csv, /10000000146/);
  assert.match(csv, /C01X00T47/);
  assert.match(csv, /Almanya \(DE\)/);
  const list = await (
    await req("/admin/departures/" + d.id + "/passengers")
  ).json();
  assert.equal(list.bookings[0].passengerDetails[0].idNumber, "10000000146");
});

test("kimlik numaraları veritabanında şifreli durur, tur tarihinden 1 yıl sonra silinir", async (t) => {
  let now = Date.now();
  const store = await openStore(":memory:", { clock: () => now });
  t.after(() => store.db.close());
  const d = (await store.listDepartures("ani-cildir"))[0];
  const h = await store.hold(d.id, [1]);
  const r = await store.reserve({
    holdToken: h.token,
    name: "Ayşe Yılmaz",
    email: "ayse@example.com",
    phone: "05551112233",
    passengers: ["Ayşe Yılmaz"],
    passengerDetails: [TR],
    paymentMode: "deposit",
  });
  const raw = await store.db.one("reservations", { reference: r.reference });
  assert.ok(!JSON.stringify(raw).includes("10000000146"));
  assert.match(raw.passenger_details[0].idNumber, /^enc:v1:/);
  assert.equal(
    (await store.workflow.get(r.reference)).passenger_details[0].idNumber,
    "10000000146",
  );

  // Tur tarihinden 366 gün sonra numara silinir, uyruk ve cinsiyet kalır.
  now = Date.parse(d.date + "T12:00:00+03:00") + 366 * 86400000;
  const result = await store.privacy.runRetention();
  assert.equal(result.passengerIdsPurged, 1);
  const after = (await store.workflow.get(r.reference, { fresh: false }))
    .passenger_details[0];
  assert.deepEqual(after, { nationality: "TR", idNumber: "", gender: "K" });
});

test("üye yol arkadaşını kaydeder; rezervasyonda kimliğiyle seçer, numara tarayıcıya tam dönmez", async (t) => {
  const { req, store, member } = await fixture(t),
    d = (await store.listDepartures("ani-cildir"))[0];
  assert.equal((await req("/member/companions")).status, 401);
  await member("ayse@example.com");
  // Kişinin bilgisi dahilinde kaydedildiği beyanı olmadan kayıt yapılmaz.
  assert.equal(
    (await req("/member/companions", { name: "Mehmet Yılmaz", ...TR })).status,
    400,
  );
  const saved = await req("/member/companions", {
    name: "Mehmet Yılmaz",
    ...TR,
    declaration: true,
  });
  assert.equal(saved.status, 201);
  const companion = await saved.json();
  assert.equal(companion.idMasked.slice(-3), "146");
  // Aynı numara ikinci kez kaydedilmez, güncellenir.
  await req("/member/companions", { name: "Mehmet Y.", ...TR, declaration: true });
  const list = await (await req("/member/companions")).json();
  assert.equal(list.length, 1);
  assert.ok(!JSON.stringify(list).includes("10000000146"));

  const hold = await (
    await req("/holds", { departureId: d.id, seats: [5, 6] })
  ).json();
  const created = await req(
    "/reservations",
    booking(hold.token, {
      passengers: ["(kayıtlı)", "Jonas Weber"],
      passengerDetails: [{ companionId: companion.id }, DE],
    }),
  );
  assert.equal(created.status, 201);
  const r = await created.json();
  assert.equal(r.passengers[0], "Mehmet Y.");
  const full = await store.workflow.get(r.reference);
  assert.equal(full.passenger_details[0].idNumber, "10000000146");

  const exported = await (await req("/member/data-export")).json();
  assert.equal(exported.companions[0].idNumber, "10000000146");
  assert.equal(
    (await req("/member/companions/" + companion.id, undefined, "DELETE"))
      .status,
    200,
  );
  assert.equal((await (await req("/member/companions")).json()).length, 0);
});

test("üretimde şifreleme anahtarı olmadan sunucu açılmaz; anahtar 32 bayt olmalı", () => {
  assert.throws(
    () => piiCipher({ NODE_ENV: "production" }),
    /PII_ENCRYPTION_KEY/,
  );
  assert.throws(() => piiCipher({ PII_ENCRYPTION_KEY: "kisa" }), /32/);
  const c = piiCipher({
    PII_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  });
  assert.equal(c.open(c.seal("10000000146")), "10000000146");
});
