import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Info,
  LockKeyhole,
  LoaderCircle,
  Ticket,
  Printer,
  CalendarDays,
  Armchair,
  ShieldCheck,
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
} from "../lib/types";
import { SeatMap } from "../components/SeatMap";
export function Booking({ catalog }: { catalog: Catalog }) {
  const { tourId } = useParams(),
    [params] = useSearchParams(),
    tour = catalog.tours.find((t) => t.id === tourId),
    [departures, setDepartures] = useState<Departure[]>([]),
    [departureId, setDepartureId] = useState(""),
    [count, setCount] = useState(
      Math.min(17, Math.max(1, Number(params.get("guests")) || 1)),
    ),
    [seats, setSeats] = useState<Seat[]>([]),
    [selected, setSelected] = useState<number[]>([]),
    [step, setStep] = useState(0),
    [hold, setHold] = useState<Hold | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now()),
    [result, setResult] = useState<Reservation | null>(null),
    [mode, setMode] = useState("deposit"),
    [passengers, setPassengers] = useState<string[]>([]),
    [contact, setContact] = useState({ name: "", email: "", phone: "" }),
    [consent, setConsent] = useState(false),
    [loaded, setLoaded] = useState(false);
  const holdRef = useRef<Hold | null>(null);
  holdRef.current = hold;
  const departure = departures.find((d) => d.id === departureId),
    total = (departure?.price || tour?.price || 0) * count;
  useEffect(() => {
    let active = true;
    setLoaded(false);
    if (tour && !tour.inquiryOnly)
      api<Departure[]>(`/tours/${tour.id}/departures`)
        .then((ds) => {
          if (!active) return;
          setDepartures(ds);
          setDepartureId(
            ds.find((d) => d.date === params.get("date"))?.id ||
              ds[0]?.id ||
              "",
          );
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
      api<{ seats: Seat[] }>(`/departures/${departureId}/seats`)
        .then((d) => {
          if (active) setSeats(d.seats);
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
      setError("Koltuk ayırma süreniz doldu. Yeniden koltuk seçebilirsiniz.");
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
      setError(`${count} yolcu için ${count} koltuk seçin.`);
      return;
    }
    setBusy(true);
    try {
      const h = await post<Hold>("/holds", { departureId, seats: selected });
      setHold(h);
      setStep(1);
      window.scrollTo({ top: 120, behavior: "smooth" });
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
  async function back() {
    if (step === 1) {
      if (hold)
        await api(`/holds/${hold.token}`, { method: "DELETE" }).catch(() => {});
      setHold(null);
    }
    setStep(Math.max(0, step - 1));
    setError("");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!hold) {
      setStep(0);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await post<Reservation>("/reservations", {
        holdToken: hold.token,
        ...contact,
        passengers: passengers.slice(0, count),
        paymentMode: mode,
        consent,
      });
      holdRef.current = null;
      setHold(null);
      setResult(r);
      window.scrollTo({ top: 120, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
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
        <h1>Bu rota için birlikte plan yapalım.</h1>
        <Link className="btn" to="/turlar">
          Tur seçeneklerine dön
        </Link>
      </div>
    );
  if (result)
    return (
      <div className="container booking-success">
        <div className="success-icon">
          <Check />
        </div>
        <span className="section-note">Rota Kars ön rezervasyon</span>
        <h1>Yolculuğunuzun ilk adımı tamam.</h1>
        <p>
          Talebiniz kaydedildi. Kesin rezervasyon için acente teyidi gerekir.
          <br />
          Bu işlemde ödeme alınmadı.
        </p>
        <ReservationTicket reservation={result} catalog={catalog} />
        <div className="button-row">
          <button className="btn" onClick={() => window.print()}>
            <Printer size={16} /> Özeti yazdır
          </button>
          <Link className="btn btn-outline" to="/rezervasyonum">
            Rezervasyonumu sorgula
          </Link>
        </div>
      </div>
    );
  const seconds = hold
    ? Math.max(0, Math.floor((hold.expiresAt - now) / 1000))
    : 0;
  return (
    <div className="container booking-page">
      <Link className="back-link" to={"/turlar/" + tour.id}>
        <ArrowLeft size={15} /> Tur detayına dön
      </Link>
      <div className="booking-page-title">
        <div>
          <span className="section-note">{tour.name}</span>
          <h1>Yolculuğunuzu planlayın.</h1>
        </div>
        {hold && (
          <span className="hold-timer" role="timer">
            <Clock3 size={17} />
            Koltuklarınız {Math.floor(seconds / 60)}:
            {String(seconds % 60).padStart(2, "0")} dakika ayrıldı
          </span>
        )}
      </div>
      <ol className="booking-steps">
        {["Tarih ve koltuk", "Yolcu bilgileri", "Ön rezervasyon"].map(
          (s, i) => (
            <li
              key={s}
              className={step === i ? "current" : step > i ? "complete" : ""}
            >
              <span>{step > i ? <Check size={14} /> : i + 1}</span>
              {s}
            </li>
          ),
        )}
      </ol>
      <div className="booking-layout">
        <div className="booking-main">
          {step === 0 ? (
            <>
              <h2>Ne zaman, hangi koltukta?</h2>
              <p className="muted">
                Önce tarihinizi seçin, sonra yol arkadaşlarınızın yerini
                belirleyin.
              </p>
              <div className="form-grid">
                <label className="field">
                  Hareket tarihi
                  <select
                    value={departureId}
                    onChange={(e) => {
                      setDepartureId(e.target.value);
                      setSelected([]);
                      setError("");
                    }}
                    aria-label="Hareket tarihi"
                  >
                    <option value="" disabled>
                      {loaded ? "Uygun tarih seçin" : "Tarihler yükleniyor…"}
                    </option>
                    {departures.map((d) => (
                      <option key={d.id} value={d.id}>
                        {dateLabel(d.date)} · Örnek sefer
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Yolcu sayısı
                  <select
                    value={count}
                    onChange={(e) => {
                      setCount(Number(e.target.value));
                      setSelected([]);
                    }}
                    aria-label="Yolcu sayısı"
                  >
                    {Array.from({ length: 17 }, (_, i) => (
                      <option key={i} value={i + 1}>
                        {i + 1} kişi
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {loaded && !departures.length && (
                <div className="info-note">
                  <Info size={18} />
                  <p>
                    Bu rota için açık bir tarih bulunmuyor.{" "}
                    <a href="tel:+905459353410">Acente ile görüşün.</a>
                  </p>
                </div>
              )}
              <div className="seat-selection">
                <SeatMap
                  vehicle={catalog.vehicle}
                  seats={seats}
                  selected={selected}
                  onSelect={(n) => {
                    setError("");
                    if (selected.includes(n))
                      setSelected(selected.filter((s) => s !== n));
                    else if (selected.length < count)
                      setSelected([...selected, n]);
                    else
                      setError(
                        `${count} yolcu için en fazla ${count} koltuk seçebilirsiniz.`,
                      );
                  }}
                  interactive={Boolean(departureId)}
                />
                <div className="seat-selection-info">
                  <h3>
                    İyi bir yolculuk, <br />
                    iyi bir yerle başlar.
                  </h3>
                  <p className="muted">
                    Şoförün yanındaki ön koltuk rehberinize ayrıldı. Diğer 17
                    koltuktan dilediğinizi seçin.
                  </p>
                  <div className="seat-legend">
                    <span>
                      <i />
                      Boş
                    </span>
                    <span>
                      <i className="chosen" />
                      Seçili
                    </span>
                    <span>
                      <i className="taken" />
                      Dolu
                    </span>
                    <span>
                      <i className="crew" />
                      Rehber
                    </span>
                  </div>
                  <div className="chosen-seats">
                    <span>Seçiminiz</span>
                    <strong>
                      {selected.length
                        ? selected.map((n) => `Koltuk ${n}`).join(", ")
                        : "Henüz koltuk seçmediniz."}
                    </strong>
                    <small>
                      {selected.length} / {count} koltuk
                    </small>
                  </div>
                  <div className="inline-note">
                    <LockKeyhole size={16} />
                    <span>
                      Devam ettiğinizde seçtiğiniz koltukları 10 dakika sizin
                      için tutarız.
                    </span>
                  </div>
                </div>
              </div>
              <div className="flow-error" role="alert">
                {error}
              </div>
              <button
                className="btn"
                disabled={busy || !departureId}
                onClick={chooseSeats}
              >
                {busy ? <LoaderCircle className="spin" size={17} /> : null}Yolcu
                bilgilerine geç <ArrowRight size={17} />
              </button>
            </>
          ) : step === 1 ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError("");
                setStep(2);
                window.scrollTo({ top: 120, behavior: "smooth" });
              }}
            >
              <h2>Yol arkadaşlarımızı tanıyalım.</h2>
              <p className="muted">
                Yolcu adlarını ve sizinle iletişime geçebileceğimiz bilgileri
                paylaşın.
              </p>
              {selected.map((n, i) => (
                <label className="field" key={n}>
                  {i + 1}. yolcu · Koltuk {n}
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
                    placeholder="Ad soyad"
                    autoComplete="off"
                  />
                </label>
              ))}
              <h3 className="contact-heading">İletişim kişisi</h3>
              <label className="field">
                Adınız soyadınız
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
                  E-posta adresiniz
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={contact.email}
                    onChange={(e) =>
                      setContact({ ...contact, email: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  Telefon numaranız
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
              <div className="flow-actions">
                <button className="text-link" type="button" onClick={back}>
                  <ArrowLeft size={15} /> Koltuk seçimine dön
                </button>
                <button className="btn">
                  Özeti incele <ArrowRight size={17} />
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={submit}>
              <h2>Son bir kez göz atalım.</h2>
              <p className="muted">
                Tercih ettiğiniz ödeme planını belirleyin. Bu adımda tahsilat
                yapılmaz.
              </p>
              <div className="confirmation-passengers">
                {selected.map((n, i) => (
                  <div key={n}>
                    <span>Koltuk {n}</span>
                    <strong>{passengers[i]}</strong>
                  </div>
                ))}
              </div>
              <div className="payment-choices">
                {[
                  ["deposit", "%30 kapora", Math.round(total * 0.3)],
                  ["full", "Tam ödeme", total],
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
                      <small>Acente onayından sonra</small>
                    </span>
                    <strong>{currency(Number(amount))}</strong>
                  </label>
                ))}
              </div>
              <div className="info-note">
                <Info size={20} />
                <div>
                  <strong>Online ödeme henüz aktif değil.</strong>
                  <p>
                    Ön rezervasyon talebinizi iletebilirsiniz. Ödeme seçenekleri
                    ve kesin rezervasyon için acentemizle iletişime geçin.
                  </p>
                </div>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                />
                <span>
                  <Link to="/bilgilendirme" target="_blank">
                    Ön rezervasyon ve aydınlatma metnini
                  </Link>{" "}
                  okudum. Bu talebin kesin bilet olmadığını ve ödeme
                  alınmayacağını biliyorum.
                </span>
              </label>
              <div className="flow-error" role="alert">
                {error}
              </div>
              <div className="flow-actions">
                <button className="text-link" type="button" onClick={back}>
                  <ArrowLeft size={15} /> Bilgileri düzenle
                </button>
                <button className="btn" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Ticket size={17} />
                  )}
                  Ön rezervasyon oluştur
                </button>
              </div>
            </form>
          )}
        </div>
        <aside className="booking-summary">
          <img src={tour.image} alt={tour.name} />
          <div>
            <span className="section-note">Yolculuğunuz</span>
            <h3>{tour.name}</h3>
            <p>
              <CalendarDays size={15} />
              {departure ? dateLabel(departure.date) : "Tarih seçin"}
            </p>
            <p>
              <Clock3 size={15} />
              {tour.departure} hareket
            </p>
            <p>
              <Armchair size={15} />
              {count} yolcu · 18+1 VIP midibüs
            </p>
            <div className="summary-total">
              <span>Toplam örnek tur bedeli</span>
              <strong>{currency(total)}</strong>
            </div>
            <small>Fiyatlar ve tarihler yerel geliştirme verisidir.</small>
            <div className="summary-payment">
              <ShieldCheck size={17} />
              <span>Şimdi ödeme alınmaz.</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
export function ReservationTicket({
  reservation: r,
  catalog,
}: {
  reservation: Reservation;
  catalog: Catalog;
}) {
  const t = catalog.tours.find((t) => t.id === r.tourId);
  return (
    <article className="reservation-ticket">
      <div className="ticket-top">
        <span>
          <Ticket size={22} /> Rota Kars
        </span>
        <span
          className={
            "status-tag " + (r.status === "pending_agency" ? "" : "inactive")
          }
        >
          {r.status === "pending_agency"
            ? "Acente onayı bekliyor"
            : r.status === "cancelled"
              ? "İptal edildi"
              : r.status === "expired"
                ? "Süresi doldu"
                : r.status}
        </span>
      </div>
      <h2>{t?.name || r.tourId}</h2>
      <div className="ticket-data">
        <div>
          <span>Referans numarası</span>
          <strong>{r.reference}</strong>
        </div>
        <div>
          <span>Tur tarihi</span>
          <strong>{dateLabel(r.date)}</strong>
        </div>
        <div>
          <span>Koltuklar</span>
          <strong>{r.seats.join(", ")}</strong>
        </div>
        <div>
          <span>Yolcular</span>
          <strong>{r.passengers.join(", ")}</strong>
        </div>
        <div>
          <span>Toplam tur bedeli</span>
          <strong>{currency(r.total)}</strong>
        </div>
        <div>
          <span>Tercih edilen ilk ödeme</span>
          <strong>
            {currency(r.deposit)} <small>(tahsil edilmedi)</small>
          </strong>
        </div>
      </div>
      <div className="ticket-bottom">
        <Info size={16} />
        <p>
          Bu kayıt kesin bilet değildir. Onaylanmayan ön rezervasyonda koltuklar
          24 saat sonra serbest kalır. Referansınızı ve e-posta adresinizi
          saklayın.
        </p>
      </div>
    </article>
  );
}
