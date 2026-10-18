import { randomBytes, createHash } from "node:crypto";
import { AppError } from "./store.mjs";
import { hashPassword } from "./members.mjs";
const digest = (s) => createHash("sha256").update(s).digest("hex");
export async function createAccountSecurity(
  db,
  { clock, tx, members, notifications },
) {
  await db.index("account_tokens", { member_id: 1, purpose: 1 });
  async function issue(member, purpose, baseUrl) {
    return tx(async () => {
      await db.updateMany(
        "account_tokens",
        { member_id: member.id, purpose, used_at: null },
        { used_at: clock() },
      );
      const token = randomBytes(32).toString("hex");
      await db.insert("account_tokens", digest(token), {
        token_hash: digest(token),
        member_id: member.id,
        purpose,
        expires_at: clock() + (purpose === "reset" ? 3600000 : 86400000),
        used_at: null,
      });
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
    const row = await db.one("account_tokens", {
      _id: digest(token),
      purpose,
      expires_at: { $gt: clock() },
      used_at: null,
    });
    if (!row)
      throw new AppError(
        410,
        "Bağlantının süresi doldu veya daha önce kullanıldı.",
      );
    return row;
  }
  return {
    async requestVerification(member, baseUrl) {
      const row = await db.one("members", { _id: member.id });
      if (row?.email_verified) return { verified: true };
      return issue(member, "verify", baseUrl);
    },
    async requestReset(email, baseUrl) {
      const member = await db.one("members", { email: email.toLowerCase() });
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
        await db.update("members", { _id: row.member_id }, { email_verified: 1 });
        await db.update(
          "account_tokens",
          { _id: row.token_hash },
          { used_at: clock() },
        );
        return { verified: true };
      });
    },
    async reset(token, password) {
      const hash = await hashPassword(password);
      return tx(async () => {
        const row = await tokenRow(token, "reset");
        await db.update("members", { _id: row.member_id }, { password_hash: hash });
        await db.updateMany(
          "account_tokens",
          { member_id: row.member_id, used_at: null },
          { used_at: clock() },
        );
        await db.remove("member_sessions", { member_id: row.member_id });
        return { ok: true };
      });
    },
    async profile(memberId, { name, phone }) {
      await db.update("members", { _id: memberId }, { name, phone: phone || null });
      return (await members.dashboard(memberId)).member;
    },
  };
}
