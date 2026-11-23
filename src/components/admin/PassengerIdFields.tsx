// Panelde yolcu kimliği (U-ETDS için): uyruk, T.C./pasaport, cinsiyet. Telefonda
// alınamayabilir; numara boş bırakılırsa yolcu "kimlik eksik" kalır ve sonra tamamlanır.
import { useMemo } from "react";
import { countryOptions } from "../../lib/countries";
import { tcknValid } from "../../lib/tckn";
import type { PassengerDetail } from "../../lib/types";

export type IdDraft = { nationality: string; idNumber: string; gender: "" | "K" | "E" };
export const emptyId: IdDraft = { nationality: "TR", idNumber: "", gender: "" };
export const draftFrom = (p?: PassengerDetail | null): IdDraft =>
  p ? { nationality: p.nationality, idNumber: p.idNumber, gender: p.gender } : emptyId;
// Numara boşsa kimlik girilmemiş sayılır (null).
export const detailFrom = (d: IdDraft): PassengerDetail | null =>
  d.idNumber.trim() ? { nationality: d.nationality, idNumber: d.idNumber.trim(), gender: d.gender as "K" | "E" } : null;
// Gönderimden önce okunur hata: yarım ya da geçersiz kimlik.
export function idProblem(d: IdDraft, label: string) {
  if (!d.idNumber.trim()) return "";
  if (d.nationality === "TR" && !tcknValid(d.idNumber.trim())) return `${label}: T.C. kimlik numarası geçersiz.`;
  if (!d.gender) return `${label}: cinsiyet seçin.`;
  return "";
}

export function PassengerIdFields({
  value,
  onChange,
  name,
}: {
  value: IdDraft;
  onChange: (next: IdDraft) => void;
  // Cinsiyet radyo grubunun benzersiz adı.
  name: string;
}) {
  const countries = useMemo(() => countryOptions("tr"), []),
    tr = value.nationality === "TR",
    set = (patch: Partial<IdDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="passenger-id-fields">
      <label className="field">
        Uyruk
        <select value={value.nationality} onChange={(e) => set({ nationality: e.target.value, idNumber: "" })}>
          <optgroup label="Sık seçilenler">
            {countries.first.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code === "TR" ? "Türkiye (T.C.)" : c.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Tüm ülkeler">
            {countries.rest.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <label className="field">
        {tr ? "T.C. kimlik no" : "Pasaport no"} <small className="muted">(boş bırakılabilir)</small>
        <input
          value={value.idNumber}
          onChange={(e) =>
            set({ idNumber: tr ? e.target.value.replace(/\D/g, "") : e.target.value.toUpperCase() })
          }
          inputMode={tr ? "numeric" : "text"}
          maxLength={tr ? 11 : 20}
          minLength={tr ? 11 : 5}
          pattern={tr ? "[1-9][0-9]{10}" : "[A-Za-z0-9 ]{5,20}"}
          autoComplete="off"
        />
      </label>
      <div className="field" role="radiogroup" aria-label="Cinsiyet">
        <span>Cinsiyet</span>
        <div className="choice-inline">
          {(
            [
              ["K", "Kadın"],
              ["E", "Erkek"],
            ] as const
          ).map(([g, label]) => (
            <label key={g}>
              <input
                type="radio"
                name={name}
                checked={value.gender === g}
                onChange={() => set({ gender: g })}
                required={Boolean(value.idNumber.trim())}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
