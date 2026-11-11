import { useEffect, useMemo, useState, type FormEvent } from "react";
import { LoaderCircle, Plus, Trash2, UsersRound } from "lucide-react";
import { api, post } from "../lib/api";
import { countryName, countryOptions } from "../lib/countries";
import { tcknValid } from "../lib/tckn";
import { Link, useLang } from "../lib/i18n";
export type Companion = {
  id: string;
  name: string;
  nationality: string;
  gender: "K" | "E";
  idMasked: string;
};
// Hesabım: kayıtlı yol arkadaşları. Kimlik numarası bir kez girilir; sonra
// rezervasyonda tek seçimle kullanılır, sayfada yalnız son 3 hanesi görünür.
export function CompanionsSection() {
  const [items, setItems] = useState<Companion[]>([]),
    [open, setOpen] = useState(false),
    [nationality, setNationality] = useState("TR"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    { lang, t } = useLang(),
    COUNTRIES = useMemo(() => countryOptions(lang), [lang]);
  const load = () =>
    api<Companion[]>("/member/companions")
      .then(setItems)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      idNumber = String(f.get("idNumber") || "").trim();
    if (nationality === "TR" && !tcknValid(idNumber)) {
      setError(t("T.C. kimlik numarası geçerli görünmüyor."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await post("/member/companions", {
        name: f.get("name"),
        nationality,
        idNumber,
        gender: f.get("gender"),
        declaration: f.get("declaration") === "on",
      });
      setOpen(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(c: Companion) {
    setError("");
    try {
      await api("/member/companions/" + c.id, { method: "DELETE" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="member-companions">
      <div className="section-heading">
        <div>
          <h2>{t("Yol arkadaşlarım")}</h2>
          <p className="muted">
            {t(
              "Ailenizi ve sık birlikte gezdiğiniz kişileri bir kez kaydedin; rezervasyonda kimlik bilgilerini yeniden yazmayın.",
            )}
          </p>
        </div>
        {!open && (
          <button
            className="btn btn-outline btn-small"
            onClick={() => setOpen(true)}
          >
            <Plus size={16} /> {t("Yol arkadaşı ekle")}
          </button>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      {items.length > 0 ? (
        <ul className="companion-list">
          {items.map((c) => (
            <li key={c.id}>
              <UsersRound size={18} />
              <div>
                <strong>{c.name}</strong>
                <small>
                  {c.nationality === "TR"
                    ? "T.C."
                    : countryName(c.nationality, lang)}{" "}
                  · {c.idMasked} · {c.gender === "E" ? t("Erkek") : t("Kadın")}
                </small>
              </div>
              <button
                className="text-link danger-text"
                onClick={() => remove(c)}
                aria-label={t("{name} kaydını sil", { name: c.name })}
              >
                <Trash2 size={15} /> {t("Sil")}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !open && (
          <p className="member-empty">
            {t("Henüz kayıtlı yol arkadaşınız yok.")}
          </p>
        )
      )}
      {open && (
        <form className="companion-form" onSubmit={add}>
          <div className="form-grid">
            <label className="field">
              {t("Ad soyad")}
              <input
                name="name"
                required
                minLength={2}
                maxLength={100}
                placeholder={t("Kimlikteki gibi")}
                autoComplete="off"
              />
            </label>
            <label className="field">
              {t("Uyruk")}
              <select
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
              >
                <optgroup label={t("Sık seçilenler")}>
                  {COUNTRIES.first.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code === "TR" ? t("Türkiye (T.C.)") : c.name}
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
              {nationality === "TR"
                ? t("T.C. kimlik numarası")
                : t("Pasaport numarası")}
              <input
                name="idNumber"
                key={nationality}
                required
                inputMode={nationality === "TR" ? "numeric" : "text"}
                minLength={nationality === "TR" ? 11 : 5}
                maxLength={nationality === "TR" ? 11 : 20}
                pattern={
                  nationality === "TR" ? "[1-9][0-9]{10}" : "[A-Za-z0-9 ]{5,20}"
                }
                autoComplete="off"
              />
            </label>
            <div className="field gender-field" role="radiogroup">
              <span>{t("Cinsiyet")}</span>
              <div className="choice-inline">
                <label>
                  <input type="radio" name="gender" value="K" required />{" "}
                  {t("Kadın")}
                </label>
                <label>
                  <input type="radio" name="gender" value="E" /> {t("Erkek")}
                </label>
              </div>
            </div>
          </div>
          <label className="checkbox-label">
            <input type="checkbox" name="declaration" required />
            <span>
              {t(
                "Bu kişinin bilgilerini onun bilgisi dahilinde, sonraki rezervasyonlarımda kullanmak üzere kaydettiğimi ve kendisini {notice} hakkında bilgilendireceğimi beyan ederim. Kaydı dilediğim zaman silebilirim.",
              )
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
            </span>
          </label>
          <div className="button-row">
            <button className="btn btn-small" disabled={busy}>
              {busy && <LoaderCircle className="spin" size={15} />}
              {t("Kaydet")}
            </button>
            <button
              className="text-link"
              type="button"
              onClick={() => {
                setOpen(false);
                setError("");
              }}
            >
              {t("Vazgeç")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
