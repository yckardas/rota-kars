import { useEffect, useRef, useState } from "react";
import {
  Check,
  CircleCheck,
  CircleX,
  LoaderCircle,
  MessageCircle,
  Phone,
  TriangleAlert,
  UserCheck,
} from "lucide-react";
import { api, post } from "../../lib/api";
import { currency, dateLabel, today } from "../../lib/types";
import { Modal } from "../Modal";

// /api/admin/tickets/:token: rehber ve operasyonun okutma ekranında gördüğü bilet.
export type TicketDetail = {
  reference: string;
  tourName: string;
  date: string;
  startTime: string;
  pickup: string;
  seats: number[];
  status: string;
  valid: boolean;
  checkedIn: boolean;
  // Binen koltuklar (okutmada biletten otomatik gelir; gelmeyen çıkarılabilir).
  boardedSeats: number[];
  contactName: string;
  phone: string;
  whatsapp: string | null;
  passengers: {
    seat: number;
    name: string;
    nationality: string;
    idLast4: string;
    boarded: boolean;
  }[];
  notes: string;
  transfer: string;
  guideName: string | null;
  total: number;
  paid: number;
  balanceDue: number;
  paymentState: "paid" | "partial" | "unpaid" | "refunded";
  checkedInAt: number | null;
};
const STATUS: Record<string, string> = {
  confirmed: "Onaylı",
  completed: "Tamamlandı",
  pending_agency: "Onay bekliyor",
  cancelled: "İptal edildi",
  expired: "Süresi doldu",
  no_show: "Gelmedi",
};
const time = (ms: number) =>
  new Date(ms).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (o: { formats: string[] }) => Detector;

// QR içeriğinden bilet anahtarını çıkarır: yalnız ".../bilet/<48 hex>" kabul edilir.
export const ticketToken = (text: string) => text.match(/\/bilet\/([a-f0-9]{48})(?:[/?#]|$)/)?.[1] || null;

// Kamerayla bilet QR'ı okutup yolcuyu "bindi" işaretler (rehber ve operasyon).
export function TicketScanner({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null),
    [state, setState] = useState<"starting" | "scanning" | "found" | "error">("starting"),
    [message, setMessage] = useState(""),
    [ticket, setTicket] = useState<{
      token: string;
      info: TicketDetail;
    } | null>(null),
    [done, setDone] = useState(false),
    [round, setRound] = useState(0);
  useEffect(() => {
    let stream: MediaStream | null = null,
      stopped = false,
      timer = 0;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return;
        const el = video.current!;
        el.srcObject = stream;
        await el.play();
        setState("scanning");
        const Native = (window as Window & { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
        const detector = Native ? new Native({ formats: ["qr_code"] }) : null;
        const jsQR = detector ? null : (await import("jsqr")).default;
        const canvas = document.createElement("canvas"),
          ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        const tick = async () => {
          if (stopped) return;
          let text = "";
          if (el.readyState >= 2) {
            if (detector) text = (await detector.detect(el).catch(() => []))[0]?.rawValue || "";
            else if (jsQR) {
              const w = Math.min(640, el.videoWidth),
                h = Math.round((el.videoHeight / el.videoWidth) * w);
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(el, 0, 0, w, h);
              text = jsQR(ctx.getImageData(0, 0, w, h).data, w, h)?.data || "";
            }
          }
          const token = text && ticketToken(text);
          if (token) {
            stopped = true;
            stream?.getTracks().forEach((t) => t.stop());
            try {
              let info = await api<TicketDetail>("/admin/tickets/" + token);
              // Bugünün onaylı biletinde koltuklar biletten okunur ve hemen "bindi" kaydedilir;
              // gelmeyen yolcu kartta koltuğuna dokunularak çıkarılır.
              if (canBoard(info) && !info.checkedIn) {
                try {
                  info = await post<TicketDetail>(`/admin/tickets/${token}/check-in`, { seats: info.seats });
                  setDone(true);
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }
              setTicket({ token, info });
              setState("found");
            } catch (e) {
              setMessage((e as Error).message);
              setState("error");
            }
            return;
          }
          if (text) setMessage("Bu QR bir Rota Kars bileti değil.");
          timer = window.setTimeout(tick, 250);
        };
        tick();
      } catch (e) {
        setMessage(
          (e as Error).name === "NotAllowedError"
            ? "Kamera izni verilmedi. Telefon ayarlarından uygulamaya kamera izni verin."
            : "Kamera açılamadı.",
        );
        setState("error");
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [round]);
  const again = () => {
    setTicket(null);
    setDone(false);
    setMessage("");
    setState("starting");
    setRound((n) => n + 1);
  };
  return (
    <Modal title="Bilet okut" onClose={onClose}>
      {(state === "starting" || state === "scanning") && (
        <div className="scanner">
          <video ref={video} playsInline muted />
          <span className="scanner-frame" aria-hidden="true" />
          <p className="muted" role="status">
            {state === "starting" ? (
              <>
                <LoaderCircle className="spin" size={16} /> Kamera açılıyor…
              </>
            ) : (
              message || "Biletteki QR kodunu çerçeveye getirin."
            )}
          </p>
        </div>
      )}
      {state === "error" && (
        <div className="scan-result invalid">
          <TriangleAlert size={28} />
          <p>{message}</p>
          <button className="btn" onClick={again}>
            Tekrar dene
          </button>
        </div>
      )}
      {state === "found" && ticket && (
        <TicketCard
          token={ticket.token}
          info={ticket.info}
          message={message}
          justBoarded={done}
          onSaved={(info) => {
            setMessage("");
            setTicket({ ...ticket, info });
          }}
        />
      )}
      {state === "found" && ticket && (
        <div className="scan-actions">
          {ticket.info.checkedIn && (
            <p className="boarded-tag">
              <Check size={18} /> {boardedLabel(ticket.info)}
              {ticket.info.checkedInAt ? ` · ${time(ticket.info.checkedInAt)}` : ""}
            </p>
          )}
          <button className="btn btn-outline" onClick={again}>
            Sonraki bileti okut
          </button>
        </div>
      )}
    </Modal>
  );
}

// Okutulan biletin kartı: önce geçerli/değil, sonra yolcular, irtibat ve ödeme.
function TicketCard({
  token,
  info,
  message,
  justBoarded,
  onSaved,
}: {
  token: string;
  info: TicketDetail;
  message: string;
  justBoarded: boolean;
  onSaved: (info: TicketDetail) => void;
}) {
  const notToday = info.valid && info.status === "confirmed" && info.date !== today(),
    verdict = !info.valid
      ? {
          tone: "bad",
          icon: <CircleX size={30} />,
          title: "Geçersiz bilet",
          text: STATUS[info.status] || info.status,
        }
      : info.checkedIn && justBoarded
        ? {
            tone: "ok",
            icon: <CircleCheck size={30} />,
            title: "Biniş kaydedildi",
            text: boardedLabel(info),
          }
        : info.checkedIn
          ? {
              tone: "warn",
              icon: <TriangleAlert size={30} />,
              title: "Bu bilet zaten okutuldu",
              text: info.checkedInAt ? `Biniş ${time(info.checkedInAt)}'de kaydedildi.` : "Biniş daha önce kaydedildi.",
            }
          : notToday
            ? {
                tone: "warn",
                icon: <TriangleAlert size={30} />,
                title: "Bugünün turu değil",
                text: `Bilet ${dateLabel(info.date)} tarihli.`,
              }
            : {
                tone: "ok",
                icon: <CircleCheck size={30} />,
                title: "Geçerli bilet",
                text: STATUS[info.status] || info.status,
              };
  const tel = info.phone.replace(/[^\d+]/g, "");
  return (
    <div className="scan-ticket">
      <div className={"scan-verdict is-" + verdict.tone} role="status">
        {verdict.icon}
        <div>
          <strong>{verdict.title}</strong>
          <span>{verdict.text}</span>
        </div>
      </div>
      <div className="scan-trip">
        <span className="scan-ref">{info.reference}</span>
        <h2>{info.tourName}</h2>
        <p>
          {dateLabel(info.date)} · {info.startTime} · {info.pickup}
        </p>
      </div>
      <section className="scan-block">
        <h3>
          Yolcular{" "}
          <span>
            {info.checkedIn && info.passengers.length
              ? `${info.boardedSeats.length}/${info.passengers.length} bindi`
              : `${info.passengers.length} kişi`}
          </span>
        </h3>
        <SeatBoarding token={token} info={info} onSaved={onSaved} />
      </section>
      <section className="scan-block">
        <h3>İrtibat</h3>
        <p className="scan-contact">
          <strong>{info.contactName}</strong>
          <span>{info.phone}</span>
        </p>
        <div className="scan-contact-actions">
          {tel && (
            <a className="btn btn-outline btn-small" href={"tel:" + tel}>
              <Phone size={15} /> Ara
            </a>
          )}
          {info.whatsapp && (
            <a className="btn btn-outline btn-small" href={info.whatsapp} target="_blank" rel="noreferrer">
              <MessageCircle size={15} /> WhatsApp
            </a>
          )}
        </div>
      </section>
      <section className={"scan-block scan-payment" + (info.valid && info.balanceDue > 0 ? " is-due" : "")}>
        <h3>Ödeme</h3>
        {info.valid && info.balanceDue > 0 ? (
          <p>
            <strong>Tahsil edilecek: {currency(info.balanceDue)}</strong>
            <span>
              Ödenen {currency(info.paid)} / Toplam {currency(info.total)}
            </span>
          </p>
        ) : (
          <p>
            <strong>
              {info.paymentState === "refunded"
                ? "İade edildi"
                : !info.valid && info.paid > 0
                  ? `Ödenmiş: ${currency(info.paid)}`
                  : info.paymentState === "paid"
                    ? "Tamamı ödendi"
                    : "Ödeme yok"}
            </strong>
            <span>Toplam {currency(info.total)}</span>
          </p>
        )}
      </section>
      {(info.notes || info.transfer) && (
        <section className="scan-block">
          <h3>Notlar</h3>
          {info.transfer && <p>{info.transfer}</p>}
          {info.notes && <p>{info.notes}</p>}
        </section>
      )}
      {message && (
        <p className="error" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

// Biniş yalnız bugünün onaylı biletinde kaydedilir (sunucu da aynı kuralı uygular).
export const canBoard = (info: Pick<TicketDetail, "status" | "date" | "valid">) =>
  info.valid && info.status === "confirmed" && info.date === today();

export const boardedLabel = (info: TicketDetail) =>
  !info.passengers.length
    ? "Bindi olarak işaretli"
    : `Koltuk ${info.boardedSeats.join(", ")} bindi`;

const sameSeats = (a: number[], b: number[]) => [...a].sort((x, y) => x - y).join() === [...b].sort((x, y) => x - y).join();

// Biletteki yolcular koltuklarıyla: dokununca binen/binmeyen değişir, kaydet sunucuya yazar.
// Okutma ekranında ve QR bilet sayfasında (yönetici/rehber oturumu) aynı bileşen.
export function SeatBoarding({
  token,
  info,
  onSaved,
}: {
  token: string;
  info: TicketDetail;
  onSaved: (info: TicketDetail) => void;
}) {
  const editable = canBoard(info),
    saved = info.checkedIn ? info.boardedSeats : [],
    // Henüz binmemiş bilette biletteki tüm koltuklar hazır seçilir.
    initial = info.checkedIn ? info.boardedSeats : info.seats,
    [picked, setPicked] = useState<number[]>(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setPicked(info.checkedIn ? info.boardedSeats : info.seats);
  }, [info]);
  const changed = !info.checkedIn || !sameSeats(picked, saved),
    seatless = !info.passengers.length;
  async function save() {
    setBusy(true);
    setError("");
    try {
      onSaved(
        await post<TicketDetail>(
          `/admin/tickets/${token}/check-in`,
          seatless && !info.checkedIn ? {} : { seats: picked },
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const toggle = (seat: number) =>
    setPicked((cur) => (cur.includes(seat) ? cur.filter((n) => n !== seat) : [...cur, seat]));
  const on = (seat: number) => (editable ? picked.includes(seat) : saved.includes(seat));
  return (
    <div className="seat-board">
      {!seatless && (
        <ul className="scan-passengers">
          {info.passengers.map((p) => {
            const row = (
              <>
                <span className="scan-seat">{p.seat}</span>
                <span className="seat-board-who">
                  <strong>{p.name || "İsim girilmemiş"}</strong>
                  {p.idLast4 && (
                    <small>
                      {p.nationality === "TR" || !p.nationality ? "T.C." : p.nationality} …{p.idLast4}
                    </small>
                  )}
                </span>
                {(editable || info.checkedIn) && (
                  <span className="seat-board-state">
                    {on(p.seat) ? (
                      <>
                        <Check size={15} aria-hidden="true" /> {editable && !info.checkedIn ? "Binecek" : "Bindi"}
                      </>
                    ) : (
                      "Binmedi"
                    )}
                  </span>
                )}
              </>
            );
            return (
              <li key={p.seat} className={on(p.seat) ? "is-on" : ""}>
                {editable ? (
                  <button
                    type="button"
                    aria-pressed={on(p.seat)}
                    aria-label={`Koltuk ${p.seat}, ${p.name || "isim girilmemiş"}: ${on(p.seat) ? "biniyor" : "binmedi"}`}
                    onClick={() => toggle(p.seat)}
                  >
                    {row}
                  </button>
                ) : (
                  <div>{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editable && changed && (
        <button
          type="button"
          className={"btn seat-board-save" + (info.checkedIn && !picked.length ? " btn-outline" : "")}
          onClick={save}
          disabled={busy || (!info.checkedIn && !seatless && !picked.length)}
        >
          {busy ? <LoaderCircle className="spin" size={16} /> : <UserCheck size={16} />}
          {seatless
            ? info.checkedIn
              ? "Binişi geri al"
              : "Bindi olarak işaretle"
            : !info.checkedIn
              ? picked.length
                ? `Koltuk ${[...picked].sort((a, b) => a - b).join(", ")} · bindi kaydet`
                : "Binen yolcuyu seçin"
              : picked.length
                ? `Binişi güncelle · Koltuk ${[...picked].sort((a, b) => a - b).join(", ")}`
                : "Binişi geri al (kimse binmedi)"}
        </button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
