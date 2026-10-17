import { randomBytes, createHash } from "node:crypto";
import { AppError } from "./store.mjs";
import { hashPassword } from "./members.mjs";
const digest = (s) => createHash("sha256").update(s).digest("hex");
export async function createAccountSecurity(
  db,
  { clock, tx, members, notifications },
) {
  const cols = (await db.prepare("PRAGMA table_info(members)").all()).map(
    (c) => c.name,
  );
  for (const [name, type] of Object.entries({
    email_verified: "INTEGER NOT NULL DEFAULT 0",
    phone: "TEXT",
  }))
    if (!cols.includes(name))
      await db.exec(`ALTER TABLE members ADD COLUMN ${name} ${type}`);
  await db.exec(
    "CREATE TABLE IF NOT EXISTS account_tokens(token_hash TEXT PRIMARY KEY,member_id TEXT NOT NULL REFERENCES members(id),purpose TEXT NOT NULL,expires_at INTEGER NOT NULL,used_at INTEGER)",
  );
  async function issue(member, purpose, baseUrl) {
    return tx(async () => {
      await db
        .prepare(
          "UPDATE account_tokens SET used_at=? WHERE member_id=? AND purpose=? AND used_at IS NULL",
        )
        .run(clock(), member.id, purpose);
      const token = randomBytes(32).toString("hex");
      await db
        .prepare("INSERT INTO account_tokens VALUES(?,?,?,?,NULL)")
        .run(
          digest(token),
          member.id,
          purpose,
          clock() + (purpose === "reset" ? 3600000 : 86400000),
        );
      const actionUrl =
        baseUrl +
        "/uyelik/" +
        (purpose === "reset" ? "parola-yenile" : "eposta-dogrula") +
        "?token=" +
        token;
      await notifications.enqueue({
        email: member.email,
        subject:
          purpose === "reset"
            ? "Rota Kars · Parolanızı yenileyin"
            : "Rota Kars · E-posta adresinizi doğrulayın",
        body:
          purpose === "reset"
            ? "Parolanızı yenilemek için bağlantıyı açın. Bu bağlantı bir saat geçerli ve tek kullanımlıdır. Bu işlemi siz istemediyseniz mesajı yok sayabilirsiniz."
            : "Üyeliğinizdeki e-posta adresini doğrulamak için bağlantıyı açın. Bağlantı 24 saat geçerli ve tek kullanımlıdır.",
        actionUrl,
        kind: "auth_" + purpose,
        dedupeKey: "auth:" + purpose + ":" + digest(token),
      });
      return { queued: true, deliveryConfigured: notifications.configured };
    });
  }
  async function tokenRow(token, purpose) {
    if (!/^[a-f0-9]{64}$/.test(token || ""))
      throw new AppError(400, "Bağlantı geçersiz. Yeni bir bağlantı isteyin.");
    const row = await db
      .prepare(
        "SELECT * FROM account_tokens WHERE token_hash=? AND purpose=? AND expires_at>? AND used_at IS NULL",
      )
      .get(digest(token), purpose, clock());
    if (!row)
      throw new AppError(
        410,
        "Bağlantının süresi doldu veya daha önce kullanıldı.",
      );
    return row;
  }
  return {
    async requestVerification(member, baseUrl) {
      const row = await db
        .prepare("SELECT email_verified FROM members WHERE id=?")
        .get(member.id);
      if (row?.email_verified) return { verified: true };
      return issue(member, "verify", baseUrl);
    },
    async requestReset(email, baseUrl) {
      const member = await db
        .prepare("SELECT id,email FROM members WHERE email=?")
        .get(email.toLowerCase());
      if (member) await issue(member, "reset", baseUrl);
      return {
        ok: true,
        message:
          "Bu adresle bir üyelik varsa parola yenileme talebi oluşturuldu.",
      };
    },
    async verify(token) {
      return tx(async () => {
        const row = await tokenRow(token, "verify");
        await db
          .prepare("UPDATE members SET email_verified=1 WHERE id=?")
          .run(row.member_id);
        await db
          .prepare("UPDATE account_tokens SET used_at=? WHERE token_hash=?")
          .run(clock(), row.token_hash);
        return { verified: true };
      });
    },
    async reset(token, password) {
      const hash = await hashPassword(password);
      return tx(async () => {
        const row = await tokenRow(token, "reset");
        await db
          .prepare("UPDATE members SET password_hash=? WHERE id=?")
          .run(hash, row.member_id);
        await db
          .prepare(
            "UPDATE account_tokens SET used_at=? WHERE member_id=? AND used_at IS NULL",
          )
          .run(clock(), row.member_id);
        await db
          .prepare("DELETE FROM member_sessions WHERE member_id=?")
          .run(row.member_id);
        return { ok: true };
      });
    },
    async profile(memberId, { name, phone }) {
      await db
        .prepare("UPDATE members SET name=?,phone=? WHERE id=?")
        .run(name, phone || null, memberId);
      return (await members.dashboard(memberId)).member;
    },
  };
}
