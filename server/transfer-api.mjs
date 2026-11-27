// Turdan bağımsız online transfer uçları (bkz. transfer-booking.mjs).
// Fiyat her istekte sunucuda yeniden hesaplanır; ödeme mevcut /api/payments/start ile başlar.
import { z } from "zod";
import { receipt } from "./advanced-api.mjs";
import { AppError } from "./store.mjs";
import { DEPOSIT_PERCENT } from "./payments.mjs";
import {
  cancellationRules,
  contractText,
  freeCancelHours,
  isLateBooking,
  preInfoText,
  serviceFor,
} from "./legal.mjs";
import {
  transferServiceSchema,
  transferTripSchema,
} from "./transfer-booking.mjs";

// Rezervasyonun son adımındaki zorunlu onay kutuları (tur rezervasyonuyla aynı dört onay).
const consents = z
  .object({
    preInfo: z.literal(true),
    contract: z.literal(true),
    cancellation: z.literal(true),
    privacy: z.literal(true),
  })
  .strict();

export function attachTransferApi(
  app,
  {
    store,
    env,
    payments,
    route,
    requireAdmin,
    human,
    schemas: { clean, email, phone },
  },
) {
  const paymentEnabled = () => Boolean(payments.config.enabled);
  const contact = z.object({
    name: z.string().trim().max(120).default(""),
    email: z.string().trim().max(200).default(""),
    phone: z.string().trim().max(40).default(""),
  });
  const bookingSchema = transferTripSchema().extend({
    name: clean,
    email,
    phone,
    notes: z.string().trim().max(500).default(""),
    consents,
    marketingConsent: z.boolean().optional(),
    lang: z.enum(["tr", "en"]).optional(),
  });
  // Sitedeki form: satış açık mı, en az kaç saat önce, fiyat tablosu.
  app.get(
    "/api/transfers/config",
    route(async (_q, r) =>
      r.json(
        await store.transferBookings.publicConfig({
          paymentEnabled: paymentEnabled(),
        }),
      ),
    ),
  );
  // Fiyat ve onay kutularında okunan metinler (bu seçimin verisiyle). Kayıt yazılmaz.
  app.post(
    "/api/transfers/quote",
    route(async (q, r) => {
      const input = transferTripSchema().merge(contact).parse(q.body);
      const quote = await store.transferBookings.quote(input, {
        paymentEnabled: paymentEnabled(),
      });
      const draft = {
        kind: "transfer",
        transfer_booking: quote.booking,
        transfer: quote.priced,
      };
      const tour = serviceFor(draft),
        data = {
          tour,
          customer: {
            name: input.name,
            email: input.email,
            phone: input.phone,
          },
          passengers: [],
          total: quote.amount,
          deposit: quote.amount,
          paymentMode: "full",
          onlinePayment: true,
          transfer: quote.priced,
          transferBooking: quote.booking,
          pax: input.pax,
          depositPercent: DEPOSIT_PERCENT,
        },
        first = quote.legs[0];
      r.json({
        amount: quote.amount,
        tier: quote.priced.tier,
        tierLabel: quote.priced.tierLabel,
        title: tour.name,
        lateBooking: isLateBooking(tour, first.date, first.time),
        freeCancelHours: freeCancelHours(tour),
        preInfo: preInfoText(data),
        contract:
          "TASLAK · Bu sözleşme ödemeniz bankaca onaylandığı anda aşağıdaki hükümlerle kurulur; sözleşme no rezervasyon numaranızdır.\n\n" +
          contractText({
            ...data,
            reference: "kayıtta verilecek",
            draft: true,
          }),
        cancellation: cancellationRules(tour, {
          depositPercent: DEPOSIT_PERCENT,
        }),
      });
    }),
  );
  // Ödeme öncesi kayıt; istemci ardından /api/payments/start ile karta yönlenir.
  app.post(
    "/api/transfers/reservations",
    route(async (q, r) => {
      const input = bookingSchema.parse(q.body);
      await human(q, "booking");
      if (q.member && input.email.toLowerCase() !== q.member.email)
        throw new AppError(
          400,
          "Üye rezervasyonunda hesabınızın e-posta adresini kullanın.",
        );
      const reservation = await store.transferBookings.reserve(input, {
        memberId: q.member?.id || null,
        paymentEnabled: paymentEnabled(),
        legal: {
          onlinePayment: true,
          depositPercent: DEPOSIT_PERCENT,
          othersDeclared: false,
        },
      });
      for (const type of [
        "kvkk_notice",
        "pre_info",
        "service_contract",
        "cancellation_terms",
      ])
        await store.privacy.recordConsent({
          email: input.email,
          memberId: q.member?.id,
          type,
          source: "transfer",
        });
      if (input.marketingConsent)
        await store.privacy.recordConsent({
          email: input.email,
          memberId: q.member?.id,
          type: "marketing",
          source: "transfer",
        });
      r.status(201).json(
        await receipt(reservation, q, env, { customer: true }),
      );
    }),
  );
  // Panel: online transfer satışı, en az kaç saat önceden ve fiyat tablosu.
  app.get(
    "/api/admin/transfer-service",
    requireAdmin,
    route(async (_q, r) =>
      r.json({
        ...(await store.transferBookings.settings()),
        paymentEnabled: paymentEnabled(),
      }),
    ),
  );
  app.post(
    "/api/admin/transfer-service",
    requireAdmin,
    route(async (q, r) =>
      r.json({
        ...(await store.transferBookings.saveSettings(
          transferServiceSchema().parse(q.body),
        )),
        paymentEnabled: paymentEnabled(),
      }),
    ),
  );
}
