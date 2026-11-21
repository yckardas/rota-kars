// Ana sayfanın arama çubuğu: rota, tarih ve yolcu. Üç kutu da tarayıcının kendi açılır
// listesi yerine sitenin tasarımında açılır (kutuyla açılan pencere aynı görünür).
// Rota kutusuna yazılabilir; listede olmayan bir yer yazılırsa müşteri WhatsApp'tan
// yazabilir ya da size özel tur talebi bırakabilir.
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type Ref,
} from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Search,
  Send,
  Users,
} from "lucide-react";
import { RequestForm } from "./RequestForm";
import { api } from "../lib/api";
import { useLang, useLocalNavigate } from "../lib/i18n";
import { responsive } from "../lib/images";
import { openFirst, placeName, searchKey as plain } from "../lib/place";
import { tourTone, toneStyle } from "../lib/tone";
import {
  dateLabel,
  today,
  type Catalog,
  type Departure,
  type Tour,
} from "../lib/types";
import { whatsappLink } from "../lib/whatsapp";

type Panel = "tour" | "date" | "guests" | null;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function HeroSearch({
  catalog,
  formRef,
}: {
  catalog: Catalog;
  formRef?: Ref<HTMLFormElement>;
}) {
  const { t, locale } = useLang();
  const navigate = useLocalNavigate();
  const ids = useId();
  const box = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState<Panel>(null),
    [query, setQuery] = useState(""),
    [tourId, setTourId] = useState(""),
    [active, setActive] = useState(-1),
    [date, setDate] = useState(""),
    [guests, setGuests] = useState(1),
    [request, setRequest] = useState(false);

  // Satışta olanlar üstte, kapalılar altta.
  const tours = useMemo(() => openFirst(catalog.tours), [catalog.tours]);
  const picked = tours.find((x) => x.id === tourId);
  const q = plain(query);
  const matches = picked
    ? tours
    : tours.filter((x) =>
        plain(`${placeName(x)} ${x.name} ${x.location}`).includes(q),
      );
  const typed = query.trim() && !picked ? query.trim() : "";

  // Tek rezervasyonda en fazla 4 yolcu; büyük gruplar acenteyle planlanır.
  const guestLimit = Math.min(
    4,
    picked?.vehicle.sellableSeats ||
      Math.max(
        ...catalog.tours
          .filter((x) => x.salesOpen)
          .map((x) => x.vehicle.sellableSeats),
        1,
      ),
  );
  useEffect(() => {
    if (guests > guestLimit) setGuests(guestLimit);
  }, [guestLimit, guests]);

  // Dışarı tıklanınca ya da Esc'e basılınca açık pencere kapanır.
  useEffect(() => {
    if (!panel) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setPanel(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [panel]);

  function choose(tour: Tour) {
    setTourId(tour.id);
    // "Ani · Ani, Çıldır ve Kars" yerine yalnız tur adı; adda yer geçmiyorsa ikisi birden.
    const place = placeName(tour);
    setQuery(
      plain(tour.name).includes(plain(place))
        ? tour.name
        : `${place} · ${tour.name}`,
    );
    setPanel(null);
    setActive(-1);
  }
  function go(tour: Tour) {
    // Talep toplayan, satışa kapalı ya da yalnız bilgi verilen turda koltuk seçilmez:
    // tur sayfasına gidilir.
    if (tour.mode === "demand" || !tour.salesOpen || tour.inquiryOnly)
      navigate(`/turlar/${tour.id}`);
    else navigate(`/rezervasyon/${tour.id}?date=${date}&guests=${guests}`);
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPanel(null);
    if (picked) return go(picked);
    if (!typed) return navigate("/turlar");
    if (matches.length === 1) return go(matches[0]);
    if (matches.length > 1)
      return navigate(`/turlar?q=${encodeURIComponent(typed)}`);
    setRequest(true);
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setPanel("tour");
      const n = matches.length;
      if (n)
        setActive((i) =>
          e.key === "ArrowDown" ? (i + 1) % n : (i <= 0 ? n : i) - 1,
        );
    } else if (
      e.key === "Enter" &&
      panel === "tour" &&
      active >= 0 &&
      matches[active]
    ) {
      e.preventDefault();
      choose(matches[active]);
    } else if (e.key === "Escape" && panel) {
      e.preventDefault();
      setPanel(null);
    }
  }
  // Pencerede Esc: pencere kapanır, odak açan kutuya döner.
  function closeOnEscape(e: KeyboardEvent<HTMLElement>, back: string) {
    if (e.key !== "Escape") return;
    e.preventDefault();
    setPanel(null);
    document.getElementById(back)?.focus();
  }

  const wa = catalog.business.whatsapp;
  const waText = typed
    ? t("Merhaba, {place} için tur düşünüyorum. Bilgi alabilir miyim?", {
        place: typed,
      })
    : t("Merhaba, listede olmayan bir rota için bilgi almak istiyorum.");
  const contact = (
    <div className="rk-pop-foot">
      <p>
        {typed && !matches.length ? (
          <>
            <strong>
              {t("“{q}” için hazır bir turumuz yok.", { q: typed })}
            </strong>{" "}
            {t("Sizin için planlayalım: bize yazın, dönüş yapalım.")}
          </>
        ) : (
          <>
            <strong>{t("Listede olmayan bir rota mı?")}</strong>{" "}
            {t("Sizin için planlayalım: bize yazın, dönüş yapalım.")}
          </>
        )}
      </p>
      <div className="rk-pop-actions">
        {wa && (
          <a
            className="rk-pill rk-pill-wa"
            href={whatsappLink(wa, waText)}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={16} aria-hidden="true" />{" "}
            {t("WhatsApp’tan yazın")}
          </a>
        )}
        <button
          type="button"
          className="rk-pill rk-pill-line"
          onClick={() => {
            setPanel(null);
            setRequest(true);
          }}
        >
          <Send size={15} aria-hidden="true" /> {t("Talep bırakın")}
        </button>
      </div>
    </div>
  );

  const listId = ids + "-list",
    tourBtn = ids + "-tour",
    dateBtn = ids + "-date",
    guestBtn = ids + "-guests";

  return (
    <>
      <form className="rk-search" onSubmit={submit} ref={formRef}>
        <div className="rk-search-fields" ref={box}>
          <div
            className="rk-field rk-field-tour"
            data-open={panel === "tour" || undefined}
          >
            <label className="rk-field-hit" htmlFor={tourBtn}>
              <MapPin size={20} aria-hidden="true" />
              <span className="rk-field-label">{t("Rota")}</span>
              <input
                id={tourBtn}
                ref={input}
                type="text"
                name="q"
                role="combobox"
                autoComplete="off"
                enterKeyHint="search"
                aria-expanded={panel === "tour"}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={
                  panel === "tour" && active >= 0
                    ? `${listId}-${active}`
                    : undefined
                }
                placeholder={t("Nereye gitmek istersiniz?")}
                value={query}
                maxLength={60}
                onFocus={() => setPanel("tour")}
                onClick={() => setPanel("tour")}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setTourId("");
                  setActive(-1);
                  setPanel("tour");
                }}
                onKeyDown={onKey}
              />
            </label>
            {panel === "tour" && (
              <div className="rk-pop rk-pop-tour">
                {matches.length > 0 && (
                  <ul
                    className="rk-options"
                    id={listId}
                    role="listbox"
                    aria-label={t("Rotalar")}
                  >
                    {matches.map((tour, k) => (
                      <li
                        key={tour.id}
                        id={`${listId}-${k}`}
                        role="option"
                        aria-selected={tour.id === tourId}
                        className={
                          "rk-option" + (k === active ? " is-active" : "")
                        }
                        style={toneStyle(tourTone(tour))}
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => choose(tour)}
                        onMouseEnter={() => setActive(k)}
                      >
                        <img
                          {...responsive(tour.image, "56px")}
                          alt=""
                          width="56"
                          height="56"
                          loading="lazy"
                          decoding="async"
                        />
                        <span className="rk-option-text">
                          <b>{placeName(tour)}</b>
                          <small>{tour.name}</small>
                        </span>
                        {tour.salesOpen ? (
                          <span className="rk-option-tag">{tour.duration}</span>
                        ) : (
                          <span className="rk-option-tag is-closed">
                            {t("Satışa kapalı")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {contact}
              </div>
            )}
          </div>

          <div className="rk-field" data-open={panel === "date" || undefined}>
            <button
              id={dateBtn}
              type="button"
              className="rk-field-hit"
              aria-haspopup="dialog"
              aria-expanded={panel === "date"}
              onClick={() => setPanel(panel === "date" ? null : "date")}
            >
              <CalendarDays size={20} aria-hidden="true" />
              <span className="rk-field-label">{t("Tarih")}</span>
              <span className={"rk-field-value" + (date ? "" : " is-empty")}>
                {date ? dateLabel(date) : t("Tarih seçin")}
              </span>
            </button>
            {panel === "date" && (
              <div
                className="rk-pop rk-pop-date"
                role="dialog"
                aria-label={t("Tarih seçin")}
                onKeyDown={(e) => closeOnEscape(e, dateBtn)}
              >
                <Calendar
                  value={date}
                  tour={picked}
                  locale={locale}
                  onPick={(d) => {
                    setDate(d);
                    setPanel(null);
                    document.getElementById(dateBtn)?.focus();
                  }}
                />
              </div>
            )}
          </div>

          <div className="rk-field" data-open={panel === "guests" || undefined}>
            <button
              id={guestBtn}
              type="button"
              className="rk-field-hit"
              aria-haspopup="dialog"
              aria-expanded={panel === "guests"}
              onClick={() => setPanel(panel === "guests" ? null : "guests")}
            >
              <Users size={20} aria-hidden="true" />
              <span className="rk-field-label">{t("Yolcu")}</span>
              <span className="rk-field-value">
                {t(guests === 1 ? "1 kişi" : "{n} kişi", { n: guests })}
              </span>
            </button>
            {panel === "guests" && (
              <div
                className="rk-pop rk-pop-guests rk-pop-end"
                role="dialog"
                aria-label={t("Yolcu sayısı")}
                onKeyDown={(e) => closeOnEscape(e, guestBtn)}
              >
                <div className="rk-guests">
                  <div>
                    <b>{t("Yolcu sayısı")}</b>
                    <small>
                      {t("Tek rezervasyonda en fazla {n} kişi.", {
                        n: guestLimit,
                      })}
                    </small>
                  </div>
                  <div className="rk-stepper">
                    <button
                      type="button"
                      onClick={() => setGuests(Math.max(1, guests - 1))}
                      disabled={guests <= 1}
                      aria-label={t("Azalt")}
                    >
                      <Minus size={18} />
                    </button>
                    <output aria-live="polite">{guests}</output>
                    <button
                      type="button"
                      onClick={() =>
                        setGuests(Math.min(guestLimit, guests + 1))
                      }
                      disabled={guests >= guestLimit}
                      aria-label={t("Artır")}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
                {wa && (
                  <a
                    className="rk-guests-more"
                    href={whatsappLink(
                      wa,
                      t(
                        "Merhaba, kalabalık bir grup için tur planlamak istiyorum.",
                      ),
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("Daha kalabalık gruplar için bize yazın")}
                  </a>
                )}
                <button
                  type="button"
                  className="rk-pill rk-pill-flame"
                  onClick={() => {
                    setPanel(null);
                    document.getElementById(guestBtn)?.focus();
                  }}
                >
                  {t("Tamam")}
                </button>
              </div>
            )}
          </div>
        </div>
        <button className="btn rk-search-go" type="submit">
          <Search size={19} aria-hidden="true" /> {t("Rotamı bul")}
        </button>
      </form>
      {request && (
        <RequestForm
          kind="private-tour"
          initialCheckIn={date || undefined}
          initialGuests={guests}
          initialNotes={
            typed ? t("İstenen rota: {place}", { place: typed }) : ""
          }
          onClose={() => setRequest(false)}
        />
      )}
    </>
  );
}

// Ay takvimi: geçmiş günler kapalı; bir tur seçiliyse sefer günleri işaretlenir.
function Calendar({
  value,
  tour,
  locale,
  onPick,
}: {
  value: string;
  tour?: Tour;
  locale: string;
  onPick: (date: string) => void;
}) {
  const { t } = useLang();
  const min = today();
  const start = new Date((value || min) + "T12:00:00");
  const [view, setView] = useState({
    y: start.getFullYear(),
    m: start.getMonth(),
  });
  const [days, setDays] = useState<Set<string>>(new Set());
  useEffect(() => {
    setDays(new Set());
    if (!tour || tour.inquiryOnly || !tour.salesOpen) return;
    let on = true;
    api<Departure[]>(`/tours/${tour.id}/departures`)
      .then(
        (ds) =>
          on &&
          setDays(
            new Set(ds.filter((d) => d.available > 0).map((d) => d.date)),
          ),
      )
      .catch(() => {});
    return () => {
      on = false;
    };
  }, [tour]);
  const first = new Date(view.y, view.m, 1, 12),
    lead = (first.getDay() + 6) % 7, // Pazartesi ilk gün
    count = new Date(view.y, view.m + 1, 0).getDate(),
    minMonth = min.slice(0, 7),
    thisMonth = iso(first).slice(0, 7);
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "short" }),
  );
  const title = first.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
  const move = (k: number) => {
    const d = new Date(view.y, view.m + k, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };
  return (
    <div className="rk-cal">
      <div className="rk-cal-head">
        <button
          type="button"
          className="rk-cal-nav"
          onClick={() => move(-1)}
          disabled={thisMonth <= minMonth}
          aria-label={t("Önceki ay")}
        >
          <ChevronLeft size={18} />
        </button>
        <b aria-live="polite">{title}</b>
        <button
          type="button"
          className="rk-cal-nav"
          onClick={() => move(1)}
          aria-label={t("Sonraki ay")}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="rk-cal-grid" role="grid">
        {weekdays.map((w) => (
          <span key={w} className="rk-cal-wd" aria-hidden="true">
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={"x" + i} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const d = iso(new Date(view.y, view.m, i + 1, 12));
          const past = d < min;
          return (
            <button
              type="button"
              key={d}
              className={
                "rk-cal-day" +
                (d === value ? " is-picked" : "") +
                (d === min ? " is-today" : "") +
                (days.has(d) ? " has-dep" : "")
              }
              disabled={past}
              aria-pressed={d === value}
              aria-label={
                dateLabel(d) + (days.has(d) ? ", " + t("Sefer günü") : "")
              }
              onClick={() => onPick(d)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="rk-cal-foot">
        {days.size > 0 ? (
          <span
            className="rk-cal-legend"
            style={tour ? toneStyle(tourTone(tour)) : undefined}
          >
            <i aria-hidden="true" /> {t("Sefer günü")}
          </span>
        ) : (
          <span />
        )}
        {value && (
          <button
            type="button"
            className="rk-cal-clear"
            onClick={() => onPick("")}
          >
            {t("Tarihi temizle")}
          </button>
        )}
      </div>
    </div>
  );
}
