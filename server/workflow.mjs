import { randomBytes, randomUUID } from "node:crypto";
import { AppError } from "./store.mjs";
import { fromJson } from "./database.mjs";
import { localDate } from "./departures.mjs";
import { tours, business } from "./catalog.mjs";
const longExpiry = (now) => now + 365 * 86400000;
export async function createWorkflow(
  db,
  { clock, tx, departures, members, notifications, env, cleanup },
) {
  await Promise.all([
    db.index(
      "payment_ledger",
      { method: 1, external_reference: 1, kind: 1 },
      { unique: true },
    ),
    db.index("payment_ledger", { reservation_id: 1, created_at: 1 }),
    db.index("reservation_audit", { reservation_id: 1, created_at: 1 }),
  ]);
  const parse = async (r) => {
    if (!r) throw new AppError(404, "Rezervasyon bulunamadı.");
    const d = await departures.get(r.departure_id, {
        allowClosed: true,
        allowPast: true,
      }),
      ledger = await db.find(
        "payment_ledger",
        { reservation_id: r.id },
        { sort: { created_at: 1, id: 1 } },
      ),
      paid = ledger
        .filter((p) => p.kind === "payment")
        .reduce((n, p) => n + Number(p.amount), 0),
      refunded = ledger
        .filter((p) => p.kind === "refund")
        .reduce((n, p) => n + Number(p.amount), 0),
      net = paid - refunded;
    return {
      ...r,
      seats: fromJson(r.seats, []),
      passengers: fromJson(r.passengers, []),
      vehicle: fromJson(r.vehicle_json, null) || d.vehicle,
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
    const id = randomUUID();
    await db.insert("reservation_audit", id, {
      id,
      reservation_id: r.id,
      event,
      details,
      created_at: clock(),
    });
  };
  const notify = async (r, event, text, dedupeKey = event + ":" + r.reference) =>
    notifications.enqueue({
      email: r.email,
      subject: "Rota Kars · " + text,
      body: `Merhaba ${r.name},\n${r.reference} · ${tours.find((t) => t.id === r.tourId)?.name || r.tourId}\nTarih: ${r.date} · Saat: ${r.start_time}\nBuluşma: ${r.pickup}\n${text}\nKoltuklar: ${r.seats.join(", ")}.`,
      actionUrl: (env.PUBLIC_BASE_URL || "") + "/bilet/" + r.ticket_token,
      kind: event,
      dedupeKey,
    });
  const tourName = (r) => tours.find((t) => t.id === r.tourId)?.name || r.tourId;
  const waLink = (phone) => {
    const digits = String(phone || "").replace(/\D/g, "");
    const intl = digits.startsWith("90") ? digits : digits.replace(/^0/, "90");
    return intl.length >= 11 ? `https://wa.me/${intl}` : "";
  };
  const agencyAlert = (r, kind, title) =>
    notifications.notifyAgency({
      subject: `${title}: ${r.reference} · ${tourName(r)} · ${r.date}`,
      body: [
        `${title}`,
        `${r.reference} · ${tourName(r)}`,
        `Tarih: ${r.date} ${r.start_time} · Koltuk: ${r.seats.join(", ")}`,
        `Müşteri: ${r.name} · ${r.phone} · ${r.email}`,
        `Tutar: ${(r.total / 100).toFixed(2)} TL · Durum: ${r.status}`,
        waLink(r.phone) && `WhatsApp: ${waLink(r.phone)}`,
      ]
        .filter(Boolean)
        .join("\n"),
      actionUrl: (env.PUBLIC_BASE_URL || "") + "/yonetim",
      kind,
      dedupeKey: kind + ":" + r.reference,
    });
  const api = {
    async get(reference, { fresh = true } = {}) {
      if (fresh) await cleanup();
      return parse(
        await db.one("reservations", { reference: reference.toUpperCase() }),
      );
    },
    async list({ date, all = false } = {}) {
      await cleanup();
      const filter = date
        ? {
            departure_id: {
              $in: (
                await db.find("departures", { date }, { projection: { id: 1 } })
              ).map((d) => d.id),
            },
          }
        : {};
      const rows = await db.find("reservations", filter, {
        sort: { created_at: -1 },
        ...(all ? {} : { limit: 500 }),
        projection: { reference: 1 },
      });
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
      await agencyAlert(r, "reservation_created", "Yeni ön rezervasyon");
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
        await db.update(
          "reservations",
          { _id: r.id },
          {
            status: "confirmed",
            confirmed_at: clock(),
            expires_at: longExpiry(clock()),
          },
        );
        await db.updateMany(
          "seat_locks",
          { owner: r.reference },
          { expires_at: longExpiry(clock()) },
        );
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
          previous = await db.one("payment_ledger", {
            method,
            external_reference: externalReference,
            kind,
          });
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
        const ledgerId = randomUUID();
        await db.insert("payment_ledger", ledgerId, {
          id: ledgerId,
          reservation_id: r.id,
          kind,
          amount,
          method,
          external_reference: externalReference,
          created_at: clock(),
        });
        if (kind === "payment") {
          await db.update(
            "reservations",
            { _id: r.id },
            { expires_at: longExpiry(clock()) },
          );
          await db.updateMany(
            "seat_locks",
            { owner: r.reference },
            { expires_at: longExpiry(clock()) },
          );
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
          await db.update("reservations", { _id: r.id }, { status: "cancelled" });
          await db.remove("seat_locks", { owner: r.reference });
          await members.releaseCoupons();
        } else
          await db.update(
            "reservations",
            { _id: r.id },
            { cancellation_requested_at: clock() },
          );
        await audit(r, "cancellation_requested", {});
        const updated = await api.get(reference);
        await agencyAlert(
          updated,
          "cancellation_requested",
          updated.status === "cancelled"
            ? "Müşteri ön rezervasyonu iptal etti"
            : "Müşteri iptal talep etti",
        );
        return updated;
      });
    },
    async cancel(reference) {
      return tx(async () => {
        await cleanup();
        const r = await api.get(reference);
        if (r.status === "completed")
          throw new AppError(409, "Tamamlanmış tur iptal edilemez.");
        if (r.status === "cancelled") return r;
        await db.update("reservations", { _id: r.id }, { status: "cancelled" });
        await db.remove("seat_locks", { owner: r.reference });
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
          const lock = await db.one("seat_locks", {
            _id: `${d.id}:${n}`,
            expires_at: { $gt: clock() },
          });
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
        await db.remove("seat_locks", { owner: r.reference });
        // Süresi dolmuş başka bir kilit kalmışsa yerine yazılır.
        for (const seat of seats)
          await db.upsert("seat_locks", `${d.id}:${seat}`, {
            departure_id: d.id,
            seat,
            owner: r.reference,
            expires_at: expires,
          });
        await db.update(
          "reservations",
          { _id: r.id },
          {
            departure_id: d.id,
            seats,
            vehicle_json: d.vehicle,
            subtotal,
            discount_amount: subtotal - total,
            total,
            deposit: r.deposit === r.total ? total : Math.round(total * 0.3),
            expires_at: expires,
          },
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
        await db.update("reservations", { _id: r.id }, { passengers: names });
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
        await db.update(
          "reservations",
          { _id: r.id },
          { status: "completed", completed_at: clock() },
        );
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
      const row = await db.one("reservations", { ticket_token: token });
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
          await db.update(
            "reservations",
            { _id: r.id },
            { checked_in_at: clock() },
          );
          await audit(r, "checked_in", {});
        }
        return api.ticket(token);
      });
    },
    async reminders() {
      const now = clock(),
        hours = Math.max(1, Math.min(72, Number(env.REMINDER_HOURS) || 24));
      // Yalnız hatırlatma penceresine giren günlerdeki onaylı kayıtlar okunur.
      const days = [];
      for (let t = now - 86400000; t <= now + hours * 3600000 + 86400000; t += 86400000)
        days.push(localDate(t));
      const departureIds = (
        await db.find("departures", { date: { $in: days } }, { projection: { id: 1 } })
      ).map((d) => d.id);
      if (!departureIds.length) return;
      const upcoming = await db.find(
        "reservations",
        { status: "confirmed", departure_id: { $in: departureIds } },
        { projection: { reference: 1 } },
      );
      for (const { reference } of upcoming) {
        const r = await api.get(reference, { fresh: false });
        const start = Date.parse(r.date + "T" + r.start_time + ":00+03:00");
        if (start > now && start <= now + hours * 3600000)
          // Sefer değişirse (taşıma) yeni sefer için yeniden hatırlatılır.
          await notify(
            r,
            "departure_reminder",
            "Yolculuğunuz yaklaşıyor. Buluşma bilgilerinizi kontrol edin.",
            `departure_reminder:${r.reference}:${r.departure_id}`,
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
      return db.find(
        "reservation_audit",
        { reservation_id: r.id },
        { sort: { created_at: 1, id: 1 } },
      );
    },
  };
  return api;
}
