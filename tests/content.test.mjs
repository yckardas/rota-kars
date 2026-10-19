import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";
import { seoHtmlHandler } from "../server/seo.mjs";

const TEMPLATE = '<!doctype html><html><head><title>x</title></head><body></body></html>';
async function fixture(t) {
  const store = await openStore(":memory:", { seed: false });
  const env = { ADMIN_PASSWORD: "ilk-kurulum-parolasi", SITE_URL: "https://rotakarsturizm.com" };
  const app = createApp(store, { env, reviewsService: { get: async () => ({ status: "not_configured", reviews: [] }) } });
  app.use(seoHtmlHandler(env, async () => TEMPLATE, app.locals.catalog));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await store.content.resetTour("ani-cildir");
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const root = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { body, cookie } = {}) => {
    const r = await fetch(root + "/api" + path, {
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      headers: { "Content-Type": "application/json", "X-Rota-Client": "web", ...(cookie ? { Cookie: cookie } : {}) },
    });
    return { status: r.status, json: await r.json().catch(() => null), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  const boot = (await call("/admin/login", { body: { password: "ilk-kurulum-parolasi" } })).cookie;
  const owner = (
    await call("/admin/users", {
      body: { email: "sahip@rotakars.test", name: "Sahip", password: "sahip-parolasi-2026", role: "owner" },
      cookie: boot,
    })
  ).cookie;
  await call("/admin/users", {
    body: { email: "ops@rotakars.test", name: "Operasyon", password: "operasyon-parola-26", role: "operations" },
    cookie: owner,
  });
  const ops = (await call("/admin/login", { body: { email: "ops@rotakars.test", password: "operasyon-parola-26" } })).cookie;
  return { store, call, owner, ops, root };
}

test("tour content edits reach catalog, SEO title and can be reset", async (t) => {
  const { call, ops, root } = await fixture(t);
  const before = (await call("/admin/content/tours/ani-cildir", { cookie: ops })).json;
  assert.equal(before.edited, false);
  const fields = {
    ...before.current,
    name: "Ani & Çıldır Kış Rotası",
    summary: "Yeni özet metni <script>alert(1)</script> ile birlikte.",
    included: ["Rehber", "Ulaşım", "Sıcak çay"],
    itinerary: [{ time: "08:00", title: "Buluşma", text: "Kars merkez." }],
  };
  const saved = await call("/admin/content/tours/ani-cildir", { body: fields, cookie: ops });
  assert.equal(saved.status, 200);
  assert.equal(saved.json.updatedBy, "Operasyon");
  const catalog = await (await fetch(root + "/api/catalog")).json();
  const ani = catalog.tours.find((x) => x.id === "ani-cildir");
  assert.equal(ani.name, "Ani & Çıldır Kış Rotası");
  assert.deepEqual(ani.included, ["Rehber", "Ulaşım", "Sıcak çay"]);
  const html = await (await fetch(root + "/turlar/ani-cildir", { headers: { Accept: "text/html" } })).text();
  assert.match(html, /<title>Ani &amp; Çıldır Kış Rotası/);
  assert.ok(!html.includes("<script>alert(1)"), "metin HTML'e kaçışlanarak yazılır");

  for (const bad of [
    { image: "https://evil.example/x.jpg" },
    { image: "/images/../server/x.webp" },
    { gallery: ["javascript:alert(1)"] },
    { name: "" },
    { itinerary: Array.from({ length: 16 }, () => ({ time: "", title: "a", text: "" })) },
  ])
    assert.equal((await call("/admin/content/tours/ani-cildir", { body: { ...fields, ...bad }, cookie: ops })).status, 400, JSON.stringify(bad));
  assert.equal((await call("/admin/content/tours/yok-boyle", { body: fields, cookie: ops })).status, 400);

  const reset = await call("/admin/content/tours/ani-cildir/reset", { body: {}, cookie: ops });
  assert.equal(reset.json.edited, false);
  assert.equal(reset.json.current.name, before.current.name);
});

test("business contact info: owner only, validated, survives a restart", async (t) => {
  const { store, call, owner, ops } = await fixture(t);
  const current = (await call("/admin/content/business", { cookie: owner })).json.current;
  const next = { ...current, whatsapp: "905551112233", hours: "Her gün 08:00–22:00" };
  assert.equal((await call("/admin/content/business", { body: next, cookie: ops })).status, 403);
  assert.equal((await call("/admin/content/business", { body: { ...next, whatsapp: "+90 555" }, cookie: owner })).status, 400);
  assert.equal((await call("/admin/content/business", { body: { ...next, instagram: "https://evil.example/rota" }, cookie: owner })).status, 400);
  assert.equal((await call("/admin/content/business", { body: next, cookie: owner })).status, 200);
  assert.equal((await call("/catalog")).json.business.whatsapp, "905551112233");
  // Yeniden başlatma: katalog varsayılana döner, açılışta düzenleme yeniden uygulanır.
  const { business } = await import("../server/catalog.mjs");
  business.whatsapp = "0";
  await store.content.apply();
  assert.equal(business.whatsapp, "905551112233");
  await call("/admin/content/business", { body: current, cookie: owner });
});

test("monthly CSV opens in Excel (BOM, semicolons) and neutralises formulas", async (t) => {
  const { store, owner, root } = await fixture(t);
  const d = await store.departures.save({
    tourId: "ani-cildir",
    date: "2030-05-10",
    startTime: "08:30",
    pickup: "Kars",
    guideName: "",
    guidePhone: "",
    price: 100000,
    vehicleModel: "vip-midibus",
    passengerSeats: 18,
    active: true,
  });
  await store.adminReserve(
    { departureId: d.id, seats: [1], name: "=HYPERLINK(\"http://x\")", phone: "05551112233", passengers: ["@SUM(1)"], paymentMode: "on_tour", confirm: true },
    { id: "x", name: "Test" },
  );
  const res = await fetch(root + "/api/admin/reports/month.csv?month=2030-05", { headers: { Cookie: owner } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-disposition"), /rota-kars-rapor-2030-05\.csv/);
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "UTF-8 BOM");
  const text = new TextDecoder().decode(bytes);
  assert.ok(text.includes('"\'=HYPERLINK(""http://x"")"'), "formül metne çevrilir");
  assert.ok(!/;"=/.test(text));
  assert.equal((await fetch(root + "/api/admin/reports/month.csv?month=2030-13", { headers: { Cookie: owner } })).status, 400);
});
