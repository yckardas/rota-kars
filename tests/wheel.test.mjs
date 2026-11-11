import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { openStore } from "../server/store.mjs";
import { createApp } from "../server/app.mjs";
import {
  defaultSectors,
  normalizeSectors,
  pickSector,
} from "../server/campaigns.mjs";

async function fixture(t) {
  const store = await openStore(":memory:");
  const server = createApp(store, {
    env: { ADMIN_PASSWORD: randomBytes(32).toString("hex") },
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const base = "http://127.0.0.1:" + server.address().port;
  // Her "tarayıcı" kendi çerezlerini tutar.
  const browser = () => {
    const jar = new Map();
    return async (path, body, method) => {
      const res = await fetch(base + "/api" + path, {
        ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
        ...(method ? { method } : {}),
        headers: {
          "Content-Type": "application/json",
          "X-Rota-Client": "web",
          Cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
        },
      });
      for (const c of res.headers.getSetCookie()) {
        const [pair, ...attrs] = c.split(";");
        const [k, v] = pair.split("=");
        if (attrs.some((a) => /max-age=0\b/i.test(a.trim())) || v === "")
          jar.delete(k);
        else jar.set(k, v);
      }
      return {
        status: res.status,
        json: await res.json().catch(() => null),
        jar,
      };
    };
  };
  return { store, browser };
}
const register = (req, email) =>
  req("/auth/register", {
    name: "Ayşe Yılmaz",
    email,
    password: "uzun-parola-123",
    consent: true,
  });

test("ağırlıklı seçim ağırlığa uyar; eski yüzde dizisi yeni ödül setine geçer", () => {
  const sectors = normalizeSectors(defaultSectors);
  // rand(total) sırayla 0..99 dönerse her dilim ağırlığı kadar seçilir.
  const counts = new Array(sectors.length).fill(0);
  for (let i = 0; i < 100; i++) counts[pickSector(sectors, () => i)]++;
  assert.deepEqual(counts, [30, 25, 20, 15, 7, 3]);
  assert.deepEqual(normalizeSectors([5, 10, 5, 15, 10, 5]), defaultSectors);
  assert.ok(
    defaultSectors.every((s) => s.value > 0),
    "boş dilim yok",
  );
});

test("TL kuponu en az 1.000 TL'de geçer ve toplamı aşmaz", async (t) => {
  const { store } = await fixture(t);
  const m = await store.members.register({
    name: "Ayşe",
    email: "a@example.com",
    password: "uzun-parola-123",
  });
  await store.db.update("members", { _id: m.id }, { email_verified: 1 });
  await store.campaigns.save({
    ...(await store.campaigns.get()),
    sectors: Array.from({ length: 4 }, () => ({
      kind: "amount",
      value: 20000,
      weight: 1,
    })),
  });
  const { coupon } = await store.members.spin(m.id);
  assert.equal(coupon.kind, "amount");
  assert.equal(coupon.amount, 20000);
  await assert.rejects(
    store.members.priceCoupon(m.id, coupon.id, 99999, "ani-cildir"),
    (e) => e.status === 400,
  );
  const priced = await store.members.priceCoupon(
    m.id,
    coupon.id,
    100000,
    "ani-cildir",
  );
  assert.equal(priced.discount, 20000);
  assert.equal(priced.total, 80000);
});

test("misafir çevirir, üye olur; hediye e-posta doğrulanınca kupona dönüşür ve başka hesaba geçmez", async (t) => {
  const { store, browser } = await fixture(t);
  const guest = browser();
  const spun = await guest("/wheel/spin", {});
  assert.equal(spun.status, 200);
  assert.ok(spun.jar.get("rota_wheel"), "hediye jetonu çerezde");
  assert.equal(spun.json.sectors.length, 6);
  assert.deepEqual(spun.json.prize, spun.json.sectors[spun.json.index]);
  // Aynı tarayıcı yeniden çevirince aynı sonucu görür.
  const again = await guest("/wheel/spin", {});
  assert.equal(again.json.index, spun.json.index);
  assert.equal(again.json.repeated, true);
  const token = spun.jar.get("rota_wheel");

  const reg = await register(guest, "misafir@example.com");
  assert.equal(reg.status, 201);
  assert.equal(reg.jar.has("rota_wheel"), false, "çerez sahiplenince silinir");
  const memberId = reg.json.member.id;
  let dash = (await guest("/member/dashboard")).json;
  assert.equal(dash.coupons.length, 0, "doğrulanmadan kupon yok");
  assert.equal(dash.spin.coupon_id, null);

  await store.db.update("members", { _id: memberId }, { email_verified: 1 });
  dash = (await guest("/member/dashboard")).json;
  assert.equal(dash.coupons.length, 1);
  const prize = spun.json.prize;
  assert.equal(dash.coupons[0].kind, prize.kind);
  assert.equal(
    prize.kind === "amount" ? dash.coupons[0].amount : dash.coupons[0].percent,
    prize.value,
  );
  // Üyenin çark hakkı kullanılmış sayılır.
  assert.equal((await guest("/member/spin", {})).status, 409);

  // Aynı jeton başka bir hesaba bağlanamaz.
  assert.equal(await store.members.claimWheel("baska-uye", token), null);
  assert.equal(await store.db.one("member_spins", { _id: "baska-uye" }), null);
});

test("misafir çarkı IP başına günde 3 kez; üye misafir çarkını kullanamaz", async (t) => {
  const { browser } = await fixture(t);
  for (let i = 0; i < 3; i++)
    assert.equal((await browser()("/wheel/spin", {})).status, 200);
  assert.equal((await browser()("/wheel/spin", {})).status, 429);
});

test("çark hakkını kullanmış üye giriş yapınca misafir hediyesi bağlanmaz", async (t) => {
  const { store, browser } = await fixture(t);
  const first = browser();
  const reg = await register(first, "uye@example.com");
  await store.db.update(
    "members",
    { _id: reg.json.member.id },
    { email_verified: 1 },
  );
  assert.equal((await first("/member/spin", {})).status, 200);
  assert.equal((await first("/wheel/spin", {})).status, 409);
  await first("/auth/logout", {});
  const guest = browser();
  await guest("/wheel/spin", {});
  await guest("/auth/login", {
    email: "uye@example.com",
    password: "uzun-parola-123",
  });
  const dash = (await guest("/member/dashboard")).json;
  assert.equal(dash.coupons.length, 1, "yalnız kendi çarkının kuponu");
});
