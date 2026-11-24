// Tur kopyalama: panelde bir turdan yeni tur türetilir (taslak başlar), düzenlenir,
// yayınlanır; kopya sitede, sefer planında ve rezervasyonda kendi turu gibi davranır.
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";
import { seoHtmlHandler } from "../server/seo.mjs";
import { tours } from "../server/catalog.mjs";

const TEMPLATE =
  "<!doctype html><html><head><title>x</title></head><body></body></html>";
async function fixture(t) {
  const store = await openStore(":memory:", { seed: false });
  const env = {
    ADMIN_PASSWORD: "ilk-kurulum-parolasi",
    SITE_URL: "https://rotakarsturizm.com",
  };
  const app = createApp(store, {
    env,
    reviewsService: {
      get: async () => ({ status: "not_configured", reviews: [] }),
    },
  });
  app.use(seoHtmlHandler(env, async () => TEMPLATE, app.locals.catalog));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    // Kopyalar modül düzeyindeki tur dizisinde durur; sonraki teste taşınmasın.
    for (const row of await store.db.find("custom_tours", {}))
      await store.content.deleteTour(row.id, { force: true });
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
    return {
      status: r.status,
      json: await r.json().catch(() => null),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  };
  const boot = (
    await call("/admin/login", { body: { password: "ilk-kurulum-parolasi" } })
  ).cookie;
  const owner = (
    await call("/admin/users", {
      body: {
        email: "sahip@rotakars.test",
        name: "Sahip",
        password: "sahip-parolasi-2026",
        role: "owner",
      },
      cookie: boot,
    })
  ).cookie;
  return { store, call, owner, root };
}
const ids = (catalog) => catalog.tours.map((t) => t.id);

test("copy starts as a hidden draft with the source's content and vehicle plan", async (t) => {
  const { store, call, owner, root } = await fixture(t);
  await store.operations.update("tiflis", {
    salesOpen: true,
    vehicleModel: "vip-minibus",
    passengerSeats: 9,
  });
  const r = await call("/admin/content/tours/tiflis/copy", {
    body: { id: "tiflis-gunubirlik", name: "Günübirlik Tiflis" },
    cookie: owner,
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.current.name, "Günübirlik Tiflis");
  const source = (await call("/admin/content/tours/tiflis", { cookie: owner }))
    .json.current;
  assert.deepEqual(
    r.json.current.itinerary,
    source.itinerary,
    "program kaynaktan gelir",
  );
  assert.deepEqual(r.json.current.documents, source.documents);
  // Taslak: sitede yok, panel listesinde "taslak" olarak var.
  assert.ok(!ids((await call("/catalog")).json).includes("tiflis-gunubirlik"));
  const list = (await call("/admin/content/tours", { cookie: owner })).json;
  const row = list.find((x) => x.id === "tiflis-gunubirlik");
  assert.deepEqual(row, {
    id: "tiflis-gunubirlik",
    name: "Günübirlik Tiflis",
    custom: true,
    hidden: true,
    sourceId: "tiflis",
  });
  assert.equal(list.find((x) => x.id === "tiflis").custom, false);
  // Araç planı kaynaktan çoğaltılır.
  const ops = await store.operations.get("tiflis-gunubirlik");
  assert.equal(ops.vehicle.passengerSeats, 9);
  assert.equal(ops.salesOpen, true);
  // Taslak sayfa Google'a açık değil.
  assert.equal((await fetch(root + "/turlar/tiflis-gunubirlik")).status, 404);
});

test("published copy is its own tour: catalog order, SEO page, edits, abroad from category, restart", async (t) => {
  const { store, call, owner, root } = await fixture(t);
  await call("/admin/content/tours/tiflis/copy", {
    body: { id: "tiflis-gunubirlik", name: "Günübirlik Tiflis" },
    cookie: owner,
  });
  assert.equal(
    (
      await call("/admin/content/tours/tiflis-gunubirlik/visibility", {
        body: { hidden: false },
        cookie: owner,
      })
    ).status,
    200,
  );
  let catalog = (await call("/catalog")).json;
  const at = ids(catalog).indexOf("tiflis");
  assert.equal(
    ids(catalog)[at + 1],
    "tiflis-gunubirlik",
    "kaynağın hemen arkasında",
  );
  const copy = catalog.tours.find((x) => x.id === "tiflis-gunubirlik");
  assert.equal(copy.abroad, true, "Yurt dışı kategorisi: 5 gün ücretsiz iptal");
  // Sayfa ve site haritası.
  const page = await fetch(root + "/turlar/tiflis-gunubirlik");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Günübirlik Tiflis/);
  assert.match(
    await (await fetch(root + "/sitemap.xml")).text(),
    /turlar\/tiflis-gunubirlik/,
  );
  // Düzenleme: tür ve program değişir; kaynak etkilenmez.
  const info = (
    await call("/admin/content/tours/tiflis-gunubirlik", { cookie: owner })
  ).json;
  const saved = await call("/admin/content/tours/tiflis-gunubirlik", {
    body: {
      ...info.current,
      category: "Kültür",
      duration: "Günübirlik",
      itinerary: [{ time: "07:00", title: "Hareket", text: "Kars." }],
    },
    cookie: owner,
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.json));
  catalog = (await call("/catalog")).json;
  assert.equal(
    catalog.tours.find((x) => x.id === "tiflis-gunubirlik").abroad,
    false,
  );
  assert.equal(
    catalog.tours.find((x) => x.id === "tiflis").itinerary.length > 1,
    true,
  );
  // "Varsayılana dön" kopyalandığı hâle döner.
  const reset = await call("/admin/content/tours/tiflis-gunubirlik/reset", {
    body: {},
    cookie: owner,
  });
  assert.equal(reset.json.current.name, "Günübirlik Tiflis");
  assert.deepEqual(reset.json.current.itinerary, info.current.itinerary);
  // Yeniden başlatma: dizi kopyasız kalsa da açılışta geri yüklenir.
  tours.splice(
    tours.findIndex((x) => x.id === "tiflis-gunubirlik"),
    1,
  );
  await store.content.reload();
  assert.ok(ids((await call("/catalog")).json).includes("tiflis-gunubirlik"));
});

test("copy address rules: valid slug, unique, copy of a copy, unknown source", async (t) => {
  const { call, owner } = await fixture(t);
  const copy = (from, body) =>
    call(`/admin/content/tours/${from}/copy`, { body, cookie: owner });
  assert.equal(
    (await copy("batum", { id: "Batum Turu!", name: "Batum 2" })).status,
    400,
  );
  assert.equal(
    (await copy("batum", { id: "ab", name: "Batum 2" })).status,
    400,
  );
  assert.equal(
    (await copy("batum", { id: "tiflis", name: "Batum 2" })).status,
    409,
  );
  assert.equal(
    (await copy("yok-boyle-tur", { id: "batum-iki", name: "Batum 2" })).status,
    400,
  );
  assert.equal(
    (await copy("batum", { id: "batum-iki", name: "Batum 2" })).status,
    201,
  );
  assert.equal(
    (await copy("batum", { id: "batum-iki", name: "Batum 3" })).status,
    409,
  );
  const second = await copy("batum-iki", { id: "batum-uc", name: "Batum 3" });
  assert.equal(second.status, 201);
  assert.equal(second.json.current.name, "Batum 3");
  // Kod içindeki turlar gizlenemez / silinemez.
  assert.equal(
    (
      await call("/admin/content/tours/batum/visibility", {
        body: { hidden: true },
        cookie: owner,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/admin/content/tours/batum", {
        method: "DELETE",
        cookie: owner,
      })
    ).status,
    409,
  );
});

test("published copy takes departures, bookings and requests; delete only without departures", async (t) => {
  const { store, call, owner } = await fixture(t);
  await call("/admin/content/tours/van/copy", {
    body: { id: "van-gunubirlik-yeni", name: "Van Gölü Günübirlik" },
    cookie: owner,
  });
  await call("/admin/content/tours/van-gunubirlik-yeni/visibility", {
    body: { hidden: false },
    cookie: owner,
  });
  await store.operations.update("van-gunubirlik-yeni", {
    salesOpen: true,
    vehicleModel: "vip-midibus",
    passengerSeats: 19,
  });
  const dep = await call("/admin/departures", {
    body: {
      tourId: "van-gunubirlik-yeni",
      date: "2027-03-10",
      startTime: "07:00",
      pickup: "Kars Garı",
      guideName: "Rehber",
      guidePhone: "05550000000",
      price: 150000,
      vehicleModel: "vip-midibus",
      passengerSeats: 19,
      active: true,
    },
    cookie: owner,
  });
  assert.equal(dep.status, 200, JSON.stringify(dep.json));
  const seats = (await call(`/tours/van-gunubirlik-yeni/departures`)).json;
  assert.equal(seats.length, 1);
  const req = await call("/requests", {
    body: {
      kind: "tour-info",
      tourId: "van-gunubirlik-yeni",
      name: "Bilgi Misafir",
      email: "bilgi@example.com",
      phone: "05551112233",
      checkIn: "2027-03-01",
      guests: 2,
      consent: true,
    },
  });
  assert.equal(req.status, 201, JSON.stringify(req.json));
  assert.equal(
    (
      await call("/requests", {
        body: {
          kind: "tour-info",
          tourId: "uydurma-tur",
          name: "X Y",
          email: "x@example.com",
          phone: "05551112233",
          checkIn: "2027-03-01",
          guests: 1,
          consent: true,
        },
      })
    ).status,
    400,
  );
  // Seferi olan kopya silinmez; taslağa alınabilir.
  assert.equal(
    (
      await call("/admin/content/tours/van-gunubirlik-yeni", {
        method: "DELETE",
        cookie: owner,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/admin/content/tours/van-gunubirlik-yeni/visibility", {
        body: { hidden: true },
        cookie: owner,
      })
    ).status,
    200,
  );
  assert.ok(
    !ids((await call("/catalog")).json).includes("van-gunubirlik-yeni"),
  );
  // Seferi olmayan kopya silinir.
  await call("/admin/content/tours/van/copy", {
    body: { id: "van-deneme", name: "Van Deneme" },
    cookie: owner,
  });
  assert.equal(
    (
      await call("/admin/content/tours/van-deneme", {
        method: "DELETE",
        cookie: owner,
      })
    ).status,
    200,
  );
  assert.ok(!tours.some((x) => x.id === "van-deneme"));
  assert.equal(
    await store.db.one("tour_operations", { _id: "van-deneme" }),
    null,
  );
});
