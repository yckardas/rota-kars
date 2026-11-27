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

test("service vehicles: operations edit from the panel, validated, reset and survive a restart", async (t) => {
  const { store, call, ops } = await fixture(t);
  const list = (await call("/admin/content/services", { cookie: ops })).json;
  assert.ok(list.some((s) => s.id === "vip-transfer"));
  const before = (await call("/admin/content/services/vip-transfer", { cookie: ops })).json;
  assert.equal(before.edited, false);
  assert.equal(before.title, "VIP transfer");
  assert.ok(before.current.vehicles.length > 0);
  // Saved defaults are accepted unchanged for every service.
  for (const { id } of list) {
    const { defaults } = (await call(`/admin/content/services/${id}`, { cookie: ops })).json;
    assert.equal((await call(`/admin/content/services/${id}`, { body: defaults, cookie: ops })).status, 200, id);
    await store.content.resetService(id);
  }
  const upload = "/media/0b6f5a1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b.jpg";
  const next = {
    vehicles: [{ name: "Mercedes-Benz Sprinter", photos: [upload, before.current.vehicles[0].photos[0]] }, ...before.current.vehicles],
  };
  const saved = await call("/admin/content/services/vip-transfer", { body: next, cookie: ops });
  assert.equal(saved.status, 200);
  assert.equal(saved.json.edited, true);
  assert.equal(saved.json.updatedBy, "Operasyon");
  const vip = () => call("/catalog").then((r) => r.json.services.find((s) => s.id === "vip-transfer"));
  assert.deepEqual((await vip()).vehicles[0], next.vehicles[0]);
  // Rejected: no photo, foreign URL, unknown service, too many vehicles.
  const bad = async (body, id = "vip-transfer") => call(`/admin/content/services/${id}`, { body, cookie: ops });
  const noPhoto = await bad({ vehicles: [{ name: "Boş araç", photos: [] }] });
  assert.equal(noPhoto.status, 400);
  assert.match(JSON.stringify(noPhoto.json), /1\. araç: en az bir fotoğraf/);
  assert.equal((await bad({ vehicles: [{ name: "Dış", photos: ["https://evil.example/x.jpg"] }] })).status, 400);
  assert.equal((await bad({ vehicles: [{ name: "X", photos: [upload] }] })).status, 400, "ad en az 2 karakter");
  assert.equal((await bad({ vehicles: Array(9).fill({ name: "Araç", photos: [upload] }) })).status, 400);
  assert.equal((await bad(next, "yok-boyle-hizmet")).status, 404);
  // Restart: catalog falls back to defaults, the saved edit is applied again on boot.
  const { services } = await import("../server/catalog.mjs");
  services.find((s) => s.id === "vip-transfer").vehicles = [];
  await store.content.apply();
  assert.equal((await vip()).vehicles[0].name, "Mercedes-Benz Sprinter");
  // An empty list hides the section; reset brings the built-in vehicles back.
  assert.equal((await bad({ vehicles: [] })).status, 200);
  assert.deepEqual((await vip()).vehicles, []);
  const reset = await call("/admin/content/services/vip-transfer/reset", { body: {}, cookie: ops });
  assert.equal(reset.status, 200);
  assert.equal(reset.json.edited, false);
  assert.deepEqual((await vip()).vehicles, before.defaults.vehicles);
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

test("required documents: abroad tours have defaults, panel edits reach the catalog, limits hold", async (t) => {
  const { store, call, ops, root } = await fixture(t);
  const info = (await call("/admin/content/tours/nahcivan", { cookie: ops })).json;
  assert.ok(info.defaults.documents.some((d) => /muvafakatname/.test(d)), "Nahçıvan varsayılan belgeleri");
  assert.deepEqual((await call("/admin/content/tours/ani-cildir", { cookie: ops })).json.current.documents, []);
  const documents = ["Geçerli pasaport", "Muvafakatname (18 yaş altı)"];
  const saved = await call("/admin/content/tours/nahcivan", { body: { ...info.current, documents }, cookie: ops });
  assert.equal(saved.status, 200, JSON.stringify(saved.json));
  const catalog = await (await fetch(root + "/api/catalog")).json();
  assert.deepEqual(catalog.tours.find((x) => x.id === "nahcivan").documents, documents);
  // Eski panel (alanı göndermeyen) kaydı da kabul edilir.
  const { documents: _omit, ...legacy } = info.current;
  assert.equal((await call("/admin/content/tours/nahcivan", { body: legacy, cookie: ops })).status, 200);
  const tooMany = Array.from({ length: 13 }, (_, i) => "Belge " + i);
  assert.equal((await call("/admin/content/tours/nahcivan", { body: { ...info.current, documents: tooMany }, cookie: ops })).status, 400);
  await store.content.resetTour("nahcivan");
});

test("card ribbon text: optional per tour, panel edit reaches the catalog, 24 characters at most", async (t) => {
  const { store, call, ops, root } = await fixture(t);
  const info = (await call("/admin/content/tours/buyuk-azerbaycan", { cookie: ops })).json;
  assert.equal(info.current.cardLabel, "", "varsayılan boş: şerit güzergâhtan gelir");
  const saved = await call("/admin/content/tours/buyuk-azerbaycan", { body: { ...info.current, cardLabel: "Bakü'de Yılbaşı" }, cookie: ops });
  assert.equal(saved.status, 200, JSON.stringify(saved.json));
  const catalog = await (await fetch(root + "/api/catalog")).json();
  assert.equal(catalog.tours.find((x) => x.id === "buyuk-azerbaycan").cardLabel, "Bakü'de Yılbaşı");
  // Alanı göndermeyen eski panel kaydı da kabul edilir.
  const { cardLabel: _omit, ...legacy } = info.current;
  assert.equal((await call("/admin/content/tours/buyuk-azerbaycan", { body: legacy, cookie: ops })).status, 200);
  assert.equal((await call("/admin/content/tours/buyuk-azerbaycan", { body: { ...info.current, cardLabel: "x".repeat(25) }, cookie: ops })).status, 400);
  await store.content.resetTour("buyuk-azerbaycan");
});

test("English fields from the panel: shown on /en, stale warning after a Turkish edit, reset clears them", async (t) => {
  const { call, ops, root } = await fixture(t);
  const enTour = async () =>
    (await (await fetch(root + "/api/catalog")).json()).translations.en.tours[
      "ani-cildir"
    ];
  const enTitle = async () =>
    (
      await (
        await fetch(root + "/en/turlar/ani-cildir", {
          headers: { Accept: "text/html" },
        })
      ).text()
    ).match(/<title>([^<]*)/)[1];
  const before = (
      await call("/admin/content/tours/ani-cildir", { cookie: ops })
    ).json,
    original = await enTour();
  assert.deepEqual(before.en, {}, "henüz İngilizce girilmedi");
  assert.equal(
    before.enFallback.subtitle,
    original.subtitle,
    "panel eski çeviriyi gösterir",
  );
  assert.deepEqual(before.enStale, []);
  // Türkçe ad ve dahil listesi değişir, İngilizcesi de girilir.
  const tr = {
    ...before.current,
    name: "Ani ve Çıldır Kış Rotası",
    included: ["Rehber", "Sıcak çay"],
  };
  const en = {
    name: "Ani and Çıldır Winter Route",
    included: ["Guide", "Hot tea"],
  };
  const saved = await call("/admin/content/tours/ani-cildir", {
    body: { ...tr, en },
    cookie: ops,
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.json));
  assert.deepEqual(saved.json.en, en);
  assert.deepEqual(saved.json.enStale, []);
  let x = await enTour();
  assert.equal(x.name, en.name, "İngilizce alan dolu: o gösterilir");
  assert.deepEqual(x.included, en.included);
  assert.equal(
    x.subtitle,
    original.subtitle,
    "boş alanda Türkçesi değişmediyse eski çeviri",
  );
  assert.match(await enTitle(), /^Ani and Çıldır Winter Route: /);
  // Yalnız Türkçe değişir: İngilizce yine gösterilir, panel uyarır.
  const tr2 = {
    ...tr,
    name: "Ani, Çıldır ve Kars Kış Rotası",
    summary: "Yepyeni bir Türkçe özet metni.",
  };
  const edited = (
    await call("/admin/content/tours/ani-cildir", {
      body: { ...tr2, en },
      cookie: ops,
    })
  ).json;
  assert.deepEqual(edited.enStale, ["name"]);
  x = await enTour();
  assert.equal(x.name, en.name);
  assert.equal(
    x.summary,
    tr2.summary,
    "İngilizcesi ve geçerli eski çevirisi olmayan alan Türkçe",
  );
  // Aynı İngilizce yeniden kaydedilince uyarı kalır; "hâlâ doğru" onayıyla kalkar.
  assert.deepEqual(
    (
      await call("/admin/content/tours/ani-cildir", {
        body: { ...tr2, en },
        cookie: ops,
      })
    ).json.enStale,
    ["name"],
  );
  const confirmed = (
    await call("/admin/content/tours/ani-cildir", {
      body: { ...tr2, en, enConfirm: ["name"] },
      cookie: ops,
    })
  ).json;
  assert.deepEqual(confirmed.enStale, []);
  // İngilizcesi değiştirilince de uyarı kalkar.
  const tr3 = { ...tr2, name: "Ani Kış Rotası" };
  assert.deepEqual(
    (
      await call("/admin/content/tours/ani-cildir", {
        body: { ...tr3, en },
        cookie: ops,
      })
    ).json.enStale,
    ["name"],
  );
  const updated = (
    await call("/admin/content/tours/ani-cildir", {
      body: { ...tr3, en: { ...en, name: "Ani Winter Route" } },
      cookie: ops,
    })
  ).json;
  assert.deepEqual(updated.enStale, []);
  // "en" göndermeyen (eski) panel kaydı İngilizceyi silmez.
  assert.equal(
    (await call("/admin/content/tours/ani-cildir", { body: tr3, cookie: ops }))
      .json.en.name,
    "Ani Winter Route",
  );
  // Boşaltılan alan siler; eski çeviriyle aynı metin ayrıca saklanmaz.
  const cleared = (
    await call("/admin/content/tours/ani-cildir", {
      body: { ...tr3, en: { name: "", subtitle: original.subtitle } },
      cookie: ops,
    })
  ).json;
  assert.deepEqual(cleared.en, {});
  assert.equal(
    (await enTour()).name,
    tr3.name,
    "İngilizce boş, Türkçe değişti: Türkçe görünür",
  );
  // Doğrulama: alan adıyla, "İngilizce" önekiyle.
  const bad = await call("/admin/content/tours/ani-cildir", {
    body: { ...tr3, en: { name: "a".repeat(81) } },
    cookie: ops,
  });
  assert.equal(bad.status, 400);
  assert.equal(
    bad.json.message,
    "İngilizce tur adı en fazla 80 karakter olabilir.",
  );
  assert.equal(bad.json.details[0].field, "en.name");
  const badStep = await call("/admin/content/tours/ani-cildir", {
    body: {
      ...tr3,
      en: { itinerary: [{ time: "08:00", title: "", text: "x" }] },
    },
    cookie: ops,
  });
  assert.equal(
    badStep.json.message,
    "İngilizce program, 1. adım başlığı boş bırakılamaz.",
  );
  // Varsayılana dön İngilizceyi de siler; eski çeviri geri gelir.
  await call("/admin/content/tours/ani-cildir", {
    body: { ...tr3, en },
    cookie: ops,
  });
  const reset = (
    await call("/admin/content/tours/ani-cildir/reset", {
      body: {},
      cookie: ops,
    })
  ).json;
  assert.deepEqual(reset.en, {});
  assert.equal((await enTour()).name, original.name);
});

test("English category and day-trip duration fall back to the filter words", async (t) => {
  const { call, ops, root } = await fixture(t);
  const before = (
    await call("/admin/content/tours/ani-cildir", { cookie: ops })
  ).json;
  await call("/admin/content/tours/ani-cildir", {
    body: { ...before.current, category: "Doğa", duration: "Günübirlik" },
    cookie: ops,
  });
  const x = (await (await fetch(root + "/api/catalog")).json()).translations.en
    .tours["ani-cildir"];
  assert.equal(x.category, "Nature");
  assert.equal(x.duration, "Day trip");
});
