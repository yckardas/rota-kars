import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";

async function fixture(t) {
  let now = Date.now();
  const store = await openStore(":memory:", { clock: () => now });
  const app = createApp(store, {
    env: { ADMIN_PASSWORD: "ilk-kurulum-parolasi" },
    reviewsService: { get: async () => ({ status: "not_configured", reviews: [] }) },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path, { body, cookie } = {}) => {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      headers: { "Content-Type": "application/json", "X-Rota-Client": "web", ...(cookie ? { Cookie: cookie } : {}) },
    });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text, headers: r.headers, cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
  const book = async (email, { cookie, marketing = false, seat = 1 } = {}) => {
    const [d] = await store.listDepartures("ani-cildir");
    const hold = await call("/holds", { body: { departureId: d.id, seats: [seat] }, cookie });
    return (await call("/reservations", {
      body: { holdToken: hold.json.token, name: "Ayşe Yılmaz", email, phone: "05551112233", passengers: ["Ayşe Yılmaz"], paymentMode: "deposit", consent: true, marketingConsent: marketing },
      cookie,
    })).json;
  };
  return { store, call, book, advance: (ms) => (now += ms) };
}

test("consents are recorded per type with version, email is stored only as a hash", async (t) => {
  const { store, book } = await fixture(t);
  await book("ayse@example.com", { marketing: true });
  const consents = await store.db.find("consents");
  assert.deepEqual(consents.map((c) => c.type).sort(), ["kvkk_notice", "marketing"]);
  assert.ok(consents.every((c) => c.version && c.source === "booking" && c.email_hash));
  assert.ok(!JSON.stringify(consents).includes("ayse@example.com"));
});

test("member can download their data and delete the account; upcoming trips block deletion", async (t) => {
  const { call, book, store } = await fixture(t);
  const reg = await call("/auth/register", { body: { name: "Ayşe Yılmaz", email: "ayse@example.com", password: "uzun-parola-123", consent: true } });
  const cookie = reg.cookie;
  const r = await book("ayse@example.com", { cookie });
  const exp = await call("/member/data-export", { cookie });
  assert.equal(exp.status, 200);
  assert.match(exp.headers.get("content-disposition"), /attachment/);
  assert.equal(exp.json.member.email, "ayse@example.com");
  assert.equal(exp.json.reservations[0].reference, r.reference);
  assert.ok(!exp.text.includes("password"), "no password hash in export");
  const blocked = await call("/member/delete", { body: { confirm: "SİL" }, cookie });
  assert.equal(blocked.status, 409, "upcoming reservation blocks deletion");
  await call("/reservations/cancel", { body: { reference: r.reference, email: "ayse@example.com" } });
  assert.equal((await call("/member/delete", { body: { confirm: "evet" }, cookie })).status, 400);
  const del = await call("/member/delete", { body: { confirm: "SİL" }, cookie });
  assert.equal(del.status, 200);
  assert.equal(del.json.anonymized, 1);
  assert.equal((await call("/auth/me", { cookie })).json?.member ?? null, null);
  const member = await store.db.one("members", {});
  assert.equal(member.name, "Silinmiş üye");
  assert.equal(member.password_hash, null);
  const res = await store.db.one("reservations", { reference: r.reference });
  assert.equal(res.name, "Anonim");
  assert.ok(!JSON.stringify(res).includes("ayse@example.com"));
  assert.equal((await call("/auth/login", { body: { email: "ayse@example.com", password: "uzun-parola-123" } })).status, 401);
});

test("paid reservations are kept for the legal period when a guest asks for erasure", async (t) => {
  const { call, book, store } = await fixture(t);
  const boot = (await call("/admin/login", { body: { password: "ilk-kurulum-parolasi" } })).cookie;
  const r = await book("misafir@example.com");
  await store.workflow.payment(r.reference, { amount: r.deposit, method: "bank", externalReference: "DEKONT-1" });
  await store.workflow.cancel(r.reference);
  const second = await book("misafir@example.com", { seat: 2 });
  await store.workflow.cancel(second.reference);
  const exported = await call("/admin/kvkk/export", { body: { email: "misafir@example.com" }, cookie: boot });
  assert.equal(exported.json.reservations.length, 2);
  const erased = await call("/admin/kvkk/erase", { body: { email: "misafir@example.com", confirm: "SİL" }, cookie: boot });
  assert.equal(erased.status, 200);
  assert.equal(erased.json.anonymized, 1);
  assert.equal(erased.json.retainedForLegalObligation, 1);
  const audit = await store.db.find("admin_audit", { action: "kvkk_erase" });
  assert.ok(!JSON.stringify(audit).includes("misafir@example.com"));
});

test("retention job anonymizes old unpaid bookings and clears old requests and notifications", async (t) => {
  const { store, book, advance } = await fixture(t);
  const r = await book("eski@example.com");
  await store.workflow.cancel(r.reference);
  await store.request("private-tour", { name: "Eski Talep", email: "eski@example.com" });
  advance(800 * 86400000);
  const result = await store.privacy.runRetention();
  assert.equal(result.anonymizedUnpaid, 1);
  assert.equal(result.requestsDeleted, 1);
  assert.equal((await store.db.one("reservations", { reference: r.reference })).name, "Anonim");
});

test("chat does not send questions abroad without explicit consent", async () => {
  const { createChatService } = await import("../server/chat.mjs");
  let calls = 0;
  const client = { messages: { create: async () => { calls++; return { content: [{ type: "text", text: "Bulut yanıtı" }] }; } } };
  const chat = createChatService({ CHAT_MODEL: "fixture" }, client);
  const q = [{ role: "user", content: "Katalog dışında bir ayrıntı soruyorum" }];
  const without = await chat.reply(q);
  assert.equal(calls, 0);
  assert.equal(without.consentNeeded, true);
  await chat.reply(q, { abroadConsent: true });
  assert.equal(calls, 1);
});
