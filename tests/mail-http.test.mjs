// Railway SMTP bağlantılarını (587/465) zaman aşımına düşürüyor; e-posta HTTPS API
// (Resend) üzerinden gider. Kuyruk ve yeniden deneme mantığı aynı kalır.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resendSender, mailDelivery } from "../server/mail-http.mjs";
import { LOGO_CID } from "../server/mail-template.mjs";

const item = {
  id: "8f9c2d1e-0000-4000-8000-000000000001",
  recipient: "misafir@example.com",
  subject: "Rota Kars · Rezervasyonunuz onaylandı",
  body: "Merhaba Ayşe,\nRK-ABC123",
  action_url: "https://rotakarsturizm.com/bilet/abc123",
};
const env = {
  RESEND_API_KEY: "re_test_123",
  MAIL_FROM: "Rota Kars <bilet@rotakarsturizm.com>",
};

test("Resend: posts the rendered mail with the inline logo and an idempotency key", async () => {
  const calls = [];
  const send = resendSender(env, async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ id: "abc" }), { status: 200 });
  });
  await send(item);
  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(init.method, "POST");
  assert.equal(init.headers.Authorization, "Bearer re_test_123");
  assert.equal(
    init.headers["Idempotency-Key"],
    item.id,
    "aynı kuyruk kaydı iki kez gönderilmez",
  );
  const body = JSON.parse(init.body);
  assert.equal(body.from, env.MAIL_FROM);
  assert.deepEqual(body.to, ["misafir@example.com"]);
  assert.equal(body.subject, item.subject);
  assert.equal(body.text, item.body + "\n\n" + item.action_url);
  assert.match(body.html, new RegExp(`cid:${LOGO_CID}`));
  assert.equal(body.attachments[0].content_id, LOGO_CID);
  assert.equal(body.attachments[0].content_type, "image/png");
  assert.ok(
    Buffer.from(body.attachments[0].content, "base64").length > 1000,
    "logo base64 olarak gider",
  );
});

test("Resend: an HTTP error is thrown with a status code so the outbox retries it", async () => {
  const send = resendSender(
    env,
    async () => new Response('{"message":"invalid from"}', { status: 422 }),
  );
  await assert.rejects(send(item), (e) => e.code === "HTTP_422");
});

test("delivery choice: Resend wins over SMTP; nothing is ready without MAIL_FROM and a public URL", () => {
  const base = {
    MAIL_FROM: env.MAIL_FROM,
    PUBLIC_BASE_URL: "https://rotakarsturizm.com",
  };
  assert.equal(
    mailDelivery({ ...base, RESEND_API_KEY: "re_x", SMTP_HOST: "smtp.x" }),
    "resend",
  );
  assert.equal(mailDelivery({ ...base, SMTP_HOST: "smtp.x" }), "smtp");
  assert.equal(mailDelivery({ ...base }), null);
  assert.equal(
    mailDelivery({
      RESEND_API_KEY: "re_x",
      PUBLIC_BASE_URL: base.PUBLIC_BASE_URL,
    }),
    null,
  );
  assert.equal(
    mailDelivery({ RESEND_API_KEY: "re_x", MAIL_FROM: env.MAIL_FROM }),
    null,
  );
});
