// İlgi listesi: iki tür kayıt, ikisinde de koltuk tutulmaz ve ödeme alınmaz.
//  - "waitlist": dolu sefer için "yer açılınca haber ver". Yer açılınca (iptal, süresi
//    dolan ön rezervasyon, araç büyütme) o seferi bekleyen herkese aynı anda e-posta
//    gider; ilk rezervasyon yapan alır.
//  - "prereg": talep toplama modundaki tur için ücretsiz ön kayıt (ör. Tiflis). Ön kayıt
//    eşiğe ulaşınca acente panelden satışı açar; ön kayıtlılara rezervasyon bağlantısı gider.
import { randomBytes, randomUUID } from "node:crypto";
import { tours } from "./catalog.mjs";
import { AppError } from "./store.mjs";
import { localDate } from "./departures.mjs";

export const INTEREST_STATUS = {
  waiting: "Bekliyor",
  notified: "Haber verildi",
  converted: "Rezervasyon yaptı",
  cancelled: "Vazgeçti",
};
const tourName = (id) => tours.find((t) => t.id === id)?.name || id;

export async function createInterest(db, { clock, tx, departures, operations, notifications, env = {} }) {
  await Promise.all([
    db.index("interest_list", { tour_id: 1, kind: 1, status: 1 }),
    db.index("interest_list", { departure_id: 1, status: 1 }),
    db.index("interest_list", { email: 1 }),
    db.index("interest_list", { token: 1 }, { unique: true }),
  ]);
  const base = () => env.PUBLIC_BASE_URL || "";
  // Rezervasyon sayfası ?date= ile o günün seferini seçili açar.
  const bookingUrl = (tourId, date) => base() + "/rezervasyon/" + tourId + (date ? "?date=" + date : "");
  const cancelUrl = (row) => base() + "/api/interest/" + row.token + "/cancel";

  const api = {
    // Siteden gelen kayıt. Aynı e-posta aynı sefer/tur için bekliyorsa yeni kayıt
    // açılmaz; kişi sayısı ve not güncellenir.
    async add(input) {
      return tx(async () => {
        const ops = await operations.get(input.tourId);
        let departure = null;
        if (input.kind === "waitlist") {
          if (!input.departureId) throw new AppError(400, "Bekleme listesi için bir sefer seçin.");
          departure = await departures.get(input.departureId, { allowClosed: true });
          if (departure.tour_id !== input.tourId) throw new AppError(400, "Sefer bu tura ait değil.");
          if (departure.departed) throw new AppError(409, "Bu seferin satışı kapandı.");
          const listed = (await departures.list({ tourId: input.tourId, date: departure.date })).find(
            (d) => d.id === departure.id,
          );
          if (listed?.salesOpen && listed.available >= input.count)
            throw new AppError(409, "Bu seferde yer var; hemen rezervasyon yapabilirsiniz.");
        } else if (ops.mode !== "demand")
          throw new AppError(409, "Bu tur için ön kayıt değil, doğrudan rezervasyon alınıyor.");
        const email = input.email.toLowerCase();
        const existing = await db.one("interest_list", {
          email,
          tour_id: input.tourId,
          kind: input.kind,
          status: "waiting",
          ...(departure ? { departure_id: departure.id } : {}),
        });
        const fields = {
          name: input.name,
          phone: input.phone,
          count: input.count,
          preferred_date: input.preferredDate || "",
          notes: input.notes || "",
          updated_at: clock(),
        };
        let row;
        if (existing) {
          await db.update("interest_list", { _id: existing.id }, fields);
          row = { ...existing, ...fields };
        } else {
          const id = randomUUID();
          row = {
            id,
            kind: input.kind,
            tour_id: input.tourId,
            departure_id: departure?.id || null,
            departure_date: departure?.date || null,
            email,
            ...fields,
            status: "waiting",
            token: randomBytes(18).toString("hex"),
            created_at: clock(),
            notified_at: null,
          };
          await db.insert("interest_list", id, row);
        }
        const reference = "BK-" + row.id.slice(0, 8).toUpperCase();
        const what =
          input.kind === "waitlist"
            ? `${tourName(input.tourId)} · ${departure.date} ${departure.start_time} seferi için bekleme listesine`
            : `${tourName(input.tourId)} için ön kayda`;
        if (!existing) {
          await notifications.enqueue({
            email,
            subject:
              input.kind === "waitlist"
                ? `Rota Kars · Bekleme listesindesiniz (${reference})`
                : `Rota Kars · Ön kaydınız alındı (${reference})`,
            body:
              `Merhaba ${input.name},\n${what} ${input.count} kişi olarak eklendiniz. Referans: ${reference}\n\n` +
              (input.kind === "waitlist"
                ? "Bu seferde yer açılınca size hemen e-posta göndereceğiz. Yer, ilk rezervasyonu tamamlayana ayrılır; koltuk tutulmaz ve ödeme alınmaz."
                : "Bu ücretsiz bir ön kayıttır; ödeme alınmaz. Yeterli talep oluşunca tur kesinleşir, tarihleri ve rezervasyon bağlantısını size e-postayla göndeririz.") +
              `\n\nArtık ilgilenmiyorsanız listeden çıkmak için: ${cancelUrl(row)}`,
            kind: "interest_" + input.kind,
            dedupeKey: "interest:" + row.id,
          });
          await notifications.notifyAgency({
            subject: `${input.kind === "waitlist" ? "Bekleme listesi" : "Ön kayıt"}: ${tourName(input.tourId)} · ${input.count} kişi`,
            body: [
              input.kind === "waitlist" ? "Dolu sefer için bekleme listesi" : "Talep toplama · ön kayıt",
              `${reference} · ${tourName(input.tourId)}${departure ? ` · ${departure.date} ${departure.start_time}` : ""}`,
              `Kişi: ${input.count}${input.preferredDate ? ` · Tercih: ${input.preferredDate}` : ""}`,
              `Müşteri: ${input.name} · ${input.phone} · ${email}`,
              input.notes && `Not: ${input.notes}`,
            ]
              .filter(Boolean)
              .join("\n"),
            actionUrl: base() + "/yonetim?sekme=interest",
            pushUrl: "/yonetim?sekme=interest",
            kind: "interest_" + input.kind,
            dedupeKey: "interest:" + row.id,
          });
        }
        return { reference, status: "waiting", updated: Boolean(existing) };
      });
    },
    // Talep toplama özeti (site ve panel): bekleyen ön kayıtların toplam kişi sayısı.
    async demandCount(tourId) {
      const rows = await db.find("interest_list", { tour_id: tourId, kind: "prereg", status: { $in: ["waiting", "notified"] } });
      return rows.reduce((n, r) => n + (Number(r.count) || 0), 0);
    },
    async list({ tourId } = {}) {
      return db.find("interest_list", tourId ? { tour_id: tourId } : {}, { sort: { created_at: -1 }, limit: 500 });
    },
    async setStatus(id, status) {
      const row = await db.one("interest_list", { _id: id });
      if (!row) throw new AppError(404, "Kayıt bulunamadı.");
      await db.update("interest_list", { _id: id }, { status, updated_at: clock() });
      return { ...row, status };
    },
    // E-postadaki bağlantıyla müşteri listeden çıkar.
    async cancelByToken(token) {
      const row = await db.one("interest_list", { token });
      if (!row) throw new AppError(404, "Kayıt bulunamadı.");
      if (row.status === "waiting" || row.status === "notified")
        await db.update("interest_list", { _id: row.id }, { status: "cancelled", updated_at: clock() });
      return { tourName: tourName(row.tour_id) };
    },
    // Panel: talep toplamayı bitir, online satışı aç ve bekleyen ön kayıtlılara haber ver.
    async openSales(tourId) {
      const ops = await operations.get(tourId);
      const open = await departures.list({ tourId });
      const upcoming = open.filter((d) => d.active && d.date >= localDate(clock()));
      if (!upcoming.length)
        throw new AppError(409, "Satışı açmadan önce bu tur için en az bir sefer oluşturun.");
      await operations.setMode(tourId, {
        mode: "online",
        threshold: ops.demand.threshold,
        showProgress: ops.demand.showProgress,
      });
      const waiting = await db.find("interest_list", { tour_id: tourId, kind: "prereg", status: "waiting" });
      const dates = upcoming
        .slice(0, 6)
        .map((d) => `${d.date} ${d.start_time}`)
        .join(", ");
      for (const row of waiting) {
        await notifications.enqueue({
          email: row.email,
          subject: `Rota Kars · ${tourName(tourId)} kesinleşti, rezervasyon açıldı`,
          body:
            `Merhaba ${row.name},\nÖn kayıt bıraktığınız ${tourName(tourId)} için yeterli talep oluştu ve rezervasyon açıldı.\n` +
            `Tarihler: ${dates}\nÖn kaydınız: ${row.count} kişi. Koltuklar ilk rezervasyon yapana ayrılır.`,
          actionUrl: bookingUrl(tourId),
          kind: "interest_open",
          dedupeKey: "interest-open:" + row.id,
        });
        await db.update("interest_list", { _id: row.id }, { status: "notified", notified_at: clock() });
      }
      return { notified: waiting.length };
    },
    // Arka plan işi (dakikada bir): yer açılan seferin bekleme listesine haber verir.
    async notifyOpenings() {
      const waiting = await db.find("interest_list", { kind: "waitlist", status: "waiting" });
      if (!waiting.length) return { notified: 0 };
      let notified = 0;
      const byDeparture = new Map();
      for (const row of waiting) byDeparture.set(row.departure_id, [...(byDeparture.get(row.departure_id) || []), row]);
      for (const [departureId, rows] of byDeparture) {
        let d;
        try {
          d = await departures.get(departureId, { allowClosed: true });
        } catch {
          continue;
        }
        const listed = (await departures.list({ tourId: d.tour_id, date: d.date })).find((x) => x.id === d.id);
        if (!listed?.salesOpen || listed.departed) continue;
        for (const row of rows) {
          if (listed.available < row.count) continue;
          await notifications.enqueue({
            email: row.email,
            subject: `Rota Kars · ${tourName(d.tour_id)} seferinde yer açıldı`,
            body:
              `Merhaba ${row.name},\nBeklediğiniz ${tourName(d.tour_id)} · ${d.date} ${d.start_time} seferinde şu an ${listed.available} koltuk boş.\n` +
              `Yer, ilk rezervasyonu tamamlayana ayrılır; bu seferi bekleyen herkese aynı anda haber verdik.`,
            actionUrl: bookingUrl(d.tour_id, d.date),
            kind: "interest_opening",
            dedupeKey: `interest-opening:${row.id}:${row.updated_at || row.created_at}`,
          });
          await db.update("interest_list", { _id: row.id }, { status: "notified", notified_at: clock() });
          notified++;
        }
      }
      return { notified };
    },
  };
  return api;
}
