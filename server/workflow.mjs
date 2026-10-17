import { randomBytes, randomUUID } from "node:crypto";
import { AppError } from "./store.mjs";
import { localDate } from "./departures.mjs";
import { tours, business } from "./catalog.mjs";
const longExpiry = (now) => now + 365 * 86400000;
export async function createWorkflow(
  db,
  { clock, tx, departures, members, notifications, env, cleanup },
) {
  const columns = (
    await db.prepare("PRAGMA table_info(reservations)").all()
  ).map((c) => c.name);
  for (const [name, type] of Object.entries({
    ticket_token: "TEXT",
    confirmed_at: "INTEGER",
    checked_in_at: "INTEGER",
    completed_at: "INTEGER",
    cancellation_requested_at: "INTEGER",
    discount_percent: "INTEGER NOT NULL DEFAULT 0",
  }))
    if (!columns.includes(name))
      await db.exec(`ALTER TABLE reservations ADD COLUMN ${name} ${type}`);
  await db.exec(`CREATE TABLE IF NOT EXISTS payment_ledger(id TEXT PRIMARY KEY,reservation_id TEXT NOT NULL REFERENCES reservations(id),kind TEXT NOT NULL,amount INTEGER NOT NULL,method TEXT NOT NULL,external_reference TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(method,external_reference,kind));
 CREATE TABLE IF NOT EXISTS reservation_audit(id TEXT PRIMARY KEY,reservation_id TEXT NOT NULL,event TEXT NOT NULL,details TEXT NOT NULL,created_at INTEGER NOT NULL);`);
  for (const r of await db
    .prepare("SELECT id FROM reservations WHERE ticket_token IS NULL")
    .all())
    await db
      .prepare(
        "UPDATE reservations SET ticket_token=? WHERE id=? AND ticket_token IS NULL",
      )
      .run(randomBytes(24).toString("hex"), r.id);
  await db
    .prepare(
      "UPDATE reservations SET discount_percent=COALESCE((SELECT percent FROM member_coupons WHERE id=reservations.coupon_id),ROUND(100.0*discount_amount/subtotal)) WHERE discount_percent=0 AND discount_amount>0 AND subtotal>0",
    )
    .run();
  const parse = async (r) => {
    if (!r) throw new AppError(404, "Rezervasyon bulunamadı.");
    const d = await departures.get(r.departure_id, {
        allowClosed: true,
        allowPast: true,
      }),
      ledger = await db
        .prepare(
          "SELECT * FROM payment_ledger WHERE reservation_id=? ORDER BY created_at,id",
        )
        .all(r.id),
      paid = ledger
        .filter((p) => p.kind === "payment")
        .reduce((n, p) => n + Number(p.amount), 0),
      refunded = ledger
        .filter((p) => p.kind === "refund")
        .reduce((n, p) => n + Number(p.amount), 0),
      net = paid - refunded;
    return {
      ...r,
      seats: JSON.parse(r.seats),
      passengers: JSON.parse(r.passengers),
      vehicle: r.vehicle_json ? JSON.parse(r.vehicle_json) : d.vehicle,
      date: d.date,
      tourId: d.tour_id,
      start_time: d.start_time,
      pickup: d.pickup,
      guide_name: d.guide_name,
      guide_phone: d.guide_phone,
      paid_total: paid,
      refunded_total: refunded,
      net_paid: net,
      balance_due: ["cancelled", "expired"].includes(r.status)
        ? 0
        : Math.max(0, r.total - net),
      payment_state:
        refunded && net === 0
          ? "refunded"
          : net >= r.total
            ? "paid"
            : net > 0
              ? "partial"
              : "unpaid",
      ledger,
    };
  };
  const audit = async (r, event, details) => {
    await db
      .prepare("INSERT INTO reservation_audit VALUES(?,?,?,?,?)")
      .run(randomUUID(), r.id, event, JSON.stringify(details), clock());
  };
  const notify = async (r, event, text) =>
    notifications.enqueue({
      email: r.email,
      subject: "Rota Kars · " + text,
      body: `Merhaba ${r.name},\n${r.reference} · ${tours.find((t) => t.id === r.tourId)?.name || r.tourId}\nTarih: ${r.date} · Saat: ${r.start_time}\nBuluşma: ${r.pickup}\n${text}\nKoltuklar: ${r.seats.join(", ")}.`,
      actionUrl: (env.PUBLIC_BASE_URL || "") + "/bilet/" + r.ticket_token,
      kind: event,
      dedupeKey: event + ":" + r.reference,
    });
  const api = {
    async get(reference, { fresh = true } = {}) {
      if (fresh) await cleanup();
      return parse(
        await db
          .prepare("SELECT * FROM reservations WHERE reference=?")
          .get(reference.toUpperCase()),
      );
    },
    async list({ date, all = false } = {}) {
      await cleanup();
      const rows = await db
        .prepare(
          "SELECT r.reference FROM reservations r JOIN departures d ON r.departure_id=d.id" +
            (date ? " WHERE d.date=?" : "") +
            " ORDER BY r.created_at DESC" +
            (all ? "" : " LIMIT 500"),
        )
        .all(...(date ? [date] : []));
      return Promise.all(
        rows.map((r) => api.get(r.reference, { fresh: false })),
      );
    },
    async created(reference) {
      const r = await api.get(reference);
      await notify(
        r,
        "reservation_created",
        "Ön rezervasyon talebiniz alındı; henüz kesin bilet veya ödeme değildir.",
      );
      return r;
    },
    async confirm(reference) {
      return tx(async () => {
        await cleanup();
        const r = await api.get(reference);
        if (r.status === "confirmed") return r;
        if (r.status !== "pending_agency")
          throw new AppError(
            409,
            "Yalnız bekleyen ön rezervasyon onaylanabilir.",
          );
        if (r.net_paid < r.deposit)
          throw new AppError(
            409,
            "Onay için en az seçilen kapora/tam ödeme tutarının tahsilatı kaydedilmeli.",
          );
        await db
          .prepare(
            "UPDATE reservations SET status='confirmed',confirmed_at=?,expires_at=? WHERE id=?",
          )
          .run(clock(), longExpiry(clock()), r.id);
        await db
          .prepare("UPDATE seat_locks SET expires_at=? WHERE owner=?")
          .run(longExpiry(clock()), r.reference);
        await audit(r, "confirmed", {});
        const updated = await api.get(reference);
        await notify(
          updated,
          "reservation_confirmed",
          "Rezervasyonunuz acente tarafından onaylandı.",
        );
        return updated;
      });
    },
    async payment(
      reference,
      { amount, method, externalReference, kind = "payment" },
    ) {
      return tx(async () => {
        await cleanup();
        const r = await api.get(reference),
          previous = await db
            .prepare(
              "SELECT * FROM payment_ledger WHERE method=? AND external_reference=? AND kind=?",
            )
            .get(method, externalReference, kind);
        if (previous) {
          if (
            previous.reservation_id !== r.id ||
            Number(previous.amount) !== amount
          )
            throw new AppError(
              409,
              "İşlem referansı başka bir kayıtta kullanılmış.",
            );
          return r;
        }
        if (!Number.isSafeInteger(amount) || amount <= 0)
          throw new AppError(400, "Geçerli bir tutar girin.");
        if (
          kind === "payment" &&
          (["cancelled", "expired", "completed"].includes(r.status) ||
            amount > r.total - r.net_paid)
        )
          throw new AppError(
            409,
            "Tahsilat tutarı kalan borcu aşıyor veya kayıt tahsilata kapalı.",
          );
        if (kind === "refund" && amount > r.net_paid)
          throw new AppError(409, "İade tutarı net tahsilatı aşamaz.");
        await db
          .prepare("INSERT INTO payment_ledger VALUES(?,?,?,?,?,?,?)")
          .run(
            randomUUID(),
            r.id,
            kind,
            amount,
            method,
            externalReference,
            clock(),
          );
        if (kind === "payment") {
          await db
            .prepare("UPDATE reservations SET expires_at=? WHERE id=?")
            .run(longExpiry(clock()), r.id);
          await db
            .prepare("UPDATE seat_locks SET expires_at=? WHERE owner=?")
            .run(longExpiry(clock()), r.reference);
        }
        await audit(r, kind, { amount, method, externalReference });
        const updated = await api.get(reference);
        if (kind === "payment" && updated.net_paid >= updated.total)
          await members.rewardReferral(r.member_id, "paid");
        return updated;
      });
    },
    async requestCancellation(reference, email) {
      return tx(async () => {
        await cleanup();
        const r = await api.get(reference);
        if (r.email !== email.toLowerCase())
          throw new AppError(404, "Rezervasyon bulunamadı.");
        if (["cancelled", "expired"].includes(r.status)) return r;
        if (r.status === "completed")
          throw new AppError(
            409,
            "Tamamlanan tur için acenteyle iletişime geçin.",
          );
        if (r.status === "pending_agency" && r.net_paid === 0) {
          await db
            .prepare("UPDATE reservations SET status='cancelled' WHERE id=?")
            .run(r.id);
          await db
            .prepare("DELETE FROM seat_locks WHERE owner=?")
            .run(r.reference);
          await members.releaseCoupons();
        } else
          await db
            .prepare(
              "UPDATE reservations SET cancellation_requested_at=? WHERE id=?",
            )
            .run(clock(), r.id);
        await audit(r, "cancellation_requested", {});
        return api.get(reference);
      });
    },
    async cancel(reference) {
      return tx(async () => {
        await cleanup();
        const r = await api.get(reference);
        if (r.status === "completed")
          throw new AppError(409, "Tamamlanmış tur iptal edilemez.");
        if (r.status === "cancelled") return r;
        await db
          .prepare("UPDATE reservations SET status='cancelled' WHERE id=?")
          .run(r.id);
        await db
          .prepare("DELETE FROM seat_locks WHERE owner=?")
          .run(r.reference);
        await members.releaseCoupons();
        await audit(r, "cancelled", { refundDue: r.net_paid });
        const updated = await api.get(reference);
        await notify(
          updated,
          "reservation_cancelled",
          "Rezervasyonunuz iptal edildi. Tahsilat varsa iade ayrıca acente tarafından yürütülür.",
        );
        return updated;
      });
    },
    async move(reference, { departureId, seats }) {
      return tx(async () => {
        await cleanup();
        const r = await api.get(reference);
        if (!["pending_agency", "confirmed"].includes(r.status))
          throw new AppError(409, "Bu kayıt başka sefere taşınamaz.");
        const d = await departures.get(departureId);
        if (d.tour_id !== r.tourId)
          throw new AppError(
            400,
            "Yalnız aynı turun başka seferine taşıyabilirsiniz.",
          );
        if (
          seats.length !== r.passengers.length ||
          new Set(seats).size !== seats.length ||
          seats.some(
            (n) => !Number.isInteger(n) || n < 1 || n > d.vehicle.sellableSeats,
          )
        )
          throw new AppError(
            400,
            "Her yolcu için geçerli ve farklı bir koltuk seçin.",
          );
        if (
          r.departure_id === departureId &&
          JSON.stringify(r.seats) === JSON.stringify(seats)
        )
          return r;
        for (const n of seats) {
          const lock = await db
            .prepare(
              "SELECT owner FROM seat_locks WHERE departure_id=? AND seat=? AND expires_at>?",
            )
            .get(d.id, n, clock());
          if (lock && lock.owner !== r.reference)
            throw new AppError(
              409,
              "Hedef koltuk dolu. Eski rezervasyon korunuyor.",
            );
        }
        const subtotal = d.price * seats.length,
          total = subtotal - Math.round((subtotal * r.discount_percent) / 100);
        if (r.net_paid > total)
          throw new AppError(
            409,
            "Yeni bedeli aşan tahsilat var. Önce fark iadesini kaydedin.",
          );
        const expires =
          r.net_paid > 0 || r.status === "confirmed"
            ? longExpiry(clock())
            : clock() + 86400000;
        await db
          .prepare("DELETE FROM seat_locks WHERE owner=?")
          .run(r.reference);
        for (const seat of seats)
          await db
            .prepare("INSERT INTO seat_locks VALUES(?,?,?,?)")
            .run(d.id, seat, r.reference, expires);
        await db
          .prepare(
            "UPDATE reservations SET departure_id=?,seats=?,vehicle_json=?,subtotal=?,discount_amount=?,total=?,deposit=?,expires_at=? WHERE id=?",
          )
          .run(
            d.id,
            JSON.stringify(seats),
            JSON.stringify(d.vehicle),
            subtotal,
            subtotal - total,
            total,
            r.deposit === r.total ? total : Math.round(total * 0.3),
            expires,
            r.id,
          );
        const id = randomUUID();
        await audit(r, "moved", { from: r.departure_id, to: d.id, seats });
        const updated = await api.get(reference);
        await notifications.enqueue({
          email: r.email,
          subject: "Rota Kars · Yolculuk bilgileriniz güncellendi",
          body: `${r.reference}\nYeni tarih: ${d.date} ${d.start_time}\nBuluşma: ${d.pickup}\nKoltuk: ${seats.join(", ")}\nGüncel tur bedeli: ${(total / 100).toFixed(2)} TL.`,
          kind: "reservation_moved",
          dedupeKey: "move:" + id,
        });
        return updated;
      });
    },
    async passengers(reference, names) {
      return tx(async () => {
        await cleanup();
        const r = await api.get(reference);
        if (names.length !== r.seats.length)
          throw new AppError(400, "Yolcu ve koltuk sayıları eşleşmeli.");
        if (!["pending_agency", "confirmed"].includes(r.status))
          throw new AppError(409, "Bu kaydın yolcuları değiştirilemez.");
        await db
          .prepare("UPDATE reservations SET passengers=? WHERE id=?")
          .run(JSON.stringify(names), r.id);
        await audit(r, "passengers_updated", {});
        return api.get(reference);
      });
    },
    async complete(reference) {
      return tx(async () => {
        await cleanup();
        const r = await api.get(reference);
        if (r.status === "completed") return r;
        if (
          r.status !== "confirmed" ||
          r.date > localDate(clock()) ||
          r.net_paid < r.total
        )
          throw new AppError(
            409,
            "Tamamlama için onaylı kayıt, geçmiş/bugünkü tur tarihi ve tam tahsilat gerekir.",
          );
        await db
          .prepare(
            "UPDATE reservations SET status='completed',completed_at=? WHERE id=?",
          )
          .run(clock(), r.id);
        await members.rewardReferral(r.member_id, "completed");
        await audit(r, "completed", {});
        await notifications.enqueue({
          email: r.email,
          subject: "Rota Kars · Birlikte yolculuk etmek güzeldi",
          body: `Merhaba ${r.name}, ${r.reference} yolculuğunuzdaki deneyiminizi Google'da paylaşabilirsiniz.`,
          actionUrl: env.GOOGLE_REVIEW_URL || business.mapsUrl,
          kind: "review_request",
          dedupeKey: "review:" + r.id,
        });
        return api.get(reference);
      });
    },
    async ticket(token) {
      await cleanup();
      if (!/^[a-f0-9]{48}$/.test(token))
        throw new AppError(404, "Bilet bulunamadı.");
      const row = await db
        .prepare("SELECT reference FROM reservations WHERE ticket_token=?")
        .get(token);
      if (!row) throw new AppError(404, "Bilet bulunamadı.");
      const r = await api.get(row.reference);
      return {
        reference: r.reference,
        tourName: tours.find((t) => t.id === r.tourId)?.name,
        date: r.date,
        startTime: r.start_time,
        pickup: r.pickup,
        seats: r.seats,
        status: r.status,
        valid: ["confirmed", "completed"].includes(r.status),
        checkedIn: Boolean(r.checked_in_at),
      };
    },
    async checkIn(token) {
      return tx(async () => {
        await cleanup();
        const info = await api.ticket(token);
        if (
          !info.valid ||
          info.status !== "confirmed" ||
          info.date !== localDate(clock())
        )
          throw new AppError(
            409,
            "Katılım yalnız bugünkü onaylı tur için kaydedilebilir.",
          );
        const r = await api.get(info.reference);
        if (!r.checked_in_at) {
          await db
            .prepare("UPDATE reservations SET checked_in_at=? WHERE id=?")
            .run(clock(), r.id);
          await audit(r, "checked_in", {});
        }
        return api.ticket(token);
      });
    },
    async reminders() {
      const now = clock(),
        hours = Math.max(1, Math.min(72, Number(env.REMINDER_HOURS) || 24));
      for (const r of await api.list({ all: true })) {
        const start = Date.parse(r.date + "T" + r.start_time + ":00+03:00");
        if (
          r.status === "confirmed" &&
          start > now &&
          start <= now + hours * 3600000
        )
          await notify(
            r,
            "departure_reminder",
            "Yolculuğunuz yaklaşıyor. Buluşma bilgilerinizi kontrol edin.",
          );
      }
    },
    async report(date) {
      const ds = await departures.list({ date }),
        rs = await api.list({ date, all: true });
      return {
        date,
        departures: ds.map((d) => ({
          ...d,
          reservations: rs.filter((r) => r.departure_id === d.id).length,
          confirmedGuests: rs
            .filter(
              (r) =>
                r.departure_id === d.id &&
                ["confirmed", "completed"].includes(r.status),
            )
            .reduce((n, r) => n + r.seats.length, 0),
        })),
        reservations: rs.length,
        guests: rs
          .filter((r) => !["cancelled", "expired"].includes(r.status))
          .reduce((n, r) => n + r.seats.length, 0),
        netCollected: rs.reduce((n, r) => n + r.net_paid, 0),
        refunded: rs.reduce((n, r) => n + r.refunded_total, 0),
      };
    },
    async manifest(departureId) {
      const d = await departures.get(departureId, {
          allowClosed: true,
          allowPast: true,
        }),
        bookings = (await api.list({ date: d.date, all: true })).filter(
          (r) =>
            r.departure_id === d.id &&
            !["cancelled", "expired"].includes(r.status),
        );
      const rows = [
        [
          "Referans",
          "Tarih",
          "Saat",
          "Tur",
          "Koltuk",
          "Yolcu",
          "İletişim kişisi",
          "Telefon",
          "Durum",
        ],
      ];
      for (const r of bookings)
        r.seats.forEach((seat, i) =>
          rows.push([
            r.reference,
            r.date,
            r.start_time,
            tours.find((t) => t.id === r.tourId)?.name,
            seat,
            r.passengers[i],
            r.name,
            r.phone,
            r.status,
          ]),
        );
      const cell = (v) => {
        let s = String(v ?? "");
        if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s;
        return '"' + s.replaceAll('"', '""') + '"';
      };
      return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
    },
    async audit(reference) {
      const r = await api.get(reference);
      return db
        .prepare(
          "SELECT * FROM reservation_audit WHERE reservation_id=? ORDER BY created_at,id",
        )
        .all(r.id);
    },
  };
  return api;
}
