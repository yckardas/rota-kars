import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { tours, vehicle } from "./catalog.mjs";
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function openStore(
  path = "./data/rota-kars.sqlite",
  { clock = Date.now, seed = true } = {},
) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
  );
  db.exec(`CREATE TABLE IF NOT EXISTS departures(id TEXT PRIMARY KEY,tour_id TEXT NOT NULL,date TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>0),active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS holds(token TEXT PRIMARY KEY,departure_id TEXT NOT NULL REFERENCES departures(id),seats TEXT NOT NULL,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS seat_locks(departure_id TEXT NOT NULL REFERENCES departures(id),seat INTEGER NOT NULL CHECK(seat BETWEEN 1 AND 8),owner TEXT NOT NULL,expires_at INTEGER NOT NULL,PRIMARY KEY(departure_id,seat));
 CREATE TABLE IF NOT EXISTS reservations(id TEXT PRIMARY KEY,reference TEXT NOT NULL UNIQUE,departure_id TEXT NOT NULL REFERENCES departures(id),email TEXT NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,passengers TEXT NOT NULL,seats TEXT NOT NULL,total INTEGER NOT NULL,deposit INTEGER NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,kind TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'new',created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS hotels(id TEXT PRIMARY KEY,name TEXT NOT NULL,location TEXT NOT NULL,description TEXT NOT NULL,amenities TEXT NOT NULL,image TEXT,active INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS review_assignments(review_id TEXT PRIMARY KEY,tour_ids TEXT NOT NULL);`);
  const tx = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  const cleanup = () => {
    const now = clock();
    db.prepare("DELETE FROM seat_locks WHERE expires_at<=?").run(now);
    db.prepare("DELETE FROM holds WHERE expires_at<=?").run(now);
    db.prepare(
      "UPDATE reservations SET status='expired' WHERE status='pending_agency' AND expires_at<=?",
    ).run(now);
  };
  const parse = (r) =>
    r
      ? {
          ...r,
          seats: JSON.parse(r.seats || "[]"),
          passengers: JSON.parse(r.passengers || "[]"),
        }
      : null;
  if (seed) {
    const insert = db.prepare(
      "INSERT OR IGNORE INTO departures(id,tour_id,date,price) VALUES(?,?,?,?)",
    );
    const today = new Date(clock());
    for (const t of tours.filter((t) => !t.inquiryOnly))
      for (let i = 0; i < 6; i++) {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() + 3 + i * 7);
        if (t.id === "sarikamis" && d.getUTCMonth() < 11) {
          d.setUTCMonth(11);
          d.setUTCDate(5 + i * 7);
        }
        const date = d.toISOString().slice(0, 10);
        insert.run(`${t.id}-${date}`, t.id, date, t.price);
      }
  }
  function departure(id) {
    const d = db
      .prepare("SELECT * FROM departures WHERE id=? AND active=1")
      .get(id);
    if (!d || d.date < new Date(clock()).toISOString().slice(0, 10))
      throw new AppError(
        404,
        "Bu sefer artık rezervasyona açık değil. Başka bir tarih seçin.",
      );
    return d;
  }
  return {
    db,
    clock,
    cleanup,
    listDepartures(tourId) {
      cleanup();
      return db
        .prepare(
          "SELECT * FROM departures WHERE tour_id=? AND active=1 AND date>=? ORDER BY date",
        )
        .all(tourId, new Date(clock()).toISOString().slice(0, 10))
        .map((d) => ({
          ...d,
          available:
            vehicle.sellableSeats -
            Number(
              db
                .prepare(
                  "SELECT count(*) n FROM seat_locks WHERE departure_id=? AND expires_at>?",
                )
                .get(d.id, clock()).n,
            ),
        }));
    },
    availability(id) {
      cleanup();
      const d = departure(id);
      return {
        departure: d,
        vehicle,
        seats: Array.from({ length: 8 }, (_, i) => ({
          number: i + 1,
          status: db
            .prepare(
              "SELECT owner FROM seat_locks WHERE departure_id=? AND seat=? AND expires_at>?",
            )
            .get(id, i + 1, clock())
            ? "occupied"
            : "available",
        })),
      };
    },
    hold(id, seats) {
      if (
        !Array.isArray(seats) ||
        seats.length < 1 ||
        seats.length > 8 ||
        new Set(seats).size !== seats.length ||
        seats.some((s) => !Number.isInteger(s) || s < 1 || s > 8)
      )
        throw new AppError(
          400,
          "Yalnızca 1–8 numaralı yolcu koltukları seçilebilir.",
        );
      return tx(() => {
        cleanup();
        departure(id);
        const token = randomBytes(24).toString("hex"),
          expires = clock() + 10 * 60 * 1000;
        for (const s of seats) {
          if (
            db
              .prepare(
                "SELECT 1 FROM seat_locks WHERE departure_id=? AND seat=?",
              )
              .get(id, s)
          )
            throw new AppError(
              409,
              "Seçtiğiniz koltuklardan biri az önce ayrıldı. Yerleşimi yenileyip tekrar seçin.",
            );
          db.prepare("INSERT INTO seat_locks VALUES(?,?,?,?)").run(
            id,
            s,
            token,
            expires,
          );
        }
        db.prepare("INSERT INTO holds VALUES(?,?,?,?)").run(
          token,
          id,
          JSON.stringify(seats),
          expires,
        );
        return { token, seats, expiresAt: expires };
      });
    },
    release(token) {
      tx(() => {
        db.prepare("DELETE FROM seat_locks WHERE owner=?").run(token);
        db.prepare("DELETE FROM holds WHERE token=?").run(token);
      });
    },
    reserve({ holdToken, name, email, phone, passengers, paymentMode }) {
      return tx(() => {
        cleanup();
        const hold = db
          .prepare("SELECT * FROM holds WHERE token=? AND expires_at>?")
          .get(holdToken, clock());
        if (!hold)
          throw new AppError(
            410,
            "Koltuk ayırma süresi doldu. Lütfen koltuklarınızı yeniden seçin.",
          );
        const seats = JSON.parse(hold.seats),
          d = departure(hold.departure_id);
        if (passengers.length !== seats.length)
          throw new AppError(
            400,
            "Her seçili koltuk için bir yolcu adı girin.",
          );
        const id = randomUUID(),
          reference = "RK-" + randomBytes(5).toString("hex").toUpperCase(),
          total = d.price * seats.length,
          deposit = paymentMode === "deposit" ? Math.round(total * 0.3) : total,
          expires = clock() + 24 * 60 * 60 * 1000;
        db.prepare(
          "INSERT INTO reservations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
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
        db.prepare(
          "UPDATE seat_locks SET owner=?,expires_at=? WHERE owner=?",
        ).run(reference, expires, holdToken);
        db.prepare("DELETE FROM holds WHERE token=?").run(holdToken);
        return {
          ...parse(db.prepare("SELECT * FROM reservations WHERE id=?").get(id)),
          date: d.date,
          tourId: d.tour_id,
        };
      });
    },
    lookup(reference, email) {
      cleanup();
      const r = db
        .prepare(
          "SELECT r.*,d.date,d.tour_id as tourId FROM reservations r JOIN departures d ON d.id=r.departure_id WHERE r.reference=? AND r.email=?",
        )
        .get(reference.toUpperCase(), email.toLowerCase());
      if (!r)
        throw new AppError(
          404,
          "Bu referans ve e-posta ile bir ön rezervasyon bulunamadı.",
        );
      return parse(r);
    },
    cancel(reference, email) {
      return tx(() => {
        const r = this.lookup(reference, email);
        if (r.status === "pending_agency") {
          db.prepare(
            "UPDATE reservations SET status='cancelled' WHERE id=?",
          ).run(r.id);
          db.prepare("DELETE FROM seat_locks WHERE owner=?").run(r.reference);
        }
        return this.lookup(reference, email);
      });
    },
    request(kind, body) {
      const id = randomUUID();
      db.prepare(
        "INSERT INTO requests(id,kind,body,created_at) VALUES(?,?,?,?)",
      ).run(id, kind, JSON.stringify(body), clock());
      return {
        reference: "TL-" + id.slice(0, 8).toUpperCase(),
        status: "received",
      };
    },
    hotels() {
      return db
        .prepare("SELECT * FROM hotels WHERE active=1 ORDER BY name")
        .all()
        .map((h) => ({ ...h, amenities: JSON.parse(h.amenities) }));
    },
    dashboard() {
      cleanup();
      return {
        reservations: db
          .prepare(
            "SELECT r.*,d.date,d.tour_id as tourId FROM reservations r JOIN departures d ON r.departure_id=d.id ORDER BY r.created_at DESC LIMIT 200",
          )
          .all()
          .map(parse),
        requests: db
          .prepare("SELECT * FROM requests ORDER BY created_at DESC LIMIT 200")
          .all()
          .map((r) => ({ ...r, body: JSON.parse(r.body) })),
        hotels: db
          .prepare("SELECT * FROM hotels ORDER BY name")
          .all()
          .map((h) => ({ ...h, amenities: JSON.parse(h.amenities) })),
      };
    },
    upsertHotel(h) {
      const id = h.id || randomUUID();
      db.prepare(
        "INSERT INTO hotels VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,location=excluded.location,description=excluded.description,amenities=excluded.amenities,image=excluded.image,active=excluded.active",
      ).run(
        id,
        h.name,
        h.location,
        h.description,
        JSON.stringify(h.amenities),
        h.image || null,
        h.active ? 1 : 0,
      );
      return { id };
    },
    assignments() {
      return Object.fromEntries(
        db
          .prepare("SELECT * FROM review_assignments")
          .all()
          .map((r) => [r.review_id, JSON.parse(r.tour_ids)]),
      );
    },
    assignReview(reviewId, tourIds) {
      db.prepare(
        "INSERT INTO review_assignments VALUES(?,?) ON CONFLICT(review_id) DO UPDATE SET tour_ids=excluded.tour_ids",
      ).run(reviewId, JSON.stringify(tourIds));
    },
  };
}
