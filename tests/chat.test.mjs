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
    assert.match(r.text, /18 uygun koltuk/);
    const d = (await store.listDepartures("ani-cildir"))[0];
    await store.hold(d.id, [1]);
    r = await chat.reply([user("Ani için tarihler neler?")]);
    assert.match(r.text, /17 uygun koltuk/);
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

test("chat: paid model calls stop at the daily per-visitor budget", async () => {
  let calls = 0;
  const client = {
    messages: {
      create: async () => {
        calls++;
        return { content: [{ type: "text", text: "Model yanıtı" }] };
      },
    },
  };
  const chat = createChatService({ CHAT_CLIENT_DAILY_LIMIT: "2", CHAT_DAILY_LIMIT: "3" }, client);
  const ask = (who) =>
    chat.reply([{ role: "user", content: "Uzay mekiği ile Kars'a gidebilir miyim acaba?" }], { abroadConsent: true, client: who });
  await ask("a");
  await ask("a");
  await ask("a");
  assert.equal(calls, 2, "ziyaretçi başına sınır");
  await ask("b");
  await ask("c");
  assert.equal(calls, 3, "günlük toplam sınır");
});

test("yedek asistan: 5 kişi + tarih + iptal sorusu kişi sınırını ve 3 gün kuralını söyler", async () => {
  const store = await openStore(":memory:");
  try {
    const chat = createChatService({}, null, { store });
    const d = (await store.listDepartures("ani-cildir"))[0];
    const month = [
      "ocak",
      "şubat",
      "mart",
      "nisan",
      "mayıs",
      "haziran",
      "temmuz",
      "ağustos",
      "eylül",
      "ekim",
      "kasım",
      "aralık",
    ][Number(d.date.slice(5, 7)) - 1];
    const r = await chat.reply([
      user(
        `5 kişiyiz, ${month} ayında Ani turuna katılabilir miyiz? İptal edersem param iade olur mu?`,
      ),
    ]);
    assert.match(r.text, /en fazla 4 kişilik/);
    assert.match(r.text, /WhatsApp/);
    assert.match(r.text, /yurt içi/);
    assert.match(r.text, /3 gün \(72 saat\)/);
    assert.match(r.text, /kapora/);
    assert.match(r.text, /boş koltuk/);
    assert.equal(r.handoff, true);
    assert.ok(r.actions.some((a) => a.href === "/bilgilendirme#iptal"));
    // 4 kişi sınırını aşan grup için rezervasyon bağlantısı önerilmez.
    assert.ok(!r.actions.some((a) => a.href.startsWith("/rezervasyon/")));
  } finally {
    await store.db.close();
  }
});
test("yedek asistan: yurt dışı iptal 5 gün, çocuk, alınış ve açık ödeme kuralları", async () => {
  const batum = await createChatService({}).reply([
    user("Batum turunu iptal edersem ne kadar iade alırım?"),
  ]);
  assert.match(batum.text, /yurt dışı/);
  assert.match(batum.text, /5 gün \(120 saat\)/);
  const child = await createChatService({}).reply([
    user("Çocuk indirimi var mı?"),
  ]);
  assert.match(child.text, /otomatik çocuk indirimi içermez/);
  assert.doesNotMatch(child.text, /şans çarkı/i);
  const pickup = await createChatService({}).reply([
    user("Ani turunda bizi otelden alıyor musunuz?"),
  ]);
  assert.match(pickup.text, /08:30/);
  assert.match(pickup.text, /otelinizden/);
  const paid = await createChatService({ PAYMENT_PROVIDER: "test" }).reply([
    user("Ödeme nasıl yapılır, taksit var mı?"),
  ]);
  assert.match(paid.text, /kartla online/);
  assert.match(paid.text, /%30/);
  assert.match(paid.text, /taksit seçeneği yok/);
  assert.doesNotMatch(paid.text, /aktif değil/);
});
test("yapay zekâlı asistanın sistem bilgisi aynı kuralları içerir", async () => {
  const { knowledgeFor } = await import("../server/chat.mjs");
  const k = knowledgeFor({ PAYMENT_PROVIDER: "test" });
  assert.match(k, /en fazla 4 kişilik/);
  assert.match(
    k,
    /yurt içi turlarda hareketten 3 gün, yurt dışı turlarda 5 gün/,
  );
  assert.match(k, /Yurt dışı turlar \(5 gün kuralı\): .*Batum/);
  assert.match(k, /kartla online ödenir/);
  assert.match(k, /otomatik çocuk indirimi içermez/);
  assert.doesNotMatch(k, /Ödeme henüz aktif değil/);
});
