// Üyelikteki rezervasyon listesi, üye oturumuyla bilet açma ve tur sonrası yorum isteği.
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";
import { displayName, tourEndDate } from "../server/guest-reviews.mjs";

const DAY = 86400000;
async function fixture(t) {
  let now = Date.now();
  const store = await openStore(":memory:", { clock: () => now });
  t.after(() => store.db.close());
  return {
    store,
    setNow: (ms) => {
      now = ms;
    },
    now: () => now,
  };
}
async function reserve(
  s,
  { email, name = "Ayşe Nur Kaya", memberId = null, seat = 1, index = 0 } = {},
) {
  const d = (await s.listDepartures("ani-cildir"))[index];
  const hold = await s.hold(d.id, [seat]);
  const r = await s.reserve({
    holdToken: hold.token,
    name,
    email,
    phone: "05550000000",
    passengers: [name],
    paymentMode: "deposit",
    memberId,
  });
  return { r, d };
}
const register = (s, email) =>
  s.members.register({
    name: "Üye Yolcu",
    email,
    password: "test-password-1234",
  });

test("üyelik listesi: misafir rezervasyonu yalnız doğrulanmış aynı e-postayla görünür", async (t) => {
  const { store: s } = await fixture(t);
  const { r: guest } = await reserve(s, { email: "ayse@example.com" });
  const { r: other } = await reserve(s, {
    email: "baska@example.com",
    seat: 2,
  });
  const m = await register(s, "ayse@example.com");
  // Doğrulanmamış e-posta: başkası bu adresle üye olmuş olabilir; geçmiş kayıt görünmez.
  let list = (await s.members.dashboard(m.id)).reservations;
  assert.deepEqual(list, []);
  await assert.rejects(
    s.lookupForMember(guest.reference, m.id),
    (e) => e.status === 404,
  );
  await s.db.update("members", { _id: m.id }, { email_verified: 1 });
  list = (await s.members.dashboard(m.id)).reservations;
  assert.deepEqual(
    list.map((x) => x.reference),
    [guest.reference],
  );
  assert.equal(list[0].tourName, "Ani, Çıldır ve Kars");
  assert.equal(list[0].status, "pending_agency");
  assert.equal(list[0].cancellationRequested, false);
  assert.ok(!list.some((x) => x.reference === other.reference));
  // Üye oturumu sahipliği kanıtlar: e-posta sorulmadan açılır; başkasınınki açılmaz.
  assert.equal(
    (await s.lookupForMember(guest.reference, m.id)).reference,
    guest.reference,
  );
  await assert.rejects(
    s.lookupForMember(other.reference, m.id),
    (e) => e.status === 404,
  );
  // İptal talebi listede ayrı durum olarak görünür.
  await s.workflow.confirm(guest.reference, { belowDeposit: true });
  await s.db.update(
    "reservations",
    { reference: guest.reference },
    { cancellation_requested_at: Date.now() },
  );
  list = (await s.members.dashboard(m.id)).reservations;
  assert.equal(list[0].status, "confirmed");
  assert.equal(list[0].cancellationRequested, true);
});

test("üyelik listesi: sağlayıcının doğrulamadığı sosyal girişte e-posta eşleşmesi kullanılmaz", async (t) => {
  const { store: s } = await fixture(t);
  const { r: guest } = await reserve(s, { email: "kurban@example.com" });
  const m = await s.members.social({
    provider: "facebook",
    subject: "fb-1",
    email: "kurban@example.com",
    name: "Saldırgan",
    emailVerified: false,
  });
  assert.equal(m.emailVerified, false);
  assert.deepEqual((await s.members.dashboard(m.id)).reservations, []);
  await assert.rejects(
    s.lookupForMember(guest.reference, m.id),
    (e) => e.status === 404,
  );
  // Üye girişiyle aldığı kendi rezervasyonu ise doğrulamasız da listelenir.
  const { r: own } = await reserve(s, {
    email: "kurban@example.com",
    memberId: m.id,
    seat: 3,
  });
  assert.deepEqual(
    (await s.members.dashboard(m.id)).reservations.map((x) => x.reference),
    [own.reference],
  );
  assert.equal(
    (await s.lookupForMember(own.reference, m.id)).reference,
    own.reference,
  );
});

test("HTTP: üye oturumuyla bilet sorgusu e-posta istemez, oturumsuz ve yabancı kayıtta kapalı", async (t) => {
  const store = await openStore(":memory:");
  const app = createApp(store, {
      env: { ADMIN_PASSWORD: "test-admin-only-password" },
    }),
    server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const base = "http://127.0.0.1:" + server.address().port;
  const req = (path, body, cookie) =>
    fetch(base + "/api" + path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "X-Rota-Client": "web",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
  const { r: guest } = await reserve(store, { email: "http-uye@example.com" });
  const { r: other } = await reserve(store, {
    email: "yabanci@example.com",
    seat: 2,
  });
  assert.equal(
    (await req("/member/reservations/lookup", { reference: guest.reference }))
      .status,
    401,
  );
  const registered = await req("/auth/register", {
    name: "Http Üye",
    email: "http-uye@example.com",
    password: "long-test-password",
    consent: true,
  });
  const sid = registered.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (
      await req(
        "/member/reservations/lookup",
        { reference: guest.reference },
        sid,
      )
    ).status,
    404,
  );
  await store.db.update(
    "members",
    { email: "http-uye@example.com" },
    { email_verified: 1 },
  );
  const ok = await req(
    "/member/reservations/lookup",
    { reference: guest.reference.toLowerCase() },
    sid,
  );
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.reference, guest.reference);
  assert.ok(body.ticketUrl.includes("/bilet/"));
  assert.ok(!("ledger" in body));
  assert.equal(
    (
      await req(
        "/member/reservations/lookup",
        { reference: other.reference },
        sid,
      )
    ).status,
    404,
  );
});

// Tur gününün ertesi günü İstanbul saatiyle 12:00.
const dayAfter = (ymd, days = 1) =>
  Date.parse(`${ymd}T12:00:00+03:00`) + days * DAY;

test("yorum isteği: onaylı katılımcıya tur sonrası bir kez gider; diğerlerine gitmez", async (t) => {
  const { store: s, setNow } = await fixture(t);
  const { r: ok, d } = await reserve(s, { email: "katilimci@example.com" });
  const { r: pending } = await reserve(s, {
    email: "bekleyen@example.com",
    seat: 2,
  });
  const { r: cancelReq } = await reserve(s, {
    email: "iptal@example.com",
    seat: 3,
  });
  const { r: noShow } = await reserve(s, {
    email: "gelmedi@example.com",
    seat: 4,
  });
  for (const r of [ok, cancelReq, noShow])
    await s.workflow.confirm(r.reference, { belowDeposit: true });
  await s.workflow.requestCancellation(
    cancelReq.reference,
    "iptal@example.com",
  );
  // Tur günü: henüz istek yok.
  setNow(Date.parse(`${d.date}T20:00:00+03:00`));
  assert.deepEqual(await s.guestReviews.sendRequests({ force: true }), {
    queued: 0,
  });
  setNow(dayAfter(d.date));
  await s.workflow.noShow(noShow.reference);
  const first = await s.guestReviews.sendRequests({ force: true });
  assert.equal(first.queued, 1);
  const mails = await s.db.find("notification_outbox", {
    kind: "review_request",
  });
  assert.deepEqual(
    mails.map((m) => m.recipient),
    ["katilimci@example.com"],
  );
  assert.match(
    mails[0].subject,
    /Ani, Çıldır ve Kars turunuz nasıl geçti\? \/ How was your tour\?/,
  );
  assert.match(mails[0].body, /Merhaba Ayşe,/);
  assert.match(mails[0].body, /Hello Ayşe,/);
  assert.match(mails[0].body, /listeden çıkabilirsiniz/);
  assert.match(mails[0].action_url, /\/yorum\/[a-f0-9]{64}$/);
  assert.ok(
    !mails.some((m) =>
      [pending, cancelReq, noShow].some((r) => m.recipient === r.email),
    ),
  );
  // Yeniden çalışınca (ve sonraki günlerde) ikinci e-posta gitmez.
  assert.equal((await s.guestReviews.sendRequests({ force: true })).queued, 0);
  setNow(dayAfter(d.date, 3));
  assert.equal((await s.guestReviews.sendRequests({ force: true })).queued, 0);
  assert.equal(
    await s.db.count("notification_outbox", { kind: "review_request" }),
    1,
  );
  assert.equal(await s.db.count("guest_review_requests"), 1);
  // Bağlantının özeti saklanır, kendisi saklanmaz.
  const token = mails[0].action_url.split("/").at(-1);
  const row = await s.db.one("guest_review_requests");
  assert.notEqual(row.token_hash, token);
  assert.ok(!JSON.stringify(row).includes(token));
});

test("yorum isteği: pencere dışı eski turlara ve listeden çıkan adrese gitmez; sabah 10'dan önce beklenir", async (t) => {
  const { store: s, setNow } = await fixture(t);
  const { r, d } = await reserve(s, { email: "eski@example.com" });
  await s.workflow.confirm(r.reference, { belowDeposit: true });
  setNow(dayAfter(d.date, 9));
  assert.equal((await s.guestReviews.sendRequests({ force: true })).queued, 0);
  const { r: r2, d: d2 } = await reserve(s, {
    email: "cikan@example.com",
    index: 1,
  });
  await s.workflow.confirm(r2.reference, { belowDeposit: true });
  setNow(Date.parse(`${d2.date}T09:00:00+03:00`) + DAY);
  assert.equal(
    (await s.guestReviews.sendRequests({ force: true })).skipped,
    "early",
  );
  await s.db.insertIfAbsent(
    "review_optouts",
    (await import("node:crypto"))
      .createHash("sha256")
      .update("rota-review-optout:cikan@example.com")
      .digest("hex"),
    { created_at: Date.now() },
  );
  setNow(dayAfter(d2.date));
  assert.equal((await s.guestReviews.sendRequests({ force: true })).queued, 0);
});

test("yorum bağlantısı tek kullanımlık; yorum onaylanınca ad + soyad baş harfiyle tur sayfasında görünür", async (t) => {
  const { store: s, setNow } = await fixture(t);
  const { r, d } = await reserve(s, {
    email: "yorumcu@example.com",
    name: "ayşe nur KAYA",
  });
  await s.workflow.confirm(r.reference, { belowDeposit: true });
  setNow(dayAfter(d.date));
  await s.guestReviews.sendRequests({ force: true });
  const token = (
    await s.db.one("notification_outbox", { kind: "review_request" })
  ).action_url
    .split("/")
    .at(-1);
  await assert.rejects(
    s.guestReviews.request("f".repeat(64)),
    (e) => e.status === 404,
  );
  await assert.rejects(
    s.guestReviews.request("bozuk"),
    (e) => e.status === 404,
  );
  const page = await s.guestReviews.request(token);
  assert.equal(page.state, "open");
  assert.equal(page.displayName, "Ayşe K.");
  assert.ok(!JSON.stringify(page).includes("yorumcu@example.com"));
  assert.ok(!JSON.stringify(page).includes("KAYA"));
  await s.guestReviews.submit(token, {
    rating: 5,
    text: "Rehberimiz harikaydı.",
  });
  await assert.rejects(
    s.guestReviews.submit(token, { rating: 1, text: "ikinci" }),
    (e) => e.status === 410,
  );
  assert.equal((await s.guestReviews.request(token)).state, "used");
  assert.equal(await s.db.count("guest_reviews"), 1);
  // Onaydan önce tur sayfasında görünmez.
  assert.deepEqual(await s.guestReviews.forTour("ani-cildir"), []);
  const [pending] = await s.guestReviews.adminList();
  assert.equal(pending.status, "pending");
  assert.equal(pending.reference, r.reference);
  await s.guestReviews.moderate(pending.id, "approved");
  const shown = await s.guestReviews.forTour("ani-cildir");
  assert.deepEqual(
    shown.map(({ name, rating, text }) => ({ name, rating, text })),
    [{ name: "Ayşe K.", rating: 5, text: "Rehberimiz harikaydı." }],
  );
  assert.ok(!JSON.stringify(shown).includes("@"));
  // Yayın izni rıza kaydına yazılır.
  assert.equal(await s.db.count("consents", { type: "review_publish" }), 1);
  // Süresi dolan bağlantı kullanılamaz.
  const { r: r2, d: d2 } = await reserve(s, {
    email: "gec@example.com",
    index: 1,
  });
  await s.workflow.confirm(r2.reference, { belowDeposit: true });
  setNow(dayAfter(d2.date));
  await s.guestReviews.sendRequests({ force: true });
  const late = (
    await s.db.one("notification_outbox", {
      recipient: "gec@example.com",
      kind: "review_request",
    })
  ).action_url
    .split("/")
    .at(-1);
  setNow(dayAfter(d2.date, 61));
  assert.equal((await s.guestReviews.request(late)).state, "expired");
  await assert.rejects(
    s.guestReviews.submit(late, { rating: 4, text: "" }),
    (e) => e.status === 410,
  );
});

test("yorum: listeden çıkınca bekleyen istek iptal olur; KVKK silmede yorum da silinir", async (t) => {
  const { store: s, setNow } = await fixture(t);
  const { r, d } = await reserve(s, { email: "kvkk@example.com" });
  await s.workflow.confirm(r.reference, { belowDeposit: true });
  setNow(dayAfter(d.date));
  await s.guestReviews.sendRequests({ force: true });
  const token = (
    await s.db.one("notification_outbox", { kind: "review_request" })
  ).action_url
    .split("/")
    .at(-1);
  await s.guestReviews.optOut(token);
  assert.equal(
    (await s.db.one("notification_outbox", { kind: "review_request" })).status,
    "cancelled",
  );
  assert.equal((await s.guestReviews.request(token)).optedOut, true);
  await s.guestReviews.submit(token, { rating: 4, text: "Güzeldi" });
  const exported = await s.privacy.exportByEmail("kvkk@example.com");
  assert.equal(exported.tourReviews.length, 1);
  await s.privacy.eraseByEmail("kvkk@example.com");
  assert.equal(await s.db.count("guest_reviews"), 0);
  assert.equal(await s.db.count("guest_review_requests"), 0);
});

test("yorum yardımcıları: görünen ad ve çok günlük tur bitişi", () => {
  assert.equal(displayName("mehmet"), "Mehmet");
  assert.equal(displayName("  İsmail   hakkı   öztürk "), "İsmail Ö.");
  assert.equal(displayName(""), "Misafirimiz");
  assert.equal(
    tourEndDate("2026-12-30", { duration: "3 gün · 2 gece" }),
    "2027-01-01",
  );
  assert.equal(
    tourEndDate("2026-12-30", { duration: "Günübirlik" }),
    "2026-12-30",
  );
});
