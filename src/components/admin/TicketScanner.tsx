import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, QrCode, TriangleAlert, UserCheck } from "lucide-react";
import { api, post } from "../../lib/api";
import { dateLabel } from "../../lib/types";
import { Modal } from "../Modal";

type TicketInfo = {
  reference: string;
  tourName: string;
  date: string;
  startTime: string;
  pickup: string;
  seats: number[];
  status: string;
  valid: boolean;
  checkedIn: boolean;
};
type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (o: { formats: string[] }) => Detector;

// QR içeriğinden bilet anahtarını çıkarır: yalnız ".../bilet/<48 hex>" kabul edilir.
export const ticketToken = (text: string) => text.match(/\/bilet\/([a-f0-9]{48})(?:[/?#]|$)/)?.[1] || null;

// Kamerayla bilet QR'ı okutup yolcuyu "bindi" işaretler (rehber ve operasyon).
export function TicketScanner({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null),
    [state, setState] = useState<"starting" | "scanning" | "found" | "error">("starting"),
    [message, setMessage] = useState(""),
    [ticket, setTicket] = useState<{ token: string; info: TicketInfo } | null>(null),
    [busy, setBusy] = useState(false),
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
              setTicket({ token, info: await api<TicketInfo>("/tickets/" + token) });
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
  async function checkIn() {
    if (!ticket) return;
    setBusy(true);
    setMessage("");
    try {
      const info = await post<TicketInfo>(`/admin/tickets/${ticket.token}/check-in`, {});
      setTicket({ ...ticket, info });
      setDone(true);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
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
        <div className={"scan-result " + (ticket.info.valid ? "valid" : "invalid")}>
          {ticket.info.valid ? <QrCode size={28} /> : <TriangleAlert size={28} />}
          <h2>{ticket.info.reference}</h2>
          <p>
            {ticket.info.tourName} · {dateLabel(ticket.info.date)} {ticket.info.startTime}
          </p>
          <p>
            <strong>Koltuk {ticket.info.seats.join(", ")}</strong>
          </p>
          {!ticket.info.valid && <p>Bu bilet geçerli değil (onaylı değil veya iptal edilmiş).</p>}
          {message && (
            <p className="error" role="alert">
              {message}
            </p>
          )}
          {ticket.info.checkedIn || done ? (
            <p className="boarded-tag">
              <Check size={18} /> Bindi olarak işaretli
            </p>
          ) : (
            ticket.info.valid && (
              <button className="btn" onClick={checkIn} disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={16} /> : <UserCheck size={16} />}
                Bindi olarak işaretle
              </button>
            )
          )}
          <button className="btn btn-outline" onClick={again}>
            Sonraki bileti okut
          </button>
        </div>
      )}
    </Modal>
  );
}
