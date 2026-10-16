import express from "express";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  business,
  tours,
  stories,
  vehicle,
  features,
  services,
  fleet,
  cancellationPolicy,
} from "./catalog.mjs";
import { createChatService } from "./chat.mjs";
import { AppError } from "./store.mjs";
import { createReviewsService } from "./reviews.mjs";
import { paymentStatus, createPayment } from "./payments.mjs";
const clean = z.string().trim().min(2).max(100),
  email = z.string().trim().email().max(254),
  phone = z
    .string()
    .trim()
    .min(10)
    .max(24)
    .regex(/^[+\d\s()-]+$/);
const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(new Date(s + "T12:00:00Z").getTime()) &&
      new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s,
    "Geçerli bir tarih seçin.",
  );
const requestSchema = z
  .object({
    kind: z.enum(["hotel", "private-tour", "vehicle"]),
    name: clean,
    email,
    phone,
    checkIn: ymd,
    checkOut: ymd.optional(),
    guests: z.number().int().min(1).max(50),
    hotelId: z.string().uuid().optional(),
    notes: z.string().trim().max(2000).default(""),
    consent: z.literal(true),
  })
  .refine((r) => r.checkIn >= new Date().toISOString().slice(0, 10), {
    message: "Gelecek bir tarih seçin.",
  })
  .refine((r) => r.kind !== "hotel" || (r.checkOut && r.checkOut > r.checkIn), {
    message: "Çıkış tarihi giriş tarihinden sonra olmalıdır.",
  });
const bookingSchema = z.object({
  holdToken: z.string().regex(/^[a-f0-9]{48}$/),
  name: clean,
  email,
  phone,
  passengers: z.array(clean).min(1).max(vehicle.sellableSeats),
  paymentMode: z.enum(["deposit", "full"]),
  consent: z.literal(true),
});
export function createApp(
  store,
  {
    env = process.env,
    reviewsService = createReviewsService(env),
    chatService = createChatService(env),
  } = {},
) {
  const app = express(),
    sessions = new Map(),
    limits = new Map();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use("/api", (req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (
        req.headers.origin &&
        req.headers.origin !== `${req.protocol}://${req.headers.host}`
      )
        return res
          .status(403)
          .json({ message: "Bu kaynaktan işlem yapılamaz." });
      if (req.headers["x-rota-client"] !== "web")
        return res.status(403).json({ message: "Geçersiz istek." });
    }
    const bucket = req.path.includes("/admin/login")
        ? "login"
        : req.path === "/chat"
          ? "chat"
          : "api",
      key = req.ip + ":" + bucket,
      now = Date.now();
    let l = limits.get(key);
    if (!l || l.reset < now) {
      l = { n: 0, reset: now + 15 * 60 * 1000 };
      limits.set(key, l);
    }
    l.n++;
    if (l.n > { login: 10, chat: 60, api: 300 }[bucket])
      return res
        .status(429)
        .json({ message: "Çok fazla istek. Biraz sonra tekrar deneyin." });
    if (limits.size > 5000)
      for (const [k, v] of limits) if (v.reset < now) limits.delete(k);
    next();
  });
  const route = (fn) => async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (e) {
      next(e);
    }
  };
  const requireAdmin = (req, res, next) => {
    const sid = (req.headers.cookie || "")
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("rota_admin="))
        ?.slice(11),
      session = sessions.get(sid);
    if (!session || session < Date.now())
      return res.status(401).json({ message: "Yönetici oturumu gerekli." });
    next();
  };
  app.get("/api/health", (_q, r) =>
    r.json({ ok: true, localPreview: env.NODE_ENV !== "production" }),
  );
  app.get("/api/catalog", (_q, r) =>
    r.json({
      business,
      tours,
      stories,
      vehicle,
      features,
      services,
      fleet,
      cancellationPolicy,
      payment: paymentStatus,
      preview: true,
    }),
  );
  app.get(
    "/api/tours/:id/departures",
    route((q, r) => r.json(store.listDepartures(q.params.id))),
  );
  app.get(
    "/api/departures/:id/seats",
    route((q, r) => r.json(store.availability(q.params.id))),
  );
  app.post(
    "/api/holds",
    route((q, r) => {
      const input = z
        .object({
          departureId: z.string().min(1).max(100),
          seats: z.array(z.number().int()).min(1).max(vehicle.sellableSeats),
        })
        .parse(q.body);
      r.status(201).json(store.hold(input.departureId, input.seats));
    }),
  );
  app.delete(
    "/api/holds/:token",
    route((q, r) => {
      const token = z
        .string()
        .regex(/^[a-f0-9]{48}$/)
        .parse(q.params.token);
      store.release(token);
      r.status(204).end();
    }),
  );
  app.post(
    "/api/reservations",
    route((q, r) =>
      r.status(201).json(store.reserve(bookingSchema.parse(q.body))),
    ),
  );
  app.post(
    "/api/reservations/lookup",
    route((q, r) => {
      const input = z
        .object({ reference: z.string().trim().min(3).max(30), email })
        .parse(q.body);
      r.json(store.lookup(input.reference, input.email));
    }),
  );
  app.post(
    "/api/reservations/cancel",
    route((q, r) => {
      const input = z
        .object({ reference: z.string().trim().min(3).max(30), email })
        .parse(q.body);
      r.json(store.cancel(input.reference, input.email));
    }),
  );
  app.post(
    "/api/chat",
    route(async (q, r) => {
      const { messages } = z
        .object({
          messages: z
            .array(
              z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string().trim().min(1).max(1200),
              }),
            )
            .min(1)
            .max(24)
            .refine((m) => m[0].role === "user" && m.at(-1).role === "user"),
        })
        .parse(q.body);
      r.json(await chatService.reply(messages));
    }),
  );
  app.get("/api/payment/status", (_q, r) => r.json(paymentStatus));
  app.post("/api/payment/checkout", (_q, r) => {
    const result = createPayment();
    r.status(result.status).json(result.body);
  });
  app.get(
    "/api/reviews",
    route(async (q, r) => {
      const tourId = q.query.tour
        ? z.enum(tours.map((t) => t.id)).parse(q.query.tour)
        : null;
      r.json(await reviewsService.get(store.assignments(), tourId));
    }),
  );
  app.get("/api/hotels", (_q, r) => r.json(store.hotels()));
  app.post(
    "/api/requests",
    route((q, r) => {
      const input = requestSchema.parse(q.body);
      if (input.hotelId && !store.hotels().some((h) => h.id === input.hotelId))
        throw new AppError(400, "Bu otel şu anda talep almıyor.");
      r.status(201).json(store.request(input.kind, input));
    }),
  );
  app.post(
    "/api/admin/login",
    route((q, r) => {
      if (!env.ADMIN_PASSWORD)
        return r.status(503).json({
          message:
            "Yönetim panelini açmak için yerel .env dosyasında ADMIN_PASSWORD belirleyin.",
        });
      const input = z
        .object({ password: z.string().min(1).max(300) })
        .parse(q.body);
      const a = createHash("sha256").update(input.password).digest(),
        b = createHash("sha256").update(env.ADMIN_PASSWORD).digest();
      if (!timingSafeEqual(a, b))
        return r.status(401).json({ message: "Parola doğru değil." });
      for (const [k, v] of sessions) if (v < Date.now()) sessions.delete(k);
      const sid = randomBytes(32).toString("hex");
      sessions.set(sid, Date.now() + 8 * 3600 * 1000);
      r.setHeader(
        "Set-Cookie",
        `rota_admin=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${env.NODE_ENV === "production" ? "; Secure" : ""}`,
      );
      r.json({ ok: true });
    }),
  );
  app.post("/api/admin/logout", requireAdmin, (q, r) => {
    const sid = (q.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("rota_admin="))
      ?.slice(11);
    sessions.delete(sid);
    r.setHeader(
      "Set-Cookie",
      "rota_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
    );
    r.json({ ok: true });
  });
  app.get(
    "/api/admin/dashboard",
    requireAdmin,
    route((_q, r) => r.json(store.dashboard())),
  );
  app.post(
    "/api/admin/hotels",
    requireAdmin,
    route((q, r) => {
      const hotel = z
        .object({
          id: z.string().uuid().optional(),
          name: clean,
          location: clean,
          description: z.string().trim().min(10).max(2000),
          amenities: z.array(z.string().trim().min(1).max(80)).max(12),
          image: z
            .string()
            .regex(/^\/images\/[\w.-]+$/)
            .optional(),
          active: z.boolean(),
        })
        .parse(q.body);
      r.json(store.upsertHotel(hotel));
    }),
  );
  app.get(
    "/api/admin/reviews",
    requireAdmin,
    route(async (_q, r) =>
      r.json({
        ...(await reviewsService.get(store.assignments())),
        assignments: store.assignments(),
      }),
    ),
  );
  app.post(
    "/api/admin/reviews/assign",
    requireAdmin,
    route((q, r) => {
      const input = z
        .object({
          reviewId: z.string().min(1).max(500),
          tourIds: z.array(z.enum(tours.map((t) => t.id))).max(tours.length),
        })
        .parse(q.body);
      store.assignReview(input.reviewId, input.tourIds);
      r.json({ ok: true });
    }),
  );
  app.use("/api", (_q, r) =>
    r.status(404).json({ message: "Bu işlem bulunamadı." }),
  );
  app.use((err, _q, r, _next) => {
    if (err instanceof z.ZodError)
      return r.status(400).json({
        message:
          "Bilgileri kontrol edin. Tarih, iletişim alanları ve onay zorunludur.",
        details: err.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
    if (err instanceof AppError)
      return r.status(err.status).json({ message: err.message });
    if (err.type === "entity.parse.failed")
      return r.status(400).json({ message: "Geçersiz istek." });
    console.error("Request failed:", err.name);
    r.status(500).json({
      message: "İşlem tamamlanamadı. Lütfen yeniden deneyin.",
    });
  });
  return app;
}
