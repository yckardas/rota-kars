import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";
import { hotp, totpStep } from "../server/totp.mjs";

const OWNER = { email: "sahip@rotakars.test", name: "Sahip", password: "sahip-parolasi-2026" };

async function fixture(t, env = {}) {
  let now = Date.now();
  const store = await openStore(":memory:", { clock: () => now, env });
  const app = createApp(store, {
    env: { ADMIN_PASSWORD: "ilk-kurulum-parolasi", ...env },
    reviewsService: { get: async () => ({ status: "not_configured", reviews: [] }) },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path, { body, cookie, method } = {}) => {
    const r = await fetch(base + path, {
      method: method || (body ? "POST" : "GET"),
      body: body ? JSON.stringify(body) : undefined,
      headers: { "Content-Type": "application/json", "X-Rota-Client": "web", ...(cookie ? { Cookie: cookie } : {}) },
    });
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: r.status, json, text, cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  const login = async (creds) => (await call("/admin/login", { body: creds })).cookie;
  const createOwner = async () => {
    const boot = await login({ password: "ilk-kurulum-parolasi" });
    const r = await call("/admin/users", { body: { ...OWNER, role: "owner" }, cookie: boot });
    assert.equal(r.status, 201);
    return r.cookie;
  };
  return { store, call, base, login, createOwner, advance: (ms) => (now += ms), now: () => now };
}

test("shared password only bootstraps the first owner, then stops working", async (t) => {
  const { call, login, createOwner } = await fixture(t);
  const ownerCookie = await createOwner();
  assert.ok(ownerCookie, "owner is signed in right after setup");
  const me = await call("/admin/me", { cookie: ownerCookie });
  assert.equal(me.json.user.role, "owner");
  assert.equal(me.json.bootstrap, false);
  const shared = await call("/admin/login", { body: { password: "ilk-kurulum-parolasi" } });
  assert.equal(shared.status, 401);
  assert.match(shared.json.message, /kapatıldı/);
  assert.ok(await login({ email: OWNER.email, password: OWNER.password }));
});

test("five wrong passwords lock the account for 15 minutes", async (t) => {
  const { call, createOwner, advance } = await fixture(t);
  await createOwner();
  for (let i = 0; i < 5; i++)
    assert.equal((await call("/admin/login", { body: { email: OWNER.email, password: "yanlis-parola-xx" } })).status, 401);
  const locked = await call("/admin/login", { body: { email: OWNER.email, password: OWNER.password } });
  assert.equal(locked.status, 401, "correct password is refused while locked");
  const unknown = await call("/admin/login", { body: { email: "yok@rotakars.test", password: "yanlis-parola-xx" } });
  assert.equal(locked.json.message, unknown.json.message, "locked and unknown accounts look the same");
  advance(16 * 60 * 1000);
  assert.equal((await call("/admin/login", { body: { email: OWNER.email, password: OWNER.password } })).status, 200);
});

test("2FA: setup with QR, login needs a fresh code, a used code cannot be replayed", async (t) => {
  const { call, login, createOwner, now, advance } = await fixture(t);
  const cookie = await createOwner();
  const setup = await call("/admin/me/2fa/setup", { body: {}, cookie });
  assert.match(setup.json.otpauthUrl, /^otpauth:\/\/totp\//);
  assert.match(setup.json.qrDataUrl, /^data:image\/png;base64,/);
  assert.equal((await call("/admin/me/2fa/enable", { body: { code: "000000" }, cookie })).status, 400);
  const code = hotp(setup.json.secret, totpStep(now()));
  assert.equal((await call("/admin/me/2fa/enable", { body: { code }, cookie })).status, 200);
  const first = await call("/admin/login", { body: { email: OWNER.email, password: OWNER.password } });
  assert.equal(first.json.needsCode, true);
  assert.equal(first.cookie, undefined, "no session without the code");
  const replay = await call("/admin/login", { body: { email: OWNER.email, password: OWNER.password, code } });
  assert.equal(replay.status, 401, "code used during setup cannot be reused");
  advance(30000);
  const fresh = hotp(setup.json.secret, totpStep(now()));
  assert.ok(await login({ email: OWNER.email, password: OWNER.password, code: fresh }));
});

test("roles: guide sees reports and check-in only, operations cannot manage users", async (t) => {
  const { call, login, createOwner } = await fixture(t);
  const owner = await createOwner();
  for (const role of ["operations", "guide"])
    assert.equal(
      (await call("/admin/users", { body: { email: `${role}@rotakars.test`, name: role, role, password: `${role}-parolasi-123` }, cookie: owner })).status,
      201,
    );
  const ops = await login({ email: "operations@rotakars.test", password: "operations-parolasi-123" });
  const guide = await login({ email: "guide@rotakars.test", password: "guide-parolasi-123" });
  assert.equal((await call("/admin/reservations", { cookie: ops })).status, 200);
  assert.equal((await call("/admin/users", { cookie: ops })).status, 403);
  assert.equal((await call("/admin/audit", { cookie: ops })).status, 403);
  assert.equal((await call("/admin/reservations", { cookie: guide })).status, 403);
  assert.equal((await call("/admin/dashboard", { cookie: guide })).status, 403);
  const today = new Date().toISOString().slice(0, 10);
  assert.equal((await call(`/admin/reports?date=${today}`, { cookie: guide })).status, 200);
  assert.equal((await call("/admin/me", { cookie: guide })).json.user.role, "guide");
});

test("the last owner cannot be demoted or disabled; disabling ends sessions", async (t) => {
  const { call, login, createOwner } = await fixture(t);
  const owner = await createOwner();
  const me = (await call("/admin/me", { cookie: owner })).json.user;
  assert.equal((await call(`/admin/users/${me.id}`, { method: "PATCH", body: { role: "operations" }, cookie: owner })).status, 409);
  const created = await call("/admin/users", { body: { email: "ops@rotakars.test", name: "Ops", role: "operations", password: "ops-parolasi-12345" }, cookie: owner });
  const ops = await login({ email: "ops@rotakars.test", password: "ops-parolasi-12345" });
  assert.equal((await call("/admin/reservations", { cookie: ops })).status, 200);
  assert.equal((await call(`/admin/users/${created.json.id}`, { method: "PATCH", body: { disabled: true }, cookie: owner })).status, 200);
  assert.equal((await call("/admin/reservations", { cookie: ops })).status, 401, "session ended");
  assert.equal((await call("/admin/login", { body: { email: "ops@rotakars.test", password: "ops-parolasi-12345" } })).status, 401);
});

test("when 2FA is required, accounts without it can only reach their own security settings", async (t) => {
  const { call, createOwner } = await fixture(t, { ADMIN_REQUIRE_2FA: "1" });
  const owner = await createOwner();
  const blocked = await call("/admin/reservations", { cookie: owner });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.json.code, "2FA_REQUIRED");
  assert.equal((await call("/admin/me", { cookie: owner })).json.needs2faSetup, true);
  assert.equal((await call("/admin/me/2fa/setup", { body: {}, cookie: owner })).status, 200);
});

test("audit log records who changed what and passenger list exports", async (t) => {
  const { call, createOwner, store } = await fixture(t);
  const owner = await createOwner();
  const [d] = await store.listDepartures("ani-cildir");
  assert.equal((await call(`/admin/departures/${d.id}/passengers.csv`, { cookie: owner })).status, 200);
  await call("/admin/users", { body: { email: "x@rotakars.test", name: "Rehber Xavier", role: "guide", password: "x-parolasi-123456" }, cookie: owner });
  await new Promise((r) => setTimeout(r, 50));
  const log = (await call("/admin/audit", { cookie: owner })).json;
  assert.ok(log.some((e) => e.action === "owner_created"));
  assert.ok(log.some((e) => e.action === "user_created" && e.details.target === "x@rotakars.test" && e.admin_email === OWNER.email));
  assert.ok(log.some((e) => e.action === "export" && /passengers\.csv/.test(e.details.path)));
  assert.ok(log.every((e) => !("ip" in e)), "raw IP is not stored");
});
test("operations cannot reach owner-only routes with case, trailing-slash or double-slash tricks", async (t) => {
  const { call, login, createOwner } = await fixture(t);
  const owner = await createOwner();
  await call("/admin/users", { body: { email: "ops2@rotakars.test", name: "Ops İki", role: "operations", password: "ops-parolasi-123456" }, cookie: owner });
  const ops = await login({ email: "ops2@rotakars.test", password: "ops-parolasi-123456" });
  for (const [path, body] of [
    ["/admin/USERS", null],
    ["/admin/Users", null],
    ["/admin/users/", null],
    ["/admin/audit/", null],
    ["/ADMIN/audit", null],
    ["/admin/kvkk/retention/", null],
    ["/admin/USERS", { email: "evil@rotakars.test", name: "Evil Owner", role: "owner", password: "evil-parolasi-123456" }],
    ["/admin/campaigns/", { active: false }],
  ]) {
    const r = await call(path, body ? { body, cookie: ops } : { cookie: ops });
    assert.ok([403, 404].includes(r.status), `${path} → ${r.status}`);
  }
  const { roleAllows } = await import("../server/admin-auth.mjs");
  assert.equal(roleAllows("operations", "post", "/api/ADMIN/USERS/"), false);
  assert.equal(roleAllows("guide", "GET", "/api/admin/RESERVATIONS"), false);
  assert.equal(roleAllows("operations", "GET", "/api/admin/reservations"), true);
});

test("remember this device: long session only with 2FA; sessions listed and others revocable", async (t) => {
  const { call, base, createOwner, now } = await fixture(t);
  await createOwner();
  const ua = "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP1A; wv) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36 RotaKarsYonetim";
  const loginRaw = (body) =>
    fetch(base + "/admin/login", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", "X-Rota-Client": "web", "User-Agent": ua },
    });
  // 2FA kapalıyken "hatırla" istense de oturum 8 saat.
  let res = await loginRaw({ email: OWNER.email, password: OWNER.password, remember: true });
  assert.match(res.headers.get("set-cookie"), /Max-Age=28800/);
  assert.equal((await res.json()).remembered, false);
  const short = res.headers.get("set-cookie").split(";")[0];
  // 2FA açılınca 14 gün.
  const setup = await call("/admin/me/2fa/setup", { body: {}, cookie: short });
  await call("/admin/me/2fa/enable", { body: { code: hotp(setup.json.secret, totpStep(now())) }, cookie: short });
  res = await loginRaw({ email: OWNER.email, password: OWNER.password, code: hotp(setup.json.secret, totpStep(now()) + 1), remember: true });
  assert.equal(res.status, 200, await res.clone().text());
  assert.match(res.headers.get("set-cookie"), new RegExp("Max-Age=" + 14 * 86400));
  const long = res.headers.get("set-cookie").split(";")[0];
  const sessions = (await call("/admin/me/sessions", { cookie: long })).json;
  const mine = sessions.find((s) => s.current);
  assert.equal(mine.remember, true);
  assert.equal(mine.device, "Android · Pixel 7 · uygulama");
  assert.ok(sessions.length >= 2);
  const revoked = await call("/admin/me/sessions/revoke-others", { body: {}, cookie: long });
  assert.ok(revoked.json.removed >= 1);
  assert.equal((await call("/admin/me", { cookie: short })).status, 401, "diğer oturum kapandı");
  assert.equal((await call("/admin/me", { cookie: long })).status, 200, "bu oturum açık kaldı");
});
