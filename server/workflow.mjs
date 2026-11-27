import { normalizeTransfer, tierFor, transferLine } from "./transfer.mjs";
import { randomBytes, randomUUID } from "node:crypto";
import { AppError } from "./store.mjs";
import { fromJson } from "./database.mjs";
import { DEPOSIT_PERCENT, depositFor } from "./payments.mjs";
import { localDate } from "./departures.mjs";
import { tours, business } from "./catalog.mjs";
import { LEGAL_VERSION, cancellationQuote, contractText, legalDataFromReservation, preInfoText } from "./legal.mjs";
import { countryName } from "./passenger-id.mjs";
import { buildFinance, tourRows } from "./finance.mjs";
const longExpiry = (now) => now + 365 * 86400000;
const MANUAL_METHODS = ["cash", "bank_transfer", "pos"];
const tl = (kurus) => (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 });
export async function createWorkflow(
  db,
  { clock, tx, departures, members, notifications, env, cleanup, pii, operations },
) {
  await Promise.all([
    db.index(
      "payment_ledger",
      { method: 1, external_reference: 1, kind: 1 },
      { unique: true },
    ),
    db.index("payment_ledger", { reservation_id: 1, created_at: 1 }),
    db.index("reservation_audit", { reservation_id: 1, created_at: 1 }),
  ]);
  const parse = async (r) => {
    if (!r) throw new AppError(404, "Rezervasyon bulunamadı.");
    const d = await departures.get(r.departure_id, {
        allowClosed: true,
        allowPast: true,
      }),
      ledger = await db.find(
        "payment_ledger",
        { reservation_id: r.id },
        { sort: { created_at: 1, id: 1 } },
      ),
      paid = ledger
        .filter((p) => p.kind === "payment")
        .reduce((n, p) => n + Number(p.amount), 0),
      refunded = ledger
        .filter((p) => p.kind === "refund")
        .reduce((n, p) => n + Number(p.amount), 0),
      net = paid - refunded;
    return {
      ...r,
      seats: fromJson(r.seats, []),
      passengers: fromJson(r.passengers, []),
      passenger_details: pii
        ? pii.openDetails(fromJson(r.passenger_details, []))
        : fromJson(r.passenger_details, []),
      vehicle: fromJson(r.vehicle_json, null) || d.vehicle,
      date: d.date,
      tourId: d.tour_id,
      start_time: d.start_time,
      pickup: d.pickup,
      guide_name: d.guide_name,
      guide_phone: d.guide_phone,
      paid_total: paid,
      refunded_total: refunded,
      net_paid: net,
      balance_due: ["cancelled", "expired"].includes(r.status)
        ? 0
        : Math.max(0, r.total - net),
      payment_state:
        refunded && net === 0
          ? "refunded"
          : net >= r.total
            ? "paid"
            : net > 0
              ? "partial"
              : "unpaid",
      ledger,
    };
  };
  const audit = async (r, event, details) => {
    const id = randomUUID();
    await db.insert("reservation_audit", id, {
      id,
      reservation_id: r.id,
      event,
      details,
      created_at: clock(),
    });
  };
  // Telefonla alınan kayıtlarda e-posta olmayabilir: o zaman müşteriye e-posta gitmez.
  // ticket: true → mail kısa bilet kartı olarak gider (onay/ön rezervasyon);
  // documents: [{ title, filename, text }] PDF eki olur, gövdeye yazılmaz.
  // extra: konu satırına girmeyen ayrıntı; gövdede başlığın altına yazılır.
  const notify = async (
    r,
    event,
    text,
    dedupeKey = event + ":" + r.reference,
    { ticket = false, documents = null, extra = "" } = {},
  ) =>
    r.email &&
    notifications.enqueue({
      email: r.email,
      subject: "Rota Kars · " + text,
      body:
        `Merhaba ${r.name},\n${r.reference} · ${tourName(r)}\nTarih: ${r.date} · Saat: ${r.start_time}\nBuluşma: ${r.pickup}\n${text}\n${extra ? extra + "\n" : ""}Koltuklar: ${r.seats.join(", ")}.` +
        (r.transfer ? `\n${transferLine(r.transfer)}.` : "") +
        (documents?.length ? `\nEkler: ${documents.map((d) => d.title).join(", ")} (PDF).` : ""),
      actionUrl: (env.PUBLIC_BASE_URL || "") + "/bilet/" + r.ticket_token,
      kind: event,
      dedupeKey,
      ticket: ticket
        ? {
            headline: text,
            name: r.name,
            tour: tourName(r),
            date: r.date,
            time: r.start_time,
            pickup: r.pickup,
            seats: r.seats,
            reference: r.reference,
            transfer: r.transfer ? transferLine(r.transfer) : null,
            total: r.total,
            paid: r.net_paid || 0,
            balance: r.balance_due ?? r.total,
            status: r.status === "confirmed" ? "confirmed" : "pending",
          }
        : null,
      documents: documents?.length ? documents : null,
    });
  const legalDoc = (kind, r, text) =>
    text && {
      title: kind === "contract" ? "Tur Hizmet Sözleşmesi" : "Ön Bilgilendirme Formu",
      filename: `${kind === "contract" ? "Tur-Hizmet-Sozlesmesi" : "On-Bilgilendirme-Formu"}-${r.reference}.pdf`,
      text,
    };
  const tourName = (r) => tours.find((t) => t.id === r.tourId)?.name || r.tourId;
  const waLink = (phone) => {
    const digits = String(phone || "").replace(/\D/g, "");
    const intl = digits.startsWith("90") ? digits : digits.replace(/^0/, "90");
    return intl.length >= 11 ? `https://wa.me/${intl}` : "";
  };
  const agencyAlert = (r, kind, title) =>
    notifications.notifyAgency({
      subject: `${title}: ${r.reference} · ${tourName(r)} · ${r.date}`,
      body: [
        `${title}`,
        `${r.reference} · ${tourName(r)}`,
        `Tarih: ${r.date} ${r.start_time} · Koltuk: ${r.seats.join(", ")}`,
        `Müşteri: ${r.name} · ${r.phone} · ${r.email}`,
        `Tutar: ${(r.total / 100).toFixed(2)} TL · Durum: ${r.status}`,
        r.transfer && `${transferLine(r.transfer)} · ${(r.transfer.amount / 100).toFixed(2)} TL`,
        waLink(r.phone) && `WhatsApp: ${waLink(r.phone)}`,
      ]
        .filter(Boolean)
        .join("\n"),
      actionUrl: (env.PUBLIC_BASE_URL || "") + "/yonetim?sekme=reservations&ref=" + r.reference,
      pushUrl: "/yonetim?sekme=reservations&ref=" + r.reference,
      kind,
      dedupeKey: kind + ":" + r.reference,
    });
  // Yolcu çıkarma (kısmi iptal) hesabı. Kişi başı bedel kayıttaki sözleşme fiyatıdır (tur
  // fiyatı sonradan değişmiş olsa da). Yüzde kuponu kalan yolculara yeniden uygulanır, TL
  // kuponu kalan bedeli aşmayacak şekilde korunur. Transfer grup fiyatıdır: kişi kademesi
  // değişirse turun güncel tablosundan yeniden fiyatlanır ama eski tutarı aşmaz; fiyat
  // yoksa aynen kalır. Müşteri isteğinde kesintisiz iptal süresi geçtiyse çıkan yolcuların
  // payının kaporası (tam iptaldeki gibi en çok net tahsilat kadar) kesinti olarak toplamda
  // kalır; acente kararıyla (waive) kesinti yapılmaz.
  const removalPlan = async (r, seats, { waive = false } = {}) => {
    if (!["pending_agency", "confirmed"].includes(r.status))
      throw new AppError(409, "Bu kayıttan yolcu çıkarılamaz.");
    const removed = [...new Set(seats)];
    if (!removed.length || removed.length !== seats.length || removed.some((n) => !r.seats.includes(n)))
      throw new AppError(400, "Çıkarılacak yolcuları rezervasyondaki koltuklardan seçin.");
    if (removed.length >= r.seats.length)
      throw new AppError(400, "Bütün yolcular çıkarılamaz; rezervasyonun tamamı için İptal'i kullanın.");
    const keep = r.seats.map((_, i) => i).filter((i) => !removed.includes(r.seats[i])),
      count = r.seats.length,
      oldTransfer = r.transfer_amount || 0,
      kept = r.discount_amount || 0,
      oldFee = r.cancellation_fee || 0,
      oldSubtotal = r.subtotal ?? r.total - oldTransfer + kept - oldFee,
      subtotal = Math.round((oldSubtotal * keep.length) / count),
      discount = r.discount_percent
        ? Math.min(kept, Math.round((subtotal * r.discount_percent) / 100))
        : Math.min(kept, subtotal);
    let transfer = r.transfer || null;
    const tier = transfer && tierFor(keep.length);
    if (tier && tier.id !== transfer.tier) {
      const config = normalizeTransfer((await operations?.get(r.tourId))?.transfer),
        table = transfer.direction === "both" ? "roundTrip" : "oneWay",
        price = config.enabled ? config[table]?.[transfer.destination || "kars"]?.[transfer.point]?.[tier.id] : null;
      if (price)
        transfer = { ...transfer, tier: tier.id, tierLabel: tier.label, amount: Math.min(price, transfer.amount) };
    }
    const base = subtotal - discount + (transfer?.amount || 0),
      share = r.total - oldFee - base,
      q = cancellationQuote({
        tour: tours.find((t) => t.id === r.tourId),
        date: r.date,
        startTime: r.start_time,
        total: share,
        netPaid: r.net_paid,
        now: clock(),
        depositPercent: DEPOSIT_PERCENT,
      }),
      fee = waive ? 0 : q.customer.retained,
      total = base + oldFee + fee;
    return {
      seats: removed,
      names: removed.map((n) => r.passengers[r.seats.indexOf(n)]),
      keep,
      subtotal,
      discount,
      transfer,
      share,
      late: q.late,
      freeUntil: q.freeUntil,
      fee,
      total,
      // Turda ödenecek kayıt kapora istemez; tam ödeme tam, kapora %30 kalır.
      deposit: r.payment_mode === "on_tour" ? 0 : r.deposit === r.total ? total : depositFor(total),
      // Yeni bedeli aşan tahsilat iade edilebilir.
      refund: Math.max(0, r.net_paid - total),
    };
  };
  const api = {
    async get(reference, { fresh = true } = {}) {
      if (fresh) await cleanup();
      return parse(
        await db.one("reservations", { reference: reference.toUpperCase() }),
      );
    },
    // Panel listesi: tur günü, durum ve serbest arama (referans, ad, telefon, e-posta).
    // from/to: tur tarihi aralığı (iki uç dahil); date tek gün içindir.
    async list({ date, from, to, all = false, status, q, flag } = {}) {
      await cleanup();
      const dateFilter = date ? { date } : from || to ? { date: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } } : null;
      const filter = dateFilter
        ? {
            departure_id: {
              $in: (
                await db.find("departures", dateFilter, { projection: { id: 1 } })
              ).map((d) => d.id),
            },
          }
        : {};
      if (status) filter.status = status;
      // Hızlı filtreler: iptal talebi bekleyenler ve bakiyesi kalan aktif kayıtlar.
      if (flag === "cancel_request")
        Object.assign(filter, {
          cancellation_requested_at: { $exists: true, $ne: null },
          status: { $in: ["pending_agency", "confirmed"] },
        });
      if (flag === "balance") filter.status = { $in: ["pending_agency", "confirmed"] };
      const text = String(q || "").trim().slice(0, 80);
      if (text) {
        const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const digits = text.replace(/\D/g, "");
        const or = [
          { reference: { $regex: escaped, $options: "i" } },
          { name: { $regex: escaped, $options: "i" } },
          { email: { $regex: escaped, $options: "i" } },
          { passengers: { $regex: escaped, $options: "i" } },
        ];
        // Telefon farklı yazılmış olabilir (0555 111 22 33 / 5551112233): son hanelerle eşleşir.
        if (digits.length >= 4)
          or.push({ phone: { $regex: digits.slice(-10).split("").join("\\D*"), $options: "i" } });
        filter.$or = or;
      }
      const rows = await db.find("reservations", filter, {
        sort: { created_at: -1 },
        ...(all ? {} : { limit: 500 }),
        projection: { reference: 1 },
      });
      const list = await Promise.all(
        rows.map((r) => api.get(r.reference, { fresh: false })),
      );
      return flag === "balance" ? list.filter((r) => r.balance_due > 0) : list;
    },
    // legal: siteden gelen kayıtta müşterinin onayladığı ön bilgilendirme formu
    // ({ onlinePayment, depositPercent, othersDeclared }). Metin onay anındaki
    // hâliyle kayda yazılır ve e-postaya eklenir.
    async created(reference, { byAgency = false, legal = null, notifyCustomer = true } = {}) {
      let r = await api.get(reference);
      let extra = "";
      if (legal) {
        const tour = tours.find((t) => t.id === r.tourId);
        extra = preInfoText(legalDataFromReservation(r, tour, legal));
        await db.update(
          "reservations",
          { _id: r.id },
          {
            legal_version: LEGAL_VERSION,
            pre_info_accepted_at: r.created_at,
            pre_info_text: extra,
            // Rezervasyon adımında ayrı ayrı işaretlenen onay kutuları.
            booking_consents: {
              pre_info: r.created_at,
              service_contract: r.created_at,
              cancellation_terms: r.created_at,
              kvkk_notice: r.created_at,
            },
            others_declared: Boolean(legal.othersDeclared),
          },
        );
        r = await api.get(reference, { fresh: false });
      }
      if (notifyCustomer) await notify(
        r,
        "reservation_created",
        "Ön rezervasyon talebiniz alındı; henüz kesin bilet veya ödeme değildir.",
        undefined,
        { ticket: true, documents: [legalDoc("pre_info", r, extra)].filter(Boolean) },
      );
      // Acentenin kendi eklediği kayıt için ekibe "yeni rezervasyon" bildirimi gitmez.
      if (!byAgency) await agencyAlert(r, "reservation_created", "Yeni ön rezervasyon");
      return r;
    },
    // via: "online" (kartla ödeme sonrası otomatik) | "agency" (panelden onay).
    // belowDeposit: acente, tahsilat kaporanın altındayken uyarıyı görüp yine de onaylar.
    // Yalnız panel onayında geçerlidir; istisna denetim kaydına tutarlarıyla yazılır.
    async confirm(reference, { via = "agency", depositPercent, belowDeposit = false } = {}) {
      return tx(async () => {
        await cleanup();
        const r = await api.get(reference);
        if (r.status === "confirmed") return r;
        if (r.status !== "pending_agency")
          throw new AppError(
            409,
            "Yalnız bekleyen ön rezervasyon onaylanabilir.",
          );
        const short = r.net_paid < r.deposit;
        if (short && !(belowDeposit && via === "agency"))
          throw new AppError(
            409,
            `Onay için en az seçilen kapora/tam ödeme tutarının tahsilatı kaydedilmeli (kayıtlı ${tl(r.net_paid)} TL, gereken ${tl(r.deposit)} TL).`,
          );
        await db.update(
          "reservations",
          { _id: r.id },
          {
            status: "confirmed",
            confirmed_at: clock(),
            expires_at: longExpiry(clock()),
          },
        );
        await db.updateMany(
          "seat_locks",
          { owner: r.reference },
          { expires_at: longExpiry(clock()) },
        );
        await audit(r, "confirmed", short ? { via, belowDeposit: { paid: r.net_paid, deposit: r.deposit } } : { via });
        let updated = await api.get(reference);
        // Sözleşme onay anında kurulur; metni kayda yazılır ve onay e-postasıyla gider.
        const tour = tours.find((t) => t.id === updated.tourId);
        const contract = tour
          ? contractText({
              ...legalDataFromReservation(updated, tour, { depositPercent, onlinePayment: via === "online" }),
              confirmedAt: updated.confirmed_at,
              via,
            })
          : "";
        if (contract) {
          await db.update(
            "reservations",
            { _id: r.id },
            { contract_text: contract, contract_version: LEGAL_VERSION, contract_at: updated.confirmed_at },
          );
          updated = await api.get(reference, { fresh: false });
        }
        const documents = [legalDoc("contract", updated, contract), legalDoc("pre_info", updated, updated.pre_info_text)].filter(Boolean);
        await notify(
          updated,
          "reservation_confirmed",
          via === "online"
            ? "Ödemeniz alındı, rezervasyonunuz onaylandı."
            : "Rezervasyonunuz acente tarafından onaylandı.",
          undefined,
          { ticket: true, documents },
        );
        return updated;
      });
    },
    // Panelden elle girilen tahsilat/iadede externalReference verilmez: kayda tekil bir
    // iç referans yazılır, acentenin yazdığı serbest metin (dekont/makbuz no, not) note olur.
    // Böylece kısa, boş ya da tekrar eden not bir tahsilatı engellemez.
    async payment(
      reference,
      { amount, method, externalReference, note = "", kind = "payment", by = null },
    ) {
      if (!externalReference) {
        // Online ödemenin referansı bankanın işlem numarasıdır; eksikse çift tahsilat koruması
        // sessizce kaybolmasın diye işlem durdurulur.
        if (!MANUAL_METHODS.includes(method)) throw new AppError(500, "Ödeme referansı eksik; işlem kaydedilmedi.");
        externalReference = "PANEL-" + randomUUID();
      }
      return tx(async () => {
        await cleanup();
        const r = await api.get(reference),
          previous = await db.one("payment_ledger", {
            method,
            external_reference: externalReference,
            kind,
          });
        if (previous) {
          if (
            previous.reservation_id !== r.id ||
            Number(previous.amount) !== amount
          )
            throw new AppError(
              409,
              "İşlem referansı başka bir kayıtta kullanılmış.",
            );
          return r;
        }
        if (!Number.isSafeInteger(amount) || amount <= 0)
          throw new AppError(400, "Geçerli bir tutar girin.");
        if (
          kind === "payment" &&
          (["cancelled", "expired", "completed"].includes(r.status) ||
            amount > r.total - r.net_paid)
        )
          throw new AppError(
            409,
            "Tahsilat tutarı kalan borcu aşıyor veya kayıt tahsilata kapalı.",
          );
        if (kind === "refund" && amount > r.net_paid)
          throw new AppError(409, "İade tutarı net tahsilatı aşamaz.");
        const ledgerId = randomUUID();
        await db.insert("payment_ledger", ledgerId, {
          id: ledgerId,
          reservation_id: r.id,
          kind,
          amount,
          method,
          external_reference: externalReference,
          note,
          // Panelden elle girilen kayıtta kaydeden yönetici (online ödemede yok).
          recorded_by: by ? { id: by.id || null, name: by.name || by.email || "" } : null,
          created_at: clock(),
        });
        if (kind === "payment") {
          await db.update(
            "reservations",
            { _id: r.id },
            { expires_at: longExpiry(clock()) },
          );
          await db.updateMany(
            "seat_locks",
            { owner: r.reference },
            { expires_at: longExpiry(clock()) },
          );
        }
        await audit(r, kind, { amount, method, externalReference, note });
        const updated = await api.get(reference);
        if (kind === "payment" && updated.net_paid >= updated.total)
          await members.rewardReferral(r.member_id, "paid");
        return updated;
      });
    },
    // Acentenin müşteriye gönderdiği kartla ödeme bağlantısı (kalan bakiye / kapora).
    async sendPaymentLink(reference, url) {
      const r = await api.get(reference);
      if (!r.email) throw new AppError(409, "Bu rezervasyonda e-posta adresi yok; bağlantıyı WhatsApp'tan gönderin.");
      const amount = r.status === "confirmed" ? r.balance_due : Math.max(0, r.deposit - r.net_paid);
      if (!["pending_agency", "confirmed"].includes(r.status) || !(amount > 0))
        throw new AppError(409, "Bu rezervasyonda ödenecek tutar yok.");
      await notifications.enqueue({
        email: r.email,
        subject: "Rota Kars · Kartla ödeme bağlantınız",
        body:
          `Merhaba ${r.name},\n${r.reference} · ${tourName(r)}\nTarih: ${r.date} · Saat: ${r.start_time}\n` +
          `${r.status === "confirmed" ? "Kalan" : "Kapora"} tutarı ${(amount / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL'yi aşağıdaki bağlantıdan Vakıfbank güvenli ödeme sayfasında kartla (3D Secure) ödeyebilirsiniz.\n` +
          "Acentemiz telefonla, e-postayla veya mesajla kart bilgisi istemez.",
        actionUrl: url,
        kind: "payment_link",
        // Aynı gün aynı tutar için tek e-posta; tutar değişirse yeniden gönderilebilir.
        dedupeKey: `payment-link:${r.reference}:${amount}:${new Date(clock()).toISOString().slice(0, 10)}`,
      });
      await audit(r, "payment_link_sent", { amount });
      return { sent: true, amount };
    },
    async requestCancellation(reference, email) {
      return tx(async () => {
        await cleanup();
        const r = await api.get(reference);
        if (r.email !== email.toLowerCase())
          throw new AppError(404, "Rezervasyon bulunamadı.");
        if (["cancelled", "expired"].includes(r.status)) return r;
        if (r.status === "completed")
          throw new AppError(
            409,
            "Tamamlanan tur için acenteyle iletişime geçin.",
          );
        if (r.status === "pending_agency" && r.net_paid === 0) {
          await db.update("reservations", { _id: r.id }, { status: "cancelled" });
          await db.remove("seat_locks", { owner: r.reference });
          await members.releaseCoupons();
        } else
          await db.update(
            "reservations",
            { _id: r.id },
            { cancellation_requested_at: clock() },
          );
        await audit(r, "cancellation_requested", {});
        const updated = await api.get(reference);
        await agencyAlert(
          updated,
          "cancellation_requested",
          updated.status === "cancelled"
            ? "Müşteri ön rezervasyonu iptal etti"
            : "Müşteri iptal talep etti",
        );
        return updated;
      });
    },
    // refundNote: panelde iptalle birlikte iade de yapılıyorsa müşteriye giden e-postada
    // "iade ayrıca yürütülür" yerine yazılır.
    async cancel(reference, { refundNote = "" } = {}) {
      return tx(async () => {
        await cleanup();
        const r = await api.get(reference);
        if (r.status === "completed")
          throw new AppError(409, "Tamamlanmış tur iptal edilemez.");
        if (r.status === "cancelled") return r;
        await db.update("reservations", { _id: r.id }, { status: "cancelled" });
        await db.remove("seat_locks", { owner: r.reference });
        await members.releaseCoupons();
        await audit(r, "cancelled", { refundDue: r.net_paid });
        const updated = await api.get(reference);
        await notify(
          updated,
          "reservation_cancelled",
          "Rezervasyonunuz iptal edildi. " +
            (refundNote || "Tahsilat varsa iade ayrıca acente tarafından yürütülür."),
        );
        return updated;
      });
    },
    async move(reference, { departureId, seats }) {
      return tx(async () => {
        await cleanup();
        const r = await api.get(reference);
        if (!["pending_agency", "confirmed"].includes(r.status))
          throw new AppError(409, "Bu kayıt başka sefere taşınamaz.");
        const d = await departures.get(departureId);
        if (d.tour_id !== r.tourId)
          throw new AppError(
            400,
            "Yalnız aynı turun başka seferine taşıyabilirsiniz.",
          );
        if (
          seats.length !== r.passengers.length ||
          new Set(seats).size !== seats.length ||
          seats.some(
            (n) => !Number.isInteger(n) || n < 1 || n > d.vehicle.sellableSeats,
          )
        )
          throw new AppError(
            400,
            "Her yolcu için geçerli ve farklı bir koltuk seçin.",
          );
        if (
          r.departure_id === departureId &&
          JSON.stringify(r.seats) === JSON.stringify(seats)
        )
          return r;
        for (const n of seats) {
          const lock = await db.one("seat_locks", {
            _id: `${d.id}:${n}`,
            expires_at: { $gt: clock() },
          });
          if (lock && lock.owner !== r.reference)
            throw new AppError(
              409,
              "Hedef koltuk dolu. Eski rezervasyon korunuyor.",
            );
        }
        // Aynı seferde yalnız koltuk değişir: sözleşmedeki bedel, turun fiyatı sonradan
        // değişmiş olsa da aynen kalır. Başka sefere taşımada bedel yeni seferin fiyatıyla
        // hesaplanır; yüzde kuponu yeniden uygulanır, TL kuponu tutarıyla korunur.
        // Transfer bedeli taşımada aynen kalır (kupon yalnız tur bedeline uygulanır).
        // Yolcu çıkarmadan kalan iptal kesintisi (cancellation_fee) taşımada da toplamda kalır.
        const sameDeparture = r.departure_id === departureId,
          transfer = r.transfer_amount || 0,
          kept = r.discount_amount || 0,
          fee = r.cancellation_fee || 0,
          subtotal = sameDeparture ? (r.subtotal ?? r.total - transfer + kept - fee) : d.price * seats.length,
          discount = sameDeparture
            ? kept
            : r.discount_percent
              ? Math.round((subtotal * r.discount_percent) / 100)
              : Math.min(kept, subtotal),
          tourTotal = subtotal - discount,
          total = sameDeparture ? r.total : tourTotal + transfer + fee;
        if (r.net_paid > total)
          throw new AppError(
            409,
            "Yeni bedeli aşan tahsilat var. Önce fark iadesini kaydedin.",
          );
        const expires =
          r.net_paid > 0 || r.status === "confirmed"
            ? longExpiry(clock())
            : clock() + 86400000;
        await db.remove("seat_locks", { owner: r.reference });
        // Süresi dolmuş başka bir kilit kalmışsa yerine yazılır.
        for (const seat of seats)
          await db.upsert("seat_locks", `${d.id}:${seat}`, {
            departure_id: d.id,
            seat,
            owner: r.reference,
            expires_at: expires,
          });
        await db.update(
          "reservations",
          { _id: r.id },
          {
            departure_id: d.id,
            seats,
            vehicle_json: d.vehicle,
            subtotal,
            discount_amount: subtotal - tourTotal,
            total,
            // Turda ödenecek kayıt kapora istemez; tam ödeme tam, kapora %30 kalır.
            deposit: sameDeparture
              ? r.deposit
              : r.payment_mode === "on_tour"
                ? 0
                : r.deposit === r.total
                  ? total
                  : depositFor(total),
            expires_at: expires,
          },
        );
        const id = randomUUID();
        await audit(r, "moved", { from: r.departure_id, to: d.id, seats });
        const updated = await api.get(reference);
        await notifications.enqueue({
          email: r.email,
          subject: "Rota Kars · Yolculuk bilgileriniz güncellendi",
          body: `${r.reference}\nYeni tarih: ${d.date} ${d.start_time}\nBuluşma: ${d.pickup}\nKoltuk: ${seats.join(", ")}\nGüncel tur bedeli: ${(total / 100).toFixed(2)} TL.`,
          kind: "reservation_moved",
          dedupeKey: "move:" + id,
        });
        return updated;
      });
    },
    // Müşteri ödeme ekranında kapora / tam ödeme arasında geçiş yapar. Yalnız
    // henüz hiç ödeme alınmamış ön rezervasyonda; kayıttaki ön bilgilendirme
    // formu yeni ödeme planıyla yeniden yazılır.
    async changePaymentMode(reference, mode, { depositPercent, onlinePayment = false } = {}) {
      return tx(async () => {
        await cleanup();
        const r = await api.get(reference, { fresh: false });
        if (r.payment_mode === mode) return r;
        if (r.status !== "pending_agency" || r.net_paid > 0 || !["deposit", "full"].includes(r.payment_mode))
          throw new AppError(409, "Bu rezervasyonun ödeme planı artık değiştirilemez.");
        await db.update(
          "reservations",
          { _id: r.id },
          { payment_mode: mode, deposit: mode === "full" ? r.total : depositFor(r.total) },
        );
        let updated = await api.get(reference, { fresh: false });
        const tour = tours.find((t) => t.id === updated.tourId);
        if (updated.pre_info_text && tour) {
          await db.update(
            "reservations",
            { _id: r.id },
            {
              pre_info_text: preInfoText(
                legalDataFromReservation(updated, tour, { depositPercent, onlinePayment }),
              ),
            },
          );
          updated = await api.get(reference, { fresh: false });
        }
        await audit(r, "payment_mode_changed", { from: r.payment_mode, to: mode });
        return updated;
      });
    },
    // Yolcu adları ve (verilirse) kimlikleri; details verilmezse kimlikler korunur.
    async passengers(reference, names, details) {
      return tx(async () => {
        await cleanup();
        const r = await api.get(reference);
        if (names.length !== r.seats.length || (details && details.length !== r.seats.length))
          throw new AppError(400, "Yolcu ve koltuk sayıları eşleşmeli.");
        if (!["pending_agency", "confirmed"].includes(r.status))
          throw new AppError(409, "Bu kaydın yolcuları değiştirilemez.");
        await db.update(
          "reservations",
          { _id: r.id },
          details
            ? { passengers: names, passenger_details: pii ? pii.sealDetails(details) : details }
            : { passengers: names },
        );
        await audit(r, "passengers_updated", {});
        return api.get(reference);
      });
    },
    // Yolcu çıkarma (kısmi iptal) önizlemesi: panel penceresi ve işlemin kendisi aynı
    // hesabı kullanır. Müşteri isteği (kurallara göre) ve acente kararı (kesintisiz) ayrı döner.
    async removalQuote(reference, seats) {
      const r = await api.get(reference),
        customer = await removalPlan(r, seats),
        agency = await removalPlan(r, seats, { waive: true });
      return {
        reference: r.reference,
        seats: customer.seats,
        names: customer.names,
        netPaid: r.net_paid,
        totalBefore: r.total,
        share: customer.share,
        late: customer.late,
        freeUntil: customer.freeUntil,
        transferBefore: r.transfer?.amount || 0,
        transfer: customer.transfer
          ? { amount: customer.transfer.amount, tierLabel: customer.transfer.tierLabel }
          : null,
        customer: { fee: customer.fee, total: customer.total, refund: customer.refund },
        agency: { fee: agency.fee, total: agency.total, refund: agency.refund },
      };
    },
    // Seçilen koltuklardaki yolcular rezervasyondan çıkar: koltukları boşalır (bekleme
    // listesine sıradaki taramada haber gider), bedel kalan yolculara göre yeniden yazılır,
    // müşteriye e-posta gider. İade burada yapılmaz (app.mjs'de, iptaldeki gibi).
    async removePassengers(reference, seats, { waive = false, refundNote = "" } = {}) {
      return tx(async () => {
        await cleanup();
        const r = await api.get(reference),
          plan = await removalPlan(r, seats, { waive }),
          details = plan.keep.map((i) => r.passenger_details?.[i] ?? null);
        await db.update(
          "reservations",
          { _id: r.id },
          {
            seats: plan.keep.map((i) => r.seats[i]),
            passengers: plan.keep.map((i) => r.passengers[i]),
            passenger_details: pii ? pii.sealDetails(details) : details,
            subtotal: plan.subtotal,
            discount_amount: plan.discount,
            transfer: plan.transfer,
            transfer_amount: plan.transfer?.amount || 0,
            total: plan.total,
            deposit: plan.deposit,
            cancellation_fee: (r.cancellation_fee || 0) + plan.fee,
          },
        );
        await db.remove("seat_locks", {
          _id: { $in: plan.seats.map((n) => `${r.departure_id}:${n}`) },
          owner: r.reference,
        });
        await audit(r, "passengers_removed", {
          seats: plan.seats,
          names: plan.names,
          totalBefore: r.total,
          totalAfter: plan.total,
          fee: plan.fee,
          waived: Boolean(waive),
        });
        const updated = await api.get(reference);
        await notify(
          updated,
          "passengers_removed",
          "Rezervasyonunuz güncellendi.",
          "passengers_removed:" + r.reference + ":" + randomUUID(),
          {
            extra:
              `Rezervasyondan çıkarılan yolcu: ${plan.names.join(", ")} (koltuk ${plan.seats.join(", ")}).\n` +
              `Güncel tur bedeli: ${tl(plan.total)} TL (önceki ${tl(r.total)} TL).` +
              (plan.fee
                ? `\nKesintisiz iptal süresi geçtiği için çıkarılan yolcuların kapora payı ${tl(plan.fee)} TL iade edilmez.`
                : "") +
              (refundNote ? "\n" + refundNote : ""),
          },
        );
        return updated;
      });
    },
    async complete(reference) {
      return tx(async () => {
        await cleanup();
        const r = await api.get(reference);
        if (r.status === "completed") return r;
        if (
          r.status !== "confirmed" ||
          r.date > localDate(clock()) ||
          r.net_paid < r.total
        )
          throw new AppError(
            409,
            "Tamamlama için onaylı kayıt, geçmiş/bugünkü tur tarihi ve tam tahsilat gerekir.",
          );
        await db.update(
          "reservations",
          { _id: r.id },
          { status: "completed", completed_at: clock() },
        );
        await members.rewardReferral(r.member_id, "completed");
        await audit(r, "completed", {});
        await notifications.enqueue({
          email: r.email,
          subject: "Rota Kars · Birlikte yolculuk etmek güzeldi",
          body: `Merhaba ${r.name}, ${r.reference} yolculuğunuzdaki deneyiminizi Google'da paylaşabilirsiniz.`,
          actionUrl: env.GOOGLE_REVIEW_URL || business.mapsUrl,
          kind: "review_request",
          dedupeKey: "review:" + r.id,
        });
        return api.get(reference);
      });
    },
    // Gelmedi: onaylı, tarihi gelmiş ve bilet okutulmamış kayıt için.
    async noShow(reference) {
      return tx(async () => {
        await cleanup();
        const r = await api.get(reference);
        if (r.status === "no_show") return r;
        if (r.status !== "confirmed" || r.date > localDate(clock()) || r.checked_in_at)
          throw new AppError(409, "Yalnız tarihi gelmiş, katılımı okutulmamış onaylı kayıt 'gelmedi' olarak işaretlenebilir.");
        await db.update("reservations", { _id: r.id }, { status: "no_show" });
        await audit(r, "no_show", {});
        return api.get(reference);
      });
    },
    async ticket(token) {
      await cleanup();
      if (!/^[a-f0-9]{48}$/.test(token))
        throw new AppError(404, "Bilet bulunamadı.");
      const row = await db.one("reservations", { ticket_token: token });
      if (!row) throw new AppError(404, "Bilet bulunamadı.");
      const r = await api.get(row.reference);
      return {
        reference: r.reference,
        tourName: tours.find((t) => t.id === r.tourId)?.name,
        date: r.date,
        startTime: r.start_time,
        pickup: r.pickup,
        seats: r.seats,
        status: r.status,
        valid: ["confirmed", "completed"].includes(r.status),
        checkedIn: Boolean(r.checked_in_at),
      };
    },
    // Rehber/operasyon bileti okutunca: yolcular, irtibat, ödeme ve notlar.
    // Kimlik numarası okutma ekranında yalnız son 4 haneyle görünür.
    async ticketDetail(token) {
      const info = await api.ticket(token),
        r = await api.get(info.reference);
      return {
        ...info,
        contactName: r.name,
        phone: r.phone,
        whatsapp: waLink(r.phone) || null,
        passengers: r.seats.map((seat, i) => {
          const p = r.passenger_details?.[i];
          return {
            seat,
            name: r.passengers[i] || (i === 0 ? r.name : ""),
            nationality: p?.nationality || "",
            idLast4: p?.idNumber ? String(p.idNumber).slice(-4) : "",
          };
        }),
        notes: r.notes || "",
        transfer: r.transfer ? transferLine(r.transfer) : "",
        guideName: r.guide_name || null,
        total: r.total,
        paid: r.net_paid,
        balanceDue: r.balance_due,
        paymentState: r.payment_state,
        checkedInAt: r.checked_in_at || null,
      };
    },
    async checkIn(token) {
      return tx(async () => {
        await cleanup();
        const info = await api.ticket(token);
        if (
          !info.valid ||
          info.status !== "confirmed" ||
          info.date !== localDate(clock())
        )
          throw new AppError(
            409,
            "Katılım yalnız bugünkü onaylı tur için kaydedilebilir.",
          );
        const r = await api.get(info.reference);
        if (!r.checked_in_at) {
          await db.update(
            "reservations",
            { _id: r.id },
            { checked_in_at: clock() },
          );
          await audit(r, "checked_in", {});
        }
        return api.ticket(token);
      });
    },
    async reminders() {
      const now = clock(),
        hours = Math.max(1, Math.min(72, Number(env.REMINDER_HOURS) || 24));
      // Yalnız hatırlatma penceresine giren günlerdeki onaylı kayıtlar okunur.
      const days = [];
      for (let t = now - 86400000; t <= now + hours * 3600000 + 86400000; t += 86400000)
        days.push(localDate(t));
      const departureIds = (
        await db.find("departures", { date: { $in: days } }, { projection: { id: 1 } })
      ).map((d) => d.id);
      if (!departureIds.length) return;
      const upcoming = await db.find(
        "reservations",
        { status: "confirmed", departure_id: { $in: departureIds } },
        { projection: { reference: 1 } },
      );
      for (const { reference } of upcoming) {
        const r = await api.get(reference, { fresh: false });
        const start = Date.parse(r.date + "T" + r.start_time + ":00+03:00");
        if (start > now && start <= now + hours * 3600000)
          // Sefer değişirse (taşıma) yeni sefer için yeniden hatırlatılır.
          await notify(
            r,
            "departure_reminder",
            "Yolculuğunuz yaklaşıyor. Buluşma bilgilerinizi kontrol edin.",
            `departure_reminder:${r.reference}:${r.departure_id}`,
          );
      }
    },
    async report(date) {
      const ds = await departures.list({ date }),
        rs = await api.list({ date, all: true });
      return {
        date,
        departures: ds.map((d) => ({
          ...d,
          reservations: rs.filter((r) => r.departure_id === d.id).length,
          confirmedGuests: rs
            .filter(
              (r) =>
                r.departure_id === d.id &&
                ["confirmed", "completed"].includes(r.status),
            )
            .reduce((n, r) => n + r.seats.length, 0),
        })),
        reservations: rs.length,
        guests: rs
          .filter((r) => !["cancelled", "expired"].includes(r.status))
          .reduce((n, r) => n + r.seats.length, 0),
        netCollected: rs.reduce((n, r) => n + r.net_paid, 0),
        refunded: rs.reduce((n, r) => n + r.refunded_total, 0),
      };
    },
    // Aylık rapor. Tur bazında: o ay yapılan seferlerin doluluğu ve cirosu (tur
    // tarihine göre). Tahsilat: o ay kasaya giren/çıkan para (işlem tarihine göre).
    async monthReport(month) {
      const prefix = month + "-";
      const ds = (await departures.list()).filter((d) => d.date.startsWith(prefix));
      const rs = (await api.list({ all: true })).filter((r) => r.date?.startsWith(prefix));
      const live = (r) => !["cancelled", "expired"].includes(r.status);
      // Finans paneliyle aynı hesap: katalogdan kalkmış turun satışı da sayılır.
      const byTour = tourRows({ tours, departures: ds, reservations: rs.filter(live) });
      const start = Date.parse(month + "-01T00:00:00+03:00"),
        [y, m] = month.split("-").map(Number),
        end = Date.parse(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01T00:00:00+03:00`);
      const ledger = await db.find("payment_ledger", { created_at: { $gte: start, $lt: end } });
      const sum = (kind, method) =>
        ledger.filter((p) => p.kind === kind && (!method || p.method === method)).reduce((n, p) => n + Number(p.amount), 0);
      const cancelled = rs.filter((r) => r.status === "cancelled");
      return {
        month,
        totals: {
          departures: ds.length,
          capacity: byTour.reduce((n, x) => n + x.capacity, 0),
          guests: byTour.reduce((n, x) => n + x.guests, 0),
          reservations: byTour.reduce((n, x) => n + x.reservations, 0),
          revenue: byTour.reduce((n, x) => n + x.revenue, 0),
          outstanding: rs.filter(live).reduce((n, r) => n + Math.max(0, r.total - r.net_paid), 0),
          cancelled: cancelled.length,
          noShow: rs.filter((r) => r.status === "no_show").length,
        },
        cash: {
          payments: sum("payment"),
          refunds: sum("refund"),
          net: sum("payment") - sum("refund"),
          cash: sum("payment", "cash") - sum("refund", "cash"),
          bankTransfer: sum("payment", "bank_transfer") - sum("refund", "bank_transfer"),
          pos: sum("payment", "pos") - sum("refund", "pos"),
          card: sum("payment", "online:vakifbank") - sum("refund", "online:vakifbank"),
        },
        byTour,
        reservations: rs
          .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
          .map((r) => ({
            reference: r.reference,
            date: r.date,
            time: r.start_time,
            tourName: tours.find((t) => t.id === r.tourId)?.name || r.tourId,
            name: r.name,
            phone: r.phone,
            seats: r.seats.length,
            status: r.status,
            source: r.source || "web",
            total: r.total,
            paid: r.net_paid,
          })),
      };
    },
    // Finans paneli: dönem cirosu/tahsilatı, alacaklar, beklenen ödemeler, talep hattı.
    async financeReport({ from, to, bucket = "day" }) {
      return buildFinance({
        reservations: await api.list({ all: true }),
        ledger: await db.find("payment_ledger", {}),
        departures: await departures.list(),
        requests: await db.find("requests", {}),
        tours,
        today: localDate(clock()),
        from,
        to,
        bucket,
      });
    },
    // Telefondaki yolcu listesi: arama/WhatsApp ve biniş işaretleme için.
    async passengerList(departureId) {
      const d = await departures.get(departureId, { allowClosed: true, allowPast: true }),
        bookings = (await api.list({ date: d.date, all: true }))
          .filter((r) => r.departure_id === d.id && !["cancelled", "expired"].includes(r.status))
          .sort((a, b) => Math.min(...a.seats) - Math.min(...b.seats));
      return {
        departure: {
          id: d.id,
          tourName: tours.find((t) => t.id === d.tour_id)?.name || d.tour_id,
          date: d.date,
          startTime: d.start_time,
          pickup: d.pickup,
          guideName: d.guide_name || null,
        },
        bookings: bookings.map((r) => ({
          reference: r.reference,
          status: r.status,
          name: r.name,
          phone: r.phone,
          whatsapp: waLink(r.phone) || null,
          seats: r.seats,
          passengers: r.passengers,
          passengerDetails: r.passenger_details,
          notes: r.notes || "",
          // Rehberin telefonunda: karşılanacak misafirler (havalimanı/otogar/gar).
          transfer: r.transfer ? transferLine(r.transfer) : "",
          checkedIn: Boolean(r.checked_in_at),
          ticketToken: r.status === "confirmed" ? r.ticket_token : null,
        })),
      };
    },
    async manifest(departureId) {
      const d = await departures.get(departureId, {
          allowClosed: true,
          allowPast: true,
        }),
        bookings = (await api.list({ date: d.date, all: true })).filter(
          (r) =>
            r.departure_id === d.id &&
            !["cancelled", "expired"].includes(r.status),
        );
      const rows = [
        [
          "Referans",
          "Tarih",
          "Saat",
          "Tur",
          "Koltuk",
          "Yolcu",
          "Uyruk",
          "T.C. kimlik / pasaport no",
          "Cinsiyet",
          "İletişim kişisi",
          "Telefon",
          "Durum",
        ],
      ];
      for (const r of bookings)
        r.seats.forEach((seat, i) =>
          rows.push([
            r.reference,
            r.date,
            r.start_time,
            tours.find((t) => t.id === r.tourId)?.name,
            seat,
            r.passengers[i],
            r.passenger_details[i]?.nationality
              ? `${countryName(r.passenger_details[i].nationality)} (${r.passenger_details[i].nationality})`
              : "",
            r.passenger_details[i]?.idNumber || "",
            r.passenger_details[i]?.gender || "",
            r.name,
            r.phone,
            r.status,
          ]),
        );
      const cell = (v) => {
        let s = String(v ?? "");
        if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s;
        return '"' + s.replaceAll('"', '""') + '"';
      };
      return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
    },
    async audit(reference) {
      const r = await api.get(reference);
      return db.find(
        "reservation_audit",
        { reservation_id: r.id },
        { sort: { created_at: 1, id: 1 } },
      );
    },
  };
  return api;
}
