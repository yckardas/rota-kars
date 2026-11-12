// Android yönetici uygulaması (Capacitor) ile köprü ve tarayıcıdan yüklenen uygulama
// (PWA). Uygulama içinde Capacitor köprüsü window.Capacitor olarak gelir (eklenti
// paketleri site koduna eklenmez); tarayıcıda bildirimler Web Push ile çalışır.
import { api, post } from "./api";

type Listener = { remove: () => Promise<void> | void };
type PushPlugin = {
  checkPermissions: () => Promise<{ receive: string }>;
  requestPermissions: () => Promise<{ receive: string }>;
  register: () => Promise<void>;
  createChannel?: (c: Record<string, unknown>) => Promise<void> | void;
  // Uzak sayfaya enjekte edilen köprüde addListener Promise yerine doğrudan
  // tutamak döndürebilir: tüm dönüşler Promise.resolve ile sarılır.
  addListener: (event: string, fn: (data: never) => void) => Promise<Listener> | Listener;
};
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins: {
    PushNotifications?: PushPlugin;
    App?: { getInfo: () => Promise<{ version: string; build: string }> };
    RotaApp?: { pushReady: () => Promise<{ ready: boolean }> };
  };
};
const cap = () => (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor;
export const isNativeApp = () => Boolean(cap()?.isNativePlatform?.());

const stored = (key: string) => ({
  get: () => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (v: string | null) => {
    try {
      if (v) localStorage.setItem(key, v);
      else localStorage.removeItem(key);
    } catch {}
  },
});
const storage = stored("rota-push-token"),
  webStorage = stored("rota-web-push");

// Bildirime dokununca yalnız site içi bir yola gidilir.
const internalPath = (url: unknown) =>
  typeof url === "string" && /^\/(?![/\\])[\w\-/?=&.%]*$/.test(url) ? url : "/yonetim";

let listeners: Listener[] = [];
export type PushState =
  | "unsupported"
  | "unconfigured"
  | "denied"
  | "prompt"
  | "needs-install"
  | "registered"
  | "error";

// prompt: false iken izin sorulmaz; yalnız daha önce izin verilmişse kayıt tazelenir.
export async function enablePush(
  onOpen: (path: string) => void,
  { prompt = true }: { prompt?: boolean } = {},
): Promise<PushState> {
  if (!isNativeApp()) return enableWebPush({ prompt });
  const push = cap()?.Plugins.PushNotifications;
  if (!isNativeApp() || !push) return "unsupported";
  // Firebase yapılandırması olmayan pakette kayıt denenmez (uygulama çökerdi).
  const rota = cap()?.Plugins.RotaApp;
  if (!rota || !(await rota.pushReady().catch(() => ({ ready: false }))).ready) return "unconfigured";
  let permission = (await push.checkPermissions()).receive;
  if (permission === "prompt" || permission === "prompt-with-rationale")
    permission = (await push.requestPermissions()).receive;
  if (permission !== "granted") return "denied";
  const listen = async (event: string, fn: (data: never) => void) => {
    const handle = await Promise.resolve(push.addListener(event, fn));
    if (handle) listeners.push(handle);
  };
  await Promise.resolve()
    .then(() =>
      push.createChannel?.({
        id: "rota-yonetim",
        name: "Rezervasyon ve yorum bildirimleri",
        importance: 5,
        visibility: 1,
        sound: "default",
      }),
    )
    .catch(() => {});
  await Promise.all(listeners.map((l) => Promise.resolve().then(() => l.remove()).catch(() => {})));
  listeners = [];
  let resolveToken: (t: string) => void = () => {},
    rejectToken: (e: Error) => void = () => {};
  const tokenPromise = new Promise<string>((resolve, reject) => {
    resolveToken = resolve;
    rejectToken = reject;
  });
  const timer = setTimeout(() => rejectToken(new Error("Bildirim kaydı zaman aşımına uğradı.")), 15000);
  await listen("registration", ((t: { value: string }) => resolveToken(t.value)) as (d: never) => void);
  await listen("registrationError", ((e: { error: string }) => rejectToken(new Error(e.error))) as (d: never) => void);
  await listen("pushNotificationActionPerformed", ((action: {
    notification: { data?: { url?: string } };
  }) => onOpen(internalPath(action.notification.data?.url))) as (d: never) => void);
  await Promise.resolve()
    .then(() => push.register())
    .catch((e: Error) => rejectToken(e));
  const token = await tokenPromise.finally(() => clearTimeout(timer));
  const model = navigator.userAgent.match(/Android [\d.]+; ([^;)]+)/)?.[1]?.trim() || "Android telefon";
  await post("/admin/devices", { token, platform: "android", label: model.slice(0, 60) });
  storage.set(token);
  return "registered";
}

// Çıkışta bu cihaz bildirim listesinden çıkarılır.
export async function disablePush() {
  const token = storage.get();
  if (token) {
    await post("/admin/devices/remove", { token }).catch(() => {});
    storage.set(null);
  }
  const endpoint = webStorage.get();
  if (endpoint) {
    await post("/admin/devices/remove", { endpoint }).catch(() => {});
    webStorage.set(null);
    const reg = await navigator.serviceWorker?.getRegistration("/yonetim").catch(() => undefined);
    await (await reg?.pushManager.getSubscription())?.unsubscribe().catch(() => {});
  }
}

// ---- Tarayıcıdan yüklenen uygulama (PWA) ----
export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
export const webPushSupported = () =>
  !isNativeApp() && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export function registerAppWorker() {
  if (isNativeApp() || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/yonetim-sw.js", { scope: "/yonetim" }).catch(() => {});
}

// Bildirime dokununca açık panel ilgili sekmeye geçer (yonetim-sw.js gönderir).
export function onAppNotificationOpen(fn: (path: string) => void) {
  if (!("serviceWorker" in navigator)) return () => {};
  const handler = (e: MessageEvent) => {
    if (e.data?.type === "rota-open") fn(internalPath(e.data.path));
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}

const base64Url = (bytes: ArrayBuffer | null) =>
  bytes ? btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "";
const fromBase64Url = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

function browserLabel() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Tarayıcı";
  const device = isIos() ? (/iPad/.test(ua) || navigator.maxTouchPoints > 1 && !/iPhone/.test(ua) ? "iPad" : "iPhone") : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : "bilgisayar";
  return `${browser} · ${device}`;
}

async function enableWebPush({ prompt }: { prompt: boolean }): Promise<PushState> {
  // iPhone'da bildirim yalnız ana ekrana eklenmiş uygulamada açılır.
  if (!webPushSupported()) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  let permission = Notification.permission;
  if (permission === "default" && prompt) permission = await Notification.requestPermission();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "prompt";
  registerAppWorker();
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await api<{ publicKey: string }>("/admin/devices/web-key");
  let sub = await reg.pushManager.getSubscription();
  // Sunucu anahtarı değiştiyse eski abonelik yenilenir.
  if (sub && base64Url(sub.options.applicationServerKey) !== publicKey) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(publicKey) });
  const json = sub.toJSON();
  await post("/admin/devices", {
    platform: "web",
    subscription: { endpoint: json.endpoint, keys: json.keys },
    label: browserLabel(),
  });
  webStorage.set(sub.endpoint);
  return "registered";
}

// Chrome/Edge "Yükle" teklifini saklar; panel kendi düğmesiyle gösterir.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let installEvent: InstallEvent | null = null;
const installWatchers = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvent = e as InstallEvent;
    installWatchers.forEach((fn) => fn());
  });
  window.addEventListener("appinstalled", () => {
    installEvent = null;
    installWatchers.forEach((fn) => fn());
  });
}
export const canInstallApp = () => Boolean(installEvent);
export function watchInstall(fn: () => void) {
  installWatchers.add(fn);
  return () => void installWatchers.delete(fn);
}
export async function installApp() {
  const e = installEvent;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  installEvent = null;
  installWatchers.forEach((fn) => fn());
  return outcome === "accepted";
}

const newer = (a: string, b: string) => {
  const pa = a.split(".").map(Number),
    pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++)
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
};
export type AppUpdate = { version: string; apkUrl: string; notes: string; required: boolean };
export async function checkAppUpdate(): Promise<AppUpdate | null> {
  const app = cap()?.Plugins.App;
  if (!isNativeApp() || !app) return null;
  const [{ version }, info] = await Promise.all([
    app.getInfo(),
    api<{ latestVersion: string | null; minVersion: string | null; apkUrl: string | null; notes: string }>("/app/android"),
  ]);
  if (!info.latestVersion || !info.apkUrl || !newer(info.latestVersion, version)) return null;
  return {
    version: info.latestVersion,
    apkUrl: info.apkUrl,
    notes: info.notes,
    required: Boolean(info.minVersion && newer(info.minVersion, version)),
  };
}
