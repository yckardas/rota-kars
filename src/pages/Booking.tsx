import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTurnstile } from "../components/Turnstile";
import { placeName } from "../lib/place";
import { useClearOfLaunchers } from "../lib/launchers";
import { responsive } from "../lib/images";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { Link, localPath, useLang } from "../lib/i18n";
import { TourLink } from "../lib/tour-transition";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  MapPin,
  Info,
  LockKeyhole,
  LoaderCircle,
  Ticket,
  Printer,
  CalendarDays,
  Armchair,
  ShieldCheck,
  FileText,
  CreditCard,
} from "lucide-react";
import { api, post, ApiError } from "../lib/api";
import {
  currency,
  dateLabel,
  type Catalog,
  type Departure,
  type Hold,
  type Seat,
  type Reservation,
  type Vehicle,
} from "../lib/types";
import { useMember, type Coupon, type MemberDashboard } from "../lib/member";
import { SeatMap } from "../components/SeatMap";
import { telHref } from "../lib/phone";
import { ReservationTicket } from "../components/ReservationTicket";
import { PayDeposit } from "./Payment";
import {
  LegalConsents,
  consentsComplete,
  noConsents,
  type Consents,
} from "../components/LegalConsents";
type PreInfo = {
  text: string;
  lateBooking: boolean;
  freeCancelDays: number;
  contract: string;
  cancellation: string[];
};
const BOOKING_CONSENT_MISSING =
  "Ön rezervasyon için dört onay kutusunun hepsini işaretleyin.";
import { tcknValid, maskId } from "../lib/tckn";
import { countryName, countryOptions } from "../lib/countries";
import type { Companion } from "../components/Companions";
// Tek rezervasyonda en fazla bu kadar koltuk (sunucudaki GUEST_MAX_SEATS ile aynı).
const MAX_SEATS = 4;
// Kart ekranına geçilen son ön rezervasyon: müşteri geri tuşuyla dönerse
// yeni kayıt açmak yerine ödemesine dönebilsin (ödeme oturumu 30 dakika açık).
const PENDING_KEY = "rk-pending-booking";
const PENDING_MS = 30 * 60 * 1000;
type PendingBooking = { tourId: string; reference: string; payUrl: string; at: number };
function readPending(tourId?: string): PendingBooking | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null") as PendingBooking | null;
    return p && p.tourId === tourId && Date.now() - p.at < PENDING_MS ? p : null;
  } catch {
    return null;
  }
}
type IdForm = {
  // ISO 3166-1 alfa-2 ülke kodu
  nationality: string;
  idNumber: string;
  gender: "" | "K" | "E";
  // Üyenin kayıtlı yol arkadaşı seçildiyse; bilgiler sunucuda doldurulur.
  companionId?: string;
  // Üye bu yolcuyu yol arkadaşlarına kaydetmek istiyor.
  save?: boolean;
};
const emptyId: IdForm = {
  nationality: "TR",
  idNumber: "",
  gender: "",
};
export function Booking({ catalog }: { catalog: Catalog }) {
  const { t, lang } = useLang();
  // Kartla ödeme açık ya da banka önizlemesinde: rezervasyondan sonra kart ekranına geçilir.
  const cardFlow = Boolean(catalog.payment.enabled || catalog.payment.preview);
  // Uyruk adları sayfanın dilinde (Intl.DisplayNames).
  const COUNTRIES = useMemo(() => countryOptions(lang), [lang]);
  const { tourId } = useParams(),
    [params] = useSearchParams(),
    tour = catalog.tours.find((t) => t.id === tourId),
    [departures, setDepartures] = useState<Departure[]>([]),
    [departureId, setDepartureId] = useState(""),
    [count, setCount] = useState(
      Math.min(
        tour?.vehicle.sellableSeats || 17,
        MAX_SEATS,
        Math.max(1, Number(params.get("guests")) || 1),
      ),
    ),
    [seats, setSeats] = useState<Seat[]>([]),
    [selected, setSelected] = useState<number[]>([]),
    // Koltuk planındaki sessiz değişiklikler (yolcu sayısı arttı, koltuk doldu) burada duyurulur.
    [seatNotice, setSeatNotice] = useState(""),
    // "info": bilgi (yolcu sayısı arttı), "warn": sorun (koltuk başkasına geçti).
    [seatNoticeTone, setSeatNoticeTone] = useState<"info" | "warn">("info"),
    [step, setStep] = useState(0),
    [pending, setPending] = useState<PendingBooking | null>(null),
    [hold, setHold] = useState<Hold | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now()),
    [result, setResult] = useState<Reservation | null>(null),
    [mode, setMode] = useState("deposit"),
    [passengers, setPassengers] = useState<string[]>([]),
    [ids, setIds] = useState<IdForm[]>([]),
    [contact, setContact] = useState({ name: "", email: "", phone: "" }),
    [consents, setConsents] = useState<Consents>(noConsents),
    [consentError, setConsentError] = useState(""),
    [othersDeclaration, setOthersDeclaration] = useState(false),
    [marketingConsent, setMarketingConsent] = useState(false),
    [preInfo, setPreInfo] = useState<PreInfo | null>(null),
    [preInfoError, setPreInfoError] = useState(""),
    human = useTurnstile("booking"),
    [loaded, setLoaded] = useState(false),
    [activeVehicle, setActiveVehicle] = useState<Vehicle | null>(null),
    [coupons, setCoupons] = useState<Coupon[]>([]),
    [couponId, setCouponId] = useState(""),
    [quote, setQuote] = useState<{
      subtotal: number;
      discount: number;
      total: number;
      deposit: number;
    } | null>(null),
    [couponError, setCouponError] = useState(""),
    [extendBusy, setExtendBusy] = useState(false),
    [extendError, setExtendError] = useState(""),
    [quoteBusy, setQuoteBusy] = useState(false),
    [quoteError, setQuoteError] = useState(""),
    [dateNotice, setDateNotice] = useState(false),
    location = useLocation(),
    stepHeading = useRef<HTMLHeadingElement>(null),
    firstStepRender = useRef(true);
  const summaryRef = useRef<HTMLElement>(null);
  useClearOfLaunchers(summaryRef, "summaryVisible");
  const { member } = useMember();
  const [companions, setCompanions] = useState<Companion[]>([]);
  useEffect(() => {
    if (member)
      api<Companion[]>("/member/companions")
        .then(setCompanions)
        .catch(() => setCompanions([]));
  }, [member]);
  const membershipHref =
    "/uyelik?next=" + encodeURIComponent(location.pathname + location.search);
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    stepHeading.current?.focus({ preventScroll: true });
  }, [step]);
  const vehicle = activeVehicle || tour?.vehicle || catalog.vehicle;
  useEffect(() => {
    setCount((current) =>
      Math.min(current, vehicle.sellableSeats, MAX_SEATS),
    );
    setSelected([]);
  }, [vehicle.id]);
  useEffect(() => {
    setCouponId("");
    setCoupons([]);
    if (member) {
      setContact((current) => ({
        ...current,
        name: current.name || member.name,
        email: member.email,
        phone: current.phone || member.phone || "",
      }));
      api<MemberDashboard>("/member/dashboard")
        .then((data) =>
          setCoupons(
            data.coupons.filter(
              (c) => !c.used_reservation && c.expires_at > Date.now(),
            ),
          ),
        )
        .catch(() =>
          setCouponError(
            t(
              "Kuponlarınız şu an yüklenemedi. Rezervasyona kuponsuz devam edebilir veya sayfayı yenileyebilirsiniz.",
            ),
          ),
        );
    }
  }, [member]);
  useEffect(() => {
    setQuote(null);
    setQuoteError("");
    if (!departureId) return;
    let active = true;
    setQuoteBusy(true);
    post<{
      subtotal: number;
      discount: number;
      total: number;
      deposit: number;
    }>("/reservations/quote", {
      departureId,
      count,
      ...(couponId ? { couponId } : {}),
    })
      .then((data) => {
        if (active) setQuote(data);
      })
      .catch((e) => {
        if (active) setQuoteError(e.message);
      })
      .finally(() => {
        if (active) setQuoteBusy(false);
      });
    return () => {
      active = false;
    };
  }, [departureId, count, couponId, member]);
  // 3. adım: sunucunun ürettiği ön bilgilendirme formu (kayıtta aynı metin saklanır).
  useEffect(() => {
    if (step !== 2 || !departureId) return;
    let active = true;
    setPreInfoError("");
    post<PreInfo>(
      "/reservations/pre-info",
      {
        departureId,
        seats: selected,
        ...contact,
        passengers: selected.map((_, i) => {
          const p = ids[i] || emptyId,
            c = companions.find((c) => c.id === p.companionId);
          return {
            name: passengers[i] || "",
            nationality: c?.nationality || p.nationality || "",
          };
        }),
        paymentMode: mode,
        ...(couponId ? { couponId } : {}),
      },
    )
      .then((data) => {
        if (active) setPreInfo(data);
      })
      .catch((e) => {
        if (active) {
          setPreInfo(null);
          setPreInfoError((e as Error).message);
        }
      });
    return () => {
      active = false;
    };
  }, [step, departureId, mode, couponId]);
  // Yön yalnız adım değişince güncellenir; süre sayacının her saniyelik
  // yeniden çizimi animasyonu baştan başlatmasın.
  const prevStep = useRef(step),
    stepDirRef = useRef<"forward" | "back">("forward");
  if (prevStep.current !== step) {
    stepDirRef.current = step > prevStep.current ? "forward" : "back";
    prevStep.current = step;
  }
  const stepDir = stepDirRef.current;
  const holdRef = useRef<Hold | null>(null);
  holdRef.current = hold;
  const stepRef = useRef(step);
  stepRef.current = step;
  // Adımlar tarayıcı geçmişine yazılır: telefonun/tarayıcının geri tuşu
  // rezervasyondan çıkmak yerine bir önceki adıma döner.
  function goStep(n: number) {
    setStep(n);
    window.history.pushState({ ...window.history.state, bookingStep: n }, "");
    window.scrollTo({ top: 120, behavior: "smooth" });
  }
  // Ön rezervasyon zaten açıldıysa ilk adıma dönülür ve "Ödemeye devam et" uyarısı öne çıkar.
  function showPending() {
    setHold(null);
    setStep(0);
    setError("");
    if (Number(window.history.state?.bookingStep || 0) > 0)
      window.history.replaceState({ ...window.history.state, bookingStep: 0 }, "");
    window.scrollTo({ top: 0 });
  }
  async function backTo(target: number) {
    if (target >= stepRef.current) return;
    if (target === 0) {
      const h = holdRef.current;
      if (h) await api(`/holds/${h.token}`, { method: "DELETE" }).catch(() => {});
      setHold(null);
    }
    setStep(target);
    setError("");
    // Geri dönünce sayfanın dibinde kalınmaz; ileri giderken olduğu gibi adımın başına çıkılır.
    window.scrollTo({ top: 120, behavior: "smooth" });
  }
  useEffect(() => {
    setPending(readPending(tourId));
    // Sayfa yeniden yüklendiyse (ör. ödeme ekranından geri gelindi) adım başa
    // döner; geçmiş kaydı da buna uyar.
    if (Number(window.history.state?.bookingStep || 0) > 0)
      window.history.replaceState({ ...window.history.state, bookingStep: 0 }, "");
  }, [tourId]);
  // Ödeme ekranından geri tuşuyla dönülünce tarayıcı sayfayı çoğu zaman
  // önbellekten (bfcache) olduğu gibi geri getirir: bileşen yeniden kurulmaz,
  // son adım ve dolu form ekranda kalır. Bu durumda da ön rezervasyon uyarısı
  // gösterilir ve adım başa alınır; yeni rezervasyon denenmez.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      const p = readPending(tourId);
      setPending(p);
      setBusy(false);
      if (p) showPending();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [tourId]);
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const target = Number(e.state?.bookingStep || 0);
      if (target < stepRef.current) void backTo(target);
      // Süre dolup başa dönüldüyse ileri adımların geçmiş kayıtları atlanır.
      else if (target > stepRef.current) window.history.back();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // Sayfadaki geri düğmeleri ve adım çubuğu da geçmiş üzerinden döner; geçmiş
  // kaydı yoksa (ör. sayfa yenilendiyse) doğrudan döner.
  function backToStep(target: number) {
    const at = Number(window.history.state?.bookingStep || 0);
    if (at === step && target < step) window.history.go(target - step);
    else void backTo(target);
  }
  const selectedRef = useRef<number[]>([]);
  selectedRef.current = selected;
  // Telefonda 1. adımın "Devam" çubuğu: asıl düğme ekranda değilken görünür.
  const continueRef = useRef<HTMLButtonElement>(null),
    [continueInView, setContinueInView] = useState(true);
  useEffect(() => {
    const el = continueRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setContinueInView(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [step, loaded]);
  // Çubuk görünürken telefondaki WhatsApp/asistan düğmeleri onun üstüne binmesin.
  const barShown = step === 0 && selected.length > 0 && !continueInView;
  useEffect(() => {
    if (barShown) document.body.dataset.continueBar = "";
    else delete document.body.dataset.continueBar;
    return () => {
      delete document.body.dataset.continueBar;
    };
  }, [barShown]);
  const departure = departures.find((d) => d.id === departureId),
    subtotal = (departure?.price || tour?.price || 0) * count,
    total = quote?.total ?? subtotal;
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setActiveVehicle(tour?.vehicle || null);
    if (tour && !tour.inquiryOnly)
      api<Departure[]>(`/tours/${tour.id}/departures`)
        .then((ds) => {
          if (!active) return;
          setDepartures(ds);
          const wanted = params.get("date"),
            match = ds.find((d) => d.date === wanted);
          setDepartureId(match?.id || ds[0]?.id || "");
          setDateNotice(Boolean(wanted && !match && ds.length));
          setLoaded(true);
        })
        .catch((e) => {
          if (active) {
            setError(e.message);
            setLoaded(true);
          }
        });
    return () => {
      active = false;
    };
  }, [tour]);
  useEffect(() => {
    let active = true;
    if (!departureId || step !== 0) return;
    const refresh = () =>
      api<{ seats: Seat[]; vehicle: Vehicle }>(
        `/departures/${departureId}/seats`,
      )
        .then((d) => {
          if (active) {
            setSeats(d.seats);
            setActiveVehicle(d.vehicle);
            // Seçili ama henüz tutulmamış koltuk bu arada başkasına geçtiyse bırakılır.
            const lost = selectedRef.current.filter(
              (n) => d.seats.find((s) => s.number === n)?.status !== "available",
            );
            if (lost.length) {
              setSelected((cur) => cur.filter((n) => !lost.includes(n)));
              setSeatNoticeTone("warn");
              setSeatNotice(
                t("Koltuk {n} az önce doldu; başka bir koltuk seçin.", {
                  n: lost.join(", "),
                }),
              );
            }
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [departureId, step]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (hold && hold.expiresAt <= now) {
      setHold(null);
      setStep(0);
      setSelected([]);
      setError(
        t("Koltuk ayırma süreniz doldu. Yeniden koltuk seçebilirsiniz."),
      );
    }
  }, [hold, now]);
  useEffect(
    () => () => {
      const h = holdRef.current;
      if (h)
        api(`/holds/${h.token}`, { method: "DELETE", keepalive: true }).catch(
          () => {},
        );
    },
    [],
  );
  async function chooseSeats() {
    setError("");
    if (selected.length !== count) {
      setError(
        count === 1
          ? t("1 yolcu için 1 koltuk seçin.")
          : t("{count} yolcu için {count} koltuk seçin.", { count }),
      );
      return;
    }
    setBusy(true);
    try {
      const h = await post<Hold>("/holds", { departureId, seats: selected });
      setHold(h);
      goStep(1);
    } catch (e) {
      setError((e as Error).message);
      const fresh = await api<{ seats: Seat[] }>(
        `/departures/${departureId}/seats`,
      ).catch(() => null);
      if (fresh) {
        setSeats(fresh.seats);
        setSelected(
          selected.filter(
            (n) =>
              fresh.seats.find((s) => s.number === n)?.status === "available",
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  }
  function back() {
    backToStep(Math.max(0, step - 1));
  }
  // İşaretlenen yolcular üyenin yol arkadaşlarına kaydedilir (hata olursa
  // rezervasyon etkilenmez).
  function saveCompanions() {
    if (member)
      for (const [i, p] of ids.slice(0, selected.length).entries())
        if (p?.save && !p.companionId)
          post("/member/companions", {
            name: passengers[i],
            nationality: p.nationality,
            idNumber: p.idNumber,
            gender: p.gender,
            // Kaydet kutusu, kişinin bilgisi dahilinde kaydedildiği beyanını içerir.
            declaration: true,
          }).catch(() => {});
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!hold) {
      const p = readPending(tourId);
      setPending(p);
      if (p) showPending();
      else setStep(0);
      return;
    }
    if (!consentsComplete(consents)) {
      setConsentError(BOOKING_CONSENT_MISSING);
      document
        .querySelector<HTMLInputElement>(".legal-consents input:not(:checked)")
        ?.focus();
      return;
    }
    setConsentError("");
    setBusy(true);
    setError("");
    try {
      const r = await post<Reservation>("/reservations", {
        holdToken: hold.token,
        ...contact,
        passengers: passengers.slice(0, count),
        passengerDetails: selected.map((_, i) => {
          const p = ids[i] || emptyId;
          if (p.companionId) return { companionId: p.companionId };
          return {
            nationality: p.nationality,
            idNumber: p.idNumber,
            gender: p.gender,
          };
        }),
        paymentMode: mode,
        consents,
        ...(count > 1 ? { othersDeclaration } : {}),
        marketingConsent,
        ...(couponId ? { couponId } : {}),
        turnstileToken: human.token,
      });
      holdRef.current = null;
      setHold(null);
      // Kartla ödeme açıksa (veya banka önizlemesindeyse) doğrudan kart ekranına
      // geçilir; açılamazsa başarı sayfasındaki "Kartla öde" düğmesi kalır.
      const toPayment = cardFlow
        ? await post<{ redirectUrl: string }>("/payments/start", {
            reference: r.reference,
            email: contact.email,
            lang,
          }).catch(() => null)
        : null;
      if (toPayment?.redirectUrl) {
        saveCompanions();
        const payUrl = localPath(lang, toPayment.redirectUrl),
          p: PendingBooking = {
            tourId: tour?.id || "",
            reference: r.reference,
            payUrl,
            at: Date.now(),
          };
        try {
          sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
        } catch {
          /* gizli sekme: uyarı sayfa önbellekteyken yine de görünür */
        }
        // Sayfa önbellekten geri gelirse uyarı hazır olsun.
        setPending(p);
        window.location.assign(payUrl);
        return;
      }
      setResult(r);
      saveCompanions();
      window.scrollTo({ top: 120, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
      human.reset();
      if (e instanceof ApiError && e.status === 410) {
        setHold(null);
        setStep(0);
        setSelected([]);
      }
    } finally {
      setBusy(false);
    }
  }
  if (!tour || tour.inquiryOnly)
    return (
      <div className="container empty-state">
        <h1>{t("Bu rota için birlikte plan yapalım.")}</h1>
        <Link className="btn" to="/turlar">
          {t("Tur seçeneklerine dön")}
        </Link>
      </div>
    );
  if (result)
    return (
      <div className="container booking-success">
        <div className="success-icon">
          <Check />
        </div>
        <h1>
          {cardFlow
            ? t("Koltuklarınız ayrıldı.")
            : t("Yolculuğunuzun ilk adımı tamam.")}
        </h1>
        {/* Para hiçbir zaman belirsiz kalmaz: ne ödendiği ve neyin onayı getirdiği tek cümlede. */}
        <p>
          {cardFlow
            ? t(
                "Ön rezervasyonunuz kaydedildi; koltuklarınız 24 saate kadar sizin için tutuluyor. Kaporayı kartla ödediğiniz anda rezervasyonunuz onaylanır.",
              )
            : t(
                "Ön rezervasyonunuz kaydedildi; koltuklarınız 24 saate kadar sizin için tutuluyor. Acentemiz sizinle iletişime geçecek; kaporayı havale veya nakitle ödediğinizde rezervasyonunuz onaylanır. Bu işlemde ödeme alınmadı.",
              )}
        </p>
        <PayDeposit
          catalog={catalog}
          reservation={result}
          email={contact.email}
        />
        <ReservationTicket reservation={result} catalog={catalog} />
        <div className="button-row">
          {/* Başarı sayfasında kırmızı yalnız ödeme eylemine: yazdır çerçeveli. */}
          <button className="btn btn-outline" onClick={() => window.print()}>
            <Printer size={16} /> {t("Özeti yazdır")}
          </button>
          <Link
            className="btn btn-outline"
            to={"/rezervasyonum?ref=" + encodeURIComponent(result.reference)}
          >
            {t("Rezervasyonumu sorgula")}
          </Link>
        </div>
      </div>
    );
  const seconds = hold
    ? Math.max(0, Math.floor((hold.expiresAt - now) / 1000))
    : 0;
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  async function extendHold() {
    if (!hold) return;
    setExtendBusy(true);
    setExtendError("");
    try {
      const next = await post<Hold>(`/holds/${hold.token}/extend`, {});
      setHold({ ...hold, expiresAt: next.expiresAt });
    } catch (e) {
      setExtendError((e as Error).message);
    } finally {
      setExtendBusy(false);
    }
  }
  // "Koltuk 3" ya da birden fazla koltukta "Koltuk 3, 4" (İngilizcede çoğul).
  const seatList =
    selected.length > 1
      ? t("Koltuk {seats}", { seats: selected.join(", ") })
      : t("Koltuk {n}", { n: selected.join(", ") });
  return (
    <div className="container booking-page">
      <TourLink className="back-link" tourId={tour.id}>
        <ArrowLeft size={15} /> {t("Tur detayına dön")}
      </TourLink>
      <div className="booking-page-title">
        <div>
          <h1>{t("Yolculuğunuzu planlayın.")}</h1>
          <p className="booking-page-sub">
            {tour.name}
            {departure
              ? ` · ${dateLabel(departure.date)} · ${departure.start_time}`
              : ""}
          </p>
        </div>
        {hold && (
          <span
            className={"hold-timer" + (seconds > 0 && seconds <= 120 ? " is-low" : "")}
            role="timer"
            aria-live="off"
          >
            <Clock3 size={17} />
            {t("Koltuklarınız için kalan süre: {time}", { time: clock })}
          </span>
        )}
      </div>
      {hold && seconds > 0 && seconds <= 120 && (
        // Süre bitmeden uyarı: ekran okuyucuya bir kez duyurulur.
        <div className="hold-warning" role="alert">
          <Clock3 size={18} />
          <span>
            {t(
              "Koltuklarınızın ayrılma süresi 2 dakikadan az. Bilgilerinizi tamamlamak için süreyi uzatabilirsiniz.",
            )}
          </span>
          <button
            type="button"
            className="btn btn-small"
            disabled={extendBusy}
            onClick={extendHold}
          >
            {t("Süreyi 10 dakika uzat")}
          </button>
          {extendError && <small>{extendError}</small>}
        </div>
      )}
      <ol className="booking-steps">
        {["Tarih ve koltuk", "Yolcu bilgileri", "Ön rezervasyon"].map(
          (s, i) => (
            <li
              key={s}
              className={
                (step === i ? "current" : step > i ? "complete" : "") +
                (step > i && !result ? " is-link" : "")
              }
              aria-current={step === i ? "step" : undefined}
              // Tamamlanan adıma dokunmak o adıma geri döndürür.
              {...(step > i && !result
                ? {
                    role: "button",
                    tabIndex: 0,
                    title: t("Bu adıma dön"),
                    onClick: () => backToStep(i),
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        backToStep(i);
                      }
                    },
                  }
                : {})}
            >
              <span>{step > i ? <Check size={14} /> : i + 1}</span>
              {t(s)}
            </li>
          ),
        )}
      </ol>
      <div className="booking-mini" aria-hidden="true">
        <img {...responsive(tour.image, "96px")} alt="" decoding="async" />
        <div>
          <strong>{tour.name}</strong>
          <span>
            {departure
              ? `${dateLabel(departure.date)} · ${departure.start_time}`
              : t("Tarih seçin")}
            {selected.length ? ` · ${seatList}` : ""}
          </span>
        </div>
        <div className="booking-mini-end">
          {/* Tutar değişince rakam yerine kayar (kp-tick); key yeni değeri yeniden çizer. */}
          <b key={total} className="kp-tick">
            {currency(total)}
          </b>
          {hold && seconds > 0 && (
            <small className={"mini-timer" + (seconds <= 120 ? " is-low" : "")}>
              <Clock3 size={13} />
              {`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
            </small>
          )}
        </div>
      </div>
      <div className="booking-layout">
        {/* Adım değişince içerik ilerlerken sağdan, geri dönerken soldan gelir. */}
        <div className="booking-main" data-dir={stepDir}>
          {step === 0 ? (
            <>
              {pending && (
                <div className="info-note pending-booking" role="status">
                  <Info size={20} />
                  <div>
                    <strong>
                      {t("Ödeme sayfasından ayrıldınız; {reference} numaralı rezervasyonunuz ön aşamada.", {
                        reference: pending.reference,
                      })}
                    </strong>
                    <p>
                      {t(
                        "Koltuklarınız sizin için ayrıldı; ödemeyi tamamladığınızda rezervasyonunuz kesinleşir. Kaldığınız yerden devam edebilirsiniz, yeni rezervasyon yapmanıza gerek yok. Kapora ya da tam ödeme seçimini ödeme sayfasında değiştirebilirsiniz.",
                      )}
                    </p>
                    <div className="button-row">
                      <a className="btn" href={pending.payUrl}>
                        <CreditCard size={17} /> {t("Ödemeye devam et")}
                      </a>
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => {
                          try {
                            sessionStorage.removeItem(PENDING_KEY);
                          } catch {
                            /* yok say */
                          }
                          setPending(null);
                        }}
                      >
                        {t("Başka bir rezervasyon yapacağım")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <h2 ref={stepHeading} tabIndex={-1}>
                {t("Ne zaman, hangi koltukta?")}
              </h2>
              <p className="muted">
                {t(
                  "Önce tarihinizi seçin, sonra yol arkadaşlarınızın yerini belirleyin.",
                )}
              </p>
              <div className="form-grid">
                <label className="field">
                  {t("Hareket tarihi")}
                  <select
                    value={departureId}
                    onChange={(e) => {
                      setDepartureId(e.target.value);
                      setDateNotice(false);
                      setSelected([]);
                      setError("");
                    }}
                    aria-label={t("Hareket tarihi")}
                  >
                    <option value="" disabled>
                      {loaded ? t("Uygun tarih seçin") : t("Tarihler yükleniyor…")}
                    </option>
                    {departures.map((d) => (
                      <option key={d.id} value={d.id}>
                        {dateLabel(d.date)} · {d.start_time} ·{" "}
                        {currency(d.price)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  {t("Yolcu sayısı")}
                  <select
                    value={count}
                    onChange={(e) => {
                      setCount(Number(e.target.value));
                      setSelected([]);
                    }}
                    aria-label={t("Yolcu sayısı")}
                  >
                    {Array.from(
                      { length: Math.min(vehicle.sellableSeats, MAX_SEATS) },
                      (_, i) => (
                        <option key={i} value={i + 1}>
                          {i === 0 ? t("1 kişi") : t("{n} kişi", { n: i + 1 })}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
              {dateNotice && (
                <div className="info-note" role="status">
                  <Info size={18} />
                  <p>
                    {t(
                      "Seçtiğiniz tarihte sefer yok, en yakın sefer gösteriliyor.",
                    )}
                  </p>
                </div>
              )}
              {loaded && !departures.length && (
                <div className="info-note">
                  <Info size={18} />
                  <p>
                    {t("Bu rota için açık bir tarih bulunmuyor.")}{" "}
                    <a href={telHref(catalog.business.mobile)}>
                      {t("Acente ile görüşün.")}
                    </a>
                  </p>
                </div>
              )}
              <div className="seat-selection">
                <SeatMap
                  vehicle={vehicle}
                  seats={seats}
                  selected={selected}
                  onSelect={(n) => {
                    setError("");
                    setSeatNotice("");
                    if (selected.includes(n))
                      setSelected(selected.filter((s) => s !== n));
                    else if (selected.length < count)
                      setSelected([...selected, n]);
                    // Tek yolcuda başka koltuğa dokunmak seçimi o koltuğa taşır.
                    else if (count === 1) setSelected([n]);
                    // Yolcu sayısından fazla koltuk seçilmez; sayı yukarıdan artırılır.
                    else
                      setError(
                        t(
                          "{count} yolcu için en fazla {count} koltuk seçebilirsiniz. Başka koltuk için önce seçili bir koltuğu kaldırın ya da yolcu sayısını artırın.",
                          { count },
                        ),
                      );
                  }}
                  interactive={Boolean(departureId)}
                />
                <div className="seat-selection-info">
                  <h3>
                    {t("İyi bir yolculuk,")} <br />
                    {t("iyi bir yerle başlar.")}
                  </h3>
                  <p className="muted">
                    {t(
                      "Şoförün yanındaki ön koltuk rehberinize ayrıldı. Diğer {n} koltuktan dilediğinizi seçin.",
                      { n: vehicle.sellableSeats },
                    )}
                  </p>
                  <div className="seat-legend">
                    <span>
                      <i />
                      {t("Boş")}
                    </span>
                    <span>
                      <i className="chosen" />
                      {t("Seçili")}
                    </span>
                    <span>
                      <i className="taken" />
                      {t("Dolu")}
                    </span>
                    <span>
                      <i className="crew" />
                      {t("Rehber")}
                    </span>
                  </div>
                  <div className="chosen-seats">
                    <span>{t("Seçiminiz")}</span>
                    <strong>
                      {selected.length
                        ? selected.map((n) => t("Koltuk {n}", { n })).join(", ")
                        : t("Henüz koltuk seçmediniz.")}
                    </strong>
                    <small>
                      {t("{selected} / {count} koltuk", {
                        selected: selected.length,
                        count,
                      })}
                    </small>
                    <p
                      className={"seat-notice is-" + seatNoticeTone}
                      role="status"
                      aria-live="polite"
                    >
                      {seatNotice}
                    </p>
                  </div>
                  <div className="inline-note">
                    <LockKeyhole size={16} />
                    <span>
                      {t(
                        "Devam ettiğinizde seçtiğiniz koltukları 10 dakika sizin için tutarız.",
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flow-error" role="alert">
                {error}
              </div>
              <button
                className="btn"
                ref={continueRef}
                disabled={busy || !departureId}
                onClick={chooseSeats}
              >
                {busy ? <LoaderCircle className="spin" size={17} /> : null}
                {t("Yolcu bilgilerine geç")} <ArrowRight size={17} />
              </button>
              {selected.length > 0 && (
                <div
                  className={
                    "booking-continue-bar" + (continueInView ? " is-tucked" : "")
                  }
                  aria-hidden={continueInView || undefined}
                >
                  <div>
                    <strong key={total} className="kp-tick">
                      {currency(total)}
                    </strong>
                    <span>
                      {selected.length === count
                        ? seatList
                        : t("{selected} / {count} koltuk seçildi", {
                            selected: selected.length,
                            count,
                          })}
                    </span>
                  </div>
                  <button
                    className="btn"
                    tabIndex={continueInView ? -1 : undefined}
                    disabled={busy || selected.length !== count}
                    onClick={chooseSeats}
                  >
                    {t("Devam")} <ArrowRight size={17} />
                  </button>
                </div>
              )}
            </>
          ) : step === 1 ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError("");
                const wrong = selected.findIndex((_, i) => {
                  const p = ids[i] || emptyId;
                  return (
                    !p.companionId &&
                    p.nationality === "TR" &&
                    !tcknValid(p.idNumber)
                  );
                });
                if (wrong >= 0) {
                  setError(
                    t(
                      "{n}. yolcunun T.C. kimlik numarası geçerli görünmüyor. Lütfen kontrol edin.",
                      { n: wrong + 1 },
                    ),
                  );
                  return;
                }
                goStep(2);
              }}
            >
              <h2 ref={stepHeading} tabIndex={-1}>
                {t("Yol arkadaşlarımızı tanıyalım.")}
              </h2>
              <p className="muted">
                {t(
                  "Yolcu adlarını ve sizinle iletişime geçebileceğimiz bilgileri paylaşın.",
                )}
              </p>
              {selected.map((n, i) => {
                const p = ids[i] || emptyId,
                  tr = p.nationality === "TR",
                  set = (patch: Partial<IdForm>) =>
                    setIds((v) => {
                      const next = [...v];
                      next[i] = { ...(next[i] || emptyId), ...patch };
                      return next;
                    });
                return (
                  <fieldset className="passenger-card" key={n}>
                    <legend>
                      {t("{n}. yolcu", { n: i + 1 })}{" "}
                      <span>{t("Koltuk {n}", { n })}</span>
                    </legend>
                    {companions.length > 0 && (
                      <label className="field">
                        {t("Kayıtlı yol arkadaşım")}
                        <select
                          value={p.companionId || ""}
                          onChange={(e) => {
                            const c = companions.find(
                              (c) => c.id === e.target.value,
                            );
                            set({ companionId: c?.id || "" });
                            setPassengers((v) => {
                              const next = [...v];
                              next[i] = c?.name || "";
                              return next;
                            });
                          }}
                        >
                          <option value="">
                            {t("Yeni yolcu bilgisi gireceğim")}
                          </option>
                          {companions.map((c) => (
                            <option
                              key={c.id}
                              value={c.id}
                              disabled={ids.some(
                                (x, k) => k !== i && x?.companionId === c.id,
                              )}
                            >
                              {c.name} · {c.idMasked}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {p.companionId ? (
                      (() => {
                        const c = companions.find(
                          (c) => c.id === p.companionId,
                        );
                        return (
                          <p className="companion-chosen">
                            <strong>{c?.name}</strong>
                            <small>
                              {c?.nationality === "TR"
                                ? "T.C."
                                : countryName(c?.nationality || "", lang)}{" "}
                              · {c?.idMasked} ·{" "}
                              {t("kayıtlı bilgileri kullanılacak")}
                            </small>
                          </p>
                        );
                      })()
                    ) : (
                      <>
                    <label className="field">
                      {t("Ad soyad")}
                      <input
                        value={passengers[i] || ""}
                        onChange={(e) =>
                          setPassengers((v) => {
                            const next = [...v];
                            next[i] = e.target.value;
                            return next;
                          })
                        }
                        required
                        minLength={2}
                        maxLength={100}
                        placeholder={t("Kimlikteki gibi")}
                        autoComplete="off"
                      />
                    </label>
                    <div className="form-grid">
                      <label className="field">
                        {t("Uyruk")}
                        <select
                          value={p.nationality}
                          onChange={(e) =>
                            set({ nationality: e.target.value, idNumber: "" })
                          }
                        >
                          <optgroup label={t("Sık seçilenler")}>
                            {COUNTRIES.first.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.code === "TR" ? "Türkiye (T.C.)" : c.name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label={t("Tüm ülkeler")}>
                            {COUNTRIES.rest.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.name}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </label>
                      <label className="field">
                        {tr ? t("T.C. kimlik numarası") : t("Pasaport numarası")}
                        <input
                          value={p.idNumber}
                          onChange={(e) =>
                            set({
                              idNumber: tr
                                ? e.target.value.replace(/\D/g, "")
                                : e.target.value.toUpperCase(),
                            })
                          }
                          inputMode={tr ? "numeric" : "text"}
                          maxLength={tr ? 11 : 20}
                          minLength={tr ? 11 : 5}
                          pattern={tr ? "[1-9][0-9]{10}" : "[A-Za-z0-9 ]{5,20}"}
                          required
                          autoComplete="off"
                        />
                      </label>
                      <div className="field gender-field" role="radiogroup">
                        <span>{t("Cinsiyet")}</span>
                        <div className="choice-inline">
                          {(
                            [
                              ["K", "Kadın"],
                              ["E", "Erkek"],
                            ] as const
                          ).map(([value, label]) => (
                            <label key={value}>
                              <input
                                type="radio"
                                name={"gender-" + n}
                                value={value}
                                checked={p.gender === value}
                                onChange={() => set({ gender: value })}
                                required
                              />
                              {t(label)}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    {member && (
                      <label className="checkbox-label companion-save">
                        <input
                          type="checkbox"
                          checked={Boolean(p.save)}
                          onChange={(e) => set({ save: e.target.checked })}
                        />
                        <span>
                          {t(
                            "Bu yolcuyu yol arkadaşlarıma kaydet. Bilgilerini onun bilgisi dahilinde, sonraki rezervasyonlarımda kullanmak üzere kaydettiğimi ve kendisini aydınlatma metni hakkında bilgilendireceğimi beyan ederim.",
                          )}
                        </span>
                      </label>
                    )}
                      </>
                    )}
                  </fieldset>
                );
              })}
              <p className="id-note">
                <ShieldCheck size={17} />
                <span>
                  {t(
                    "Kimlik bilgileri, turizm taşımacılığında zorunlu olan yolcu listesi bildirimi (U-ETDS) için istenir. Bu bilgileri yalnız acentemiz görür; size gönderilen belgede numaranın yalnız son 3 hanesi yer alır.",
                  )}
                </span>
              </p>
              <h3 className="contact-heading">{t("İletişim kişisi")}</h3>
              <label className="field">
                {t("Adınız soyadınız")}
                <input
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                  value={contact.name}
                  onChange={(e) =>
                    setContact({ ...contact, name: e.target.value })
                  }
                />
              </label>
              <div className="form-grid">
                <label className="field">
                  {t("E-posta adresiniz")}
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={contact.email}
                    readOnly={Boolean(member)}
                    onChange={(e) =>
                      setContact({ ...contact, email: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  {t("Telefon numaranız")}
                  <input
                    type="tel"
                    autoComplete="tel"
                    required
                    minLength={10}
                    maxLength={24}
                    value={contact.phone}
                    onChange={(e) =>
                      setContact({ ...contact, phone: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="flow-error" role="alert">
                {error}
              </div>
              <div className="flow-actions">
                <button className="text-link" type="button" onClick={back}>
                  <ArrowLeft size={15} /> {t("Koltuk seçimine dön")}
                </button>
                <button className="btn">
                  {t("Özeti incele")} <ArrowRight size={17} />
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={submit}>
              <h2 ref={stepHeading} tabIndex={-1}>
                {t("Son bir kez göz atalım.")}
              </h2>
              <p className="muted">
                {catalog.payment.enabled
                  ? t(
                      "Ödeme planınızı seçin. Ödemeyi ön rezervasyonunuz oluşunca, bir sonraki adımda kartla yaparsınız.",
                    )
                  : t("Ödeme planınızı seçin. Bu adımda ödeme alınmaz.")}
              </p>
              <div className="confirmation-passengers">
                {selected.map((n, i) => (
                  <div key={n}>
                    <span>{t("Koltuk {n}", { n })}</span>
                    <strong>{passengers[i]}</strong>
                    <small>
                      {(() => {
                        const p = ids[i] || emptyId,
                          c = companions.find((c) => c.id === p.companionId),
                          nat = c?.nationality || p.nationality || "TR";
                        return `${nat === "TR" ? "T.C." : countryName(nat, lang)} · ${
                          c ? c.idMasked : maskId(p.idNumber)
                        } · ${(c?.gender || p.gender) === "E" ? t("Erkek") : t("Kadın")}`;
                      })()}
                    </small>
                  </div>
                ))}
              </div>
              <div className="payment-choices">
                {[
                  // Kapora sunucuda hesaplanır; teklif gelmeden gösterilmez.
                  [
                    "deposit",
                    t("%30 kapora"),
                    quote?.deposit ?? Math.round(total * 0.3),
                  ],
                  ["full", t("Tam ödeme"), total],
                ].map(([value, title, amount]) => (
                  <label
                    className={
                      "payment-choice " + (mode === value ? "active" : "")
                    }
                    key={value}
                  >
                    <input
                      type="radio"
                      name="paymentMode"
                      value={value}
                      checked={mode === value}
                      onChange={() => setMode(String(value))}
                    />
                    <span>
                      <strong>{title}</strong>
                      <small>
                        {catalog.payment.enabled
                          ? t("Kartla ödeyince anında onay")
                          : catalog.payment.preview
                            ? t("Sonraki adımda kartla")
                            : t("Acente onayından sonra")}
                      </small>
                    </span>
                    <strong>{currency(Number(amount))}</strong>
                  </label>
                ))}
              </div>
              <div className="info-note">
                <Info size={20} />
                <div>
                  {catalog.payment.enabled ? (
                    <>
                      <strong>{t("Ödemeyi bir sonraki adımda kartla yapın.")}</strong>
                      <p>
                        {t(
                          "Ön rezervasyonunuz oluşunca kart ödeme ekranına yönlendirilirsiniz. Seçtiğiniz tutarı 3D Secure (SMS onayı) ile ödersiniz; ödeme alınınca rezervasyonunuz anında onaylanır.",
                        )}
                      </p>
                    </>
                  ) : catalog.payment.preview ? (
                    <>
                      <strong>{t("Ödemeyi bir sonraki adımda kartla yapın.")}</strong>
                      <p>
                        {t(
                          "Ön rezervasyonunuz oluşunca kart ödeme ekranına yönlendirilirsiniz. Kartla ödeme banka onayının ardından açılacak; o zamana kadar kartınızdan çekim yapılmaz.",
                        )}
                      </p>
                    </>
                  ) : (
                    <>
                      <strong>{t("Ödeme havale veya nakitle yapılır.")}</strong>
                      <p>
                        {t(
                          "Ön rezervasyonunuzu gönderin; acentemiz sizinle iletişime geçip ödeme bilgilerini iletir. Kaporanız kaydedilince rezervasyonunuz onaylanır. Online kartla ödeme henüz aktif değil.",
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <section className="pre-info" aria-labelledby="pre-info-title">
                <div className="pre-info-head">
                  <FileText size={18} aria-hidden="true" />
                  <div>
                    <h3 id="pre-info-title">{t("Ön Bilgilendirme Formu")}</h3>
                    <p>
                      {t(
                        "Göndermeden önce okuyun. Onayladığınız metin rezervasyonunuza kaydedilir ve e-postanıza gönderilir.",
                      )}
                    </p>
                  </div>
                </div>
                {lang === "en" && (
                  <p className="pre-info-lang">
                    {t(
                      "Bu formun bağlayıcı metni Türkçedir. Temel koşullar: {policy}",
                      { policy: catalog.cancellationPolicy },
                    )}
                  </p>
                )}
                {preInfo?.lateBooking && catalog.payment.enabled && (
                  <div className="info-note pre-info-late" role="note">
                    <Info size={18} />
                    <p>
                      {t(
                        "Son dakika rezervasyonu: tur hareketine {days} günden az kaldı. Ödeme yaptıktan sonra iptal ederseniz kapora iade edilmez.",
                        { days: preInfo.freeCancelDays },
                      )}
                    </p>
                  </div>
                )}
                <div
                  className="pre-info-text"
                  tabIndex={0}
                  role="region"
                  aria-label={t("Ön Bilgilendirme Formu metni")}
                  lang="tr"
                >
                  {preInfo
                    ? preInfo.text
                    : preInfoError || t("Form hazırlanıyor…")}
                </div>
              </section>
              <LegalConsents
                value={consents}
                onChange={(next) => {
                  setConsents(next);
                  if (consentsComplete(next)) setConsentError("");
                }}
                documents={
                  preInfo && {
                    preInfo: preInfo.text,
                    contract: preInfo.contract,
                    cancellation: preInfo.cancellation,
                  }
                }
                error={consentError}
              />
              <p className="legal-notice-line">
                {cardFlow
                  ? t("Rezervasyonunuz kartla ödemeyle birlikte kesinleşir.")
                  : t(
                      "Online ödeme yaparsanız rezervasyonunuz ödemeyle birlikte kesinleşir; havale veya nakit ödemede sözleşme acente onayıyla kurulur.",
                    )}
              </p>
              {count > 1 && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={othersDeclaration}
                    onChange={(e) => setOthersDeclaration(e.target.checked)}
                    required
                  />
                  <span>
                    {t(
                      "Diğer yolcuların bilgilerini onların bilgisi dahilinde girdiğimi, kimlik bilgilerinin kimlik belgeleriyle aynı olduğunu ve bu kişileri aydınlatma metni hakkında bilgilendireceğimi beyan ederim.",
                    )}
                  </span>
                </label>
              )}
              <label className="checkbox-label optional-consent">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                />
                <span>
                  {t(
                    "İsteğe bağlı: Kampanya, indirim ve yeni rotalar hakkında bana e-posta ve SMS ile ticari elektronik ileti gönderilmesine ve bu amaçla ad, e-posta ve telefon bilgilerimin işlenmesine onay veriyorum. Onayımı dilediğim zaman ücretsiz geri alabilirim.",
                  )}
                </span>
              </label>
              <p className="legal-notice-line">
                {t("Kişisel verileriniz {notice} kapsamında işlenir.")
                  .split(/(\{notice\})/)
                  .map((part, k) =>
                    part === "{notice}" ? (
                      <Link key={k} to="/bilgilendirme#kvkk" target="_blank">
                        {t("Aydınlatma Metni")}
                      </Link>
                    ) : (
                      part
                    ),
                  )}
              </p>
              {human.widget}
              <div className="flow-error" role="alert">
                {error}
              </div>
              <div className="flow-actions">
                <button className="text-link" type="button" onClick={back}>
                  <ArrowLeft size={15} /> {t("Bilgileri düzenle")}
                </button>
                <button
                  className="btn"
                  disabled={
                    busy || quoteBusy || Boolean(quoteError) || !quote || !human.ready
                  }
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Ticket size={17} />
                  )}
                  {cardFlow ? t("Ödemeye geç") : t("Ön rezervasyon oluştur")}
                </button>
              </div>
            </form>
          )}
        </div>
        <aside className="booking-summary" ref={summaryRef}>
          {/* Masaüstünde sabit özet: 2. adımı doldururken kalan süre ve uzatma hep görünür. */}
          {hold && seconds > 0 && (
            <div className={"summary-hold" + (seconds <= 120 ? " is-low" : "")}>
              <Clock3 size={16} />
              <span>{t("Koltuklarınız için kalan süre: {time}", { time: clock })}</span>
              {seconds <= 120 && (
                <button
                  type="button"
                  className="text-link"
                  disabled={extendBusy}
                  onClick={extendHold}
                >
                  {t("Süreyi 10 dakika uzat")}
                </button>
              )}
            </div>
          )}
          <div className="booking-summary-photo">
            <img
              {...responsive(tour.image, "320px")}
              alt={tour.name}
              loading="lazy"
              decoding="async"
            />
            <span className="booking-summary-ribbon" aria-hidden="true">
              {placeName(tour)}
            </span>
          </div>
          <div>
            <h3>{tour.name}</h3>
            <p>
              <CalendarDays size={15} />
              {departure ? dateLabel(departure.date) : t("Tarih seçin")}
            </p>
            <p>
              <Clock3 size={15} />
              {t("{time} hareket", {
                time: departure?.start_time || tour.departure,
              })}
            </p>
            <p>
              <Armchair size={15} />
              {count === 1 ? t("1 yolcu") : t("{n} yolcu", { n: count })} ·{" "}
              {vehicle.passengerSeats}+1{" "}
              {vehicle.unit ? vehicle.unit.name : vehicle.name}
            </p>
            {selected.length > 0 && (
              <p>
                <Ticket size={15} />
                {seatList}
              </p>
            )}
            {departure?.pickup && (
              <p>
                <MapPin size={15} />
                {departure.pickup}
              </p>
            )}
            <div className="booking-coupon">
              {couponError && (
                <small className="form-error" role="alert">
                  {couponError}
                </small>
              )}
              {member ? (
                <label className="field">
                  {t("Üyelik kuponunuz")}
                  <select
                    aria-label={t("İndirim kuponu")}
                    value={couponId}
                    disabled={busy}
                    onChange={(e) => setCouponId(e.target.value)}
                  >
                    <option value="">{t("Kupon kullanma")}</option>
                    {coupons.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.kind === "amount"
                          ? currency(c.amount || 0)
                          : t("%{p}", { p: c.percent })}{" "}
                        ·{" "}
                        {c.source === "wheel"
                          ? t("Şans çarkı")
                          : t("Arkadaş daveti")}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                // Koltuk seçildikten sonra kullanıcıyı rezervasyondan çıkaran bağlantı gösterilmez.
                !selected.length &&
                !hold && (
                  <p>
                    <Link to={membershipHref}>{t("Üye olun")}</Link>
                    {t(", çarkı çevirin ve tur indirimi kazanın.")}
                  </p>
                )
              )}
              {quoteBusy && <small role="status">{t("Fiyat hesaplanıyor…")}</small>}
              {quoteError && (
                <p className="error" role="alert">
                  {quoteError}
                </p>
              )}
              {quote && quote.discount > 0 && (
                <div className="coupon-savings">
                  <span>
                    {t("Tur bedeli {amount}", {
                      amount: currency(quote.subtotal),
                    })}
                  </span>
                  <strong>
                    {t("Üyelik indirimi −{amount}", {
                      amount: currency(quote.discount),
                    })}
                  </strong>
                </div>
              )}
            </div>
            <div className="summary-total">
              <span>
                {quote && quote.discount > 0
                  ? catalog.demo
                    ? t("İndirim sonrası örnek tur bedeli")
                    : t("İndirim sonrası tur bedeli")
                  : catalog.demo
                    ? t("Örnek tur bedeli")
                    : t("Tur bedeli")}
              </span>
              <strong key={total} className="kp-tick">
                {currency(total)}
              </strong>
            </div>
            {catalog.demo && (
              <small>{t("Fiyatlar ve tarihler örnek demo verisidir.")}</small>
            )}
            <div className="summary-payment">
              <ShieldCheck size={17} />
              <span>
                {catalog.payment.enabled
                  ? t("Bu adımda ödeme alınmaz; kartla ödeme sonraki adımdadır.")
                  : t("Şimdi ödeme alınmaz.")}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
