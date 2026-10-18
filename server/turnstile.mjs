// Cloudflare Turnstile: rezervasyon, üyelik ve talep formlarında bot koruması.
// TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY ayarlı değilse doğrulama kapalıdır
// (yerel geliştirme ve testler). Doğrulama sunucu tarafında, her token bir kez.
import { AppError } from "./store.mjs";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function createTurnstile(env = process.env, fetchImpl = fetch) {
  const siteKey = env.TURNSTILE_SITE_KEY || "",
    secret = env.TURNSTILE_SECRET_KEY || "",
    enabled = Boolean(siteKey && secret);
  return {
    enabled,
    siteKey: enabled ? siteKey : null,
    async verify(token, ip, action) {
      if (!enabled) return true;
      if (typeof token !== "string" || !token || token.length > 2048)
        throw new AppError(400, "Güvenlik doğrulamasını tamamlayın.");
      let result;
      try {
        const res = await fetchImpl(VERIFY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
          signal: AbortSignal.timeout(8000),
        });
        result = await res.json();
      } catch (error) {
        console.error(JSON.stringify({ level: "error", job: "turnstile", message: String(error?.message || error) }));
        throw new AppError(503, "Güvenlik doğrulaması şu anda yapılamıyor. Biraz sonra tekrar deneyin.");
      }
      if (!result?.success || (action && result.action && result.action !== action))
        throw new AppError(400, "Güvenlik doğrulaması geçersiz veya süresi doldu. Tekrar deneyin.");
      return true;
    },
  };
}
