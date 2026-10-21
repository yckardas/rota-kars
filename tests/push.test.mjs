import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";
import { createReviewWatch } from "../server/review-watch.mjs";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SERVICE_ACCOUNT = JSON.stringify({
  project_id: "rota-test",
  client_email: "push@rota-test.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
});
const TOKEN = (n) => "fcm-token-" + String(n).padStart(24, "0");

// Firebase'i taklit eder: yetki JWT'sinin imzasını doğrular, gönderilen mesajları kaydeder.
function fakeFirebase({ dead = [] } = {}) {
  const sent = [];
  const fetchImpl = async (url, options) => {
    if (url === "https://oauth2.googleapis.com/token") {
      const [h, p, sig] = options.body.get("assertion").split(".");
      assert.ok(createVerify("RSA-SHA256").update(h + "." + p).verify(publicKey, sig, "base64url"));
      assert.equal(JSON.parse(Buffer.from(p, "base64url")).scope, "https://www.googleapis.com/auth/firebase.messaging");
      return { ok: true, status: 200, json: async () => ({ access_token: "fcm-access", expires_in: 3600 }) };
    }
    assert.equal(url, "https://fcm.googleapis.com/v1/projects/rota-test/messages:send");
    assert.equal(options.headers.Authorization, "Bearer fcm-access");
    const { message } = JSON.parse(options.body);
    if (dead.includes(message.token))
      return { ok: false, status: 404, json: async () => ({ error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } }) };
    sent.push(message);
    return { ok: true, status: 200, json: async () => ({ name: "projects/rota-test/messages/1" }) };
  };
  return { sent, fetchImpl };
}

const addAdmin = (store, id, role, extra = {}) =>
  store.db.insert("admin_users", id, { id, email: id + "@rotakars.test", name: id, role, disabled: false, ...extra });

test("push: agency events reach owner/operations phones once, never guides; dead tokens are dropped", async (t) => {
  const firebase = fakeFirebase({ dead: [TOKEN(9)] });
  const store = await openStore(":memory:", { env: { FIREBASE_SERVICE_ACCOUNT: SERVICE_ACCOUNT }, pushFetch: firebase.fetchImpl });
  t.after(() => store.db.close());
  assert.equal(store.push.enabled, true);
  await addAdmin(store, "owner1", "owner");
  await addAdmin(store, "ops1", "operations");
  await addAdmin(store, "guide1", "guide");
  await addAdmin(store, "old1", "operations", { disabled: true });
  await store.push.register("owner1", { token: TOKEN(1) });
  await store.push.register("ops1", { token: TOKEN(2) });
  await store.push.register("guide1", { token: TOKEN(3) });
  await store.push.register("old1", { token: TOKEN(4) });
  await store.push.register("ops1", { token: TOKEN(9) });

  // Talep işlem içinde oluşur; bildirim işlem bittikten sonra gider.
  await store.request("private-tour", { name: "Test Yolcu", email: "t@example.com", phone: "05551112233", guests: 2 });
  const tokens = firebase.sent.map((m) => m.token).sort();
  assert.deepEqual(tokens, [TOKEN(1), TOKEN(2)]);
  assert.match(firebase.sent[0].notification.title, /Özel tur talebi/);
  assert.equal(firebase.sent[0].data.url, "/yonetim");
  assert.equal(await store.db.count("push_devices", { _id: { $exists: true } }), 4, "ölü token silindi");

  // Aynı olay ikinci kez bildirilmez.
  const before = firebase.sent.length;
  await store.notifications.notifyAgency({ subject: "X", body: "a\nb", kind: "k", dedupeKey: "same" });
  await store.notifications.notifyAgency({ subject: "X", body: "a\nb", kind: "k", dedupeKey: "same" });
  assert.equal(firebase.sent.length - before, 2, "iki cihaz, tek olay");

  // Aynı telefon başka yöneticiyle giriş yaparsa eski hesaba bildirim gitmez.
  await store.push.register("guide1", { token: TOKEN(1) });
  assert.deepEqual((await store.push.devices("owner1")).length, 0);
});

test("push: without Firebase config nothing is sent and bookings are unaffected", async (t) => {
  const store = await openStore(":memory:", { env: {}, pushFetch: async () => assert.fail("fetch çağrılmamalı") });
  t.after(() => store.db.close());
  assert.equal(store.push.enabled, false);
  await store.request("vehicle", { name: "Test Yolcu", email: "t@example.com", phone: "05551112233", guests: 2 });
});

test("HTTP: device registration needs a real owner/operations account", async (t) => {
  const firebase = fakeFirebase();
  const store = await openStore(":memory:", { env: { FIREBASE_SERVICE_ACCOUNT: SERVICE_ACCOUNT }, pushFetch: firebase.fetchImpl });
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
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path, { body, cookie } = {}) => {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      headers: { "Content-Type": "application/json", "X-Rota-Client": "web", ...(cookie ? { Cookie: cookie } : {}) },
    });
    return { status: r.status, json: await r.json().catch(() => null), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  assert.equal((await call("/admin/devices", { body: { token: TOKEN(1) } })).status, 401);
  const boot = (await call("/admin/login", { body: { password: "ilk-kurulum-parolasi" } })).cookie;
  assert.equal((await call("/admin/devices", { body: { token: TOKEN(1) }, cookie: boot })).status, 403);
  const owner = (
    await call("/admin/users", {
      body: { email: "sahip@rotakars.test", name: "Sahip", password: "sahip-parolasi-2026", role: "owner" },
      cookie: boot,
    })
  ).cookie;
  assert.equal((await call("/admin/me", { cookie: owner })).json.pushEnabled, true);
  assert.equal((await call("/admin/devices", { body: { token: "kötü token <script>" }, cookie: owner })).status, 400);
  assert.equal((await call("/admin/devices", { body: { token: TOKEN(1), label: "Sahibin telefonu" }, cookie: owner })).status, 201);
  assert.equal((await call("/admin/devices", { cookie: owner })).json.devices[0].label, "Sahibin telefonu");
  const test = await call("/admin/devices/test", { body: {}, cookie: owner });
  assert.equal(test.json.sent, 1);
  assert.match(firebase.sent.at(-1).notification.body, /Test bildirimi/);

  await call("/admin/users", {
    body: { email: "rehber@rotakars.test", name: "Rehber", password: "rehber-parolasi-2026", role: "guide" },
    cookie: owner,
  });
  const guide = (await call("/admin/login", { body: { email: "rehber@rotakars.test", password: "rehber-parolasi-2026" } })).cookie;
  assert.equal((await call("/admin/devices", { body: { token: TOKEN(2) }, cookie: guide })).status, 403);

  assert.equal((await call("/admin/devices/remove", { body: { token: TOKEN(1) }, cookie: owner })).json.removed, 1);
  const info = await call("/app/android");
  assert.equal(info.status, 200);
  assert.equal(info.json.apkUrl, null);
});

test("Google review watch: first run is silent, new reviews and rating bumps notify once", async (t) => {
  const store = await openStore(":memory:", { env: {} });
  t.after(() => store.db.close());
  let now = Date.parse("2026-10-19T10:00:00Z");
  let place = {
    rating: 4.9,
    userRatingCount: 100,
    reviews: [{ name: "places/x/reviews/old", rating: 5, publishTime: "2026-01-01T00:00:00Z", text: { text: "Eski yorum" }, authorAttribution: { displayName: "Eski" } }],
  };
  const notified = [];
  const watch = createReviewWatch({
    db: store.db,
    env: { GOOGLE_PLACES_API_KEY: "k", GOOGLE_PLACE_ID: "p" },
    clock: () => now,
    notifications: { notifyAgency: async (m) => notified.push(m) },
    fetchImpl: async (url, options) => {
      assert.match(url, /^https:\/\/places\.googleapis\.com\/v1\/places\/p\?/);
      assert.equal(options.headers["X-Goog-FieldMask"], "rating,userRatingCount,reviews");
      return { ok: true, json: async () => place };
    },
  });
  assert.equal((await watch.check()).initialized, true);
  assert.equal(notified.length, 0);
  assert.equal((await watch.check()).added, 0);
  assert.equal(notified.length, 0);

  now += 3600000;
  place = {
    ...place,
    userRatingCount: 102,
    reviews: [
      ...place.reviews,
      { name: "places/x/reviews/new", rating: 2, publishTime: "2026-10-19T10:30:00Z", text: { text: "Rehber geç kaldı" }, authorAttribution: { displayName: "Ayşe" } },
      // Google sıralamasıyla listeye yeni giren eski yorum: bildirilmez.
      { name: "places/x/reviews/older", rating: 5, publishTime: "2025-05-01T00:00:00Z", text: { text: "Çok eski" }, authorAttribution: { displayName: "Ali" } },
    ],
  };
  const r = await watch.check();
  assert.equal(r.added, 2);
  assert.equal(notified.length, 2, "metni görünen yorum + yalnız puan veren için sayı bildirimi");
  assert.match(notified[0].subject, /^Dikkat: düşük puan/);
  assert.match(notified[0].body, /Rehber geç kaldı/);
  assert.match(notified[1].subject, /1 yeni değerlendirme/);
  await watch.check();
  assert.equal(notified.length, 2, "aynı yorum tekrar bildirilmez");
});

test("roles: guides read the phone passenger list but not devices or CSV exports", async () => {
  const { roleAllows } = await import("../server/admin-auth.mjs");
  assert.equal(roleAllows("guide", "GET", "/api/admin/departures/abc/passengers"), true);
  assert.equal(roleAllows("guide", "GET", "/api/admin/departures/abc/passengers.csv"), false);
  assert.equal(roleAllows("guide", "POST", "/api/admin/devices"), false);
  assert.equal(roleAllows("guide", "POST", "/api/admin/devices/test"), false);
  assert.equal(roleAllows("operations", "POST", "/api/admin/devices"), true);
});

test("service account is read from plain JSON, base64 and newline-mangled env values", async () => {
  const { readServiceAccount } = await import("../server/push.mjs");
  const plain = SERVICE_ACCOUNT;
  assert.equal(readServiceAccount(plain).status, "ok");
  assert.equal(readServiceAccount(Buffer.from(plain).toString("base64")).status, "ok");
  // Railway: anahtardaki "\n" kaçışları gerçek satır sonuna dönüşmüş (JSON.parse başarısız).
  const mangled = plain.replace(/\\n/g, "\n");
  assert.throws(() => JSON.parse(mangled));
  const fixed = readServiceAccount(mangled);
  assert.equal(fixed.status, "ok");
  assert.equal(fixed.account.project_id, "rota-test");
  assert.equal(readServiceAccount("").status, "missing");
  assert.equal(readServiceAccount('{"project_id":"x"}').status, "invalid");
  assert.equal(
    readServiceAccount(JSON.stringify({ project_id: "x", client_email: "a@b", private_key: "-----BEGIN PRIVATE KEY-----\nbozuk\n-----END PRIVATE KEY-----" })).status,
    "invalid",
  );
});

test("FCM errors are reported with a hint and do not silently drop the phone", async (t) => {
  const firebase = fakeFirebase();
  let mode = "disabled";
  const fetchImpl = async (url, options) => {
    if (url.includes("messages:send") && mode === "disabled")
      return {
        ok: false,
        status: 403,
        json: async () => ({ error: { status: "PERMISSION_DENIED", message: "API has not been used", details: [{ reason: "SERVICE_DISABLED" }] } }),
      };
    if (url.includes("messages:send") && mode === "payload")
      return { ok: false, status: 400, json: async () => ({ error: { status: "INVALID_ARGUMENT", message: "Invalid value at 'message.android'" } }) };
    return firebase.fetchImpl(url, options);
  };
  const store = await openStore(":memory:", { env: { FIREBASE_SERVICE_ACCOUNT: SERVICE_ACCOUNT }, pushFetch: fetchImpl });
  t.after(() => store.db.close());
  await addAdmin(store, "owner1", "owner");
  await store.push.register("owner1", { token: TOKEN(1) });
  let r = await store.push.notifyAdmins({ title: "t", body: "b", kind: "test" });
  assert.equal(r.sent, 0);
  assert.equal(r.errors[0].code, "SERVICE_DISABLED");
  const { fcmHint } = await import("../server/push.mjs");
  assert.match(fcmHint("SERVICE_DISABLED"), /Cloud Messaging API/);
  mode = "payload";
  r = await store.push.notifyAdmins({ title: "t", body: "b", kind: "test" });
  assert.equal(r.errors[0].code, "INVALID_ARGUMENT");
  assert.equal((await store.push.devices("owner1")).length, 1, "içerik hatası telefonu silmez");
  mode = "ok";
  r = await store.push.notifyAdmins({ title: "t", body: "b", kind: "test" });
  assert.equal(r.sent, 1);
});
