import { z } from "zod";
import QRCode from "qrcode";
import { AppError } from "./store.mjs";
import { vehicleModels } from "./operations.mjs";
import { tours } from "./catalog.mjs";
export const siteBase = (q, env) =>
  (env.PUBLIC_BASE_URL || `${q.protocol}://${q.headers.host}`).replace(
    /\/$/,
    "",
  );
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
      const input = z.object({ date: ymd.optional() }).parse(q.query);
      await store.cleanup();
      r.json(await store.workflow.list(input));
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
