import { test } from "node:test";
import assert from "node:assert/strict";
import { createChatService } from "../server/chat.mjs";
import { openStore } from "../server/store.mjs";
const user = (content) => ({
    role: "user",
    content,
  }),
  assistant = (content) => ({
    role: "assistant",
    content,
  });
test("follow-up remembers a route and calculates two people without confirming a payment", async () => {
  const chat = createChatService({});
  const r = await chat.reply([
    user("Ani turunu anlat"),
    assistant("Ani ve Çıldır"),
    user("İki kişi için toplam ne kadar?"),
  ]);
  assert.match(r.text, /Ani/);
  assert.match(r.text, /2\.000/);
  assert.match(r.text, /600/);
  assert.match(r.text, /örnek|teklif/);
  assert.equal(r.cards[0].id, "ani-cildir");
  assert.ok(r.actions.some((a) => a.href === "/rezervasyon/ani-cildir"));
});
test("specific cancellation intent wins over tour-name match", async () => {
  const r = await createChatService({}).reply([
    user("Ani turunu iptal etmek istiyorum"),
  ]);
  assert.match(r.text, /sorgula|iptal/);
  assert.match(r.text, /teyit/);
  assert.equal(r.handoff, true);
  assert.ok(r.actions.some((a) => a.href === "/rezervasyonum"));
});
test("payment follow-up stays on the route and says no charge", async () => {
  const r = await createChatService({}).reply([
    user("Batum 2 kişi"),
    assistant("Batum"),
    user("Kapora ne kadar?"),
  ]);
  assert.match(r.text, /1\.500/);
  assert.match(r.text, /tahsilat yapmaz/);
  assert.match(r.text, /aktif değil/);
});
test("page context supplies a tour when question is implicit", async () => {
  const r = await createChatService({}).reply([user("Fiyata neler dahil?")], {
    tourId: "sarikamis",
  });
  assert.match(r.text, /Sarıkamış/);
  assert.match(r.text, /kask|ekipman/i);
  assert.ok(r.actions.some((a) => a.href === "/turlar/sarikamis"));
});
test("word boundaries do not mistake anilar or organizasyon for Ani", async () => {
  const r = await createChatService({}).reply([
    user("Organizasyon için bilgi istiyorum"),
  ]);
  assert.ok(!r.cards.some((c) => c.id === "ani-cildir"));
});
test("date questions use authoritative availability and identify preview dates", async () => {
  const store = await openStore(":memory:");
  try {
    const chat = createChatService({}, null, {
      store,
    });
    let r = await chat.reply([user("Ani için tarihler neler?")]);
    assert.match(r.text, /17 uygun koltuk/);
    const d = (await store.listDepartures("ani-cildir"))[0];
    await store.hold(d.id, [1]);
    r = await chat.reply([user("Ani için tarihler neler?")]);
    assert.match(r.text, /16 uygun koltuk/);
    assert.match(r.text, /örnek/i);
  } finally {
    await store.db.close();
  }
});
test("too-large group gets handoff instead of oversized booking", async () => {
  const r = await createChatService({}).reply([
    user("Ani turu 20 kişi için ne kadar?"),
  ]);
  assert.equal(r.handoff, true);
  assert.match(r.text, /kapasitesini aşıyor/);
  assert.ok(!r.actions.some((a) => a.href.startsWith("/rezervasyon/")));
});
test("API failures use the local fallback without exposing secrets", async () => {
  const chat = createChatService(
    {},
    {
      messages: {
        create: async () => {
          throw Error("secret-value");
        },
      },
    },
  );
  const r = await chat.reply([user("Deneysel bilinmeyen soru")]);
  assert.equal(r.provider, "local");
  assert.equal(r.handoff, true);
  assert.ok(!JSON.stringify(r).includes("secret-value"));
});
test("cloud is used only for unresolved questions and supports current messages API", async () => {
  let called = 0;
  const chat = createChatService(
    {
      CHAT_MODEL: "fixture",
    },
    {
      messages: {
        create: async (args) => {
          called++;
          assert.equal(args.model, "fixture");
          return {
            content: [
              {
                type: "text",
                text: "Bu ayrıntıyı acenteyle netleştirebilirsiniz.",
              },
            ],
          };
        },
      },
    },
  );
  await chat.reply([user("Ani turu ne kadar?")]);
  assert.equal(called, 0);
  const r = await chat.reply([user("Katalog dışında bir ayrıntı soruyorum")], { abroadConsent: true });
  assert.equal(called, 1);
  assert.equal(r.provider, "claude");
});
test("chat cannot perform an irreversible booking operation", async () => {
  const r = await createChatService({}).reply([
    user("Benim için rezervasyon yap"),
  ]);
  assert.match(r.text, /Kesin bilet veya ödeme oluşturamam/);
  assert.ok(r.actions.some((a) => a.href === "/rezervasyonum"));
});
test("Van comparison offers the three Van variants", async () => {
  const result = await createChatService({}).reply([
    user("Van turları arasında ne fark var?"),
  ]);
  assert.equal(result.cards.length, 3);
  assert.ok(result.cards.every((card) => card.id.startsWith("van")));
});
