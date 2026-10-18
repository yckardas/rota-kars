import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
export async function createNotifications(db, { clock, tx, env = {} }) {
  await Promise.all([
    db.index("notification_outbox", { id: 1 }, { unique: true }),
    db.index("notification_outbox", { status: 1, next_attempt_at: 1 }),
    db.index("notification_outbox", { created_at: -1 }),
  ]);
  const ready = Boolean(
    env.SMTP_HOST &&
    env.MAIL_FROM &&
    /^https?:\/\//.test(env.PUBLIC_BASE_URL || ""),
  );
  const transport = ready
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT || 587),
        secure: env.SMTP_SECURE === "true",
        ...(env.SMTP_USER
          ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
          : {}),
        connectionTimeout: 10000,
        socketTimeout: 20000,
      })
    : null;
  // Acente ekibine gidecek bildirimler: AGENCY_EMAIL virgülle ayrılmış liste.
  const agencyEmails = String(env.AGENCY_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  const api = {
    configured: ready,
    agencyEmails,
    async notifyAgency({ subject, body, actionUrl = null, kind, dedupeKey }) {
      for (const email of agencyEmails)
        await api.enqueue({
          email,
          subject: "[Acente] " + subject,
          body,
          actionUrl,
          kind: "agency_" + kind,
          dedupeKey: `agency:${email}:${dedupeKey}`,
        });
    },
    async enqueue({ email, subject, body, actionUrl = null, kind, dedupeKey }) {
      // dedupe_key _id olarak kullanılır: aynı olay için ikinci mesaj kuyruğa girmez.
      await db.insertIfAbsent("notification_outbox", dedupeKey, {
        id: randomUUID(),
        recipient: email,
        subject,
        body,
        action_url: actionUrl,
        kind,
        dedupe_key: dedupeKey,
        status: "queued",
        attempts: 0,
        next_attempt_at: clock(),
        lease_until: 0,
        created_at: clock(),
        sent_at: null,
        last_error: null,
      });
      return (await db.one("notification_outbox", { _id: dedupeKey })).id;
    },
    async list() {
      const rows = await db
        .find("notification_outbox", {}, { sort: { created_at: -1 }, limit: 200 });
      return {
        configured: ready,
        preview: env.DEMO_MODE === "1" || env.NODE_ENV !== "production",
        items: rows.map((row) => {
          if (
            row.kind.startsWith("auth_") &&
            env.NODE_ENV === "production" &&
            env.DEMO_MODE !== "1"
          )
            return {
              ...row,
              body: "Hesap güvenliği mesajı; içerik gizlidir.",
              action_url: null,
            };
          return row;
        }),
      };
    },
    async retry(id) {
      await db
        .update(
          "notification_outbox",
          { id, status: "failed" },
          { status: "queued", attempts: 0, next_attempt_at: clock(), last_error: null },
        );
    },
    async processBatch({
      send = transport
        ? (item) =>
            transport.sendMail({
              from: env.MAIL_FROM,
              to: item.recipient,
              subject: item.subject,
              text:
                item.body + (item.action_url ? "\n\n" + item.action_url : ""),
            })
        : null,
    } = {}) {
      if (!send) return { sent: 0, configured: false };
      let sent = 0;
      for (let i = 0; i < 10; i++) {
        const item = await tx(async () => {
          const row = await db.one(
            "notification_outbox",
            {
              $or: [
                { status: "queued", next_attempt_at: { $lte: clock() } },
                { status: "sending", lease_until: { $lte: clock() } },
              ],
            },
            { sort: { created_at: 1 } },
          );
          if (!row) return null;
          await db
            .col("notification_outbox")
            .updateOne(
              { id: row.id },
              { $set: { status: "sending", lease_until: clock() + 60000 }, $inc: { attempts: 1 } },
              db.opts(),
            );
          return row;
        });
        if (!item) break;
        try {
          await send(item);
          await db
            .update(
              "notification_outbox",
              { id: item.id },
              { status: "sent", sent_at: clock(), lease_until: 0, last_error: null },
            );
          sent++;
        } catch (e) {
          console.error(
            `Notification send failed (${item.kind}): ${e?.code || e?.responseCode || e?.message || "unknown"}`,
          );
          const attempts = item.attempts + 1;
          await db.update(
            "notification_outbox",
            { id: item.id },
            {
              status: attempts >= 5 ? "failed" : "queued",
              next_attempt_at: clock() + Math.min(3600000, 60000 * 2 ** attempts),
              lease_until: 0,
              last_error: "Gönderim sağlayıcısına ulaşılamadı. Ayarları kontrol edin.",
            },
          );
        }
      }
      return { sent, configured: true };
    },
  };
  return api;
}
