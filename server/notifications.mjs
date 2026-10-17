import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
export async function createNotifications(db, { clock, tx, env = {} }) {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS notification_outbox(id TEXT PRIMARY KEY,recipient TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,action_url TEXT,kind TEXT NOT NULL,dedupe_key TEXT NOT NULL UNIQUE,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at INTEGER NOT NULL,lease_until INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,sent_at INTEGER,last_error TEXT);`,
  );
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
  return {
    configured: ready,
    async enqueue({ email, subject, body, actionUrl = null, kind, dedupeKey }) {
      const previous = await db
        .prepare("SELECT id FROM notification_outbox WHERE dedupe_key=?")
        .get(dedupeKey);
      if (previous) return previous.id;
      const id = randomUUID();
      await db
        .prepare(
          "INSERT OR IGNORE INTO notification_outbox(id,recipient,subject,body,action_url,kind,dedupe_key,status,next_attempt_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          id,
          email,
          subject,
          body,
          actionUrl,
          kind,
          dedupeKey,
          "queued",
          clock(),
          clock(),
        );
      return (
        await db
          .prepare("SELECT id FROM notification_outbox WHERE dedupe_key=?")
          .get(dedupeKey)
      ).id;
    },
    async list() {
      const rows = await db
        .prepare(
          "SELECT * FROM notification_outbox ORDER BY created_at DESC LIMIT 200",
        )
        .all();
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
        .prepare(
          "UPDATE notification_outbox SET status='queued',attempts=0,next_attempt_at=?,last_error=NULL WHERE id=? AND status='failed'",
        )
        .run(clock(), id);
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
          const row = await db
            .prepare(
              "SELECT * FROM notification_outbox WHERE ((status='queued' AND next_attempt_at<=?) OR (status='sending' AND lease_until<=?)) ORDER BY created_at LIMIT 1",
            )
            .get(clock(), clock());
          if (!row) return null;
          await db
            .prepare(
              "UPDATE notification_outbox SET status='sending',lease_until=?,attempts=attempts+1 WHERE id=?",
            )
            .run(clock() + 60000, row.id);
          return row;
        });
        if (!item) break;
        try {
          await send(item);
          await db
            .prepare(
              "UPDATE notification_outbox SET status='sent',sent_at=?,lease_until=0,last_error=NULL WHERE id=?",
            )
            .run(clock(), item.id);
          sent++;
        } catch {
          const attempts = item.attempts + 1;
          await db
            .prepare(
              "UPDATE notification_outbox SET status=?,next_attempt_at=?,lease_until=0,last_error=? WHERE id=?",
            )
            .run(
              attempts >= 5 ? "failed" : "queued",
              clock() + Math.min(3600000, 60000 * 2 ** attempts),
              "Gönderim sağlayıcısına ulaşılamadı. Ayarları kontrol edin.",
              item.id,
            );
        }
      }
      return { sent, configured: true };
    },
  };
}
