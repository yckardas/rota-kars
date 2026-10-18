import { useEffect, useRef, useState } from "react";

// Cloudflare Turnstile (bot koruması). Site anahtarı katalogla gelir; ayarlı
// değilse widget gösterilmez ve formlar doğrulamasız gönderilir.
type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
type TurnstileWindow = Window & { turnstile?: TurnstileApi };

let siteKey: string | null = null;
export const configureTurnstile = (key?: string | null) => {
  siteKey = key || null;
};

let loader: Promise<void> | null = null;
function loadTurnstile() {
  if ((window as TurnstileWindow).turnstile) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      loader = null;
      reject(new Error("Turnstile yüklenemedi."));
    };
    document.head.append(script);
  });
  return loader;
}

function TurnstileWidget({
  action,
  onToken,
}: {
  action: string;
  onToken: (token: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true,
      id: string | null = null;
    loadTurnstile()
      .then(() => {
        const api = (window as TurnstileWindow).turnstile;
        if (!active || !api || !host.current || !siteKey) return;
        id = api.render(host.current, {
          sitekey: siteKey,
          action,
          language: "tr",
          size: "flexible",
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken(""),
        });
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (id) (window as TurnstileWindow).turnstile?.remove(id);
    };
  }, [action, onToken]);
  return (
    <div className="turnstile-box">
      <div ref={host} />
      {failed && (
        <p className="form-error" role="alert">
          Güvenlik doğrulaması yüklenemedi. Sayfayı yenileyin veya WhatsApp’tan
          bize yazın.
        </p>
      )}
    </div>
  );
}

// Her token bir kez kullanılır: gönderimden sonra reset() ile yenisi alınır.
export function useTurnstile(action: string) {
  const [token, setToken] = useState(""),
    [round, setRound] = useState(0),
    enabled = Boolean(siteKey);
  return {
    widget: enabled ? (
      <TurnstileWidget key={round} action={action} onToken={setToken} />
    ) : null,
    token: enabled ? token : undefined,
    ready: !enabled || Boolean(token),
    reset: () => {
      if (!enabled) return;
      setToken("");
      setRound((n) => n + 1);
    },
  };
}
