import { randomUUID } from "node:crypto";
import express from "express";
import { attachAdvancedApi, receipt, siteBase } from "./advanced-api.mjs";
import { readFileSync } from "node:fs";
const photoCredits = JSON.parse(
  readFileSync(new URL("./photo-credits.json", import.meta.url), "utf8"),
);
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
import { attachSeoRoutes } from "./seo.mjs";
import { vehicleModels } from "./operations.mjs";
import { attachSocialAuth, cookieValue } from "./social-auth.mjs";
import { normalizeInstagramUrl, createInstagramFeed } from "./instagram.mjs";
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
  passengers: z.array(clean).min(1).max(53),
  paymentMode: z.enum(["deposit", "full"]),
  consent: z.literal(true),
  couponId: z
    .string()
    .regex(/^[a-f0-9]{32}$/)
    .optional(),
});
export function createApp(
  store,
  {
    env = process.env,
    reviewsService = createReviewsService(env),
    chatService = createChatService(env, null, {
      store,
    }),
    socialFetch = fetch,
    instagramFeed = createInstagramFeed({
      env,
      settings: store.instagramSettings,
    }),
  } = {},
) {
  const app = express(),
    limits = new Map(),
    activeHolds = new Map();
  app.disable("x-powered-by");
  // Tüm yanıtlar (HTML sayfaları dahil) için güvenlik başlıkları.
  const production = env.NODE_ENV === "production";
  const csp = [
    "default-src 'self'",
    // Instagram oynatıcısı yalnız video dosyası olmayan paylaşımlar için açılır.
    "script-src 'self' https://www.instagram.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src https://www.google.com https://maps.google.com https://www.instagram.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self' https://appleid.apple.com",
    "object-src 'none'",
  ].join("; ");
  app.use((req, res, next) => {
    req.id = randomUUID();
    res.set({
      "X-Request-Id": req.id,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "SAMEORIGIN",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    });
    // Vite geliştirme sunucusu satır içi betik kullandığı için CSP yalnızca yayında.
    if (production) {
      res.set("Content-Security-Policy", csp);
      if (req.secure)
        res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });
  if (env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use(
    "/api/auth/callback",
    express.urlencoded({
      extended: false,
      limit: "32kb",
    }),
  );
  app.use(
    express.json({
      limit: "32kb",
    }),
  );
  app.use("/api", (req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    const appleCallback =
      req.path === "/auth/callback/apple" && req.method === "POST";
    if (req.method !== "GET" && req.method !== "HEAD" && !appleCallback) {
      if (
        req.headers.origin &&
        req.headers.origin !== `${req.protocol}://${req.headers.host}`
      )
        return res.status(403).json({
          message: "Bu kaynaktan işlem yapılamaz.",
        });
      if (req.headers["x-rota-client"] !== "web")
        return res.status(403).json({
          message: "Geçersiz istek.",
        });
    }
    const bucket =
        req.path.includes("/admin/login") ||
        (req.path.startsWith("/auth/") && req.method === "POST") ||
        req.path.startsWith("/auth/start/")
          ? "login"
          : req.path === "/chat"
            ? "chat"
            : req.method === "POST" && req.path === "/holds"
              ? "hold"
              : req.method === "POST" && req.path === "/reservations"
                ? "booking"
                : "api",
      key = req.ip + ":" + bucket,
      now = Date.now();
    let l = limits.get(key);
    if (!l || l.reset < now) {
      l = {
        n: 0,
        reset: now + 15 * 60 * 1000,
      };
      limits.set(key, l);
    }
    l.n++;
    if (
      l.n >
      {
        login: 10,
        chat: 60,
        // Koltuk tutma ve ön rezervasyon, seferleri dolu gösterme amaçlı
        // kötüye kullanıma karşı ayrıca sınırlanır.
        hold: Number(env.HOLD_LIMIT_PER_15MIN || 20),
        booking: Number(env.BOOKING_LIMIT_PER_15MIN || 6),
        api: 300,
      }[bucket]
    )
      return res.status(429).json({
        message: "Çok fazla istek. Biraz sonra tekrar deneyin.",
      });
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
  const requireAdmin = async (req, res, next) => {
    const sid = (req.headers.cookie || "")
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("rota_admin="))
        ?.slice(11),
      session =
        sid && /^[a-f0-9]{64}$/.test(sid)
          ? await store.db.one("admin_sessions", {
              _id: createHash("sha256").update(sid).digest("hex"),
            })
          : null;
    if (!session || session.expires_at < Date.now())
      return res.status(401).json({
        message: "Yönetici oturumu gerekli.",
      });
    next();
  };
  app.use("/api", async (q, _r, next) => {
    q.member = await store.members.fromSession(cookieValue(q, "rota_member"));
    next();
  });
  const requireMember = (q, r, next) =>
    q.member
      ? next()
      : r.status(401).json({
          message: "Üye girişi gerekli.",
        });
  const memberCookie = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400000,
  };
  const setSession = async (r, id) =>
    r.cookie("rota_member", await store.members.session(id), memberCookie);
  app.get("/api/auth/me", (q, r) =>
    r.json({
      member: q.member,
    }),
  );
  app.post(
    "/api/auth/register",
    route(async (q, r) => {
      const input = z
        .object({
          name: clean,
          email,
          password: z
            .string()
            .min(10, "Parola en az 10 karakter olmalı.")
            .max(128),
          consent: z.literal(true),
          referralCode: z
            .string()
            .regex(/^[a-f0-9]{10}$/i)
            .optional(),
        })
        .parse(q.body);
      const member = await store.members.register(input);
      await setSession(r, member.id);
      const verification = await store.accountSecurity.requestVerification(
        member,
        siteBase(q, env),
      );
      r.status(201).json({ member, verification });
    }),
  );
  app.post(
    "/api/auth/login",
    route(async (q, r) => {
      const input = z
        .object({
          email,
          password: z.string().min(1).max(128),
        })
        .parse(q.body);
      const member = await store.members.login(input.email, input.password);
      await setSession(r, member.id);
      r.json({
        member,
      });
    }),
  );
  app.post("/api/auth/logout", async (q, r) => {
    await store.members.logout(cookieValue(q, "rota_member"));
    r.clearCookie("rota_member", {
      ...memberCookie,
      maxAge: 0,
    });
    r.status(204).end();
  });
  app.get(
    "/api/member/dashboard",
    requireMember,
    route(async (q, r) => {
      await store.cleanup();
      r.json(await store.members.dashboard(q.member.id));
    }),
  );
  app.post(
    "/api/member/spin",
    requireMember,
    route(async (q, r) => r.json(await store.members.spin(q.member.id))),
  );
  app.post(
    "/api/reservations/quote",
    route(async (q, r) => {
      const input = z
        .object({
          departureId: z.string().min(1).max(100),
          count: z.number().int().min(1).max(53),
          couponId: z
            .string()
            .regex(/^[a-f0-9]{32}$/)
            .optional(),
        })
        .parse(q.body);
      const available = await store.availability(input.departureId);
      if (input.count > available.vehicle.sellableSeats)
        throw new AppError(400, "Yolcu sayısı araç kapasitesini aşıyor.");
      const subtotal = available.departure.price * input.count;
      const quote = await store.members.priceCoupon(
        q.member?.id,
        input.couponId,
        subtotal,
        available.departure.tour_id,
      );
      r.json({
        subtotal,
        discount: quote.discount,
        total: quote.total,
      });
    }),
  );
  attachSocialAuth(app, {
    env,
    store,
    route,
    setSession,
    fetchImpl: socialFetch,
  });
  app.get(
    "/api/admin/operations",
    requireAdmin,
    route(async (_q, r) =>
      r.json({
        tours: await store.operations.list(),
        vehicleModels,
      }),
    ),
  );
  app.post(
    "/api/admin/operations/:id",
    requireAdmin,
    route(async (q, r) => {
      const input = z
        .object({
          salesOpen: z.boolean(),
          vehicleModel: z.enum(vehicleModels.map((v) => v.id)),
          passengerSeats: z.number().int().min(4).max(54),
        })
        .parse(q.body);
      r.json(await store.operations.update(q.params.id, input));
    }),
  );
  attachAdvancedApi(app, {
    store,
    env,
    route,
    requireAdmin,
    requireMember,
    schemas: { ymd, clean, email, phone },
  });
  // Railway/Docker sağlık kontrolü: veritabanına gerçekten ulaşılabiliyor mu?
  app.get("/api/health", async (_q, r) => {
    let database = "ok";
    try {
      await store.db.ping();
    } catch {
      database = "unavailable";
    }
    r.status(database === "ok" ? 200 : 503).json({
      ok: database === "ok",
      localPreview: env.NODE_ENV !== "production",
      dialect: store.db.dialect,
      database,
    });
  });
  attachSeoRoutes(app, env);
  app.get("/api/catalog", async (_q, r) =>
    r.json({
      business,
      tours: await store.operations.list(),
      vehicleModels,
      photoCredits,
      stories,
      vehicle,
      features,
      services,
      fleet,
      cancellationPolicy,
      payment: paymentStatus,
      preview: true,
      demo: env.DEMO_MODE === "1",
    }),
  );
  app.get(
    "/api/tours/:id/departures",
    route(async (q, r) => r.json(await store.listDepartures(q.params.id))),
  );
  app.get(
    "/api/departures/:id/seats",
    route(async (q, r) => r.json(await store.availability(q.params.id))),
  );
  app.post(
    "/api/holds",
    route(async (q, r) => {
      const input = z
        .object({
          departureId: z.string().min(1).max(100),
          seats: z.array(z.number().int()).min(1).max(53),
        })
        .parse(q.body);
      const guestMax = Number(env.GUEST_MAX_SEATS || 10);
      if (!q.member && input.seats.length > guestMax)
        throw new AppError(
          400,
          `Online en fazla ${guestMax} koltuk seçebilirsiniz. Daha büyük gruplar için WhatsApp'tan yazın.`,
        );
      // Aynı IP'nin eşzamanlı tuttuğu toplam koltuk sınırlıdır.
      const now = Date.now(),
        mine = (activeHolds.get(q.ip) || []).filter((h) => h.expiresAt > now),
        heldSeats = mine.reduce((n, h) => n + h.seats, 0),
        ipMax = Number(env.IP_MAX_HELD_SEATS || 20);
      if (heldSeats + input.seats.length > ipMax)
        throw new AppError(
          429,
          "Aynı anda çok fazla koltuk tutuluyor. Önceki seçimlerinizi tamamlayın ya da birkaç dakika sonra deneyin.",
        );
      const hold = await store.hold(input.departureId, input.seats);
      mine.push({
        token: hold.token,
        seats: input.seats.length,
        expiresAt: hold.expiresAt,
      });
      activeHolds.set(q.ip, mine);
      if (activeHolds.size > 5000)
        for (const [k, v] of activeHolds)
          if (!v.some((h) => h.expiresAt > now)) activeHolds.delete(k);
      r.status(201).json(hold);
    }),
  );
  app.delete(
    "/api/holds/:token",
    route(async (q, r) => {
      const token = z
        .string()
        .regex(/^[a-f0-9]{48}$/)
        .parse(q.params.token);
      await store.release(token);
      const mine = activeHolds.get(q.ip);
      if (mine)
        activeHolds.set(
          q.ip,
          mine.filter((h) => h.token !== token),
        );
      r.status(204).end();
    }),
  );
  app.post(
    "/api/reservations",
    route(async (q, r) => {
      const input = bookingSchema.parse(q.body);
      if (q.member && input.email.toLowerCase() !== q.member.email)
        throw new AppError(
          400,
          "Üye rezervasyonunda hesabınızın e-posta adresini kullanın.",
        );
      r.status(201).json(
        await receipt(
          await store.reserve({
            ...input,
            memberId: q.member?.id,
          }),
          q,
          env,
        ),
      );
    }),
  );
  app.post(
    "/api/reservations/lookup",
    route(async (q, r) => {
      const input = z
        .object({
          reference: z.string().trim().min(3).max(30),
          email,
        })
        .parse(q.body);
      r.json(
        await receipt(await store.lookup(input.reference, input.email), q, env),
      );
    }),
  );
  app.post(
    "/api/reservations/cancel",
    route(async (q, r) => {
      const input = z
        .object({
          reference: z.string().trim().min(3).max(30),
          email,
        })
        .parse(q.body);
      r.json(
        await receipt(await store.cancel(input.reference, input.email), q, env),
      );
    }),
  );
  app.post(
    "/api/chat",
    route(async (q, r) => {
      const { messages, context } = z
        .object({
          messages: z
            .array(
              z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string().trim().min(1).max(4000),
              }),
            )
            .min(1)
            .max(24)
            .refine((m) => m[0].role === "user" && m.at(-1).role === "user")
            .refine((m) =>
              m.every(
                (item, i) =>
                  (item.role !== "user" || item.content.length <= 1200) &&
                  (i === 0 || item.role !== m[i - 1].role),
              ),
            )
            .refine(
              (m) => m.reduce((n, item) => n + item.content.length, 0) <= 12000,
            ),
          context: z
            .object({
              tourId: z.enum(tours.map((t) => t.id)).optional(),
            })
            .optional(),
        })
        .parse(q.body);
      r.json(await chatService.reply(messages, context));
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
      r.json(await reviewsService.get(await store.assignments(), tourId));
    }),
  );
  app.get("/api/hotels", async (_q, r) => r.json(await store.hotels()));
  app.get("/api/instagram", async (_q, r) => {
    // Instagram API bağlıysa hesabın son videoları gerçek dosyalarıyla gelir;
    // değilse yönetim panelinden girilen paylaşımlar kullanılır.
    const live = await instagramFeed.posts();
    r.json({
      posts: live?.length ? live : await store.instagramPosts(),
      source: live?.length ? "instagram" : "manual",
      profileUrl: business.instagram,
    });
  });
  app.get("/api/admin/instagram", requireAdmin, async (_q, r) =>
    r.json(await store.instagramPosts(true)),
  );
  app.post(
    "/api/admin/instagram",
    requireAdmin,
    route(async (q, r) => {
      const post = z
        .object({
          id: z.string().uuid().optional(),
          title: clean,
          permalink: z
            .string()
            .max(500)
            .transform(normalizeInstagramUrl)
            .refine(
              Boolean,
              "Geçerli bir Instagram Reels veya gönderi bağlantısı girin.",
            ),
          cover: z.string().regex(/^\/images\/[\w.-]+$/),
          videoSrc: z
            .string()
            .regex(/^\/videos\/[A-Za-z0-9_-]+\.(mp4|webm)$/)
            .nullable()
            .optional(),
          position: z.number().int().min(0).max(99),
          active: z.boolean(),
        })
        .parse(q.body);
      r.json(await store.upsertInstagramPost(post));
    }),
  );
  app.post(
    "/api/requests",
    route(async (q, r) => {
      const input = requestSchema.parse(q.body);
      if (
        input.hotelId &&
        !(await store.hotels()).some((h) => h.id === input.hotelId)
      )
        throw new AppError(400, "Bu otel şu anda talep almıyor.");
      r.status(201).json(await store.request(input.kind, input));
    }),
  );
  app.post(
    "/api/admin/login",
    route(async (q, r) => {
      if (!env.ADMIN_PASSWORD)
        return r.status(503).json({
          message:
            "Yönetim panelini açmak için yerel .env dosyasında ADMIN_PASSWORD belirleyin.",
        });
      const input = z
        .object({
          password: z.string().min(1).max(300),
        })
        .parse(q.body);
      const a = createHash("sha256").update(input.password).digest(),
        b = createHash("sha256").update(env.ADMIN_PASSWORD).digest();
      if (!timingSafeEqual(a, b))
        return r.status(401).json({
          message: "Parola doğru değil.",
        });
      await store.db.remove("admin_sessions", {
        expires_at: { $lt: Date.now() },
      });
      const sid = randomBytes(32).toString("hex"),
        hash = createHash("sha256").update(sid).digest("hex");
      await store.db.insert("admin_sessions", hash, {
        token_hash: hash,
        expires_at: Date.now() + 8 * 3600 * 1000,
      });
      r.setHeader(
        "Set-Cookie",
        `rota_admin=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${env.NODE_ENV === "production" ? "; Secure" : ""}`,
      );
      r.json({
        ok: true,
      });
    }),
  );
  app.post("/api/admin/logout", requireAdmin, async (q, r) => {
    const sid = (q.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("rota_admin="))
      ?.slice(11);
    if (sid)
      await store.db.remove("admin_sessions", {
        _id: createHash("sha256").update(sid).digest("hex"),
      });
    r.setHeader(
      "Set-Cookie",
      "rota_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
    );
    r.json({
      ok: true,
    });
  });
  app.get(
    "/api/admin/dashboard",
    requireAdmin,
    route(async (_q, r) => r.json(await store.dashboard())),
  );
  app.post(
    "/api/admin/hotels",
    requireAdmin,
    route(async (q, r) => {
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
      r.json(await store.upsertHotel(hotel));
    }),
  );
  app.get(
    "/api/admin/reviews",
    requireAdmin,
    route(async (_q, r) =>
      r.json({
        ...(await reviewsService.get(await store.assignments())),
        assignments: await store.assignments(),
      }),
    ),
  );
  app.post(
    "/api/admin/reviews/assign",
    requireAdmin,
    route(async (q, r) => {
      const input = z
        .object({
          reviewId: z.string().min(1).max(500),
          tourIds: z.array(z.enum(tours.map((t) => t.id))).max(tours.length),
        })
        .parse(q.body);
      await store.assignReview(input.reviewId, input.tourIds);
      r.json({
        ok: true,
      });
    }),
  );
  app.use("/api", (_q, r) =>
    r.status(404).json({
      message: "Bu işlem bulunamadı.",
    }),
  );
  app.use((err, q, r, _next) => {
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
      return r.status(err.status).json({
        message: err.message,
      });
    if (err.type === "entity.parse.failed")
      return r.status(400).json({
        message: "Geçersiz istek.",
      });
    // Kişisel veri sızdırmadan teşhis için yeterli bilgi: istek kimliği, yol ve yığın.
    console.error(
      JSON.stringify({
        level: "error",
        requestId: q.id,
        method: q.method,
        path: q.path,
        error: err.name,
        message: String(err.message || "").slice(0, 300),
        stack: String(err.stack || "")
          .split("\n")
          .slice(0, 6)
          .join(" | "),
      }),
    );
    r.status(500).json({
      message: "İşlem tamamlanamadı. Lütfen yeniden deneyin.",
    });
  });
  return app;
}
