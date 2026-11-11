import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
// Kart ödeme formunun canlı kart görseli (Peynişar'daki kart formunun uyarlaması):
// numara, isim ve son kullanma yazıldıkça kartın üzerinde belirir; marka logosu
// numaraya göre gelir, güvenlik kodu için kart arkasına döner.
export type CardField = "holder" | "pan" | "expiry" | "cvv";
export type CardValues = Record<CardField, string>;
export const emptyCard: CardValues = {
  holder: "",
  pan: "",
  expiry: "",
  cvv: "",
};
export type CardBrand = "visa" | "mastercard" | "troy" | "";
export function cardBrand(pan: string): CardBrand {
  if (/^4/.test(pan)) return "visa";
  const two = Number(pan.slice(0, 2)),
    four = Number(pan.slice(0, 4));
  if ((two >= 51 && two <= 55) || (four >= 2221 && four <= 2720))
    return "mastercard";
  if (/^(9792|65)/.test(pan)) return "troy";
  return "";
}
export const formatPan = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
export function formatExpiry(v: string, previous: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  // Silerken "/" işaretine takılmasın.
  if (v.length < previous.length && previous.endsWith("/") && d.length === 2)
    return d.slice(0, 1);
  return d.length > 2 || (d.length === 2 && v.length > previous.length)
    ? d.slice(0, 2) + "/" + d.slice(2)
    : d;
}
function luhn(pan: string) {
  let sum = 0;
  for (let i = 0; i < pan.length; i++) {
    let d = Number(pan[pan.length - 1 - i]);
    if (i % 2) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return pan.length > 0 && sum % 10 === 0;
}
// Alan sırasıyla kartın sorunları; boşsa kart gönderilebilir.
export function cardProblems(card: CardValues, now = new Date()) {
  const problems: Partial<Record<CardField, string>> = {};
  const holder = card.holder.replace(/\s+/g, " ").trim();
  if (holder.length < 3 || /\d/.test(holder) || !/\p{L}/u.test(holder))
    problems.holder = "Kartın üzerindeki ismi yazın.";
  const pan = card.pan.replace(/\D/g, "");
  if (!/^\d{16}$/.test(pan) || !luhn(pan))
    problems.pan = "Kart numarasını kontrol edin (16 hane).";
  else if (!cardBrand(pan))
    problems.pan = "Visa, Mastercard veya Troy kartı kullanın.";
  const [month, year] = card.expiry.split("/").map(Number);
  const current = (now.getFullYear() % 100) * 100 + now.getMonth() + 1;
  if (!/^\d{2}\/\d{2}$/.test(card.expiry) || month < 1 || month > 12)
    problems.expiry = "Son kullanma tarihini AA/YY biçiminde girin.";
  else if (year * 100 + month < current)
    problems.expiry = "Kartın son kullanma tarihi geçmiş.";
  if (!/^\d{3}$/.test(card.cvv))
    problems.cvv = "Kartın arkasındaki 3 haneli kodu girin.";
  return problems;
}
// Kart ağlarının basit işaretleri (resmî logo değil; banka logo paketi gelince değiştirilebilir).
const marks: Record<Exclude<CardBrand, "">, ReactElement> = {
  visa: (
    <svg viewBox="0 0 64 22" aria-hidden="true">
      <text
        x="1"
        y="19"
        fontFamily="Arial,sans-serif"
        fontStyle="italic"
        fontWeight="900"
        fontSize="22"
        fill="#fff"
      >
        VISA
      </text>
    </svg>
  ),
  mastercard: (
    <svg viewBox="0 0 44 28" aria-hidden="true">
      <circle cx="15" cy="14" r="13" fill="#eb001b" />
      <circle cx="29" cy="14" r="13" fill="#f79e1b" fillOpacity=".92" />
    </svg>
  ),
  troy: (
    <svg viewBox="0 0 64 24" aria-hidden="true">
      <text
        x="1"
        y="19"
        fontFamily="Arial,sans-serif"
        fontStyle="italic"
        fontWeight="900"
        fontSize="21"
        fill="#fff"
      >
        troy
      </text>
      <path d="M48 4q10 4 4 13" fill="none" stroke="#fff" strokeWidth="2.4" />
    </svg>
  ),
};
export function CardVisual({
  card,
  focused,
  t,
}: {
  card: CardValues;
  focused: CardField | null;
  t: (text: string) => string;
}) {
  const box = useRef<HTMLDivElement>(null),
    zones = {
      pan: useRef<HTMLDivElement>(null),
      holder: useRef<HTMLDivElement>(null),
      expiry: useRef<HTMLDivElement>(null),
    },
    [ring, setRing] = useState<CSSProperties>({ opacity: 0 });
  const digits = card.pan.replace(/\D/g, ""),
    brand = cardBrand(digits),
    back = focused === "cvv",
    holder = card.holder.replace(/\s+/g, " ").trim().toLocaleUpperCase("tr");
  // Odaktaki alanın karttaki karşılığını çerçeveyle gösterir. Konum, kartın dönüşünden
  // etkilenmemesi için ekran ölçüsüyle değil kart içindeki offset'lerle hesaplanır.
  useLayoutEffect(() => {
    const target = focused && focused !== "cvv" ? zones[focused].current : null;
    if (!target || !box.current) return setRing({ opacity: 0 });
    let x = 0,
      y = 0,
      el: HTMLElement | null = target;
    while (el && el !== box.current) {
      x += el.offsetLeft;
      y += el.offsetTop;
      el = el.offsetParent as HTMLElement | null;
    }
    setRing({
      opacity: 1,
      transform: `translate(${x - 8}px, ${y - 6}px)`,
      width: target.offsetWidth + 16,
      height: target.offsetHeight + 12,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);
  return (
    <div className="pay-card-stage" aria-hidden="true">
      <div
        ref={box}
        className="pay-card"
        data-side={back ? "back" : "front"}
        data-brand={brand}
      >
        <div className="pay-card-inner">
          <div className="pay-card-face pay-card-front">
            <div className="pay-card-top">
              <svg className="pay-card-chip" viewBox="0 0 46 34">
                <rect
                  x=".5"
                  y=".5"
                  width="45"
                  height="33"
                  rx="6"
                  fill="#e3c77a"
                  stroke="#c9a94f"
                />
                <path
                  d="M15 1v32M31 1v32M1 12h14M31 12h14M1 22h14M31 22h14"
                  stroke="#b8933e"
                  strokeWidth="1.2"
                  fill="none"
                />
              </svg>
              <span className="pay-card-mark">
                {(Object.keys(marks) as (keyof typeof marks)[]).map((k) => (
                  <span key={k} data-mark={k}>
                    {marks[k]}
                  </span>
                ))}
              </span>
            </div>
            <div className="pay-card-pan" ref={zones.pan}>
              {Array.from({ length: 16 }, (_, i) => (
                <span
                  key={i}
                  className={
                    "pay-card-group" + (i % 4 === 0 && i ? " gap" : "")
                  }
                >
                  {/* Rakam değişince yeniden oluşur ve düşerek belirir. */}
                  <span
                    key={digits[i] ?? "•"}
                    className={"pan-slot" + (digits[i] ? " filled" : "")}
                  >
                    {digits[i] ?? "•"}
                  </span>
                </span>
              ))}
            </div>
            <div className="pay-card-bottom">
              <div className="pay-card-holder" ref={zones.holder}>
                <small>{t("Kart sahibi")}</small>
                <span className={holder ? "filled" : ""}>
                  {holder || t("AD SOYAD")}
                </span>
              </div>
              <div className="pay-card-expiry" ref={zones.expiry}>
                <small>{t("Son kullanma")}</small>
                <span className={card.expiry ? "filled" : ""}>
                  {card.expiry || t("AA/YY")}
                </span>
              </div>
            </div>
          </div>
          <div className="pay-card-face pay-card-back">
            <div className="pay-card-stripe" />
            <div className="pay-card-sign">
              <span>{card.cvv ? "•".repeat(card.cvv.length) : "•••"}</span>
            </div>
            <small className="pay-card-back-note">
              {t("Güvenlik kodu kartın arkasındaki son 3 hanedir.")}
            </small>
          </div>
        </div>
        <span className="pay-card-focus" style={ring} />
      </div>
    </div>
  );
}
