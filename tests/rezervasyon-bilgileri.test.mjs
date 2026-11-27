// Rezervasyon formundaki yolculuk bilgileri: alınış yeri, çocuklar ve müşteri notu.
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";
import { renderMail } from "../server/mail-template.mjs";

const PASSWORD = "ilk-kurulum-parolasi";
async function fixture(t) {
  let now = Date.now();
  const env = { ...process.env, AGENCY_EMAIL: "ekip@rotakars.test" };
  const store = await openStore(":memory:", { clock: () => now, env });
  const app = createApp(store, {
    env: { ADMIN_PASSWORD: PASSWORD },
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
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path, { body, cookie } = {}) => {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        "Content-Type": "application/json",
        "X-Rota-Client": "web",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* CSV */
    }
    return {
      status: r.status,
      json,
      text,
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  };
  const [departure] = await store.listDepartures("ani-cildir");
  const book = async (extra = {}, seat = 1) => {
    const hold = await call("/holds", {
      body: { departureId: departure.id, seats: [seat] },
    });
    return call("/reservations", {
      body: {
        holdToken: hold.json.token,
        name: "Ayşe Yılmaz",
        email: "ayse@example.com",
        phone: "05551112233",
        passengers: ["Ayşe Yılmaz"],
        passengerDetails: [
          { nationality: "TR", idNumber: "10000000146", gender: "K" },
        ],
        paymentMode: "deposit",
        consents: {
          preInfo: true,
          contract: true,
          cancellation: true,
          privacy: true,
        },
        ...extra,
      },
    });
  };
  const admin = async () =>
    (await call("/admin/login", { body: { password: PASSWORD } })).cookie;
  return { store, call, book, admin, departure, advance: (ms) => (now += ms) };
}

const info = {
  pickupAddress: "Kars Otel\u0007 · Faikbey Cd.\nNo: 12",
  children: { ages: "4 ve 9", seat: true },
  note: "Annem yavaş yürüyor.\r\nÖn sıraya yakın olursa seviniriz.",
};

test("alınış yeri, çocuk ve not kayda şifreli/temiz yazılır; fiyat değişmez", async (t) => {
  const { store, book } = await fixture(t);
  const plain = await book({}, 2);
  const created = await book(info);
  assert.equal(created.status, 201, created.text);
  // Fiyat çocuk bilgisinden etkilenmez.
  assert.equal(created.json.total, plain.json.total);
  // Müşteriye dönen kayıtta kendi yazdığı bilgiler okunur hâlde.
  assert.equal(created.json.pickup_address, "Kars Otel · Faikbey Cd. No: 12");
  assert.deepEqual(created.json.children, { ages: "4 ve 9", seat: true });
  assert.equal(
    created.json.customer_note,
    "Annem yavaş yürüyor.\nÖn sıraya yakın olursa seviniriz.",
  );
  // Veritabanında alınış yeri ve not şifreli.
  const raw = await store.db.one("reservations", {
    reference: created.json.reference,
  });
  assert.match(raw.pickup_address, /^enc:v1:/);
  assert.match(raw.customer_note, /^enc:v1:/);
  assert.ok(!JSON.stringify(raw).includes("Faikbey"));
  // Bilgi verilmeyen kayıtta alanlar boş kalır.
  const empty = await store.db.one("reservations", {
    reference: plain.json.reference,
  });
  assert.equal(empty.pickup_address, "");
  assert.equal(empty.children, null);
  assert.equal(empty.customer_note, "");
});

test("uzun ya da hatalı alanlar Türkçe mesajla reddedilir", async (t) => {
  const { book } = await fixture(t);
  const long = await book({ pickupAddress: "a".repeat(201) });
  assert.equal(long.status, 400);
  assert.match(long.json.message, /Alınış yeri en fazla 200 karakter/);
  const note = await book({ note: "n".repeat(501) }, 2);
  assert.equal(note.status, 400);
  assert.match(note.json.message, /Not en fazla 500 karakter/);
  const extraKey = await book({ children: { ages: "5", discount: true } }, 3);
  assert.equal(extraKey.status, 400);
  const ages = await book(
    { children: { ages: "1".repeat(61), seat: false } },
    4,
  );
  assert.equal(ages.status, 400);
  assert.match(ages.json.message, /Çocuk yaşları/);
});

test("bilgiler müşteri ve acente e-postasında yer alır", async (t) => {
  const { store, book } = await fixture(t);
  const created = await book(info);
  const outbox = await store.db.find("notification_outbox", {});
  const customer = outbox.find((m) => m.kind === "reservation_created");
  assert.equal(customer.ticket.pickupAddress, "Kars Otel · Faikbey Cd. No: 12");
  assert.equal(
    customer.ticket.children,
    "yaşları 4 ve 9 · çocuk koltuğu gerekiyor",
  );
  assert.match(customer.ticket.note, /Annem yavaş yürüyor/);
  const mail = await renderMail({
    recipient: customer.recipient,
    subject: customer.subject,
    body: customer.body,
    ticket: customer.ticket,
  });
  assert.match(mail.text, /Alınış yeri: Kars Otel · Faikbey Cd\. No: 12/);
  assert.match(mail.text, /Çocuk: yaşları 4 ve 9 · çocuk koltuğu gerekiyor/);
  assert.match(mail.html, /Alınış yeri/);
  assert.match(mail.html, /Yaşları 4 ve 9/);
  assert.match(mail.html, /Notunuz/);
  const agency = outbox.find((m) => m.kind === "agency_reservation_created");
  assert.match(agency.body, new RegExp(created.json.reference));
  assert.match(agency.body, /Alınış yeri: Kars Otel/);
  assert.match(agency.body, /Çocuk: yaşları 4 ve 9 · çocuk koltuğu gerekiyor/);
  assert.match(agency.body, /Müşteri notu: Annem yavaş yürüyor/);
  // HTML'e kaçışsız girmez.
  const evil = await book({ pickupAddress: "<b>Otel</b>" }, 2);
  const evilMail = (await store.db.find("notification_outbox", {})).find(
    (m) =>
      m.kind === "reservation_created" && m.body.includes(evil.json.reference),
  );
  const html = (
    await renderMail({
      ...evilMail,
      recipient: evilMail.recipient,
      ticket: evilMail.ticket,
    })
  ).html;
  assert.ok(!html.includes("<b>Otel</b>"));
  assert.match(html, /&lt;b&gt;Otel&lt;\/b&gt;/);
});

test("panel: sefer yolcu listesi ve CSV'de görünür, alınış yeri sonradan yazılabilir", async (t) => {
  const { store, call, book, admin, departure } = await fixture(t);
  const created = await book(info);
  const cookie = await admin();
  const list = await call(`/admin/departures/${departure.id}/passengers`, {
    cookie,
  });
  assert.equal(list.status, 200);
  const row = list.json.bookings.find(
    (b) => b.reference === created.json.reference,
  );
  assert.equal(row.pickupAddress, "Kars Otel · Faikbey Cd. No: 12");
  assert.equal(row.children, "yaşları 4 ve 9 · çocuk koltuğu gerekiyor");
  assert.match(row.customerNote, /Annem/);
  const csv = await call(`/admin/departures/${departure.id}/passengers.csv`, {
    cookie,
  });
  assert.match(csv.text, /"Alınış yeri","Çocuk","Müşteri notu"/);
  assert.match(csv.text, /"Kars Otel · Faikbey Cd\. No: 12"/);

  const other = await book({}, 2);
  const unauth = await call(
    `/admin/reservations/${other.json.reference}/pickup`,
    { body: { pickupAddress: "X" } },
  );
  assert.equal(unauth.status, 401);
  const set = await call(`/admin/reservations/${other.json.reference}/pickup`, {
    body: { pickupAddress: "  Kafkas Otel\n resepsiyon " },
    cookie,
  });
  assert.equal(set.status, 200, set.text);
  assert.equal(set.json.pickup_address, "Kafkas Otel resepsiyon");
  const raw = await store.db.one("reservations", {
    reference: other.json.reference,
  });
  assert.match(raw.pickup_address, /^enc:v1:/);
  const audit = await store.db.find("reservation_audit", {
    event: "pickup_updated",
  });
  assert.equal(audit.length, 1);
  assert.ok(!JSON.stringify(audit).includes("Kafkas"));
  const tooLong = await call(
    `/admin/reservations/${other.json.reference}/pickup`,
    {
      body: { pickupAddress: "a".repeat(201) },
      cookie,
    },
  );
  assert.equal(tooLong.status, 400);
});

test("KVKK: dökümde yer alır, anonimleştirmede ve tur sonrası saklama işinde silinir", async (t) => {
  const { store, call, book, admin, advance } = await fixture(t);
  const cookie = await admin();
  const kept = await book(info);
  const exported = await call("/admin/kvkk/export", {
    body: { email: "ayse@example.com" },
    cookie,
  });
  const row = exported.json.reservations.find(
    (r) => r.reference === kept.json.reference,
  );
  assert.equal(row.pickupAddress, "Kars Otel · Faikbey Cd. No: 12");
  assert.deepEqual(row.children, { ages: "4 ve 9", seat: true });
  assert.match(row.note, /Annem/);

  // Tur tarihinden 1 yıl sonra (ödemeli kayıt anonimleşmeden önce) alınış bilgileri silinir.
  await store.workflow.payment(kept.json.reference, {
    amount: kept.json.deposit,
    method: "bank",
    externalReference: "DEKONT-9",
  });
  advance(800 * 86400000);
  const result = await store.privacy.runRetention();
  assert.ok(result.passengerIdsPurged >= 1);
  const purged = await store.db.one("reservations", {
    reference: kept.json.reference,
  });
  assert.equal(purged.pickup_address, "");
  assert.equal(purged.customer_note, "");
  assert.equal(purged.children, null);
  assert.equal(
    purged.name,
    "Ayşe Yılmaz",
    "ödemeli kaydın kendisi yasal süre boyunca kalır",
  );
});

test("KVKK silme talebinde ödemesiz kayıttaki bilgiler temizlenir", async (t) => {
  const { store, call, book, admin } = await fixture(t);
  const cookie = await admin();
  const r = await book(info);
  await store.workflow.cancel(r.json.reference);
  const erased = await call("/admin/kvkk/erase", {
    body: { email: "ayse@example.com", confirm: "SİL" },
    cookie,
  });
  assert.equal(erased.status, 200, erased.text);
  const raw = await store.db.one("reservations", {
    reference: r.json.reference,
  });
  assert.equal(raw.pickup_address, "");
  assert.equal(raw.customer_note, "");
  assert.equal(raw.children, null);
});
