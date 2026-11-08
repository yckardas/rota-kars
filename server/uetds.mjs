import { AppError } from "./store.mjs";
import { tours } from "./catalog.mjs";
import { tcknValid } from "./passenger-id.mjs";
// U-ETDS (Ulaştırma Elektronik Takip ve Denetim Sistemi) arızi yolcu bildirimi.
// Resmi servis: SOAP 1.1, "UdhbUetdsAriziService" (servis.turkiye.gov.tr). Kimlik
// hem HTTP Basic hem gövdedeki <wsuser> ile gönderilir. Akış:
//   seferEkle -> seferGrupEkle -> personelEkle -> yolcuEkleCoklu
// Sonradan gelen yolcu eklenir, iptal edilen yolcu yolcuIptal ile düşülür, araç
// değiştiyse seferPlakaDegistir çağrılır. sonucKodu 0 başarıdır.
// UETDS_USERNAME / UETDS_PASSWORD yoksa "kuru çalışma": istekler hazırlanır,
// gönderilmez; panel ne gönderileceğini gösterir.
const URLS = {
  test: "https://servis.turkiye.gov.tr/services/g2g/kdgm/test/uetdsarizi",
  prod: "https://servis.turkiye.gov.tr/services/g2g/kdgm/uetdsarizi",
};
const ACTION = "http://uetds.unetws.udhb.gov.tr/uetdsytsarizi/";
// Personel tür kodları (kılavuzla teyit edilmeli): 0 şoför, 5 rehber.
const DRIVER = 0,
  GUIDE = 5;
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
const xml = (tag, fields) =>
  `<${tag}>` +
  Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `<${k}>${esc(v)}</${k}>`)
    .join("") +
  `</${tag}>`;
const pick = (text, tag) =>
  text.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1] ?? null;
const pickAll = (text, tag) =>
  [...text.matchAll(new RegExp(`<${tag}>([^<]*)</${tag}>`, "g"))].map(
    (m) => m[1],
  );
// "Ayşe Nur Yılmaz" -> adi "Ayşe Nur", soyadi "Yılmaz"
export const splitName = (full) => {
  const parts = String(full).trim().split(/\s+/);
  return parts.length > 1
    ? { adi: parts.slice(0, -1).join(" "), soyadi: parts.at(-1) }
    : { adi: parts[0] || "", soyadi: parts[0] || "" };
};
const day = (ymd) => ymd + "T00:00:00";
export function createUetds(
  db,
  { env = process.env, fetchImpl = fetch, clock, departures, workflow, pii },
) {
  const user = env.UETDS_USERNAME,
    pass = env.UETDS_PASSWORD,
    mode = user && pass ? (env.UETDS_ENV === "prod" ? "prod" : "test") : "dry",
    startIl = Number(env.UETDS_START_IL || 36),
    startIlce = env.UETDS_START_ILCE ? Number(env.UETDS_START_ILCE) : null;
  const wsuser = () =>
    `<wsuser><kullaniciAdi>${esc(user || "KULLANICI")}</kullaniciAdi><sifre>${esc(mode === "dry" ? "****" : pass)}</sifre></wsuser>`;
  // Tek SOAP çağrısı; kuru çalışmada yalnız isteği kaydeder.
  async function call(op, inner, log) {
    const body =
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:uet="http://uetds.unetws.udhb.gov.tr/">` +
      `<soapenv:Header/><soapenv:Body><uet:${op}>${wsuser()}${inner}</uet:${op}></soapenv:Body></soapenv:Envelope>`;
    if (mode === "dry") {
      log.push({ op, dry: true, request: body });
      return { code: 0, message: "Kuru çalışma: gönderilmedi.", text: "" };
    }
    let text;
    try {
      const res = await fetchImpl(URLS[mode], {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: `"${ACTION}${op}"`,
          Authorization:
            "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
        },
        body,
        signal: AbortSignal.timeout(30000),
      });
      text = await res.text();
    } catch (e) {
      throw new AppError(502, `U-ETDS'e ulaşılamadı (${op}): ${e.message}`);
    }
    const fault = pick(text, "faultstring");
    if (fault) throw new AppError(502, `U-ETDS hatası (${op}): ${fault}`);
    const code = Number(pick(text, "sonucKodu")),
      message = pick(text, "sonucMesaji") || "";
    log.push({ op, code, message });
    if (code !== 0)
      throw new AppError(
        502,
        `U-ETDS reddetti (${op}): ${message || "kod " + code}`,
      );
    return { code, message, text };
  }
  const getState = async (id) =>
    (await db.one("uetds_reports", { _id: id })) || null;
  const saveState = async (id, patch) => {
    if (await getState(id))
      await db.update("uetds_reports", { _id: id }, patch);
    else await db.insert("uetds_reports", id, { departure_id: id, ...patch });
  };
  const crewView = (c) =>
    c && {
      name: c.name,
      phone: c.phone || "",
      gender: c.gender,
      nationality: c.nationality,
      idMasked: c.id_number ? "•••" + pii.open(c.id_number).slice(-4) : "",
    };
  const crewInput = (c) => {
    if (!c) return null;
    const idNumber = String(c.idNumber || "")
      .replace(/\s/g, "")
      .toUpperCase();
    if (c.nationality === "TR" && !tcknValid(idNumber))
      throw new AppError(
        400,
        `${c.name} için geçerli bir T.C. kimlik numarası girin.`,
      );
    return {
      name: c.name,
      phone: c.phone || "",
      gender: c.gender,
      nationality: c.nationality,
      id_number: pii.seal(idNumber),
    };
  };
  // Sefere binecek (onaylı) yolcular, koltuk başına.
  async function riders(d) {
    const list = await workflow.list({ date: d.date, all: true });
    return list
      .filter(
        (r) =>
          r.departure_id === d.id &&
          ["confirmed", "completed"].includes(r.status),
      )
      .flatMap((r) =>
        r.seats.map((seat, i) => ({
          seat: String(seat),
          reference: r.reference,
          name: r.passengers[i] || r.name,
          phone: i === 0 ? r.phone : "",
          detail: r.passenger_details?.[i] || null,
        })),
      );
  }
  return {
    mode,
    async status(id) {
      const d = await departures.get(id, {
          allowClosed: true,
          allowPast: true,
        }),
        s = await getState(id),
        all = await riders(d);
      return {
        mode,
        configured: mode !== "dry",
        startIlce: startIlce,
        plate: d.vehicle?.unit?.plate || null,
        driver: crewView(s?.driver),
        guide: crewView(s?.guide),
        ref: s?.ref || null,
        reportedAt: s?.reported_at || null,
        reported: Object.keys(s?.passengers || {}).length,
        riders: all.length,
        missingIds: all.filter((p) => !p.detail?.idNumber).map((p) => p.seat),
        log: s?.log || [],
      };
    },
    async saveCrew(id, { driver, guide }) {
      await departures.get(id, { allowClosed: true, allowPast: true });
      await saveState(id, {
        driver: crewInput(driver),
        guide: crewInput(guide),
      });
      return this.status(id);
    },
    // Bildirimi oluşturur ya da günceller (yeni yolcular eklenir, iptaller düşülür).
    async report(id) {
      const d = await departures.get(id, {
          allowClosed: true,
          allowPast: true,
        }),
        tour = tours.find((t) => t.id === d.tour_id),
        s = (await getState(id)) || {},
        log = [],
        plate = d.vehicle?.unit?.id;
      if (!plate)
        throw new AppError(
          409,
          "U-ETDS için sefere filodan bir araç atayın (plaka gerekir).",
        );
      if (!s.driver)
        throw new AppError(409, "U-ETDS için şoför bilgilerini girin.");
      // Kuru çalışmada ilçe kodu eksikse önizleme yer tutucuyla hazırlanır.
      if (!startIlce && mode !== "dry")
        throw new AppError(
          409,
          "UETDS_START_ILCE (Kars merkez ilçe kodu) ortam değişkeni tanımlanmalı.",
        );
      const all = await riders(d),
        missing = all.filter((p) => !p.detail?.idNumber);
      if (missing.length)
        throw new AppError(
          409,
          `Kimlik bilgisi eksik koltuklar: ${missing.map((p) => p.seat).join(", ")}.`,
        );
      let { ref, group_id: groupId } = s;
      const passengers = { ...(s.passengers || {}) };
      if (!ref) {
        const sefer = await call(
          "seferEkle",
          xml("ariziSeferBilgileriInput", {
            aracPlaka: plate,
            seferAciklama: `${tour?.name || d.tour_id} · Rota Kars Turizm`,
            hareketTarihi: day(d.date),
            hareketSaati: d.start_time,
            aracTelefonu: env.UETDS_VEHICLE_PHONE || "",
            firmaSeferNo: d.id.slice(0, 30),
            seferBitisTarihi: day(d.date),
            seferBitisSaati: tour?.end || "20:00",
          }),
          log,
        );
        ref =
          mode === "dry" ? "KURU" : pick(sefer.text, "uetdsSeferReferansNo");
        const grup = await call(
          "seferGrupEkle",
          `<uetdsSeferReferansNo>${esc(ref)}</uetdsSeferReferansNo>` +
            xml("seferGrupBilgileriInput", {
              grupAciklama: `${tour?.name || d.tour_id} ${d.date}`,
              baslangicUlke: "TR",
              baslangicIl: startIl,
              baslangicIlce: startIlce ?? "ILCE_KODU",
              baslangicYer: d.pickup,
              bitisUlke: "TR",
              bitisIl: startIl,
              bitisIlce: startIlce ?? "ILCE_KODU",
              bitisYer: d.pickup,
              grupAdi: tour?.name || d.tour_id,
              grupUcret: String(d.price / 100),
            }),
          log,
        );
        groupId = mode === "dry" ? "KURU" : pickAll(grup.text, "grupId").at(-1);
        const crew = [
          [DRIVER, s.driver],
          [GUIDE, s.guide],
        ].filter(([, c]) => c);
        await call(
          "personelEkle",
          `<uetdsSeferReferansNo>${esc(ref)}</uetdsSeferReferansNo>` +
            crew
              .map(([turKodu, c]) =>
                xml("seferPersonelBilgileriInput", {
                  turKodu,
                  uyrukUlke: c.nationality,
                  tcKimlikPasaportNo: pii.open(c.id_number),
                  cinsiyet: c.gender,
                  ...splitName(c.name),
                  telefon: c.phone,
                }),
              )
              .join(""),
          log,
        );
      } else if (s.plate && s.plate !== plate) {
        await call(
          "seferPlakaDegistir",
          `<uetdsSeferReferansNo>${esc(ref)}</uetdsSeferReferansNo><tasitPlakaNo>${esc(plate)}</tasitPlakaNo>`,
          log,
        );
      }
      // İptal edilen ya da koltuğu değişen yolcular düşülür.
      const current = new Map(all.map((p) => [p.seat, p]));
      let cancelled = 0;
      for (const [seat, p] of Object.entries(passengers)) {
        const now = current.get(seat);
        if (now && now.reference === p.reference) continue;
        await call(
          "yolcuIptal",
          `<uetdsSeferReferansNo>${esc(ref)}</uetdsSeferReferansNo>` +
            xml("iptalYolcu", {
              koltukNo: seat,
              yolcuTCKimlikPasaportNo: pii.open(p.id_number),
              iptalAciklama: "Rezervasyon iptal edildi",
            }),
          log,
        );
        delete passengers[seat];
        cancelled++;
      }
      const fresh = all.filter((p) => !passengers[p.seat]);
      if (fresh.length) {
        const res = await call(
          "yolcuEkleCoklu",
          `<uetdsSeferReferansNo>${esc(ref)}</uetdsSeferReferansNo>` +
            fresh
              .map((p) =>
                xml("yolcuBilgileri", {
                  uyrukUlke: p.detail.nationality,
                  tcKimlikPasaportNo: p.detail.idNumber,
                  cinsiyet: p.detail.gender,
                  ...splitName(p.name),
                  koltukNo: p.seat,
                  telefonNo: p.phone,
                  grupId: groupId,
                }),
              )
              .join(""),
          log,
        );
        const tickets =
          mode === "dry" ? [] : pickAll(res.text, "uetdsBiletRefNo");
        fresh.forEach((p, i) => {
          passengers[p.seat] = {
            reference: p.reference,
            id_number: pii.seal(p.detail.idNumber),
            ticket: tickets[i] || null,
          };
        });
      }
      const summary = {
        mode,
        ref,
        added: fresh.length,
        cancelled,
        total: all.length,
        log: log.map(({ request, ...rest }) => rest),
        preview:
          mode === "dry"
            ? log.map((l) => ({ op: l.op, request: l.request }))
            : undefined,
      };
      // Kuru çalışma hiçbir şey kaydetmez.
      if (mode !== "dry")
        await saveState(id, {
          ref,
          group_id: groupId,
          plate,
          passengers,
          reported_at: clock(),
          log: [
            ...(s.log || []),
            { at: clock(), added: fresh.length, cancelled },
          ].slice(-20),
        });
      return summary;
    },
    async pdf(id) {
      const s = await getState(id);
      if (!s?.ref)
        throw new AppError(409, "Bu sefer henüz U-ETDS'e bildirilmedi.");
      const res = await call(
        "seferDetayCiktisiAl",
        `<uetdsSeferReferansNo>${esc(s.ref)}</uetdsSeferReferansNo>`,
        [],
      );
      const b64 = pick(res.text, "sonucPdf");
      if (!b64) throw new AppError(502, "U-ETDS PDF döndürmedi.");
      return Buffer.from(b64, "base64");
    },
  };
}
