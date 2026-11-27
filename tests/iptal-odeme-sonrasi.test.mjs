// İptal talebi ve ödeme sonrası: iptal talebi bekleyen kayıtta ödeme alınmaz, müşteriye
// iade hesabı gösterilir, ödeme sonucu sayfasındaki bilet e-posta sorulmadan açılır ve
// ön kayıt numarası (BK-…) "Rezervasyonum"da tanınır.
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";

async function fixture(t) {
  let now = Date.parse("2026-10-17T06:00:00Z");
  const env = {
    PAYMENT_PROVIDER: "test",
    PUBLIC_BASE_URL: "https://rotakarsturizm.com",
    AGENCY_EMAIL: "ekip@rotakars.test",
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
  const root = `http://127.0.0.1:${server.address().port}/api`;
  let cookie = "";
  const call = async (path, body, { admin = false } = {}) => {
    const r = await fetch(root + path, {
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        "Content-Type": "application/json",
        "X-Rota-Client": "web",
        ...(admin && cookie ? { Cookie: cookie } : {}),
      },
    });
    if (path === "/admin/login")
      cookie = r.headers.get("set-cookie").split(";")[0];
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  await call("/admin/login", { password: "ilk-kurulum-parolasi" });
  const d = await store.departures.save({
    tourId: "ani-cildir",
    date: "2026-10-24",
    startTime: "09:00",
    pickup: "Kars Garı",
    guideName: "",
    guidePhone: "",
    price: 200000,
    vehicleModel: "vip-midibus",
    passengerSeats: 18,
    active: true,
  });
  const h = await store.hold(d.id, [2]);
  const r = await store.reserve({
    holdToken: h.token,
    name: "Ayşe Yılmaz",
    email: "ayse@example.com",
    phone: "05551112233",
    passengers: ["Ayşe Yılmaz"],
    paymentMode: "deposit",
  });
  const creds = { reference: r.reference, email: "ayse@example.com" };
  const startPayment = async () => {
    const s = await call("/payments/start", creds);
    return { ...s, id: s.json?.redirectUrl?.split("/").pop() };
  };
  const pay = async () => {
    const s = await startPayment();
    assert.equal(s.status, 200, JSON.stringify(s.json));
    const done = await call(`/payments/test/${s.id}/result`, {
      result: "paid",
    });
    assert.equal(done.json.status, "paid");
    return s.id;
  };
  return {
    store,
    call,
    r,
    creds,
    startPayment,
    pay,
    advance: (ms) => (now += ms),
  };
}

test("iptal talebi bekleyen rezervasyonda kalan tutar ödenemez; talep geri alınınca ödeme açılır", async (t) => {
  const { store, call, r, creds, startPayment, pay } = await fixture(t);
  await pay();
  const paid = await store.workflow.get(r.reference);
  assert.equal(paid.status, "confirmed");
  assert.ok(paid.balance_due > 0);
  // Önceden açılmış ödeme sekmesi: oturum iptal talebinden önce açıldı.
  const earlier = await startPayment();
  assert.equal(earlier.status, 200);

  const cancelled = await call("/reservations/cancel", creds);
  assert.equal(cancelled.status, 200);
  assert.ok(cancelled.json.cancellation_requested_at);
  assert.equal(
    cancelled.json.status,
    "confirmed",
    "kaporası ödenmiş kayıt talep olarak bekler",
  );

  const blocked = await startPayment();
  assert.equal(blocked.status, 409);
  assert.match(
    blocked.json.message,
    /İptal talebiniz acente değerlendirmesini bekliyor/,
  );
  // Bilet belirteci ödeme açmaz (yalnız Rezervasyonum'a yönlendirir); panel bağlantı üretmez.
  const viaTicket = await call("/payments/start-ticket", {
    token: paid.ticket_token,
  });
  assert.equal(viaTicket.status, 200);
  assert.equal(viaTicket.json.redirectUrl, undefined);
  assert.equal(viaTicket.json.lookup, r.reference);
  const link = await call(
    `/admin/reservations/${r.reference}/payment-link`,
    {},
    { admin: true },
  );
  assert.equal(link.status, 409);
  assert.match(link.json.message, /iptal talebi/);
  // Talepten önce açılmış oturum tamamlansa da tahsilat işlenmez.
  const late = await call(`/payments/test/${earlier.id}/result`, {
    result: "paid",
  });
  assert.equal(late.json.status, "failed");
  assert.equal((await store.workflow.get(r.reference)).net_paid, paid.net_paid);

  // Müşteri vazgeçti, acente talebi kaldırdı: kalan ödeme yeniden açılır.
  const dismissed = await call(
    `/admin/reservations/${r.reference}/cancellation-request/dismiss`,
    {},
    { admin: true },
  );
  assert.equal(dismissed.status, 200, JSON.stringify(dismissed.json));
  assert.equal(dismissed.json.cancellation_requested_at, null);
  const again = await startPayment();
  assert.equal(again.status, 200);
  assert.equal(again.json.amount, paid.balance_due);
  assert.equal(
    (
      await call(
        `/admin/reservations/${r.reference}/cancellation-request/dismiss`,
        {},
        { admin: true },
      )
    ).status,
    409,
    "bekleyen talep yoksa kaldırılacak bir şey yok",
  );
  // İptal edilmiş kayıtta da ödeme başlatılamaz.
  await store.workflow.cancel(r.reference);
  assert.equal((await startPayment()).status, 409);
});

test("Rezervasyonum iptal penceresi için iade hesabı: süre içinde tamamı, süre geçince kapora düşülür", async (t) => {
  const { call, creds, pay, advance } = await fixture(t);
  const before = await call("/reservations/lookup", creds);
  assert.equal(before.json.cancellation_quote.net_paid, 0);
  assert.equal(before.json.cancellation_quote.refund, 0);
  await pay();
  const quote = (await call("/reservations/lookup", creds)).json
    .cancellation_quote;
  assert.equal(quote.late, false);
  assert.equal(quote.net_paid, 60000);
  assert.equal(quote.refund, 60000, "kesintisiz süre içinde ödenenin tamamı");
  assert.equal(quote.retained, 0);
  assert.equal(quote.refund_days, 14);
  assert.equal(quote.free_until, Date.parse("2026-10-21T09:00:00+03:00"));
  // Kesintisiz süre (hareketten 3 gün önce) geçti: kapora iade edilmez.
  advance(5 * 86400000);
  const lateQuote = (await call("/reservations/lookup", creds)).json
    .cancellation_quote;
  assert.equal(lateQuote.late, true);
  assert.equal(lateQuote.retained, 60000);
  assert.equal(lateQuote.refund, 0);
  // Talep yapıldıktan sonra hesap talebin ulaştığı ana göre sabit kalır.
  const requested = await call("/reservations/cancel", creds);
  assert.equal(requested.json.cancellation_quote.late, true);
});

test("ödeme sonucu sayfasındaki bilet e-posta sorulmadan, yalnız ödenmiş oturumla ve sınırlı süre açılır", async (t) => {
  const { call, r, startPayment, pay, advance } = await fixture(t);
  const open = await startPayment();
  const unpaid = await call(`/payments/sessions/${open.id}/reservation`);
  assert.equal(unpaid.status, 404, "ödenmemiş oturum bilet açmaz");
  assert.equal(
    (await call(`/payments/sessions/${"a".repeat(48)}/reservation`)).status,
    404,
  );
  assert.equal(
    (await call(`/payments/sessions/${r.reference}/reservation`)).status,
    400,
    "referansla erişilemez",
  );

  const id = await pay();
  const ticket = await call(`/payments/sessions/${id}/reservation`);
  assert.equal(ticket.status, 200, JSON.stringify(ticket.json));
  assert.equal(ticket.json.reference, r.reference);
  assert.equal(ticket.json.status, "confirmed");
  assert.ok(ticket.json.qrDataUrl.startsWith("data:image/png"));
  assert.equal(
    ticket.json.ledger,
    undefined,
    "tahsilat satırları müşteriye dönmez",
  );
  assert.ok(ticket.json.cancellation_quote);
  advance(25 * 3600000);
  assert.equal(
    (await call(`/payments/sessions/${id}/reservation`)).status,
    404,
    "bir gün sonra Rezervasyonum'dan sorgulanır",
  );
});

test("ön kayıt numarası (BK-…) Rezervasyonum'da e-postayla sorgulanır", async (t) => {
  const { store, call } = await fixture(t);
  await store.operations.setMode("guneydogu", {
    mode: "demand",
    threshold: 10,
    showProgress: false,
  });
  const created = await call("/interest", {
    kind: "prereg",
    tourId: "guneydogu",
    preferredDate: "Mart 2027",
    name: "Ön Kayıt Misafir",
    email: "onkayit@example.com",
    phone: "05551112233",
    count: 2,
    consent: true,
  });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const reference = created.json.reference;
  const mail = (
    await store.db.find("notification_outbox", {
      recipient: "onkayit@example.com",
    })
  )[0];
  assert.match(mail.body, /Bu numara bir rezervasyon değildir/);
  assert.ok(
    mail.body.includes(
      "https://rotakarsturizm.com/rezervasyonum?ref=" + reference,
    ),
  );

  const found = await call("/interest/lookup", {
    reference: reference.toLowerCase(),
    email: "OnKayit@example.com",
  });
  assert.equal(found.status, 200, JSON.stringify(found.json));
  assert.equal(found.json.reference, reference);
  assert.equal(found.json.kind, "prereg");
  assert.equal(found.json.status, "waiting");
  assert.equal(found.json.count, 2);
  assert.equal(found.json.preferredDate, "Mart 2027");
  assert.equal(found.json.email, undefined, "iletişim bilgisi dönmez");
  assert.equal(found.json.phone, undefined);
  assert.equal(
    (await call("/interest/lookup", { reference, email: "baska@example.com" }))
      .status,
    404,
  );
  assert.equal(
    (
      await call("/interest/lookup", {
        reference: "BK-00000000",
        email: "onkayit@example.com",
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await call("/interest/lookup", {
        reference: "BK-.*",
        email: "onkayit@example.com",
      })
    ).status,
    404,
  );
});
