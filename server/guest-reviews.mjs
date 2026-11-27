// Tur sonrası site içi yorum: katılımcıya bir kez e-posta gider, kişiye özel bağlantıyla
// puan ve kısa yorum bırakılır. Yorumlar panelde onaylanınca tur sayfasında
// "Doğrulanmış katılımcı" etiketiyle, yalnız ad ve soyadın baş harfiyle görünür.
//
// Güvenlik ve KVKK:
// - Bağlantıdaki belirteç 32 bayt rastgeledir; veritabanında yalnız SHA-256 özeti tutulur
//   (hesap bağlantılarıyla aynı desen). Tek kullanımlıktır ve LINK_DAYS gün geçerlidir.
// - Her rezervasyona en çok bir istek gider: istek kaydının _id'si rezervasyon kimliğidir,
//   e-posta kuyruğunda da rezervasyona bağlı tekil anahtar kullanılır.
// - Yalnız tur bitişinden sonraki SEND_WINDOW_DAYS gün içinde istenir; eski turların
//   katılımcılarına toplu e-posta gitmez.
// - Listeden çıkan adres (özeti) bir daha yorum isteği almaz. E-posta tanıtım içermez.
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { AppError } from "./store.mjs";
import { tours } from "./catalog.mjs";
import { localDate } from "./departures.mjs";
import { siteBase } from "./seo.mjs";
import { en as catalogEn } from "./catalog-en.mjs";

const DAY = 86400000;
export const LINK_DAYS = 60;
export const SEND_WINDOW_DAYS = 7;
// İstanbul saatiyle bu saatten önce e-posta kuyruğa yazılmaz (gece yarısı gitmesin).
const SEND_HOUR = 10;
const digest = (s) => createHash("sha256").update(s).digest("hex");
const optOutId = (email) =>
  digest("rota-review-optout:" + String(email).trim().toLowerCase());
const TOKEN = /^[a-f0-9]{64}$/;
const tourOf = (id) => tours.find((t) => t.id === id);
const tourName = (id) => tourOf(id)?.name || id;

// "ayşe nur KAYA" → "Ayşe K." · tek kelime → "Ayşe". Soyadın tamamı hiçbir yerde gösterilmez.
export function displayName(full) {
  const parts = String(full || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "Misafirimiz";
  const cap = (w) =>
    w.charAt(0).toLocaleUpperCase("tr-TR") +
    w.slice(1).toLocaleLowerCase("tr-TR");
  const first = cap(parts[0]);
  return parts.length > 1
    ? `${first} ${parts.at(-1).charAt(0).toLocaleUpperCase("tr-TR")}.`
    : first;
}
const firstName = (full) => displayName(full).split(" ")[0];
// Çok günlük turda bitiş günü: "3 gün · 2 gece" → hareketten 2 gün sonra.
export function tourEndDate(date, tour) {
  const days =
    Number(/(\d+)\s*gün/i.exec(String(tour?.duration || ""))?.[1]) || 1;
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.max(0, days - 1));
  return d.toISOString().slice(0, 10);
}
const istanbulHour = (now) =>
  Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(now)),
  );
const trDate = (ymd) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
const enDate = (ymd) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export async function createGuestReviews(
  db,
  { clock, tx, notifications, privacy = null, env = {} },
) {
  await Promise.all([
    db.index("guest_review_requests", { token_hash: 1 }, { unique: true }),
    db.index("guest_reviews", { tour_id: 1, status: 1, created_at: -1 }),
    db.index("guest_reviews", { reservation_id: 1 }),
  ]);
  const enabled = env.REVIEW_REQUESTS !== "0";
  const mapsUrl = () => {
    try {
      const u = new URL(env.GOOGLE_MAPS_URL || "");
      if (u.protocol === "https:") return u.href;
    } catch {
      // Tanımsız ya da geçersizse katalogdaki işletme bağlantısı kullanılır.
    }
    return null;
  };
  let lastRun = 0;
  async function requestRow(token) {
    if (!TOKEN.test(token || "")) throw new AppError(404, "Bağlantı geçersiz.");
    const row = await db.one("guest_review_requests", {
      token_hash: digest(token),
    });
    if (!row) throw new AppError(404, "Bağlantı geçersiz.");
    return row;
  }
  const api = {
    enabled,
    // Arka plan işi (index.mjs, 30 sn'de bir çağrılır; en çok 10 dakikada bir çalışır).
    async sendRequests({ force = false } = {}) {
      const now = clock();
      if (!enabled) return { skipped: "disabled" };
      if (!force && now - lastRun < 10 * 60000) return { skipped: "throttled" };
      lastRun = now;
      if (istanbulHour(now) < SEND_HOUR) return { skipped: "early" };
      const today = localDate(now),
        oldestEnd = localDate(now - SEND_WINDOW_DAYS * DAY);
      // En uzun tur 15 gün sayılır; pencereye girebilecek hareket tarihleri.
      const departures = (
        await db.find("departures", {
          date: {
            $gte: localDate(now - (SEND_WINDOW_DAYS + 15) * DAY),
            $lt: today,
          },
        })
      ).filter((d) => {
        const end = tourEndDate(d.date, tourOf(d.tour_id));
        return end < today && end >= oldestEnd;
      });
      if (!departures.length) return { queued: 0 };
      const byId = new Map(departures.map((d) => [d.id, d]));
      const reservations = await db.find("reservations", {
        departure_id: { $in: [...byId.keys()] },
        status: { $in: ["confirmed", "completed"] },
        anonymized_at: { $exists: false },
      });
      // Seferde yoklama (QR okutma) yapıldıysa yalnız okutulanlar gelmiş sayılır.
      const checkedDepartures = new Set(
        reservations.filter((r) => r.checked_in_at).map((r) => r.departure_id),
      );
      // E-posta bağlantısı istek dışında üretilir: yapılandırılmış adres, yoksa yerel sunucu.
      const base = siteBase(env, {
        protocol: "http",
        headers: { host: "127.0.0.1:" + (env.PORT || 5173) },
      });
      let queued = 0;
      for (const r of reservations) {
        if (!r.email || r.cancellation_requested_at) continue;
        if (checkedDepartures.has(r.departure_id) && !r.checked_in_at) continue;
        if (await db.one("guest_review_requests", { _id: r.id })) continue;
        if (await db.one("review_optouts", { _id: optOutId(r.email) }))
          continue;
        const d = byId.get(r.departure_id),
          token = randomBytes(32).toString("hex");
        // Tekil _id: yarışta ya da yeniden denemede ikinci istek oluşmaz.
        const created = await db.insertIfAbsent("guest_review_requests", r.id, {
          reservation_id: r.id,
          token_hash: digest(token),
          email: r.email,
          tour_id: d.tour_id,
          departure_date: d.date,
          created_at: now,
          expires_at: now + LINK_DAYS * DAY,
          used_at: null,
        });
        if (!created) continue;
        const name = firstName(r.name),
          tr = tourName(d.tour_id),
          en = catalogEn.tours?.[d.tour_id]?.name || tr;
        await notifications.enqueue({
          email: r.email,
          subject: `Rota Kars · ${tr} turunuz nasıl geçti? / How was your tour?`,
          body: [
            `Merhaba ${name},`,
            `${trDate(d.date)} tarihli ${tr} turumuza katıldığınız için teşekkür ederiz. Bir dakikanızı ayırıp deneyiminizi puanlarsanız çok seviniriz. Yorumunuz acentemiz onayladıktan sonra tur sayfamızda yalnız adınız ve soyadınızın baş harfiyle, "Doğrulanmış katılımcı" etiketiyle yayımlanır.`,
            `Bağlantı size özeldir, tek kullanımlıktır ve ${LINK_DAYS} gün geçerlidir. Bu tür e-postaları almak istemiyorsanız aynı sayfanın altından listeden çıkabilirsiniz.`,
            "—",
            `Hello ${name},`,
            `Thank you for joining our ${en} tour on ${enDate(d.date)}. We would love it if you could take a minute to rate your experience. Once approved by our agency, your review appears on the tour page with your first name and last initial only, marked "Verified guest".`,
            `This link is personal, single-use and valid for ${LINK_DAYS} days. To stop these emails, use the option at the bottom of the same page.`,
          ].join("\n\n"),
          actionUrl: `${base}/yorum/${token}`,
          kind: "review_request",
          dedupeKey: "review_request:" + r.id,
        });
        queued++;
      }
      return { queued };
    },
    // Yorum sayfası: yalnız ad, tur ve tarih döner (e-posta, telefon, soyad dönmez).
    async request(token) {
      const row = await requestRow(token);
      const reservation = await db.one("reservations", {
        _id: row.reservation_id,
      });
      const state = row.used_at
        ? "used"
        : row.expires_at <= clock() || !reservation || reservation.anonymized_at
          ? "expired"
          : "open";
      return {
        state,
        tourId: row.tour_id,
        tourName: tourName(row.tour_id),
        date: row.departure_date,
        firstName: state === "open" ? firstName(reservation.name) : "",
        displayName: state === "open" ? displayName(reservation.name) : "",
        optedOut: Boolean(
          await db.one("review_optouts", { _id: optOutId(row.email) }),
        ),
        googleUrl: mapsUrl(),
      };
    },
    submit(token, { rating, text = "" }) {
      return tx(async () => {
        const row = await requestRow(token);
        if (row.used_at)
          throw new AppError(
            410,
            "Bu bağlantıyla yorum zaten gönderildi. Teşekkür ederiz.",
          );
        const reservation = await db.one("reservations", {
          _id: row.reservation_id,
        });
        if (
          row.expires_at <= clock() ||
          !reservation ||
          reservation.anonymized_at
        )
          throw new AppError(410, "Bu bağlantının süresi doldu.");
        // Tek kullanım: belirteç önce kapatılır; eşzamanlı ikinci gönderim burada düşer.
        const closed = await db.update(
          "guest_review_requests",
          { _id: row.reservation_id, used_at: null },
          { used_at: clock() },
        );
        if (!closed)
          throw new AppError(
            410,
            "Bu bağlantıyla yorum zaten gönderildi. Teşekkür ederiz.",
          );
        const id = randomUUID(),
          name = displayName(reservation.name);
        await db.insert("guest_reviews", id, {
          id,
          reservation_id: reservation.id,
          tour_id: row.tour_id,
          departure_date: row.departure_date,
          name,
          rating,
          text,
          status: "pending",
          created_at: clock(),
        });
        await privacy?.recordConsent({
          email: reservation.email,
          memberId: reservation.member_id || null,
          type: "review_publish",
          source: "guest_review",
        });
        await notifications.notifyAgency({
          subject: `Yeni katılımcı yorumu onay bekliyor ${"★".repeat(rating)} · ${name}`,
          body: [
            "Tur sonrası site yorumu (onay bekliyor)",
            `${tourName(row.tour_id)} · ${row.departure_date} · ${reservation.reference}`,
            `${name} · ${rating}/5`,
            text ? text.slice(0, 400) : "(Yalnız puan)",
          ].join("\n"),
          kind: "guest_review",
          pushUrl: "/yonetim?sekme=reviews",
          dedupeKey: "guest-review:" + id,
        });
        return { ok: true, status: "pending", googleUrl: mapsUrl() };
      });
    },
    // Listeden çık: adresin özeti saklanır, bu adrese bir daha yorum isteği gitmez.
    async optOut(token) {
      const row = await requestRow(token);
      await db.insertIfAbsent("review_optouts", optOutId(row.email), {
        created_at: clock(),
      });
      await db.updateMany(
        "notification_outbox",
        { recipient: row.email, kind: "review_request", status: "queued" },
        { status: "cancelled", cancelled_at: clock() },
      );
      return { ok: true };
    },
    async adminList() {
      const rows = await db.find(
        "guest_reviews",
        {},
        { sort: { created_at: -1 }, limit: 300 },
      );
      const refs = new Map(
        (
          await db.find(
            "reservations",
            { _id: { $in: rows.map((r) => r.reservation_id) } },
            { projection: { reference: 1, id: 1 } },
          )
        ).map((r) => [r.id, r.reference]),
      );
      const order = { pending: 0, approved: 1, rejected: 2 };
      return rows
        .map((r) => ({
          id: r.id,
          tourId: r.tour_id,
          tourName: tourName(r.tour_id),
          date: r.departure_date,
          reference: refs.get(r.reservation_id) || "",
          name: r.name,
          rating: r.rating,
          text: r.text,
          status: r.status,
          createdAt: r.created_at,
        }))
        .sort(
          (a, b) =>
            order[a.status] - order[b.status] || b.createdAt - a.createdAt,
        );
    },
    async moderate(id, status) {
      const n = await db.update(
        "guest_reviews",
        { _id: id },
        {
          status,
          moderated_at: clock(),
          ...(status === "approved" ? { approved_at: clock() } : {}),
        },
      );
      if (!n) throw new AppError(404, "Yorum bulunamadı.");
      return { ok: true };
    },
    async remove(id) {
      if (!(await db.remove("guest_reviews", { _id: id })))
        throw new AppError(404, "Yorum bulunamadı.");
      return { ok: true };
    },
    // Tur sayfası: yalnız onaylı yorumlar; ad + soyadın baş harfi, puan, metin, ay.
    async forTour(tourId) {
      return (
        await db.find(
          "guest_reviews",
          { tour_id: tourId, status: "approved" },
          { sort: { created_at: -1 }, limit: 50 },
        )
      ).map((r) => ({
        id: r.id,
        name: r.name,
        rating: r.rating,
        text: r.text,
        date: r.departure_date,
      }));
    },
  };
  return api;
}
