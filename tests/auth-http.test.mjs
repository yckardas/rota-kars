import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { generateKeyPairSync, sign } from "node:crypto";
import { createApp } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";
// Bu testler çark davranışını doğrulanmamış üyelerle sınar; doğrulama kapısı ayrıca test edilir.
const allowUnverifiedWheel = async (s) =>
  s.campaigns.save({ ...(await s.campaigns.get()), requireVerified: false });
async function fixture(t, extra = {}) {
  const store = await openStore(":memory:");
  await allowUnverifiedWheel(store);
  const
    app = createApp(store, {
      env: {
        ADMIN_PASSWORD: "test-admin-only-password",
      },
      ...extra,
    }),
    server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await store.db.close();
  });
  const req = (path, body, cookie) =>
    fetch(base + "/api" + path, {
      redirect: "manual",
      ...(body
        ? {
            method: "POST",
            body: JSON.stringify(body),
          }
        : {}),
      headers: {
        "Content-Type": "application/json",
        "X-Rota-Client": "web",
        ...(cookie
          ? {
              Cookie: cookie,
            }
          : {}),
      },
    });
  return {
    store,
    req,
    base,
  };
}
const cookie = (r) => r.headers.get("set-cookie")?.split(";")[0];
test("HTTP member registration/session, owner-only coupons and double-spend race", async (t) => {
  const { store, req } = await fixture(t);
  const registered = await req("/auth/register", {
    name: "Test Yolcu",
    email: "http@example.com",
    password: "long-test-password",
    consent: true,
  });
  assert.equal(registered.status, 201);
  const sid = cookie(registered);
  assert.ok(registered.headers.get("set-cookie").includes("HttpOnly"));
  assert.equal((await req("/auth/me", undefined, sid)).status, 200);
  assert.equal((await (await req("/auth/me")).json()).member, null);
  assert.equal((await req("/member/dashboard")).status, 401);
  const prize = await (await req("/member/spin", {}, sid)).json();
  assert.equal((await req("/member/spin", {}, sid)).status, 409);
  const departure = (await store.listDepartures("ani-cildir"))[0],
    quote = {
      departureId: departure.id,
      count: 1,
      couponId: prize.coupon.id,
    };
  assert.equal((await req("/reservations/quote", quote)).status, 401);
  const amount = await (await req("/reservations/quote", quote, sid)).json();
  assert.equal(amount.total, 100000 - 1000 * prize.coupon.percent);
  const holds = [
    await store.hold(departure.id, [1]),
    await store.hold(departure.id, [2]),
  ];
  const responses = await Promise.all(
    holds.map((h) =>
      req(
        "/reservations",
        {
          holdToken: h.token,
          name: "Test Yolcu",
          email: "http@example.com",
          phone: "05550000000",
          passengers: ["Test Yolcu"],
          paymentMode: "full",
          consent: true,
          couponId: prize.coupon.id,
          total: 1,
        },
        sid,
      ),
    ),
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (await responses.find((r) => r.status === 201).json()).total,
    amount.total,
  );
  await req("/auth/logout", {}, sid);
  assert.equal(
    (await (await req("/auth/me", undefined, sid)).json()).member,
    null,
  );
});
test("operations are admin protected and public catalog exposes the new capacity", async (t) => {
  const { req } = await fixture(t);
  const input = {
    salesOpen: true,
    vehicleModel: "vip-minibus",
    passengerSeats: 9,
  };
  assert.equal((await req("/admin/operations/ani-cildir", input)).status, 401);
  const sid = cookie(
    await req("/admin/login", {
      password: "test-admin-only-password",
    }),
  );
  assert.equal(
    (await req("/admin/operations/ani-cildir", input, sid)).status,
    200,
  );
  const catalog = await (await req("/catalog")).json();
  assert.equal(catalog.tours[0].vehicle.sellableSeats, 8);
  await req(
    "/admin/operations/ani-cildir",
    {
      ...input,
      salesOpen: false,
    },
    sid,
  );
  const closed = await (await req("/catalog")).json();
  assert.equal(closed.tours[0].salesOpen, false);
  assert.deepEqual(
    await (await req("/tours/ani-cildir/departures")).json(),
    [],
  );
});
const rsa = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
function jwt(claims) {
  const h = Buffer.from(
      JSON.stringify({
        alg: "RS256",
        kid: "fixture-key",
      }),
    ).toString("base64url"),
    p = Buffer.from(JSON.stringify(claims)).toString("base64url"),
    data = h + "." + p;
  return (
    data +
    "." +
    sign("RSA-SHA256", Buffer.from(data), rsa.privateKey).toString("base64url")
  );
}
for (const provider of ["google", "apple", "facebook"])
  test(
    provider +
      " callback verifies provider identity and binds state to browser",
    async (t) => {
      let nonce,
        wrongAudience = false;
      const pem = generateKeyPairSync("ec", {
        namedCurve: "P-256",
      }).privateKey.export({
        type: "pkcs8",
        format: "pem",
      });
      const env = {
        PUBLIC_BASE_URL: "https://rota.example",
        GOOGLE_AUTH_CLIENT_ID: "client",
        GOOGLE_AUTH_CLIENT_SECRET: "secret",
        APPLE_CLIENT_ID: "client",
        APPLE_PRIVATE_KEY: pem,
        APPLE_TEAM_ID: "team",
        APPLE_KEY_ID: "key",
        FACEBOOK_APP_ID: "client",
        FACEBOOK_APP_SECRET: "secret",
      };
      const socialFetch = async (url, options) => {
        if (url.includes("/certs") || url.includes("/auth/keys"))
          return {
            ok: true,
            json: async () => ({
              keys: [
                {
                  ...rsa.publicKey.export({
                    format: "jwk",
                  }),
                  kid: "fixture-key",
                },
              ],
            }),
          };
        if (url.includes("/me?")) {
          assert.equal(options.headers.Authorization, "Bearer fixture-access");
          assert.ok(url.includes("appsecret_proof="));
          return {
            ok: true,
            json: async () => ({
              id: "facebook-subject",
              email: "facebook@example.com",
              name: "Test Yolcu",
            }),
          };
        }
        const now = Math.floor(Date.now() / 1000);
        return {
          ok: true,
          json: async () =>
            provider === "facebook"
              ? {
                  access_token: "fixture-access",
                }
              : {
                  id_token: jwt({
                    iss:
                      provider === "apple"
                        ? "https://appleid.apple.com"
                        : "https://accounts.google.com",
                    aud: wrongAudience ? "attacker-client" : "client",
                    sub: provider + "-subject",
                    nonce,
                    iat: now,
                    exp: now + 3600,
                    email: provider + "@example.com",
                    email_verified: true,
                    name: "Test Yolcu",
                  }),
                },
        };
      };
      const { req, base, store } = await fixture(t, {
        env,
        socialFetch,
      });
      async function begin() {
        const start = await req("/auth/start/" + provider),
          url = new URL(start.headers.get("location"));
        nonce = url.searchParams.get("nonce");
        assert.ok(nonce);
        if (provider === "google")
          assert.equal(url.searchParams.get("code_challenge_method"), "S256");
        return {
          state: url.searchParams.get("state"),
          binding: cookie(start),
        };
      }
      async function finish(entry, binding = entry.binding) {
        const body = new URLSearchParams({
          state: entry.state,
          code: "fixture-code",
        });
        return fetch(
          base +
            "/api/auth/callback/" +
            provider +
            (provider === "apple" ? "" : "?" + body),
          {
            redirect: "manual",
            method: provider === "apple" ? "POST" : "GET",
            headers: {
              Cookie: binding,
              ...(provider === "apple"
                ? {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Origin: "https://appleid.apple.com",
                  }
                : {}),
            },
            ...(provider === "apple"
              ? {
                  body,
                }
              : {}),
          },
        );
      }
      const entry = await begin(),
        result = await finish(entry);
      assert.equal(result.headers.get("location"), "/hesabim");
      assert.ok(result.headers.get("set-cookie").includes("rota_member="));
      assert.equal(
        await store.db.count("members"),
        1,
      );
      assert.ok(
        (await finish(entry)).headers.get("location").includes("error="),
      );
      const forged = await begin();
      assert.ok(
        (await finish(forged, "rota_oauth=wrong")).headers
          .get("location")
          .includes("error="),
      );
      if (provider !== "facebook") {
        wrongAudience = true;
        const bad = await begin();
        assert.ok(
          (await finish(bad)).headers.get("location").includes("error="),
        );
      }
    },
  );
