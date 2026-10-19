import { z } from "zod";
import QRCode from "qrcode";
import { AppError } from "./store.mjs";
import { vehicleModels } from "./operations.mjs";
import { tours } from "./catalog.mjs";
import { localDate } from "./departures.mjs";
import { siteBase as configuredBase } from "./seo.mjs";
export const siteBase = (q, env) => configuredBase(env, q);
export async function receipt(reservation, q, env) {
  const ticketUrl = siteBase(q, env) + "/bilet/" + reservation.ticket_token;
  return {
    ...reservation,
    ticketUrl,
    qrDataUrl: await QRCode.toDataURL(ticketUrl, { width: 200, margin: 1 }),
  };
}
export function attachAdvancedApi(
  app,
  {
    store,
    env,
    route,
    requireAdmin,
    requireMember,
    schemas: { ymd, clean, email, phone },
  },
) {
  const token = z.string().regex(/^[a-f0-9]{64}$/),
    tourId = z.enum(tours.map((t) => t.id));
  app.post(
    "/api/auth/verification/request",
    requireMember,
    route(async (q, r) =>
      r.json(
        await store.accountSecurity.requestVerification(
          q.member,
          siteBase(q, env),
        ),
      ),
    ),
  );
  app.post(
    "/api/auth/verify",
    route(async (q, r) => {
      const input = z.object({ token }).parse(q.body);
      r.json(await store.accountSecurity.verify(input.token));
    }),
  );
  app.post(
    "/api/auth/forgot-password",
    route(async (q, r) => {
      const input = z.object({ email }).parse(q.body);
      r.json(
        await store.accountSecurity.requestReset(input.email, siteBase(q, env)),
      );
    }),
  );
  app.post(
    "/api/auth/reset-password",
    route(async (q, r) => {
      const input = z
        .object({ token, password: z.string().min(10).max(128) })
        .parse(q.body);
      r.json(await store.accountSecurity.reset(input.token, input.password));
    }),
  );
  app.post(
    "/api/member/profile",
    requireMember,
    route(async (q, r) => {
      const input = z
        .object({
          name: clean,
          phone: z.union([phone, z.literal("")]).default(""),
        })
        .parse(q.body);
      r.json({
        member: await store.accountSecurity.profile(q.member.id, input),
      });
    }),
  );
  app.get(
    "/api/campaigns",
    route(async (_q, r) => r.json(await store.campaigns.get())),
  );
  app.post(
    "/api/admin/campaigns",
    requireAdmin,
    route(async (q, r) => {
      const input = z
        .object({
          active: z.boolean(),
          sectors: z
            .array(z.union([z.literal(5), z.literal(10), z.literal(15)]))
            .length(6),
          validDays: z.number().int().min(1).max(365),
          minTotal: z.number().int().min(0).max(100000000),
          tourIds: z.array(tourId).max(tours.length),
          referralTrigger: z.enum(["paid", "completed"]),
          requireVerified: z.boolean(),
        })
        .parse(q.body);
      r.json(await store.campaigns.save(input));
    }),
  );
  app.get(
    "/api/admin/departures",
    requireAdmin,
    route(async (q, r) => {
      const filters = z
        .object({ date: ymd.optional(), tourId: tourId.optional() })
        .parse(q.query);
      r.json(await store.departures.list(filters));
    }),
  );
  // Toplu sefer: tarih aralığında seçilen hafta günlerine aynı plan. Aynı tur, gün ve
  // saatte zaten sefer varsa atlanır. En fazla 186 gün ve 200 sefer.
  app.post(
    "/api/admin/departures/bulk",
    requireAdmin,
    route(async (q, r) => {
      const input = z
        .object({
          tourId,
          from: ymd,
          to: ymd,
          weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
          startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
          price: z.number().int().min(1).max(100000000),
          pickup: clean,
          guideName: z.string().trim().max(100).default(""),
          guidePhone: z.union([phone, z.literal("")]).default(""),
          vehicleModel: z.enum(vehicleModels.map((m) => m.id)),
          passengerSeats: z.number().int().min(4).max(54),
          active: z.boolean(),
        })
        .parse(q.body);
      const day = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
      const start = day(input.from),
        end = day(input.to);
      if (end < start) throw new AppError(400, "Bitiş tarihi başlangıçtan önce olamaz.");
      if (end - start > 186 * 86400000) throw new AppError(400, "En fazla 6 aylık aralık seçin.");
      if (input.from < localDate(store.clock())) throw new AppError(400, "Geçmiş tarihe sefer açılamaz.");
      const dates = [];
      for (let t = start; t <= end; t += 86400000)
        if (input.weekdays.includes(new Date(t).getUTCDay())) dates.push(new Date(t).toISOString().slice(0, 10));
      if (!dates.length) throw new AppError(400, "Seçilen aralıkta bu günlere denk gelen tarih yok.");
      if (dates.length > 200) throw new AppError(400, "Tek seferde en fazla 200 sefer açılabilir.");
      const { from, to, weekdays, ...plan } = input;
      const result = await store.db.transaction(async () => {
        const existing = new Set(
          (await store.departures.list({ tourId: input.tourId }))
            .filter((d) => d.start_time === input.startTime)
            .map((d) => d.date),
        );
        const created = [];
        for (const date of dates)
          if (!existing.has(date)) created.push((await store.departures.save({ ...plan, date })).date);
        return { created: created.length, skipped: dates.length - created.length, dates: created };
      });
      r.status(201).json(result);
    }),
  );
  app.post(
    "/api/admin/departures",
    requireAdmin,
    route(async (q, r) => {
      const input = z
        .object({
          id: z.string().min(1).max(100).optional(),
          tourId,
          date: ymd,
          startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
          price: z.number().int().min(1).max(100000000),
          pickup: clean,
          guideName: z.string().trim().max(100).default(""),
          guidePhone: z.union([phone, z.literal("")]).default(""),
          vehicleModel: z.enum(vehicleModels.map((m) => m.id)),
          passengerSeats: z.number().int().min(4).max(54),
          active: z.boolean(),
        })
        .parse(q.body);
      const d = await store.db.transaction(async () => {
        const before = input.id
          ? await store.departures.get(input.id, {
              allowClosed: true,
              allowPast: true,
            })
          : null;
        const d = await store.departures.save(input);
        if (
          before &&
          (before.pickup !== d.pickup ||
            before.guide_name !== d.guide_name ||
            before.guide_phone !== d.guide_phone)
        ) {
          for (const booking of await store.workflow.list({
            date: d.date,
            all: true,
          })) {
            if (
              booking.departure_id !== d.id ||
              !["pending_agency", "confirmed"].includes(booking.status)
            )
              continue;
            await store.notifications.enqueue({
              email: booking.email,
              subject: "Rota Kars · Buluşma bilgileriniz güncellendi",
              body: `${booking.reference} · ${d.date} ${d.start_time}\nBuluşma: ${d.pickup}\nRehber: ${d.guide_name || "Acente tarafından paylaşılacak"} ${d.guide_phone}`,
              kind: "pickup_updated",
              dedupeKey:
                "pickup:" + booking.reference + ":" + crypto.randomUUID(),
            });
          }
        }
        return d;
      });
      r.json(d);
    }),
  );
  app.get(
    "/api/admin/reservations",
    requireAdmin,
    route(async (q, r) => {
      const input = z
        .object({
          date: ymd.optional(),
          status: z.enum(["pending_agency", "confirmed", "cancelled", "expired", "completed", "no_show"]).optional(),
          q: z.string().max(80).optional(),
        })
        .parse(q.query);
      await store.cleanup();
      r.json(await store.workflow.list(input));
    }),
  );
  app.get(
    "/api/admin/departures/:id/seats",
    requireAdmin,
    route(async (q, r) => r.json(await store.availability(q.params.id, { agent: true }))),
  );
  // Telefon/WhatsApp ile gelen müşteri için panelden rezervasyon.
  app.post(
    "/api/admin/reservations",
    requireAdmin,
    route(async (q, r) => {
      const input = z
        .object({
          departureId: z.string().min(1).max(100),
          seats: z.array(z.number().int().min(1).max(60)).min(1).max(53),
          name: clean,
          phone,
          email: z.union([z.literal(""), email]).optional(),
          passengers: z.array(clean).min(1).max(53),
          paymentMode: z.enum(["deposit", "full", "on_tour"]),
          notes: z.string().trim().max(500).optional(),
          payment: z
            .object({
              amount: z.number().int().min(1).max(100000000),
              method: z.enum(["cash", "bank_transfer"]),
              externalReference: z.string().trim().min(3).max(100).optional(),
            })
            .optional(),
          confirm: z.boolean().default(false),
        })
        .parse(q.body);
      if (q.adminCtx?.bootstrap)
        throw new AppError(403, "Rezervasyon eklemek için kendi yönetici hesabınızla giriş yapın.");
      const created = await store.adminReserve(input, q.admin);
      r.status(201).json(await receipt(created, q, env));
    }),
  );
  for (const action of ["confirm", "cancel", "complete"])
    app.post(
      "/api/admin/reservations/:reference/" + action,
      requireAdmin,
      route(async (q, r) =>
        r.json(
          await receipt(
            await store.workflow[action](q.params.reference),
            q,
            env,
          ),
        ),
      ),
    );
  app.post(
    "/api/admin/reservations/:reference/move",
    requireAdmin,
    route(async (q, r) => {
      const input = z
        .object({
          departureId: z.string().min(1).max(100),
          seats: z.array(z.number().int().min(1).max(53)).min(1).max(53),
        })
        .parse(q.body);
      r.json(
        await receipt(
          await store.workflow.move(q.params.reference, input),
          q,
          env,
        ),
      );
    }),
  );
  app.post(
    "/api/admin/reservations/:reference/passengers",
    requireAdmin,
    route(async (q, r) => {
      const input = z
        .object({ names: z.array(clean).min(1).max(53) })
        .parse(q.body);
      r.json(await store.workflow.passengers(q.params.reference, input.names));
    }),
  );
  for (const [path, kind] of [
    ["payments", "payment"],
    ["refunds", "refund"],
  ])
    app.post(
      "/api/admin/reservations/:reference/" + path,
      requireAdmin,
      route(async (q, r) => {
        const input = z
          .object({
            amount: z.number().int().min(1).max(100000000),
            method: z.enum(["cash", "bank_transfer"]),
            externalReference: z.string().trim().min(3).max(100),
            recordedExternally: z.literal(true),
          })
          .parse(q.body);
        r.json(
          await store.workflow.payment(q.params.reference, { ...input, kind }),
        );
      }),
    );
  app.get(
    "/api/admin/reservations/:reference/audit",
    requireAdmin,
    route(async (q, r) =>
      r.json(await store.workflow.audit(q.params.reference)),
    ),
  );
  app.get(
    "/api/tickets/:token",
    route(async (q, r) => r.json(await store.workflow.ticket(q.params.token))),
  );
  app.post(
    "/api/admin/tickets/:token/check-in",
    requireAdmin,
    route(async (q, r) => r.json(await store.workflow.checkIn(q.params.token))),
  );
  app.get("/api/admin/session", requireAdmin, (q, r) =>
    r.json({ ok: true, user: q.admin, bootstrap: q.adminCtx?.bootstrap || false }),
  );
  app.get(
    "/api/admin/reports",
    requireAdmin,
    route(async (q, r) => {
      const date = ymd.parse(q.query.date);
      r.json(await store.workflow.report(date));
    }),
  );
  const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Ay YYYY-AA biçiminde olmalı.");
  app.get(
    "/api/admin/reports/month",
    requireAdmin,
    route(async (q, r) => r.json(await store.workflow.monthReport(month.parse(q.query.month)))),
  );
  // Excel'in doğrudan açtığı CSV: noktalı virgül ayraç, UTF-8 BOM, formül enjeksiyonu engelli.
  app.get(
    "/api/admin/reports/month.csv",
    requireAdmin,
    route(async (q, r) => {
      const m = month.parse(q.query.month),
        rep = await store.workflow.monthReport(m);
      const cell = (v) => {
        let s = String(v ?? "");
        if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
        return '"' + s.replaceAll('"', '""') + '"';
      };
      const tl = (k) => (k / 100).toFixed(2).replace(".", ",");
      const STATUS = { pending_agency: "Onay bekliyor", confirmed: "Onaylı", completed: "Tamamlandı", cancelled: "İptal", expired: "Süresi doldu", no_show: "Gelmedi" };
      const rows = [
        ["Rota Kars aylık rapor", m],
        [],
        ["Tur", "Sefer", "Kapasite", "Yolcu", "Doluluk %", "Rezervasyon", "Ciro (TL)", "Tahsil edilen (TL)"],
        ...rep.byTour.map((x) => [x.tourName, x.departures, x.capacity, x.guests, x.occupancy, x.reservations, tl(x.revenue), tl(x.collected)]),
        ["TOPLAM", rep.totals.departures, rep.totals.capacity, rep.totals.guests, rep.totals.capacity ? Math.round((rep.totals.guests / rep.totals.capacity) * 100) : 0, rep.totals.reservations, tl(rep.totals.revenue), ""],
        [],
        ["Ay içi tahsilat (işlem tarihine göre)"],
        ["Tahsilat", tl(rep.cash.payments)],
        ["İade", tl(rep.cash.refunds)],
        ["Net", tl(rep.cash.net)],
        ["Nakit (net)", tl(rep.cash.cash)],
        ["Havale/EFT (net)", tl(rep.cash.bankTransfer)],
        [],
        ["Referans", "Tarih", "Saat", "Tur", "Müşteri", "Telefon", "Kişi", "Durum", "Kaynak", "Tutar (TL)", "Ödenen (TL)"],
        ...rep.reservations.map((x) => [x.reference, x.date, x.time, x.tourName, x.name, x.phone, x.seats, STATUS[x.status] || x.status, x.source === "agency" ? "Panel" : "Site", tl(x.total), tl(x.paid)]),
      ];
      r.set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="rota-kars-rapor-${m}.csv"`,
      }).send("\ufeff" + rows.map((row) => row.map(cell).join(";")).join("\r\n"));
    }),
  );
  app.get(
    "/api/admin/departures/:id/passengers",
    requireAdmin,
    route(async (q, r) => r.json(await store.workflow.passengerList(q.params.id))),
  );
  app.get(
    "/api/admin/departures/:id/passengers.csv",
    requireAdmin,
    route(async (q, r) => {
      const text = await store.workflow.manifest(q.params.id);
      r.set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="rota-kars-yolcu-listesi.csv"',
      }).send(text);
    }),
  );
  app.get(
    "/api/admin/notifications",
    requireAdmin,
    route(async (_q, r) => r.json(await store.notifications.list())),
  );
  app.post(
    "/api/admin/notifications/:id/retry",
    requireAdmin,
    route(async (q, r) => {
      await store.notifications.retry(z.string().uuid().parse(q.params.id));
      r.json({ ok: true });
    }),
  );
  app.post(
    "/api/admin/notifications/process",
    requireAdmin,
    route(async (_q, r) => {
      await store.workflow.reminders();
      r.json(await store.notifications.processBatch());
    }),
  );
}
