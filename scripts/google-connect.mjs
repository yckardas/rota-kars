#!/usr/bin/env node
// Google Business Profile bağlantı sihirbazı (yalnız yerelde çalışır).
//
//   npm run google:connect
//
// 1. .env içindeki GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET ile tarayıcıda
//    Google onay ekranını açar (Desktop app OAuth istemcisi, loopback + PKCE).
// 2. Refresh token alır, işletmeye erişimi olan hesapları ve işletmeleri listeler,
//    Rota Kars'ı Haritalar CID'sinden veya adından bulur.
// 3. Yorum API'sine bir deneme isteği atar ve sonucu .env'e yazar.
// Gizli değerler ekrana yazdırılmaz.
import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";

const SCOPE = "https://www.googleapis.com/auth/business.manage";
const MAPS_CID = "1539703208462618989";

export function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

// Var olan satırları yerinde günceller, olmayanları sona ekler; diğer ayarlara dokunmaz.
export function updateEnv(text, values) {
  const lines = text.split(/\r?\n/);
  const seen = new Set();
  const next = lines.map((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (m && m[1] in values) {
      seen.add(m[1]);
      return `${m[1]}=${values[m[1]]}`;
    }
    return line;
  });
  const missing = Object.keys(values).filter((k) => !seen.has(k));
  if (missing.length) {
    if (next.at(-1) !== "") next.push("");
    for (const k of missing) next.push(`${k}=${values[k]}`);
  }
  return next.join("\n").replace(/\n*$/, "\n");
}

// Rota Kars işletmesini Haritalar CID'si (en güvenilir) veya adıyla seçer.
export function pickLocation(locations, cid = MAPS_CID) {
  const byCid = locations.filter((l) =>
    String(l.metadata?.mapsUri || "").includes(cid),
  );
  if (byCid.length === 1) return { location: byCid[0], reason: "cid" };
  const byName = locations.filter((l) =>
    /rota\s*kars/i.test(l.title || ""),
  );
  if (byName.length === 1) return { location: byName[0], reason: "name" };
  return { location: null, candidates: byCid.length ? byCid : locations };
}

export function explainGoogleError(status, body = "") {
  if (status === 429 || /quota|RATE_LIMIT|0 QPM/i.test(body))
    return "Google Business Profile API kotası 0 görünüyor. Bu, API erişim başvurusunun henüz onaylanmadığı anlamına gelir (docs/GOOGLE-BUSINESS-SETUP.md, adım 1).";
  if (status === 403)
    return "Erişim reddedildi. Projede My Business API'lerinin etkin olduğundan, başvurunun onaylandığından ve giriş yapılan hesabın işletmede yönetici olduğundan emin olun.";
  if (status === 404)
    return "Hesap veya işletme bulunamadı. Doğru Google hesabıyla giriş yaptığınızı kontrol edin.";
  if (status === 401) return "Yetki geçersiz. Sihirbazı yeniden çalıştırın.";
  return `Google ${status} döndü.`;
}

async function google(url, token, init = {}) {
  const r = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    signal: AbortSignal.timeout(15000),
  });
  const text = await r.text();
  if (!r.ok) {
    const e = new Error(explainGoogleError(r.status, text));
    e.status = r.status;
    throw e;
  }
  return text ? JSON.parse(text) : {};
}

async function authorize(clientId, clientSecret) {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("hex");
  let redirectUri;
  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, redirectUri);
      if (url.pathname !== "/callback") return res.writeHead(404).end();
      const ok = url.searchParams.get("state") === state && url.searchParams.get("code");
      res.writeHead(ok ? 200 : 400, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        ok
          ? "<h2>Rota Kars: Google bağlantısı alındı.</h2><p>Bu sekmeyi kapatıp terminale dönebilirsiniz.</p>"
          : "<h2>Bağlantı tamamlanamadı.</h2><p>Terminaldeki mesaja bakın.</p>",
      );
      server.close();
      if (ok) resolve(url.searchParams.get("code"));
      else reject(new Error(url.searchParams.get("error") || "Google onayı tamamlanmadı."));
    });
    server.listen(0, "127.0.0.1", () => {
      redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
      const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      auth.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPE,
        access_type: "offline",
        prompt: "consent",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
      });
      console.log("\nTarayıcıda Google onay ekranı açılıyor. Açılmazsa bu adresi kopyalayın:\n");
      console.log(auth.href + "\n");
      const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
      execFile(opener, [auth.href], () => {});
    });
    setTimeout(() => {
      server.close();
      reject(new Error("5 dakika içinde onay gelmedi."));
    }, 5 * 60 * 1000).unref();
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  const data = await r.json();
  if (!r.ok || !data.refresh_token)
    throw new Error(
      data.refresh_token
        ? "Token alınamadı."
        : "Google refresh token vermedi. OAuth istemcisinin türü 'Desktop app' olmalı; hesabınızın erişimini https://myaccount.google.com/permissions adresinden kaldırıp tekrar deneyin.",
    );
  return data;
}

async function main() {
  const envPath = ".env";
  if (!existsSync(envPath)) writeFileSync(envPath, readFileSync(".env.example", "utf8"));
  const env = { ...parseEnv(readFileSync(envPath, "utf8")), ...process.env };
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    console.error(
      "Önce .env dosyasına GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET ekleyin.\n" +
        "Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID → Application type: Desktop app.",
    );
    process.exit(1);
  }
  const tokens = await authorize(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  console.log("✓ Google onayı alındı.");
  const accounts =
    (await google("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", tokens.access_token)).accounts || [];
  if (!accounts.length) throw new Error("Bu Google hesabının yönettiği bir Business Profile hesabı yok.");
  const locations = [];
  for (const account of accounts) {
    let pageToken = "";
    do {
      const q = new URLSearchParams({ readMask: "name,title,storefrontAddress,metadata", pageSize: "100" });
      if (pageToken) q.set("pageToken", pageToken);
      const page = await google(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?${q}`,
        tokens.access_token,
      );
      for (const l of page.locations || []) locations.push({ ...l, account: account.name });
      pageToken = page.nextPageToken || "";
    } while (pageToken);
  }
  let { location, reason, candidates } = pickLocation(locations);
  if (!location) {
    if (!candidates.length) throw new Error("Hesapta işletme bulunamadı.");
    console.log("\nRota Kars otomatik bulunamadı. İşletmeyi seçin:");
    candidates.forEach((l, i) =>
      console.log(`  ${i + 1}) ${l.title} · ${l.storefrontAddress?.locality || ""}`),
    );
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const n = Number(await rl.question("Numara: "));
    rl.close();
    location = candidates[n - 1];
    if (!location) throw new Error("Geçersiz seçim.");
  } else
    console.log(`✓ İşletme bulundu: ${location.title} (${reason === "cid" ? "Haritalar kaydıyla eşleşti" : "adından"})`);
  const accountId = location.account.split("/")[1];
  const locationId = location.name.split("/")[1];
  const reviews = await google(
    `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews?pageSize=1`,
    tokens.access_token,
  );
  console.log(
    `✓ Yorum API'si çalışıyor: ${reviews.totalReviewCount ?? "?"} yorum, ortalama ${reviews.averageRating ?? "?"}.`,
  );
  writeFileSync(
    envPath,
    updateEnv(readFileSync(envPath, "utf8"), {
      GOOGLE_REVIEWS_PROVIDER: "business",
      GOOGLE_REFRESH_TOKEN: tokens.refresh_token,
      GOOGLE_ACCOUNT_ID: accountId,
      GOOGLE_LOCATION_ID: locationId,
    }),
  );
  console.log(
    "✓ .env güncellendi (GOOGLE_REVIEWS_PROVIDER, GOOGLE_REFRESH_TOKEN, GOOGLE_ACCOUNT_ID, GOOGLE_LOCATION_ID).\n" +
      "Sunucuyu yeniden başlatın. Railway için aynı dört değeri ve CLIENT_ID/SECRET'ı servis değişkenlerine girin.",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href)
  main().catch((e) => {
    console.error("\n✗ " + e.message);
    process.exit(1);
  });
