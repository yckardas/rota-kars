import { connectDatabase, fromJson } from "./database.mjs";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { tours, vehicle } from "./catalog.mjs";
import { createOperations } from "./operations.mjs";
import { createMembers } from "./members.mjs";
import { createCampaigns } from "./campaigns.mjs";
import { createNotifications } from "./notifications.mjs";
import { createDepartures, localDate } from "./departures.mjs";
import { createInstagramSettings } from "./instagram.mjs";
import { createWorkflow } from "./workflow.mjs";
import { createAccountSecurity } from "./account-security.mjs";
import { createAdminAuth } from "./admin-auth.mjs";
import { createPrivacy } from "./privacy.mjs";
import { depositFor } from "./payments.mjs";
import { createPush } from "./push.mjs";
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export async function openStore(
  path = undefined,
  { clock = Date.now, seed = true, env = process.env, pushFetch = fetch } = {},
) {
  const db = await connectDatabase({ path, env });
  await Promise.all([
    db.index("departures", { tour_id: 1, date: 1 }),
    db.index("holds", { expires_at: 1 }),
    db.index("seat_locks", { owner: 1 }),
    db.index("seat_locks", { departure_id: 1, expires_at: 1 }),
    db.index("seat_locks", { expires_at: 1 }),
    db.index("reservations", { reference: 1 }, { unique: true }),
    db.index("reservations", { ticket_token: 1 }, { unique: true, sparse: true }),
    db.index("reservations", { status: 1, expires_at: 1 }),
    db.index("reservations", { departure_id: 1 }),
    db.index("reservations", { member_id: 1 }),
    db.index("reservations", { email: 1 }),
    db.index("requests", { created_at: -1 }),
    db.index("instagram_posts", { permalink: 1 }, { unique: true }),
    db.index("admin_sessions", { expires_at: 1 }),
  ]);
  // Görseller WebP'ye taşındı: veritabanında eski adresleri tutan kayıtlar güncellenir.
  const imageMigrations = JSON.parse(
    readFileSync(new URL("./image-migrations.json", import.meta.url), "utf8"),
  );
  for (const [from, to] of Object.entries(imageMigrations)) {
    await db.updateMany("instagram_posts", { cover: from }, { cover: to });
    await db.updateMany("hotels", { image: from }, { image: to });
  }
  const tx = (fn) => db.transaction(fn);
  let members;
  // Süresi dolan kilit/ön rezervasyon temizliği. Yazma işlemlerinde (işlem içinde)
  // her seferinde yapılır; herkese açık okumalarda en fazla 5 sn'de bir çalışır,
  // böylece yoğun okuma trafiği işlem kuyruğunu tıkamaz. Okumalar ayrıca süre
  // filtresi uygular; arka plan işi de 30 sn'de bir zorla çalıştırır.
  let lastCleanup = 0,
    cleanupRunning = null;
  const cleanup = async ({ force = false } = {}) => {
    // İşlem içindeki temizlik o işlemle birlikte geri alınabilir; bu yüzden
    // kısıtlayıcı yalnız kalıcılaşan (işlem dışı) temizliklerle güncellenir.
    if (db.inTransaction()) return cleanupNow();
    if (!force && clock() - lastCleanup < 5000) return;
    if (cleanupRunning) return cleanupRunning;
    const run = cleanupNow()
      .then(() => {
        lastCleanup = clock();
      })
      .finally(() => {
        cleanupRunning = null;
      });
    cleanupRunning = run;
    return run;
  };
  const cleanupNow = async () =>
    tx(async () => {
      const now = clock();
      await db.remove("seat_locks", { expires_at: { $lte: now } });
      await db.remove("holds", { expires_at: { $lte: now } });
      await db.updateMany(
        "reservations",
        { status: "pending_agency", expires_at: { $lte: now } },
        { status: "expired" },
      );
      await members?.releaseCoupons();
    });
  const campaigns = await createCampaigns(db, { clock });
  const instagramSettings = await createInstagramSettings(db, { clock });
  const adminAuth = await createAdminAuth(db, { clock, env });
  await db.index("consents", { email_hash: 1 });
  const privacy = createPrivacy(db, { clock, env, tx: (fn) => db.transaction(fn) });
  members = await createMembers(db, {
    campaigns,
    clock,
    tx,
  });
  const operations = await createOperations(db, {
    clock,
    cleanup,
    tx,
  });
  await Promise.all([
    db.index("push_devices", { admin_id: 1 }),
    db.index("push_log", { created_at: 1 }),
  ]);
  const push = createPush(db, { env, clock, fetchImpl: pushFetch });
  const notifications = await createNotifications(db, { clock, tx, env, push });
  const accountSecurity = await createAccountSecurity(db, {
    clock,
    tx,
    members,
    notifications,
  });
  const departures = await createDepartures(db, {
    clock,
    tx,
    operations,
    cleanup,
    env,
  });
  if (
    seed &&
    (env.NODE_ENV !== "production" ||
      env.DEMO_MODE === "1" ||
      env.SEED_DEMO === "1")
  ) {
    const instagramPosts = JSON.parse(
      readFileSync(new URL("./instagram-posts.json", import.meta.url), "utf8"),
    );
    // Örnek veriler toplu ve "yoksa ekle" biçiminde yazılır.
    const ifAbsent = (doc) => ({
      updateOne: {
        filter: { _id: doc.id },
        update: { $setOnInsert: doc },
        upsert: true,
      },
    });
    await db.col("instagram_posts").bulkWrite(
      instagramPosts.map((post) =>
        ifAbsent({
          id: post.id,
          title: post.title,
          permalink: post.permalink,
          cover: post.cover,
          position: post.position,
          active: post.active ? 1 : 0,
          videoSrc: null,
        }),
      ),
    );
    const seedDepartures = [];
    const today = new Date(clock());
    for (const t of tours)
      for (let i = 0; i < 6; i++) {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() + 3 + i * 7);
        if (t.id === "sarikamis" && d.getUTCMonth() < 11) {
          d.setUTCMonth(11);
          d.setUTCDate(5 + i * 7);
        }
        const date = d.toISOString().slice(0, 10),
          id = `${t.id}-${date}`;
        seedDepartures.push(
          ifAbsent({ id, tour_id: t.id, date, price: t.price, active: 1 }),
        );
      }
    await db.col("departures").bulkWrite(seedDepartures);
  }
  const workflow = await createWorkflow(db, {
    cleanup,
    clock,
    tx,
    departures,
    members,
    notifications,
    env,
  });
  const departure = (id) => departures.get(id);
  return {
    operations,
    departures,
    workflow,
    campaigns,
    instagramSettings,
    adminAuth,
    privacy,
    notifications,
    push,
    accountSecurity,
    members,
    db,
    clock,
    cleanup,
    async listDepartures(tourId) {
      return (await departures.list({ tourId })).filter(
        (d) => d.salesOpen && d.date >= localDate(clock()),
      );
    },
    async availability(id, { agent = false } = {}) {
      await cleanup();
      const d = agent ? await departures.get(id, { allowClosed: true }) : await departure(id),
        vehicle = d.vehicle;
      // Tüm koltuk kilitleri tek sorguda okunur.
      const taken = new Set(
        (
          await db.find(
            "seat_locks",
            { departure_id: id, expires_at: { $gt: clock() } },
            { projection: { seat: 1 } },
          )
        ).map((l) => l.seat),
      );
      return {
        departure: d,
        vehicle,
        seats: Array.from({ length: vehicle.sellableSeats }, (_, i) => ({
          number: i + 1,
          status: taken.has(i + 1) ? "occupied" : "available",
        })),
      };
    },
    async hold(id, seats, { agent = false } = {}) {
      return tx(async () => {
        await cleanup();
        // Acente panelden ekliyorsa satışı kapanmış (ama tarihi geçmemiş) sefere de yazabilir.
        const d = agent ? await departures.get(id, { allowClosed: true }) : await departure(id),
          vehicle = d.vehicle;
        if (
          !Array.isArray(seats) ||
          !seats.length ||
          seats.length > vehicle.sellableSeats ||
          new Set(seats).size !== seats.length ||
          seats.some(
            (s) => !Number.isInteger(s) || s < 1 || s > vehicle.sellableSeats,
          )
        )
          throw new AppError(
            400,
            `Yalnızca 1–${vehicle.sellableSeats} numaralı yolcu koltukları seçilebilir.`,
          );
        const token = randomBytes(24).toString("hex"),
          expires = clock() + 600000;
        // Önce tüm koltuklar kontrol edilir, sonra hepsi yazılır: biri doluysa
        // hiçbir koltuk kilitlenmez. _id departure:seat olduğu için aynı koltuk
        // veritabanı düzeyinde de iki kez kilitlenemez.
        if (await db.one("seat_locks", { _id: { $in: seats.map((n) => `${id}:${n}`) } }))
          throw new AppError(
            409,
            "Seçtiğiniz koltuklardan biri az önce ayrıldı.",
          );
        await db.col("seat_locks").insertMany(
          seats.map((seat) => ({
            _id: `${id}:${seat}`,
            departure_id: id,
            seat,
            owner: token,
            expires_at: expires,
          })),
          db.opts(),
        );
        await db.insert("holds", token, {
          token,
          departure_id: id,
          seats,
          expires_at: expires,
          created_at: clock(),
          extensions: 0,
        });
        return { token, seats, expiresAt: expires };
      });
    },
    // Koltuk tutma süresi 10 dk; en fazla 2 kez uzatılabilir (toplam en fazla 30 dk).
    async extendHold(token) {
      return tx(async () => {
        await cleanup();
        const hold = await db.one("holds", { _id: token, expires_at: { $gt: clock() } });
        if (!hold)
          throw new AppError(410, "Koltuk ayırma süresi doldu. Lütfen koltuklarınızı yeniden seçin.");
        if ((hold.extensions || 0) >= 2)
          throw new AppError(409, "Süre en fazla iki kez uzatılabilir. Lütfen rezervasyonu tamamlayın.");
        const expires = Math.min(
          hold.expires_at + 600000,
          (hold.created_at || hold.expires_at - 600000) + 30 * 60000,
        );
        await db.update("holds", { _id: token }, { expires_at: expires, extensions: (hold.extensions || 0) + 1 });
        await db.updateMany("seat_locks", { owner: token }, { expires_at: expires });
        return { token, seats: hold.seats, expiresAt: expires, extensionsLeft: 1 - (hold.extensions || 0) };
      });
    },
    release(token) {
      return tx(async () => {
        await db.remove("seat_locks", { owner: token });
        await db.remove("holds", { _id: token });
      });
    },
    reserve({
      holdToken,
      name,
      email,
      phone,
      passengers,
      paymentMode,
      memberId = null,
      couponId = null,
      agent = null,
      notes = "",
    }) {
      return tx(async () => {
        await cleanup();
        const hold = await db.one("holds", {
          _id: holdToken,
          expires_at: { $gt: clock() },
        });
        if (!hold)
          throw new AppError(
            410,
            "Koltuk ayırma süresi doldu. Lütfen koltuklarınızı yeniden seçin.",
          );
        const seats = fromJson(hold.seats, []),
          d = agent
            ? await departures.get(hold.departure_id, { allowClosed: true })
            : await departure(hold.departure_id);
        if (passengers.length !== seats.length)
          throw new AppError(
            400,
            "Her seçili koltuk için bir yolcu adı girin.",
          );
        const id = randomUUID(),
          reference = "RK-" + randomBytes(5).toString("hex").toUpperCase(),
          subtotal = d.price * seats.length,
          discounted = await members.priceCoupon(
            memberId,
            couponId,
            subtotal,
            d.tour_id,
          ),
          total = discounted.total,
          // "Turda ödenecek" yalnız acentenin panelden eklediği kayıtlarda seçilebilir.
          deposit =
            agent && paymentMode === "on_tour"
              ? 0
              : paymentMode === "deposit"
                ? depositFor(total)
                : total,
          // Onay bekleyen kayıt en fazla PENDING_HOLD_HOURS (varsayılan 24) saat ya da
          // satış kapanışına kadar koltuk tutar.
          expires = Math.min(
            clock() + Math.max(1, Number(env.PENDING_HOLD_HOURS) || 24) * 3600000,
            d.salesClosesAt ?? Infinity,
          );
        // Aynı e-postanın onay bekleyen toplam koltuğu sınırlıdır: sahte e-postayla değil
        // ama tek kişinin çok sayıda seferi bloke etmesi engellenir.
        const maxPending = Math.max(1, Number(env.PENDING_SEATS_PER_EMAIL) || 12);
        const pending = await db.find(
          "reservations",
          { email: email.toLowerCase(), status: "pending_agency", expires_at: { $gt: clock() } },
          { projection: { seats: 1 } },
        );
        const pendingSeats = pending.reduce((n, r) => n + (r.seats?.length || 0), 0);
        if (!agent && pendingSeats + seats.length > maxPending)
          throw new AppError(
            409,
            "Bu e-posta ile onay bekleyen çok sayıda koltuk var. Önceki ön rezervasyonlarınızı acenteyle netleştirin veya WhatsApp'tan yazın.",
          );
        // Kupon önce düşülür; kullanılmışsa hiçbir kayıt yazılmadan işlem durur.
        await members.consumeCoupon(couponId, id);
        await db.insert("reservations", id, {
          id,
          reference,
          departure_id: d.id,
          email: email.toLowerCase(),
          name,
          phone,
          passengers,
          seats,
          total,
          deposit,
          status: "pending_agency",
          created_at: clock(),
          expires_at: expires,
          vehicle_json: d.vehicle,
          member_id: memberId,
          coupon_id: couponId,
          subtotal,
          discount_amount: discounted.discount,
          ticket_token: randomBytes(24).toString("hex"),
          discount_percent: discounted.coupon?.percent || 0,
          source: agent ? "agency" : "web",
          created_by: agent?.id || null,
          payment_mode: agent && paymentMode === "on_tour" ? "on_tour" : paymentMode,
          notes: String(notes || "").slice(0, 500),
        });

        await db.updateMany(
          "seat_locks",
          { owner: holdToken },
          { owner: reference, expires_at: expires },
        );
        await db.remove("holds", { _id: holdToken });
        return workflow.created(reference, { byAgency: Boolean(agent) });
      });
    },
    // Telefon/WhatsApp ile gelen müşteriyi acente panelden kaydeder: koltuk, kayıt,
    // isteğe bağlı tahsilat ve onay tek işlemde (biri olmazsa hiçbiri yazılmaz).
    adminReserve(input, agent) {
      return tx(async () => {
        const h = await this.hold(input.departureId, input.seats, { agent: true });
        const r = await this.reserve({
          holdToken: h.token,
          name: input.name,
          email: input.email || "",
          phone: input.phone,
          passengers: input.passengers,
          paymentMode: input.paymentMode,
          agent,
          notes: input.notes,
        });
        if (input.payment)
          await workflow.payment(r.reference, {
            amount: input.payment.amount,
            method: input.payment.method,
            externalReference: input.payment.externalReference || "PANEL-" + r.reference,
            kind: "payment",
          });
        if (input.confirm) await workflow.confirm(r.reference);
        return workflow.get(r.reference);
      });
    },
    async lookup(reference, email) {
      await cleanup();
      const r = await workflow.get(reference);
      if (r.email !== email.toLowerCase())
        throw new AppError(
          404,
          "Bu referans ve e-posta ile bir ön rezervasyon bulunamadı.",
        );
      return r;
    },
    cancel(reference, email) {
      return workflow.requestCancellation(reference, email);
    },
    async request(kind, body) {
      const id = randomUUID();
      await db.insert("requests", id, {
        id,
        kind,
        body,
        status: "new",
        created_at: clock(),
      });
      const reference = "TL-" + id.slice(0, 8).toUpperCase();
      const label =
        { hotel: "Konaklama talebi", "private-tour": "Özel tur talebi", vehicle: "Araç kiralama talebi" }[kind] ||
        "Yeni talep";
      await notifications.notifyAgency({
        subject: `${label}: ${reference}`,
        body:
          `${label} · ${reference}\n` +
          Object.entries(body || {})
            .filter(([, v]) => v !== "" && v != null && typeof v !== "object")
            .map(([k, v]) => `${k}: ${String(v).slice(0, 500)}`)
            .join("\n"),
        actionUrl: (env.PUBLIC_BASE_URL || "") + "/yonetim",
        kind: "request_" + kind,
        dedupeKey: "request:" + id,
      });
      return {
        reference,
        status: "received",
      };
    },
    async hotels() {
      return (await db.find("hotels", { active: 1 }, { sort: { name: 1 } })).map(
        (h) => ({ ...h, amenities: fromJson(h.amenities, []) }),
      );
    },
    // Panel ana ekranı: bugün kalkan seferler, onay bekleyenler (süresi yaklaşan
    // önce), iptal talepleri, yeni talepler ve önümüzdeki 7 günün doluluğu.
    async overview() {
      await cleanup();
      const now = clock(),
        today = localDate(now),
        week = localDate(now + 7 * 86400000);
      const tourName = (id) => tours.find((t) => t.id === id)?.name || id;
      const upcoming = (await departures.list()).filter((d) => d.date >= today && d.date <= week);
      const seatsOf = (d) => d.vehicle.sellableSeats;
      const pending = (await workflow.list({ status: "pending_agency", all: true }))
        .sort((a, b) => a.expires_at - b.expires_at)
        .map((r) => ({
          reference: r.reference,
          name: r.name,
          phone: r.phone,
          tourName: tourName(r.tourId),
          date: r.date,
          seats: r.seats.length,
          total: r.total,
          expiresAt: r.expires_at,
        }));
      const cancellationRequests = await db.count("reservations", {
        cancellation_requested_at: { $exists: true, $ne: null },
        status: { $in: ["pending_agency", "confirmed"] },
      });
      return {
        today,
        todayDepartures: upcoming
          .filter((d) => d.date === today)
          .map((d) => ({
            id: d.id,
            tourName: tourName(d.tour_id),
            startTime: d.start_time,
            pickup: d.pickup,
            guideName: d.guide_name || null,
            booked: seatsOf(d) - d.available,
            capacity: seatsOf(d),
            active: Boolean(d.active),
          })),
        pending: { count: pending.length, items: pending.slice(0, 8) },
        cancellationRequests,
        newRequests: await db.count("requests", { status: "new" }),
        week: {
          departures: upcoming.length,
          booked: upcoming.reduce((n, d) => n + seatsOf(d) - d.available, 0),
          capacity: upcoming.reduce((n, d) => n + seatsOf(d), 0),
        },
      };
    },
    async dashboard() {
      await cleanup();
      return {
        reservations: await workflow.list(),
        requests: (
          await db.find("requests", {}, { sort: { created_at: -1 }, limit: 200 })
        ).map((r) => ({ ...r, body: fromJson(r.body, {}) })),
        hotels: (await db.find("hotels", {}, { sort: { name: 1 } })).map((h) => ({
          ...h,
          amenities: fromJson(h.amenities, []),
        })),
      };
    },
    async upsertHotel(h) {
      const id = h.id || randomUUID();
      await db.upsert("hotels", id, {
        id,
        name: h.name,
        location: h.location,
        description: h.description,
        amenities: h.amenities,
        image: h.image || null,
        active: h.active ? 1 : 0,
      });
      return {
        id,
      };
    },
    async assignments() {
      return Object.fromEntries(
        (await db.find("review_assignments")).map((r) => [
          r.review_id,
          fromJson(r.tour_ids, []),
        ]),
      );
    },
    async assignReview(reviewId, tourIds) {
      await db.upsert("review_assignments", reviewId, {
        review_id: reviewId,
        tour_ids: tourIds,
      });
    },
    async instagramPosts(includeDrafts = false) {
      return db.find("instagram_posts", includeDrafts ? {} : { active: 1 }, {
        sort: { position: 1, id: 1 },
      });
    },
    async upsertInstagramPost(post) {
      const id = post.id || randomUUID();
      const duplicate = await db.one("instagram_posts", {
        permalink: post.permalink,
        _id: { $ne: id },
      });
      if (duplicate)
        throw new AppError(409, "Bu Instagram videosu zaten eklenmiş.");
      await db.upsert("instagram_posts", id, {
        id,
        title: post.title,
        permalink: post.permalink,
        cover: post.cover,
        position: post.position,
        active: post.active ? 1 : 0,
        videoSrc: post.videoSrc || null,
      });
      return {
        id,
      };
    },
  };
}
