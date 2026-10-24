// Android yönetici uygulaması (Capacitor) ile köprü. Site tarayıcıda açıldığında
// bu fonksiyonlar hiçbir şey yapmaz; uygulama içinde Capacitor köprüsü
// window.Capacitor olarak gelir (eklenti paketleri site koduna eklenmez).
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

const TOKEN_KEY = "rota-push-token";
const storage = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (v: string | null) => {
    try {
      if (v) localStorage.setItem(TOKEN_KEY, v);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
  },
};

// Bildirime dokununca yalnız site içi bir yola gidilir.
const internalPath = (url: unknown) =>
  typeof url === "string" && /^\/(?![/\\])[\w\-/?=&.%]*$/.test(url) ? url : "/yonetim";

let listeners: Listener[] = [];
export type PushState = "unsupported" | "unconfigured" | "denied" | "registered" | "error";

export async function enablePush(onOpen: (path: string) => void): Promise<PushState> {
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

// Çıkışta bu telefon bildirim listesinden çıkarılır.
export async function disablePush() {
  const token = storage.get();
  if (!token) return;
  await post("/admin/devices/remove", { token }).catch(() => {});
  storage.set(null);
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
