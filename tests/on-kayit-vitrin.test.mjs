// Tur vitrini ve ön kayıt (Kasım 2026 müşteri değerlendirmesi 2.6 ve 2.10):
//  - talep tarihinde kesinleşme kararının en geç tarihi (hareket − asgari katılımcı bildirim
//    süresi); bu tarih geçince tarih sitede ön kayda kapanır, panelde görünür kalır.
//  - satışa kapalı tur için "tarih açılınca haber ver" (kind: "notify"); tur açılınca e-posta.
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";
import { tours } from "../server/catalog.mjs";
import { minNoticeHoursOf } from "../server/legal.mjs";

async function fixture(t) {
  // 2026-11-27 09:00 (İstanbul).
  let now = Date.parse("2026-11-27T06:00:00Z");
  const env = {
    AGENCY_EMAIL: "ekip@rotakars.test",
    PUBLIC_BASE_URL: "https://rotakarsturizm.com",
  };
  const store = await openStore(":memory:", {
    clock: () => now,
    env,
    seed: false,
  });
  const app = createApp(store, {
    env: { ...env, ADMIN_PASSWORD: "ilk-kurulum-parolasi" },
    reviewsService: {
      get: async () => ({ status: "not_configured", reviews: [] }),
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const root = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const call = async (path, body) => {
    const r = await fetch(root + "/api" + path, {
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        "Content-Type": "application/json",
        "X-Rota-Client": "web",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    if (path === "/admin/login")
      cookie = r.headers.get("set-cookie").split(";")[0];
    const type = r.headers.get("content-type") || "";
    return {
      status: r.status,
      json: type.includes("json") ? await r.json() : null,
    };
  };
  await call("/admin/login", { password: "ilk-kurulum-parolasi" });
  const departure = (tourId, extra = {}) =>
    store.departures.save({
      tourId,
      date: "2026-12-26",
      startTime: "08:30",
      pickup: "Kars",
      guideName: "",
      guidePhone: "",
      price: 600000,
      vehicleModel: "vip-midibus",
      passengerSeats: 18,
      active: true,
      ...extra,
    });
  const outbox = () =>
    store.db.find("notification_outbox", {}, { sort: { created_at: 1 } });
  const setSales = (tourId, salesOpen) =>
    store.operations.update(tourId, {
      salesOpen,
      vehicleModel: "vip-midibus",
      passengerSeats: 19,
    });
  return {
    store,
    call,
    departure,
    outbox,
    setSales,
    advance: (ms) => (now += ms),
  };
}
const person = (extra = {}) => ({
  name: "Vitrin Misafir",
  email: "vitrin@example.com",
  phone: "05551112233",
  count: 2,
  consent: true,
  ...extra,
});
const tour = (id) => tours.find((t) => t.id === id);
const to = (m) => m.recipient || m.email;

test("notice hours: the panel value wins, otherwise the package-tour minimums by duration", () => {
  assert.equal(minNoticeHoursOf({ duration: "Günübirlik" }), 48);
  assert.equal(minNoticeHoursOf({ duration: "2 gün · 1 gece" }), 168);
  assert.equal(minNoticeHoursOf({ duration: "8 gün · 7 gece" }), 480);
  assert.equal(
    minNoticeHoursOf({ duration: "2 gün · 1 gece", minNoticeHours: 72 }),
    72,
  );
});

test("a demand date shows its decision day and closes on the site once that day has passed", async (t) => {
  const { store, call, departure } = await fixture(t);
  // Nahçıvan günübirlik: karar hareketten 48 saat önce.
  const tomorrow = await departure("nahcivan", {
    date: "2026-11-28",
    startTime: "06:00",
  });
  const later = await departure("nahcivan", {
    date: "2026-12-12",
    startTime: "06:00",
  });
  const g = (await call("/catalog")).json.tours.find(
    (x) => x.id === "nahcivan",
  );
  assert.deepEqual(
    g.demandDates.map((x) => [x.id, x.decisionDate]),
    [[later.id, "2026-12-10"]],
    "yarınki tarihin karar günü geçti; sitede ön kayda açık görünmez",
  );
  const late = await call("/interest", {
    kind: "prereg",
    tourId: "nahcivan",
    departureId: tomorrow.id,
    ...person(),
  });
  assert.equal(late.status, 409);
  assert.match(late.json.message, /süresi doldu/);
  const ok = await call("/interest", {
    kind: "prereg",
    tourId: "nahcivan",
    departureId: later.id,
    ...person(),
  });
  assert.equal(ok.status, 201, JSON.stringify(ok.json));
  const mail = (await store.db.find("notification_outbox", {})).find(
    (m) => to(m) === "vitrin@example.com",
  );
  assert.match(
    mail.body,
    /14 kişiye ulaşınca kesinleşir; kararı en geç 10 Aralık 2026/,
  );
  // Panel karar günü geçen tarihi de gösterir, sitede kapandığını işaretler.
  const admin = (await call("/admin/interest")).json.tours.find(
    (x) => x.id === "nahcivan",
  );
  assert.deepEqual(
    admin.dates.map((x) => [x.date, x.decisionDate, x.closedOnSite]),
    [
      ["2026-11-28", "2026-11-26", true],
      ["2026-12-12", "2026-12-10", false],
    ],
  );
  // Panelde girilen iptal bildirim süresi kararı öne çeker.
  const before = tour("nahcivan").minNoticeHours;
  t.after(() => (tour("nahcivan").minNoticeHours = before));
  tour("nahcivan").minNoticeHours = 24 * 20;
  const g2 = (await call("/catalog")).json.tours.find(
    (x) => x.id === "nahcivan",
  );
  assert.equal(
    g2.demandDates,
    undefined,
    "20 gün önce karar: iki tarih de kapandı",
  );
});

test("an online tour with only a demand date lists it in the catalog with no next departure", async (t) => {
  const { call, departure } = await fixture(t);
  const d = await departure("batum", { salesMode: "demand" });
  const g = (await call("/catalog")).json.tours.find((x) => x.id === "batum");
  assert.equal(g.mode, "online");
  assert.equal(g.next, undefined);
  assert.deepEqual(
    g.demandDates.map((x) => [x.id, x.date]),
    [[d.id, "2026-12-26"]],
  );
  assert.equal(g.demand.threshold, 14, "eşik online turda da sitede");
});

test("closed tours take 'tell me when dates open' sign-ups; open tours refuse them", async (t) => {
  const { store, call, outbox } = await fixture(t);
  // Van Havzası varsayılan olarak satışa kapalıdır.
  const r = await call("/interest", {
    kind: "notify",
    tourId: "van-havzasi",
    preferredDate: "Mayıs 2027",
    ...person(),
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.match(r.json.reference, /^BK-/);
  const again = await call("/interest", {
    kind: "notify",
    tourId: "van-havzasi",
    ...person({ count: 3 }),
  });
  assert.equal(again.json.updated, true, "aynı e-posta yeni kayıt açmaz");
  const open = await call("/interest", {
    kind: "notify",
    tourId: "ani-cildir",
    ...person(),
  });
  assert.equal(open.status, 409);
  const mails = await outbox();
  const own = mails.filter((m) => to(m) === "vitrin@example.com");
  assert.equal(own.length, 1);
  assert.match(own[0].subject, /Haber listesindesiniz/);
  assert.match(
    own[0].body,
    /listeden çıkmak için: https:\/\/rotakarsturizm\.com\/api\/interest\/[a-f0-9]{36}\/cancel/,
  );
  assert.match(
    mails.find((m) => to(m) === "ekip@rotakars.test").subject,
    /Haber listesi: .* · 2 kişi/,
  );
  // Panel: tur bazında sayı ve kayıtlar.
  const admin = (await call("/admin/interest")).json;
  assert.equal(admin.tours.find((x) => x.id === "van-havzasi").notifyCount, 3);
  assert.equal(admin.items.filter((x) => x.kind === "notify").length, 1);
  // KVKK onayı zorunlu.
  assert.equal(
    (
      await call("/interest", {
        kind: "notify",
        tourId: "van-havzasi",
        ...person({ consent: false }),
      })
    ).status,
    400,
  );
  assert.equal(
    await store.interest.demandCount("van-havzasi"),
    0,
    "talep sayacına karışmaz",
  );
});

test("when a closed tour opens with a bookable date, the notify list hears once", async (t) => {
  const { store, call, departure, outbox, setSales } = await fixture(t);
  await call("/interest", {
    kind: "notify",
    tourId: "van-havzasi",
    ...person(),
  });
  await call("/interest", {
    kind: "notify",
    tourId: "van-havzasi",
    lang: "en",
    ...person({ email: "guest@example.com" }),
  });
  await call("/interest", {
    kind: "notify",
    tourId: "van-havzasi",
    ...person({ email: "vazgecti@example.com" }),
  });
  const gone = await store.db.one("interest_list", {
    email: "vazgecti@example.com",
  });
  await store.interest.cancelByToken(gone.token);
  assert.equal(
    (await store.interest.notifyTourOpenings()).notified,
    0,
    "tur kapalı",
  );
  await setSales("van-havzasi", true);
  assert.equal(
    (await store.interest.notifyTourOpenings()).notified,
    0,
    "açık ama tarihi yok",
  );
  await departure("van-havzasi");
  assert.equal((await store.interest.notifyTourOpenings()).notified, 2);
  assert.equal(
    (await store.interest.notifyTourOpenings()).notified,
    0,
    "ikinci kez gitmez",
  );
  const sent = (await outbox()).filter((m) => m.kind === "interest_open");
  assert.deepEqual(sent.map(to).sort(), [
    "guest@example.com",
    "vitrin@example.com",
  ]);
  const tr = sent.find((m) => to(m) === "vitrin@example.com"),
    en = sent.find((m) => to(m) === "guest@example.com");
  assert.match(tr.subject, /rezervasyona açıldı/);
  assert.match(tr.body, /26 Aralık 2026 08:30/);
  assert.equal(
    tr.action_url,
    "https://rotakarsturizm.com/rezervasyon/van-havzasi",
  );
  assert.match(en.subject, /open for booking/);
  assert.match(en.body, /26 December 2026 08:30/);
  assert.equal(
    en.action_url,
    "https://rotakarsturizm.com/en/rezervasyon/van-havzasi",
  );
  assert.equal(
    (await store.db.one("interest_list", { email: "vazgecti@example.com" }))
      .status,
    "cancelled",
  );
});

test("a closed tour reopening to collect demand sends the notify list to the tour page", async (t) => {
  const { store, call, departure, outbox, setSales } = await fixture(t);
  await call("/interest", {
    kind: "notify",
    tourId: "van-havzasi",
    ...person(),
  });
  await call("/admin/operations/van-havzasi/mode", {
    mode: "demand",
    threshold: 12,
    showProgress: true,
  });
  await setSales("van-havzasi", true);
  await departure("van-havzasi"); // talep toplama turunda yeni tarih talep tarihidir
  assert.equal((await store.interest.notifyTourOpenings()).notified, 1);
  const [mail] = (await outbox()).filter((m) => m.kind === "interest_open");
  assert.match(mail.subject, /ön kayıt açıldı/);
  assert.match(mail.body, /planlanan tarihler: 26 Aralık 2026 08:30/);
  assert.equal(
    mail.action_url,
    "https://rotakarsturizm.com/turlar/van-havzasi",
  );
});
