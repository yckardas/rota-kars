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
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export async function openStore(
  path = undefined,
  { clock = Date.now, seed = true, env = process.env } = {},
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
  const tx = (fn) => db.transaction(fn);
  let members;
  const cleanup = async () =>
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
  const notifications = await createNotifications(db, { clock, tx, env });
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
    notifications,
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
    async availability(id) {
      await cleanup();
      const d = await departure(id),
        vehicle = d.vehicle;
      return {
        departure: d,
        vehicle,
        seats: await Promise.all(
          Array.from(
            {
              length: vehicle.sellableSeats,
            },
            async (_, i) => ({
              number: i + 1,
              status: (await db.one("seat_locks", {
                _id: `${id}:${i + 1}`,
                expires_at: { $gt: clock() },
              }))
                ? "occupied"
                : "available",
            }),
          ),
        ),
      };
    },
    async hold(id, seats) {
      return tx(async () => {
        await cleanup();
        const d = await departure(id),
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
        });
        return { token, seats, expiresAt: expires };
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
          d = await departure(hold.departure_id);
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
          deposit = paymentMode === "deposit" ? Math.round(total * 0.3) : total,
          // Onay bekleyen kayıt en fazla 24 saat ya da satış kapanışına kadar koltuk tutar.
          expires = Math.min(
            clock() + 24 * 60 * 60 * 1000,
            d.salesClosesAt ?? Infinity,
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
        });

        await db.updateMany(
          "seat_locks",
          { owner: holdToken },
          { owner: reference, expires_at: expires },
        );
        await db.remove("holds", { _id: holdToken });
        return workflow.created(reference);
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
