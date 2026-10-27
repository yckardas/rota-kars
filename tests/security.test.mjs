import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";

// Güvenlik regresyon testleri: kimlik, yetki, CSRF, enjeksiyon, kaba kuvvet ve başlıklar.
const OWNER = { email: "sahip@rotakars.test", name: "Sahip", password: "sahip-parolasi-2026" };
const BOOT = "ilk-kurulum-parolasi-guvenlik";

async function fixture(t, env = {}) {
  const store = await openStore(":memory:", { env });
  const app = createApp(store, {
    env: { ADMIN_PASSWORD: BOOT, ...env },
    reviewsService: { get: async () => ({ status: "not_configured", reviews: [] }) },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { body, cookie, method, headers = {}, raw } = {}) => {
    const r = await fetch(origin + path, {
      method: method || (body || raw ? "POST" : "GET"),
      body: raw ?? (body ? JSON.stringify(body) : undefined),
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        "X-Rota-Client": "web",
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
    });
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: r.status, json, text, headers: r.headers, cookie: r.headers.get("set-cookie") };
  };
  const login = async (creds) => (await call("/api/admin/login", { body: creds })).cookie?.split(";")[0];
  const owner = async () => {
    const boot = await login({ password: BOOT });
    const r = await call("/api/admin/users", { body: { ...OWNER, role: "owner" }, cookie: boot });
    assert.equal(r.status, 201);
    return r.cookie.split(";")[0];
  };
  return { app, store, call, login, owner };
}

// Uygulamadaki her /api/admin yolu, gerçek parametre yerine sahte değerle.
function adminRoutes(app) {
  const out = [];
  for (const layer of app.router.stack) {
    const route = layer.route;
    if (!route || typeof route.path !== "string" || !route.path.startsWith("/api/admin")) continue;
    for (const method of Object.keys(route.methods))
      out.push({
        method: method.toUpperCase(),
        path: route.path.replace(/:id\b/g, "00000000-0000-4000-8000-000000000000").replace(/:\w+/g, "X"),
      });
  }
  return out;
}

test("security: every admin route refuses anonymous callers", async (t) => {
  const { app, call } = await fixture(t);
  // Giriş ve çıkış oturumsuz çağrılabilir (çıkış yalnız çerezi siler).
  const routes = adminRoutes(app).filter((r) => !["/api/admin/login", "/api/admin/logout"].includes(r.path));
  assert.ok(routes.length > 40, "yönetim yolları bulundu");
  for (const r of routes) {
    const res = await call(r.path, { method: r.method, body: r.method === "GET" ? undefined : {} });
    assert.equal(res.status, 401, `${r.method} ${r.path} oturumsuz açık`);
  }
});

test("security: guide and operations roles cannot escalate", async (t) => {
  const { call, login, owner } = await fixture(t);
  const o = await owner();
  for (const role of ["operations", "guide"])
    await call("/api/admin/users", {
      body: { email: `${role}@rotakars.test`, name: role, role, password: `${role}-parolasi-123` },
      cookie: o,
    });
  const ops = await login({ email: "operations@rotakars.test", password: "operations-parolasi-123" });
  const guide = await login({ email: "guide@rotakars.test", password: "guide-parolasi-123" });
  const uuid = "00000000-0000-4000-8000-000000000000";
  // Rehber: rezervasyon, para, içerik ve silme işlemlerine erişemez.
  for (const [method, path] of [
    ["GET", "/api/admin/reservations"],
    ["GET", "/api/admin/counts"],
    ["GET", "/api/admin/dashboard"],
    ["POST", "/api/admin/hotels"],
    ["DELETE", `/api/admin/hotels/${uuid}`],
    ["DELETE", "/api/admin/departures/x"],
    ["POST", "/api/admin/departures"],
    ["POST", "/api/admin/reservations/RK-X/no-show"],
    ["POST", "/api/admin/reservations/RK-X/payments"],
    ["POST", "/api/admin/content/business"],
    ["POST", "/api/admin/users"],
  ])
    assert.equal((await call(path, { method, cookie: guide, body: method === "GET" ? undefined : {} })).status, 403, `rehber: ${method} ${path}`);
  // Operasyon: kullanıcı, denetim kaydı, KVKK ve kampanya yalnız sahipte.
  for (const [method, path] of [
    ["GET", "/api/admin/users"],
    ["POST", "/api/admin/users"],
    ["GET", "/api/admin/audit"],
    ["POST", "/api/admin/kvkk/export"],
    ["POST", "/api/admin/kvkk/erase"],
    ["POST", "/api/admin/campaigns"],
  ])
    assert.equal((await call(path, { method, cookie: ops, body: method === "GET" ? undefined : {} })).status, 403, `operasyon: ${method} ${path}`);
  // Kendi rolünü yükseltemez.
  const me = (await call("/api/admin/me", { cookie: ops })).json.user;
  assert.equal((await call(`/api/admin/users/${me.id}`, { method: "PATCH", cookie: ops, body: { role: "owner" } })).status, 403);
});

test("security: cross-site writes are refused (CSRF)", async (t) => {
  const { call } = await fixture(t);
  // Özel başlık yoksa (düz HTML formu) reddedilir.
  assert.equal((await call("/api/admin/login", { body: { password: BOOT }, headers: { "X-Rota-Client": "" } })).status, 403);
  // Başka bir siteden gelen istek reddedilir.
  assert.equal((await call("/api/admin/login", { body: { password: BOOT }, headers: { Origin: "https://evil.example" } })).status, 403);
  assert.equal((await call("/api/reservations/cancel", { body: {}, headers: { Origin: "https://evil.example" } })).status, 403);
});

test("security: operator objects and oversized bodies cannot bypass validation", async (t) => {
  const { call, owner } = await fixture(t);
  // NoSQL operatörüyle parola atlatma denemesi.
  for (const body of [
    { email: { $ne: null }, password: { $ne: null } },
    { password: { $gt: "" } },
    { email: OWNER.email, password: ["x"] },
  ])
    assert.equal((await call("/api/admin/login", { body })).status, 400, JSON.stringify(body));
  const o = await owner();
  // Arama düzenli ifade olarak yorumlanmaz, sorgu nesnesi kabul edilmez.
  for (const q of [".*", "(a+)+$", "q[$ne]=1"]) {
    const r = await call("/api/admin/reservations?q=" + encodeURIComponent(q), { cookie: o });
    assert.ok([200, 400].includes(r.status), `${q}: ${r.status}`);
    if (r.status === 200) assert.deepEqual(r.json, []);
  }
  assert.ok([400, 404].includes((await call("/api/reservations/lookup", { body: { reference: { $ne: "" }, email: { $ne: "" } } })).status));
  // 32 kb üstü gövde reddedilir.
  const big = JSON.stringify({ password: "x".repeat(40000) });
  assert.equal((await call("/api/admin/login", { raw: big })).status, 413);
});

test("security: brute force on admin login is rate limited", async (t) => {
  const { call } = await fixture(t);
  const statuses = [];
  for (let i = 0; i < 12; i++) statuses.push((await call("/api/admin/login", { body: { password: "yanlis-parola-" + i } })).status);
  // Hiçbir deneme geçmez; en geç 11. denemede istek sınırı devreye girer.
  assert.ok(statuses.every((s) => s === 401 || s === 429), statuses.join(","));
  assert.ok(statuses.slice(0, 11).includes(429), statuses.join(","));
  assert.equal(statuses.at(-1), 429);
});

test("security: session cookie flags, headers and no stack traces", async (t) => {
  const { call } = await fixture(t, { NODE_ENV: "production" });
  const r = await call("/api/admin/login", { body: { password: BOOT } });
  assert.equal(r.status, 200);
  assert.match(r.cookie, /HttpOnly/);
  assert.match(r.cookie, /SameSite=Strict/);
  assert.match(r.cookie, /Secure/);
  const h = (await call("/api/catalog")).headers;
  assert.equal(h.get("x-content-type-options"), "nosniff");
  assert.equal(h.get("x-frame-options"), "SAMEORIGIN");
  assert.match(h.get("content-security-policy") || "", /frame-ancestors 'self'/);
  assert.match(h.get("content-security-policy") || "", /object-src 'none'/);
  assert.match(h.get("permissions-policy") || "", /camera=\(\)/);
  assert.equal(h.get("x-powered-by"), null);
  // Bozuk istek gövdesi iç ayrıntı sızdırmaz.
  const bad = await call("/api/admin/login", { raw: "{bozuk" });
  assert.ok(bad.status >= 400 && bad.status < 500);
  assert.doesNotMatch(bad.text, /at \w+ \(|node_modules|\/Users\//);
});

test("security: media paths cannot escape the upload store", async (t) => {
  const { call } = await fixture(t);
  for (const p of ["/media/..%2F..%2F.env", "/media/%2e%2e%2fpackage.json", "/media/x.svg"]) {
    const r = await call(p);
    assert.notEqual(r.status, 200, p);
    assert.doesNotMatch(r.text, /ADMIN_PASSWORD|"dependencies"/, p);
  }
});

test("security: catalog data embedded in HTML cannot break out of its script tag", async (t) => {
  const { default: express } = await import("express");
  const { seoHtmlHandler } = await import("../server/seo.mjs");
  const store = await openStore(":memory:");
  t.after(() => store.db.close());
  const catalog = await createApp(store, { env: {} }).locals.catalog();
  const evil = { ...catalog, business: { ...catalog.business, name: "</script><script>alert(1)</script>" } };
  const app = express();
  app.use(seoHtmlHandler({}, async () => '<!doctype html><html><head></head><body><div id="root"></div></body></html>', async () => evil));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((r) => server.close(r)));
  const html = await (await fetch(`http://127.0.0.1:${server.address().port}/`, { headers: { Accept: "text/html" } })).text();
  assert.match(html, /catalog-data/);
  assert.ok(!html.includes("</script><script>alert(1)"), "katalog verisi betik etiketini kapatamaz");
});

test("security: HEAD cannot reach owner-only routes and templates ignore $ patterns", async (t) => {
  const { roleAllows } = await import("../server/admin-auth.mjs");
  assert.equal(roleAllows("operations", "HEAD", "/api/admin/audit"), false);
  assert.equal(roleAllows("operations", "HEAD", "/api/admin/users"), false);
  assert.equal(roleAllows("operations", "HEAD", "/api/admin/reservations"), true);
  const { renderHtml } = await import("../server/seo.mjs");
  const html = renderHtml("<html><head><title>x</title></head><body></body></html>", { title: "t", description: "d", status: 200 }, "https://rotakarsturizm.com", { note: "Fiyat $` ve $' içerir" });
  assert.equal(html.split("</head>").length, 2, "tek head kapanışı");
  assert.match(html, /Fiyat \$` ve \$' içerir/);
});

test("security: an unverified social e-mail does not make the member verified", async (t) => {
  const store = await openStore(":memory:");
  t.after(() => store.db.close());
  const fb = await store.members.social({ provider: "facebook", subject: "fb-1", email: "kurban@example.com", name: "X", emailVerified: false });
  assert.equal(fb.emailVerified, false);
  const google = await store.members.social({ provider: "google", subject: "g-1", email: "dogru@example.com", name: "Y" });
  assert.equal(google.emailVerified, true);
});

test("security: a locked admin still gets in with password + 2FA code; attackers do not", async (t) => {
  const { hotp, totpStep } = await import("../server/totp.mjs");
  const { call, owner } = await fixture(t);
  const o = await owner();
  const setup = await call("/api/admin/me/2fa/setup", { body: {}, cookie: o });
  const step = totpStep(Date.now());
  assert.equal((await call("/api/admin/me/2fa/enable", { body: { code: hotp(setup.json.secret, step - 1) }, cookie: o })).status, 200);
  // Saldırgan 5 yanlış parolayla hesabı kilitler.
  for (let i = 0; i < 5; i++)
    assert.equal((await call("/api/admin/login", { body: { email: OWNER.email, password: "yanlis-" + i } })).status, 401);
  // Kilitliyken: parola tek başına yetmez, doğru parola kod ister, kodla girilir.
  const wrong = await call("/api/admin/login", { body: { email: OWNER.email, password: "yine-yanlis" } });
  assert.equal(wrong.status, 401);
  const needs = await call("/api/admin/login", { body: { email: OWNER.email, password: OWNER.password } });
  assert.equal(needs.json?.needsCode, true);
  const ok = await call("/api/admin/login", { body: { email: OWNER.email, password: OWNER.password, code: hotp(setup.json.secret, step) } });
  assert.equal(ok.status, 200, ok.text);
});

test("security: weak bootstrap passwords are refused and sent auth links are not kept", async (t) => {
  const { call } = await fixture(t, { ADMIN_PASSWORD: "kisa-parola" });
  // fixture env ADMIN_PASSWORD'u uygulamaya geçirir; kısa olduğu için ilk kurulum açılmaz.
  const r = await call("/api/admin/login", { body: { password: "kisa-parola" } });
  assert.ok([401, 503].includes(r.status));
  const store = await openStore(":memory:", { env: { SMTP_URL: "" } });
  t.after(() => store.db.close());
  await store.notifications.enqueue({ email: "a@example.com", subject: "s", body: "b", actionUrl: "https://x/parola-yenile?token=abc", kind: "auth_reset", dedupeKey: "k1" });
  const sent = [];
  await store.notifications.processBatch({ send: async (item) => sent.push(item.action_url) });
  assert.deepEqual(sent, ["https://x/parola-yenile?token=abc"], "bağlantı e-postayla gider");
  const row = (await store.db.find("notification_outbox", {}))[0];
  assert.equal(row.status, "sent");
  assert.equal(row.action_url, null, "gönderilen bağlantı kuyrukta saklanmaz");
});
