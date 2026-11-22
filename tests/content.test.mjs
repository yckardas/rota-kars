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
  // Asgari katılımcı: sayı girilirse bildirim süresi de zorunlu; katalogda turla gelir.
  assert.equal(before.current.minParticipants, 0);
  assert.equal((await call("/admin/content/tours/ani-cildir", { body: { ...fields, minParticipants: 8, minNoticeHours: 0 }, cookie: ops })).status, 400);
  assert.equal((await call("/admin/content/tours/ani-cildir", { body: { ...fields, minParticipants: 8, minNoticeHours: 48 }, cookie: ops })).status, 200);
  const withMin = (await (await fetch(root + "/api/catalog")).json()).tours.find((x) => x.id === "ani-cildir");
  assert.equal(withMin.minParticipants, 8);
  assert.equal(withMin.minNoticeHours, 48);

  const reset = await call("/admin/content/tours/ani-cildir/reset", { body: {}, cookie: ops });
  assert.equal(reset.json.edited, false);
  assert.equal(reset.json.current.name, before.current.name);
  // Sözleşme koşulu: metin sıfırlansa da asgari katılımcı kalır.
  assert.equal(reset.json.current.minParticipants, 8);
  assert.equal(reset.json.current.minNoticeHours, 48);
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

test("announcement strip: owner only, safe links, shown only when on", async (t) => {
  const { store, call, owner, ops } = await fixture(t);
  const on = { enabled: true, text: "Yılbaşı Van turu satışta", textEn: "New Year Van tour on sale", link: "/turlar/van" };
  assert.equal((await call("/catalog")).json.announcement, null);
  assert.equal((await call("/admin/content/announcement", { body: on, cookie: ops })).status, 403);
  assert.equal((await call("/admin/content/announcement", { body: { ...on, link: "javascript:alert(1)" }, cookie: owner })).status, 400);
  assert.equal((await call("/admin/content/announcement", { body: { ...on, link: "//evil.example" }, cookie: owner })).status, 400);
  assert.equal((await call("/admin/content/announcement", { body: { ...on, text: "" }, cookie: owner })).status, 400);
  assert.equal((await call("/admin/content/announcement", { body: on, cookie: owner })).status, 200);
  assert.deepEqual((await call("/catalog")).json.announcement, { text: on.text, textEn: on.textEn, link: on.link });
  // Yeniden başlatma: kayıt açılışta yeniden uygulanır.
  const { announcement } = await import("../server/content.mjs");
  announcement.enabled = false;
  await store.content.apply();
  assert.equal(announcement.enabled, true);
  // Kapatılınca metin saklanır ama sitede görünmez.
  assert.equal((await call("/admin/content/announcement", { body: { ...on, enabled: false }, cookie: owner })).status, 200);
  assert.equal((await call("/catalog")).json.announcement, null);
  assert.equal((await call("/admin/content/announcement", { cookie: owner })).json.current.text, on.text);
  await call("/admin/content/announcement", { body: { enabled: false, text: "", textEn: "", link: "" }, cookie: owner });
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

test("panel reset restores text and photos but keeps the edited tour price", async (t) => {
  const { call, ops, root } = await fixture(t);
  const before = (await call("/admin/content/tours/ani-cildir", { cookie: ops })).json;
  await call("/admin/content/tours/ani-cildir", {
    body: { ...before.current, name: "Geçici ad", price: before.defaults.price + 50000 },
    cookie: ops,
  });
  const reset = await call("/admin/content/tours/ani-cildir/reset", { body: {}, cookie: ops });
  assert.equal(reset.status, 200);
  assert.equal(reset.json.current.name, before.defaults.name);
  assert.equal(reset.json.current.price, before.defaults.price + 50000, "fiyat sıfırlanmaz");
  const ani = (await (await fetch(root + "/api/catalog")).json()).tours.find((x) => x.id === "ani-cildir");
  assert.equal(ani.price, before.defaults.price + 50000);
  assert.equal(ani.name, before.defaults.name);
  // Yalnız fiyatı kalan kayıt "düzenlenmiş metin" sayılmaz; ikinci sıfırlama bir şey değiştirmez.
  assert.equal(reset.json.edited, false);
});

test("English site drops a stale translation for fields edited in the panel", async (t) => {
  const { call, ops, root } = await fixture(t);
  const enTour = async () => (await (await fetch(root + "/api/catalog")).json()).translations.en.tours["ani-cildir"];
  const enTitle = async () =>
    (await (await fetch(root + "/en/turlar/ani-cildir", { headers: { Accept: "text/html" } })).text()).match(/<title>([^<]*)/)[1];
  const before = (await call("/admin/content/tours/ani-cildir", { cookie: ops })).json,
    original = await enTour();
  assert.notEqual(original.name, before.current.name, "çeviri varsayılan içerikte İngilizce");
  await call("/admin/content/tours/ani-cildir", {
    body: { ...before.current, name: "Ani ve Çıldır Kış Rotası", included: ["Rehber", "Sıcak çay"] },
    cookie: ops,
  });
  const edited = await enTour();
  assert.equal(edited.name, "Ani ve Çıldır Kış Rotası", "değişen alan eski çeviriyi göstermez");
  assert.deepEqual(edited.included, ["Rehber", "Sıcak çay"]);
  assert.equal(edited.subtitle, original.subtitle, "dokunulmayan alan İngilizce kalır");
  assert.deepEqual(edited.itinerary, original.itinerary);
  assert.match(await enTitle(), /^Ani ve Çıldır Kış Rotası: /);
  await call("/admin/content/tours/ani-cildir/reset", { body: {}, cookie: ops });
  assert.equal((await enTour()).name, original.name, "varsayılana dönünce çeviri geri gelir");
});

test("every tour's built-in content can be saved from the panel unchanged", async (t) => {
  const { store, call, ops } = await fixture(t);
  const { tours } = await import("../server/catalog.mjs");
  const rejected = [];
  for (const { id } of tours) {
    const { defaults } = (await call(`/admin/content/tours/${id}`, { cookie: ops })).json;
    const saved = await call(`/admin/content/tours/${id}`, { body: defaults, cookie: ops });
    if (saved.status !== 200) rejected.push([id, saved.json.details]);
    await store.content.resetTour(id);
  }
  assert.deepEqual(rejected, []);
});

test("itinerary time and return time accept 40 characters, not 41", async (t) => {
  const { store, call, ops } = await fixture(t);
  const { current } = (await call("/admin/content/tours/ani-cildir", { cookie: ops })).json;
  const save = (patch) => call("/admin/content/tours/ani-cildir", { body: { ...current, ...patch }, cookie: ops });
  const step = (time) => [{ time, title: "Buluşma", text: "" }];
  assert.equal((await save({ itinerary: step("a".repeat(40)) })).status, 200, "saat 40");
  assert.equal((await save({ end: "a".repeat(40) })).status, 200, "dönüş 40");
  assert.equal((await save({ itinerary: step("a".repeat(41)) })).status, 400, "saat 41");
  assert.equal((await save({ end: "a".repeat(41) })).status, 400, "dönüş 41");
});

test("a rejected tour save names the field, the row and the limit", async (t) => {
  const { call, ops } = await fixture(t);
  const { current } = (await call("/admin/content/tours/ani-cildir", { cookie: ops })).json;
  const step = { time: "08:00", title: "Buluşma", text: "" };
  for (const [patch, message, field] of [
    [{ itinerary: [step, { ...step, time: "a".repeat(41) }] }, "Program, 2. adım saati en fazla 40 karakter olabilir.", "itinerary.1.time"],
    [{ itinerary: [{ ...step, title: "" }] }, "Program, 1. adım başlığı boş bırakılamaz.", "itinerary.0.title"],
    [{ included: ["Rehber", "a".repeat(161)] }, "Fiyata dahil, 2. madde en fazla 160 karakter olabilir.", "included.1"],
    [{ excluded: Array(21).fill("Yemek") }, "Fiyata dahil değil en fazla 20 madde olabilir.", "excluded"],
    [{ name: "ab" }, "Tur adı en az 3 karakter olmalı.", "name"],
    [{ price: -1 }, "Başlayan fiyat geçersiz.", "price"],
    [{ gallery: ["/gecersiz.gif"] }, "Galeri, 1. fotoğraf: Geçersiz görsel yolu.", "gallery.0"],
    [{ minParticipants: 8, minNoticeHours: 0 }, "Asgari katılımcı sayısı girildiyse iptal bildirim süresi de girilmeli.", "minNoticeHours"],
  ]) {
    const res = await call("/admin/content/tours/ani-cildir", { body: { ...current, ...patch }, cookie: ops });
    assert.equal(res.status, 400);
    assert.equal(res.json.message, message);
    assert.equal(res.json.details[0].field, field);
  }
});

test("built-in tour photos are valid Instagram covers and hotel photos", async (t) => {
  const { call, owner } = await fixture(t);
  const { tours } = await import("../server/catalog.mjs");
  const post = (cover) =>
    call("/admin/instagram", {
      body: { title: "Kapak", permalink: "https://www.instagram.com/reel/KAPAK12345/", cover, position: 9, active: false },
      cookie: owner,
    });
  const hotel = (image) =>
    call("/admin/hotels", {
      body: { name: "Deneme Otel", location: "Kars", description: "Deneme otel açıklaması", amenities: [], image, active: false },
      cookie: owner,
    });
  // Instagram formu varsayılan kapak olarak ilk turun fotoğrafını seçer.
  assert.equal((await post(tours[0].image)).status, 200, "Instagram: " + tours[0].image);
  assert.equal((await hotel(tours[0].image)).status, 200, "otel: " + tours[0].image);
  for (const bad of ["/images/../server/x.webp", "/images/tours/../../x.webp", "/images/..", "/images//x.webp", "https://evil.example/x.jpg"]) {
    assert.equal((await post(bad)).status, 400, "Instagram: " + bad);
    assert.equal((await hotel(bad)).status, 400, "otel: " + bad);
  }
});
