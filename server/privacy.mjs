// KVKK (6698 sayılı Kanun) araçları: rıza kayıtları, ilgili kişi başvurusunda
// verilerin dışa aktarılması ve silinmesi/anonimleştirilmesi, saklama süreleri.
//
// Saklama ilkesi:
// - Tahsilatı olan rezervasyonlar vergi/ticari mevzuat gereği (VUK 253, TTK 82)
//   10 yıl saklanır; süre dolunca anonimleştirilir.
// - Tahsilatı olmayan iptal/süresi dolmuş ön rezervasyonlar 1 yıl sonra anonimleşir.
// - Talepler 2 yıl, gönderilmiş bildirimler 90 gün, yönetici denetim kaydı 2 yıl.
// Süreler ortam değişkenleriyle değiştirilebilir. Metinler hukuki danışmanla
// teyit edilmelidir.
import { randomUUID, createHash } from "node:crypto";
import { AppError } from "./store.mjs";
import { localDate } from "./departures.mjs";

export const KVKK_NOTICE_VERSION = "2026-10";
export const CONSENT_TYPES = ["kvkk_notice", "marketing", "abroad_transfer"];
const DAY = 86400000;
const emailHash = (email) =>
  createHash("sha256").update("rota-kvkk:" + String(email).trim().toLowerCase()).digest("hex");
const ANON = "Anonim";
const anonEmail = (id) => `anonim-${id.slice(0, 8)}@silindi.invalid`;

export function createPrivacy(db, { clock = Date.now, env = process.env, tx }) {
  const days = (name, fallback) => Math.max(1, Number(env[name]) || fallback);
  const retention = {
    unpaidReservationDays: days("RETENTION_UNPAID_DAYS", 365),
    paidReservationDays: days("RETENTION_PAID_DAYS", 3653),
    requestDays: days("RETENTION_REQUEST_DAYS", 730),
    notificationDays: days("RETENTION_NOTIFICATION_DAYS", 90),
    auditDays: days("RETENTION_AUDIT_DAYS", 730),
  };
  const ledgerTotals = async (reservationIds) => {
    const rows = reservationIds.length
      ? await db.find("payment_ledger", { reservation_id: { $in: reservationIds } })
      : [];
    const paid = new Map();
    for (const p of rows)
      paid.set(p.reservation_id, (paid.get(p.reservation_id) || 0) + (p.kind === "refund" ? 0 : Number(p.amount)));
    return paid;
  };
  const departureDates = async (reservations) =>
    new Map(
      (
        await db.find("departures", {
          _id: { $in: [...new Set(reservations.map((r) => r.departure_id))] },
        })
      ).map((d) => [d.id, d.date]),
    );
  const anonymizeReservation = (r) =>
    db.update(
      "reservations",
      { _id: r.id },
      {
        name: ANON,
        email: anonEmail(r.id),
        phone: "",
        passengers: (Array.isArray(r.passengers) ? r.passengers : []).map(() => ANON),
        member_id: null,
        anonymized_at: clock(),
      },
    );
  // Bir e-posta adresine (ve varsa üyeye) ait tüm kayıtlar.
  async function collect(email, memberId = null) {
    const normalized = String(email).trim().toLowerCase();
    const reservations = await db.find("reservations", {
      $or: [{ email: normalized }, ...(memberId ? [{ member_id: memberId }] : [])],
    });
    const requests = (await db.find("requests", {}, { sort: { created_at: -1 }, limit: 5000 })).filter(
      (r) => String(r.body?.email || "").toLowerCase() === normalized,
    );
    return {
      normalized,
      reservations,
      requests,
      notifications: await db.find("notification_outbox", { recipient: normalized }),
      consents: await db.find("consents", { email_hash: emailHash(normalized) }),
    };
  }
  const shapeExport = async (data, member = null) => ({
    generatedAt: new Date(clock()).toISOString(),
    controller: "Rota Kars Turizm",
    note: "6698 sayılı KVKK md. 11 kapsamında hazırlanmış kişisel veri dökümüdür.",
    member: member && {
      name: member.name,
      email: member.email,
      phone: member.phone || null,
      emailVerified: Boolean(member.email_verified),
      createdAt: new Date(member.created_at).toISOString(),
    },
    socialAccounts: member
      ? (await db.find("social_accounts", { member_id: member.id })).map((s) => s.provider)
      : [],
    coupons: member
      ? (await db.find("member_coupons", { member_id: member.id })).map((c) => ({
          percent: c.percent,
          source: c.source,
          createdAt: new Date(c.created_at).toISOString(),
          used: Boolean(c.used_reservation),
        }))
      : [],
    reservations: data.reservations.map((r) => ({
      reference: r.reference,
      status: r.status,
      name: r.name,
      email: r.email,
      phone: r.phone,
      passengers: r.passengers,
      seats: r.seats,
      total: r.total / 100,
      createdAt: new Date(r.created_at).toISOString(),
    })),
    requests: data.requests.map((r) => ({ kind: r.kind, body: r.body, createdAt: new Date(r.created_at).toISOString() })),
    messagesSent: data.notifications.map((n) => ({
      subject: n.subject,
      status: n.status,
      createdAt: new Date(n.created_at).toISOString(),
    })),
    consents: data.consents.map((c) => ({
      type: c.type,
      granted: c.granted,
      version: c.version,
      source: c.source,
      at: new Date(c.at).toISOString(),
    })),
  });
  // Silme: yaklaşan turu olan kayıtlar silinemez; tahsilatı olanlar yasal saklama
  // süresince tutulur; diğerleri anonimleşir. Bildirim kuyruğu ve talepler silinir.
  async function erase(data) {
    const today = localDate(clock());
    const dates = await departureDates(data.reservations);
    const paid = await ledgerTotals(data.reservations.map((r) => r.id));
    const upcoming = data.reservations.filter(
      (r) => ["pending_agency", "confirmed"].includes(r.status) && (dates.get(r.departure_id) || "") >= today,
    );
    if (upcoming.length)
      throw new AppError(
        409,
        `Yaklaşan ${upcoming.length} rezervasyon var (${upcoming.map((r) => r.reference).join(", ")}). Tur tarihinden sonra veya rezervasyon iptal edildikten sonra silinebilir.`,
      );
    let anonymized = 0,
      retained = 0;
    for (const r of data.reservations) {
      if ((paid.get(r.id) || 0) > 0) {
        retained++;
        continue;
      }
      await anonymizeReservation(r);
      anonymized++;
    }
    const requestIds = data.requests.map((r) => r.id);
    if (requestIds.length) await db.remove("requests", { _id: { $in: requestIds } });
    await db.remove("notification_outbox", { recipient: data.normalized });
    return { anonymized, retainedForLegalObligation: retained, requestsDeleted: requestIds.length };
  }
  return {
    retention,
    async recordConsent({ email, memberId = null, type, granted = true, source, version = KVKK_NOTICE_VERSION }) {
      if (!CONSENT_TYPES.includes(type)) throw new Error("Bilinmeyen rıza türü");
      const id = randomUUID();
      // E-posta açık saklanmaz; ispat için karma (hash) tutulur.
      await db.insert("consents", id, {
        id,
        email_hash: email ? emailHash(email) : null,
        member_id: memberId,
        type,
        granted: Boolean(granted),
        version,
        source,
        at: clock(),
      });
    },
    async memberExport(memberId) {
      const member = await db.one("members", { _id: memberId });
      if (!member) throw new AppError(404, "Üyelik bulunamadı.");
      return shapeExport(await collect(member.email, member.id), member);
    },
    async memberDelete(memberId) {
      return tx(async () => {
        const member = await db.one("members", { _id: memberId });
        if (!member) throw new AppError(404, "Üyelik bulunamadı.");
        const result = await erase(await collect(member.email, member.id));
        await db.remove("member_sessions", { member_id: memberId });
        await db.remove("social_accounts", { member_id: memberId });
        await db.remove("account_tokens", { member_id: memberId });
        await db.remove("member_coupons", { member_id: memberId, used_reservation: null });
        await db.update(
          "members",
          { _id: memberId },
          {
            name: "Silinmiş üye",
            email: anonEmail(memberId),
            phone: null,
            password_hash: null,
            email_verified: 0,
            deleted_at: clock(),
          },
        );
        await db.updateMany("reservations", { member_id: memberId }, { member_id: null });
        return result;
      });
    },
    async exportByEmail(email) {
      const member = await db.one("members", { email: String(email).trim().toLowerCase() });
      return shapeExport(await collect(email, member?.id), member);
    },
    async eraseByEmail(email) {
      const member = await db.one("members", { email: String(email).trim().toLowerCase() });
      if (member) return { member: true, ...(await this.memberDelete(member.id)) };
      return tx(async () => ({ member: false, ...(await erase(await collect(email))) }));
    },
    // Günlük saklama süresi temizliği.
    async runRetention() {
      const now = clock();
      const result = { anonymizedUnpaid: 0, anonymizedPaid: 0 };
      await tx(async () => {
        const old = await db.find("reservations", {
          anonymized_at: { $exists: false },
          created_at: { $lt: now - retention.unpaidReservationDays * DAY },
        });
        const paid = await ledgerTotals(old.map((r) => r.id));
        for (const r of old) {
          const hasPayment = (paid.get(r.id) || 0) > 0;
          if (!hasPayment && ["cancelled", "expired"].includes(r.status)) {
            await anonymizeReservation(r);
            result.anonymizedUnpaid++;
          } else if (hasPayment && r.created_at < now - retention.paidReservationDays * DAY) {
            await anonymizeReservation(r);
            result.anonymizedPaid++;
          }
        }
      });
      result.requestsDeleted = await db.remove("requests", {
        created_at: { $lt: now - retention.requestDays * DAY },
      });
      result.notificationsDeleted = await db.remove("notification_outbox", {
        status: { $in: ["sent", "failed"] },
        created_at: { $lt: now - retention.notificationDays * DAY },
      });
      result.auditDeleted = await db.remove("admin_audit", { at: { $lt: now - retention.auditDays * DAY } });
      await db.remove("member_sessions", { expires_at: { $lt: now } });
      await db.remove("admin_sessions", { expires_at: { $lt: now } });
      await db.remove("account_tokens", { expires_at: { $lt: now - 30 * DAY } });
      return result;
    },
  };
}
