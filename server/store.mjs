import { connectDatabase } from "./database.mjs";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { tours, vehicle } from "./catalog.mjs";
import { createOperations } from "./operations.mjs";
import { createMembers } from "./members.mjs";
import { createCampaigns } from "./campaigns.mjs";
import { createNotifications } from "./notifications.mjs";
import { createDepartures, localDate } from "./departures.mjs";
import { createWorkflow } from "./workflow.mjs";
import { createAccountSecurity } from "./account-security.mjs";
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export async function openStore(
  path = "./data/rota-kars.sqlite",
  { clock = Date.now, seed = true, env = process.env, driver } = {},
) {
  const db = await connectDatabase({ path, env, driver });
  await db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
  );
  await db.exec(`CREATE TABLE IF NOT EXISTS departures(id TEXT PRIMARY KEY,tour_id TEXT NOT NULL,date TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>0),active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS holds(token TEXT PRIMARY KEY,departure_id TEXT NOT NULL REFERENCES departures(id),seats TEXT NOT NULL,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS seat_locks(departure_id TEXT NOT NULL REFERENCES departures(id),seat INTEGER NOT NULL CHECK(seat >= 1),owner TEXT NOT NULL,expires_at INTEGER NOT NULL,PRIMARY KEY(departure_id,seat));
 CREATE TABLE IF NOT EXISTS reservations(id TEXT PRIMARY KEY,reference TEXT NOT NULL UNIQUE,departure_id TEXT NOT NULL REFERENCES departures(id),email TEXT NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,passengers TEXT NOT NULL,seats TEXT NOT NULL,total INTEGER NOT NULL,deposit INTEGER NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,kind TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'new',created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS hotels(id TEXT PRIMARY KEY,name TEXT NOT NULL,location TEXT NOT NULL,description TEXT NOT NULL,amenities TEXT NOT NULL,image TEXT,active INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS review_assignments(review_id TEXT PRIMARY KEY,tour_ids TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS instagram_posts(id TEXT PRIMARY KEY,title TEXT NOT NULL,permalink TEXT NOT NULL UNIQUE,cover TEXT NOT NULL,position INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 0);`);
  if (
    !(await db.prepare("PRAGMA table_info(instagram_posts)").all()).some(
      (column) => column.name === "videoSrc",
    )
  )
    await db.exec("ALTER TABLE instagram_posts ADD COLUMN videoSrc TEXT");
  const reservationColumns = (
    await db.prepare("PRAGMA table_info(reservations)").all()
  ).map((c) => c.name);
  for (const [name, sql] of Object.entries({
    vehicle_json: "TEXT",
    member_id: "TEXT",
    coupon_id: "TEXT",
    subtotal: "INTEGER NOT NULL DEFAULT 0",
    discount_amount: "INTEGER NOT NULL DEFAULT 0",
  }))
    if (!reservationColumns.includes(name))
      await db.exec(`ALTER TABLE reservations ADD COLUMN ${name} ${sql}`);
  const tx = (fn) => db.transaction(fn);
  let members;
  await db.exec(
    "CREATE TABLE IF NOT EXISTS admin_sessions(token_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL)",
  );
  const cleanup = async () =>
    tx(async () => {
      const now = clock();
      await db.prepare("DELETE FROM seat_locks WHERE expires_at<=?").run(now);
      await db.prepare("DELETE FROM holds WHERE expires_at<=?").run(now);
      await db
        .prepare(
          "UPDATE reservations SET status='expired' WHERE status='pending_agency' AND expires_at<=?",
        )
        .run(now);
      await members?.releaseCoupons();
    });
  const parse = (r) =>
    r
      ? {
          ...r,
          vehicle: r.vehicle_json ? JSON.parse(r.vehicle_json) : null,
          seats: JSON.parse(r.seats || "[]"),
          passengers: JSON.parse(r.passengers || "[]"),
        }
      : null;
  const campaigns = await createCampaigns(db, { clock });
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
    const insertPost = db.prepare(
      "INSERT OR IGNORE INTO instagram_posts(id,title,permalink,cover,position,active) VALUES(?,?,?,?,?,?)",
    );
    for (const post of instagramPosts)
      await insertPost.run(
        post.id,
        post.title,
        post.permalink,
        post.cover,
        post.position,
        post.active ? 1 : 0,
      );
    const insert = db.prepare(
      "INSERT OR IGNORE INTO departures(id,tour_id,date,price) VALUES(?,?,?,?)",
    );
    const today = new Date(clock());
    for (const t of tours)
      for (let i = 0; i < 6; i++) {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() + 3 + i * 7);
        if (t.id === "sarikamis" && d.getUTCMonth() < 11) {
          d.setUTCMonth(11);
          d.setUTCDate(5 + i * 7);
        }
        const date = d.toISOString().slice(0, 10);
        await insert.run(`${t.id}-${date}`, t.id, date, t.price);
      }
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
              status: (await db
                .prepare(
                  "SELECT owner FROM seat_locks WHERE departure_id=? AND seat=? AND expires_at>?",
                )
                .get(id, i + 1, clock()))
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
        for (const seat of seats) {
          if (
            await db
              .prepare(
                "SELECT 1 FROM seat_locks WHERE departure_id=? AND seat=?",
              )
              .get(id, seat)
          )
            throw new AppError(
              409,
              "Seçtiğiniz koltuklardan biri az önce ayrıldı.",
            );
          await db
            .prepare("INSERT INTO seat_locks VALUES(?,?,?,?)")
            .run(id, seat, token, expires);
        }
        await db
          .prepare("INSERT INTO holds VALUES(?,?,?,?)")
          .run(token, id, JSON.stringify(seats), expires);
        return { token, seats, expiresAt: expires };
      });
    },
    release(token) {
      return tx(async () => {
        await db.prepare("DELETE FROM seat_locks WHERE owner=?").run(token);
        await db.prepare("DELETE FROM holds WHERE token=?").run(token);
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
        const hold = await db
          .prepare("SELECT * FROM holds WHERE token=? AND expires_at>?")
          .get(holdToken, clock());
        if (!hold)
          throw new AppError(
            410,
            "Koltuk ayırma süresi doldu. Lütfen koltuklarınızı yeniden seçin.",
          );
        const seats = JSON.parse(hold.seats),
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
          expires = clock() + 24 * 60 * 60 * 1000;
        await db
          .prepare(
            "INSERT INTO reservations(id,reference,departure_id,email,name,phone,passengers,seats,total,deposit,status,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .run(
            id,
            reference,
            d.id,
            email.toLowerCase(),
            name,
            phone,
            JSON.stringify(passengers),
            hold.seats,
            total,
            deposit,
            "pending_agency",
            clock(),
            expires,
          );
        await db
          .prepare(
            "UPDATE reservations SET vehicle_json=?,member_id=?,coupon_id=?,subtotal=?,discount_amount=? WHERE id=?",
          )
          .run(
            JSON.stringify(d.vehicle),
            memberId,
            couponId,
            subtotal,
            discounted.discount,
            id,
          );
        await db
          .prepare(
            "UPDATE reservations SET ticket_token=?,discount_percent=? WHERE id=?",
          )
          .run(
            randomBytes(24).toString("hex"),
            discounted.coupon?.percent || 0,
            id,
          );
        await members.consumeCoupon(couponId, id);

        await db
          .prepare("UPDATE seat_locks SET owner=?,expires_at=? WHERE owner=?")
          .run(reference, expires, holdToken);
        await db.prepare("DELETE FROM holds WHERE token=?").run(holdToken);
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
      await db
        .prepare(
          "INSERT INTO requests(id,kind,body,created_at) VALUES(?,?,?,?)",
        )
        .run(id, kind, JSON.stringify(body), clock());
      return {
        reference: "TL-" + id.slice(0, 8).toUpperCase(),
        status: "received",
      };
    },
    async hotels() {
      return (
        await db
          .prepare("SELECT * FROM hotels WHERE active=1 ORDER BY name")
          .all()
      ).map((h) => ({
        ...h,
        amenities: JSON.parse(h.amenities),
      }));
    },
    async dashboard() {
      await cleanup();
      return {
        reservations: await workflow.list(),
        requests: (
          await db
            .prepare(
              "SELECT * FROM requests ORDER BY created_at DESC LIMIT 200",
            )
            .all()
        ).map((r) => ({
          ...r,
          body: JSON.parse(r.body),
        })),
        hotels: (
          await db.prepare("SELECT * FROM hotels ORDER BY name").all()
        ).map((h) => ({
          ...h,
          amenities: JSON.parse(h.amenities),
        })),
      };
    },
    async upsertHotel(h) {
      const id = h.id || randomUUID();
      await db
        .prepare(
          "INSERT INTO hotels VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,location=excluded.location,description=excluded.description,amenities=excluded.amenities,image=excluded.image,active=excluded.active",
        )
        .run(
          id,
          h.name,
          h.location,
          h.description,
          JSON.stringify(h.amenities),
          h.image || null,
          h.active ? 1 : 0,
        );
      return {
        id,
      };
    },
    async assignments() {
      return Object.fromEntries(
        (await db.prepare("SELECT * FROM review_assignments").all()).map(
          (r) => [r.review_id, JSON.parse(r.tour_ids)],
        ),
      );
    },
    async assignReview(reviewId, tourIds) {
      await db
        .prepare(
          "INSERT INTO review_assignments VALUES(?,?) ON CONFLICT(review_id) DO UPDATE SET tour_ids=excluded.tour_ids",
        )
        .run(reviewId, JSON.stringify(tourIds));
    },
    async instagramPosts(includeDrafts = false) {
      return await db
        .prepare(
          `SELECT * FROM instagram_posts ${includeDrafts ? "" : "WHERE active=1"} ORDER BY position,id`,
        )
        .all();
    },
    async upsertInstagramPost(post) {
      const id = post.id || randomUUID();
      const duplicate = await db
        .prepare("SELECT id FROM instagram_posts WHERE permalink=? AND id<>?")
        .get(post.permalink, id);
      if (duplicate)
        throw new AppError(409, "Bu Instagram videosu zaten eklenmiş.");
      await db
        .prepare(
          "INSERT INTO instagram_posts(id,title,permalink,cover,position,active,videoSrc) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,permalink=excluded.permalink,cover=excluded.cover,position=excluded.position,active=excluded.active,videoSrc=excluded.videoSrc",
        )
        .run(
          id,
          post.title,
          post.permalink,
          post.cover,
          post.position,
          post.active ? 1 : 0,
          post.videoSrc || null,
        );
      return {
        id,
      };
    },
  };
}
