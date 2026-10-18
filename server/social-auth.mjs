import {
  randomBytes,
  createHash,
  createHmac,
  createPublicKey,
  verify,
  sign,
} from "node:crypto";
import { AppError } from "./store.mjs";
const hash = (s) => createHash("sha256").update(s).digest("base64url");
export const cookieValue = (req, name) =>
  (req.headers.cookie || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + "="))
    ?.slice(name.length + 1);
// Giriş sonrası dönüş adresi: yalnız "/" ile başlayan site içi yol; "//", "\\",
// şema veya kontrol karakteri içeremez.
export function safeNext(value) {
  if (typeof value !== "string" || value.length > 300) return null;
  if (!/^\/(?![\/\\])/.test(value) || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, "https://rotakarsturizm.invalid");
    if (url.origin !== "https://rotakarsturizm.invalid") return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
export function attachSocialAuth(
  app,
  { env, store, route, setSession, fetchImpl = fetch },
) {
  const states = new Map(),
    keys = new Map(),
    base = (env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const configs = {
    google: {
      id: env.GOOGLE_AUTH_CLIENT_ID,
      secret: env.GOOGLE_AUTH_CLIENT_SECRET,
      auth: "https://accounts.google.com/o/oauth2/v2/auth",
      token: "https://oauth2.googleapis.com/token",
      jwks: "https://www.googleapis.com/oauth2/v3/certs",
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      scope: "openid email profile",
    },
    apple: {
      id: env.APPLE_CLIENT_ID,
      secret: env.APPLE_PRIVATE_KEY && env.APPLE_TEAM_ID && env.APPLE_KEY_ID,
      auth: "https://appleid.apple.com/auth/authorize",
      token: "https://appleid.apple.com/auth/token",
      jwks: "https://appleid.apple.com/auth/keys",
      issuer: ["https://appleid.apple.com"],
      scope: "name email",
    },
    facebook: {
      id: env.FACEBOOK_APP_ID,
      secret: env.FACEBOOK_APP_SECRET,
      auth: "https://www.facebook.com/v23.0/dialog/oauth",
      token: "https://graph.facebook.com/v23.0/oauth/access_token",
      scope: "email public_profile",
    },
  };
  const enabled = (name) =>
    Boolean(
      base &&
      configs[name]?.id &&
      configs[name]?.secret &&
      (name !== "apple" || base.startsWith("https://")),
    );
  const jsonFetch = async (url, options = {}) => {
    const res = await fetchImpl(url, {
      ...options,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error("Provider request failed");
    return res.json();
  };
  async function verifyIdToken(token, config, nonce) {
    if (typeof token !== "string" || token.length > 16000)
      throw new Error("Invalid token");
    const pieces = token.split(".");
    if (pieces.length !== 3) throw new Error("Invalid token");
    const header = JSON.parse(Buffer.from(pieces[0], "base64url")),
      claims = JSON.parse(Buffer.from(pieces[1], "base64url"));
    if (header.alg !== "RS256" || typeof header.kid !== "string")
      throw new Error("Invalid algorithm");
    let cached = keys.get(config.jwks);
    if (
      !cached ||
      cached.expires < Date.now() ||
      !cached.keys.some((k) => k.kid === header.kid)
    ) {
      const data = await jsonFetch(config.jwks);
      cached = {
        keys: data.keys,
        expires: Date.now() + 3600000,
      };
      keys.set(config.jwks, cached);
    }
    const jwk = cached.keys.find(
      (k) => k.kid === header.kid && k.kty === "RSA",
    );
    if (!jwk) throw new Error("Invalid signing key");
    const valid = verify(
      "RSA-SHA256",
      Buffer.from(pieces[0] + "." + pieces[1]),
      createPublicKey({
        key: jwk,
        format: "jwk",
      }),
      Buffer.from(pieces[2], "base64url"),
    );
    const now = Math.floor(Date.now() / 1000);
    if (
      !valid ||
      !config.issuer.includes(claims.iss) ||
      claims.aud !== config.id ||
      !Number.isFinite(claims.exp) ||
      claims.exp <= now ||
      !Number.isFinite(claims.iat) ||
      claims.iat > now + 60 ||
      claims.nonce !== nonce ||
      typeof claims.sub !== "string" ||
      !claims.sub ||
      !claims.email ||
      !["true", true].includes(claims.email_verified)
    )
      throw new Error("Invalid identity");
    return {
      subject: claims.sub,
      email: claims.email,
      name: claims.name || claims.email.split("@")[0],
    };
  }
  function appleSecret() {
    const now = Math.floor(Date.now() / 1000),
      head = Buffer.from(
        JSON.stringify({
          alg: "ES256",
          kid: env.APPLE_KEY_ID,
        }),
      ).toString("base64url"),
      payload = Buffer.from(
        JSON.stringify({
          iss: env.APPLE_TEAM_ID,
          iat: now,
          exp: now + 300,
          aud: "https://appleid.apple.com",
          sub: env.APPLE_CLIENT_ID,
        }),
      ).toString("base64url"),
      data = head + "." + payload;
    return (
      data +
      "." +
      sign("sha256", Buffer.from(data), {
        key: env.APPLE_PRIVATE_KEY.replaceAll("\\n", "\n"),
        dsaEncoding: "ieee-p1363",
      }).toString("base64url")
    );
  }
  app.get("/api/auth/providers", (_q, r) =>
    r.json(
      Object.keys(configs).map((id) => ({
        id,
        enabled: enabled(id),
      })),
    ),
  );
  app.get(
    "/api/auth/start/:provider",
    route(async (q, r) => {
      const name = q.params.provider;
      if (!enabled(name))
        return r.redirect("/uyelik?setup=" + encodeURIComponent(name));
      for (const [key, value] of states)
        if (value.expires < Date.now()) states.delete(key);
      if (states.size >= 1000)
        throw new AppError(429, "Biraz sonra tekrar deneyin.");
      const state = randomBytes(32).toString("hex"),
        nonce = randomBytes(24).toString("hex"),
        verifier = randomBytes(32).toString("base64url"),
        binding = randomBytes(32).toString("hex");
      const refer =
        typeof q.query.ref === "string" && /^[A-F0-9]{10}$/i.test(q.query.ref)
          ? q.query.ref.toUpperCase()
          : null;
      states.set(state, {
        name,
        next: safeNext(q.query.next),
        nonce,
        verifier,
        binding: hash(binding),
        referralCode: refer,
        memberId: (
          await store.members.fromSession(cookieValue(q, "rota_member"))
        )?.id,
        expires: Date.now() + 600000,
      });
      r.cookie("rota_oauth", binding, {
        httpOnly: true,
        secure: base.startsWith("https:"),
        sameSite: name === "apple" ? "none" : "lax",
        maxAge: 600000,
        path: "/api/auth",
      });
      const params = new URLSearchParams({
        client_id: configs[name].id,
        redirect_uri: base + "/api/auth/callback/" + name,
        response_type: "code",
        scope: configs[name].scope,
        state,
        nonce,
      });
      if (name === "google") {
        params.set("code_challenge", hash(verifier));
        params.set("code_challenge_method", "S256");
      }
      if (name === "apple") params.set("response_mode", "form_post");
      r.redirect(configs[name].auth + "?" + params);
    }),
  );
  async function callback(q, r) {
    const name = q.params.provider,
      data = q.method === "POST" ? q.body : q.query,
      entry = states.get(data.state);
    states.delete(data.state);
    r.clearCookie("rota_oauth", {
      path: "/api/auth",
      httpOnly: true,
      secure: base.startsWith("https:"),
      sameSite: name === "apple" ? "none" : "lax",
    });
    try {
      const binding = cookieValue(q, "rota_oauth");
      if (
        !enabled(name) ||
        !entry ||
        entry.name !== name ||
        entry.expires < Date.now() ||
        !binding ||
        hash(binding) !== entry.binding ||
        data.error ||
        typeof data.code !== "string" ||
        data.code.length > 4000
      )
        throw new Error("Invalid callback");
      const config = configs[name],
        params = new URLSearchParams({
          client_id: config.id,
          client_secret: name === "apple" ? appleSecret() : config.secret,
          code: data.code,
          redirect_uri: base + "/api/auth/callback/" + name,
          grant_type: "authorization_code",
        });
      if (name === "google") params.set("code_verifier", entry.verifier);
      const tokens = await jsonFetch(config.token, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });
      let identity;
      if (name === "facebook") {
        if (!tokens.access_token) throw new Error("Missing access token");
        const query = new URLSearchParams({
          fields: "id,name,email",
          appsecret_proof: createHmac("sha256", config.secret)
            .update(tokens.access_token)
            .digest("hex"),
        });
        const profile = await jsonFetch(
          "https://graph.facebook.com/v23.0/me?" + query,
          {
            headers: {
              Authorization: "Bearer " + tokens.access_token,
            },
          },
        );
        if (!profile.id || !profile.email) throw new Error("Missing email");
        identity = {
          subject: profile.id,
          name: profile.name,
          email: profile.email,
        };
      } else
        identity = await verifyIdToken(tokens.id_token, config, entry.nonce);
      const member = await store.members.social({
        ...identity,
        provider: name,
        referralCode: entry.referralCode,
        linkMemberId: entry.memberId,
      });
      await setSession(r, member.id);
      // Yalnız sitenin kendi sayfalarına dönülür (açık yönlendirme önlenir).
      r.redirect(entry.next || "/hesabim");
    } catch (error) {
      r.redirect(
        "/uyelik?error=" +
          encodeURIComponent(
            error instanceof AppError && error.status === 409
              ? "existing_account"
              : "social_login",
          ),
      );
    }
  }
  app.get("/api/auth/callback/:provider", route(callback));
  app.post("/api/auth/callback/:provider", route(callback));
}
