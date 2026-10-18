export function normalizeInstagramUrl(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["www.instagram.com", "instagram.com"].includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password
    )
      return null;
    const match = url.pathname.match(/^\/(reel|p)\/([A-Za-z0-9_-]{5,64})\/?$/);
    return match ? `https://www.instagram.com/${match[1]}/${match[2]}/` : null;
  } catch {
    return null;
  }
}

// Instagram API (Instagram ile giriş) üzerinden hesabın kendi Reels/video
// paylaşımları. media_url imzalı ve süreli bir CDN adresidir; bu yüzden liste
// sunucuda kısa süre önbelleğe alınır ve tarayıcı videoyu doğrudan oynatır.
// Uzun ömürlü token 60 gün geçerlidir; 24 saatte bir yenilenip saklanır.
const GRAPH = "https://graph.instagram.com";
export async function createInstagramSettings(db, { clock }) {
  return {
    async get(id) {
      return (await db.one("integration_settings", { _id: id }))?.body ?? null;
    },
    async set(id, body) {
      await db.upsert("integration_settings", id, {
        id,
        body,
        updated_at: clock(),
      });
    },
  };
}
export function createInstagramFeed({
  env = process.env,
  fetcher = fetch,
  clock = Date.now,
  settings = null,
} = {}) {
  const configured = Boolean(env.INSTAGRAM_ACCESS_TOKEN);
  const ttl = Number(env.INSTAGRAM_CACHE_MINUTES || 30) * 60 * 1000;
  let cache = null,
    inflight = null,
    lastErrorLog = 0;
  async function call(path, params) {
    const url = new URL(GRAPH + path);
    url.search = new URLSearchParams(params);
    const r = await fetcher(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) {
      const e = Error(`Instagram API ${r.status}`);
      e.status = r.status;
      throw e;
    }
    return r.json();
  }
  async function token() {
    const saved = settings ? await settings.get("instagram_token") : null;
    // Ortam değişkenindeki token değiştirildiyse onu esas al.
    const current =
      saved && saved.source === env.INSTAGRAM_ACCESS_TOKEN
        ? saved
        : { token: env.INSTAGRAM_ACCESS_TOKEN, source: env.INSTAGRAM_ACCESS_TOKEN, refreshedAt: 0 };
    if (settings && clock() - (current.refreshedAt || 0) > 24 * 3600 * 1000) {
      try {
        const fresh = await call("/refresh_access_token", {
          grant_type: "ig_refresh_token",
          access_token: current.token,
        });
        if (fresh.access_token) {
          current.token = fresh.access_token;
          current.refreshedAt = clock();
          current.expiresAt = clock() + (fresh.expires_in || 0) * 1000;
          await settings.set("instagram_token", current);
        }
      } catch {
        // Yenileme başarısızsa mevcut token ile devam edilir; süresi dolunca liste boş döner.
      }
    }
    return current.token;
  }
  async function load() {
    const data = await call("/me/media", {
      fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
      limit: "24",
      access_token: await token(),
    });
    return (data.data || [])
      .filter((m) => m.media_type === "VIDEO" && m.media_url)
      .slice(0, Number(env.INSTAGRAM_MAX_VIDEOS || 8))
      .map((m) => ({
        id: "ig-" + m.id,
        title:
          String(m.caption || "")
            .split("\n")[0]
            .replace(/#\S+/g, "")
            .trim()
            .slice(0, 70) || "Rota Kars’tan",
        permalink: normalizeInstagramUrl(m.permalink) || m.permalink,
        cover: m.thumbnail_url || "",
        videoSrc: m.media_url,
        timestamp: m.timestamp,
        source: "instagram",
      }));
  }
  return {
    configured,
    async posts() {
      if (!configured) return null;
      try {
        if (!cache || clock() - cache.at > ttl) {
          inflight ||= load()
            .then((posts) => (cache = { at: clock(), posts }))
            .finally(() => (inflight = null));
          await inflight;
        }
        return cache.posts;
      } catch (e) {
        if (clock() - lastErrorLog > 10 * 60 * 1000) {
          lastErrorLog = clock();
          console.error(
            JSON.stringify({ level: "warn", service: "instagram", status: e?.status || null }),
          );
        }
        // Önceki başarılı liste varsa (adresleri henüz geçerli olabilir) onu kullan.
        return cache?.posts || null;
      }
    },
  };
}
