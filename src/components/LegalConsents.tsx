import { useState } from "react";
import { FileText } from "lucide-react";
import { Link, useLang } from "../lib/i18n";
import { Modal } from "./Modal";
// Rezervasyon ve kartla ödeme ekranlarındaki zorunlu onay kutuları. Her metin
// ayrı kutuyla onaylanır; metinler açılır pencerede (bu rezervasyonun verisiyle)
// okunur, metin yoksa /bilgilendirme sayfasındaki genel hâli yeni sekmede açılır.
export type ConsentKey = "preInfo" | "contract" | "cancellation" | "privacy";
export type Consents = Record<ConsentKey, boolean>;
export const noConsents: Consents = {
  preInfo: false,
  contract: false,
  cancellation: false,
  privacy: false,
};
export const allConsents: Consents = {
  preInfo: true,
  contract: true,
  cancellation: true,
  privacy: true,
};
export const consentsComplete = (c: Consents) =>
  c.preInfo && c.contract && c.cancellation && c.privacy;
export type LegalDocuments = {
  preInfo?: string;
  contract?: string;
  cancellation?: string[];
};
const ORDER: ConsentKey[] = ["preInfo", "contract", "cancellation", "privacy"];
// Cümle {link} yerine metni açan bağlantıyla yazılır (sıra dile göre değişebilir).
const ITEMS: Record<
  ConsentKey,
  { sentence: string; link: string; title: string; anchor: string }
> = {
  preInfo: {
    sentence: "{link} okudum, onaylıyorum.",
    link: "Ön Bilgilendirme Formu'nu",
    title: "Ön Bilgilendirme Formu",
    anchor: "sozlesme",
  },
  contract: {
    sentence: "{link} okudum, kabul ediyorum.",
    link: "Tur Hizmet Sözleşmesi'ni (Mesafeli Satış Sözleşmesi)",
    title: "Tur Hizmet Sözleşmesi",
    anchor: "sozlesme",
  },
  cancellation: {
    sentence: "{link} okudum, kabul ediyorum.",
    link: "İptal ve İade Koşulları'nı",
    title: "İptal ve İade Koşulları",
    anchor: "iptal",
  },
  privacy: {
    sentence:
      "Kişisel verilerimin işlenmesine ilişkin {link} okudum, bilgilendirildim.",
    link: "KVKK Aydınlatma Metni'ni",
    title: "KVKK Aydınlatma Metni",
    anchor: "kvkk",
  },
};
export function LegalConsents({
  value,
  onChange,
  documents,
  error,
  disabled = false,
}: {
  value: Consents;
  onChange: (next: Consents) => void;
  documents?: LegalDocuments | null;
  // Ödemeye geçilmek istendiğinde eksik kutu varsa gösterilen uyarı.
  error?: string;
  disabled?: boolean;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState<ConsentKey | null>(null);
  const text = (key: ConsentKey) =>
    key === "cancellation"
      ? documents?.cancellation?.map((l) => "- " + l).join("\n\n")
      : key === "privacy"
        ? undefined
        : documents?.[key];
  return (
    <fieldset className="legal-consents" disabled={disabled}>
      <legend>
        <FileText size={16} aria-hidden="true" />
        {t("Sözleşmeler ve onaylar")}
      </legend>
      <p className="legal-consents-hint">
        {t(
          "Devam etmek için her birini okuyup ayrı ayrı onaylayın. Onaylarınız tarih ve saatiyle kaydedilir; metinler e-postanıza da gönderilir.",
        )}
      </p>
      {ORDER.map((key) => {
        const item = ITEMS[key],
          body = text(key),
          missing = Boolean(error) && !value[key];
        return (
          <label
            key={key}
            className={
              "checkbox-label consent-item" + (missing ? " is-missing" : "")
            }
          >
            <input
              type="checkbox"
              name={"consent-" + key}
              checked={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
              aria-invalid={missing ? true : undefined}
            />
            <span>
              {t(item.sentence)
                .split(/(\{link\})/)
                .map((part, k) =>
                  part !== "{link}" ? (
                    part
                  ) : body ? (
                    <button
                      key={k}
                      type="button"
                      className="consent-doc-link"
                      onClick={(e) => {
                        e.preventDefault();
                        setOpen(key);
                      }}
                    >
                      {t(item.link)}
                    </button>
                  ) : (
                    <Link
                      key={k}
                      to={"/bilgilendirme#" + item.anchor}
                      target="_blank"
                    >
                      {t(item.link)}
                    </Link>
                  ),
                )}
            </span>
          </label>
        );
      })}
      {error && (
        <p className="field-error consent-error" role="alert">
          {t(error)}
        </p>
      )}
      {open && (
        <Modal title={t(ITEMS[open].title)} onClose={() => setOpen(null)} wide>
          <div className="legal-doc" tabIndex={0} lang="tr">
            {text(open)}
          </div>
          <div className="legal-doc-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setOpen(null)}
            >
              {t("Kapat")}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                onChange({ ...value, [open]: true });
                setOpen(null);
              }}
            >
              {t("Okudum, onaylıyorum")}
            </button>
          </div>
        </Modal>
      )}
    </fieldset>
  );
}
export const CONSENT_MISSING =
  "Ödemeye geçmeden önce dört onay kutusunun hepsini işaretleyin.";
