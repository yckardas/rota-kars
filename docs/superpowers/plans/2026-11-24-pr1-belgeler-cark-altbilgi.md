# PR 1 uygulama planı: çark, belgeler, alt bilgi, üyelik çizimi

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Spec'teki PR 1 maddeleri. **Spec:** `docs/superpowers/specs/2026-11-24-belgeler-cark-altbilgi-kopya-design.md`
**Tech:** Node/Express/zod, Mongo (`:memory:` testler), React 19, `node --test`.

## Global Constraints
- Ödeme koduna dokunulmaz. Herkese açık stil yalnız `.kp` altında (renkli.css). Yeni herkese açık metinlerin İngilizcesi `src/lib/en/*`.

## Review Focus
- Doğrulanmamış üye iki kez çeviremez (409) → Task 1 testi.
- Doğrulanınca kupon bir kez oluşur → Task 1 testi.
- `documents` boş turda kutu hiç görünmez → Task 2 elle.
- Eski kayıtlı tur içeriğinde `documents` yoksa varsayılan gelir, kayıt 400 vermez → Task 2 testi.
- Footer mobilde yatay kaydırma yapmaz → Task 3 elle.

### Task 1: Doğrulanmamış üye çarkı çevirir
Files: `server/members.mjs:250-283`, `src/pages/Membership.tsx:430-560`, `src/lib/en/member.ts`, Test `tests/wheel.test.mjs`
- [ ] Test `unverified member spins now and the coupon activates after verification`: requireVerified kampanya, doğrulanmamış üye `spin` → `{pending:true, coupon:null, index}`; `member_coupons` 0; ikinci `spin` 409; e-posta doğrulanınca `dashboard`/`activatePending` → 1 kupon.
- [ ] FAIL gör (403). [ ] `spin` doğrulanmamışsa `coupon_id:null` ile yazar. [ ] Ekranda bekleyen hediye mesajı. [ ] PASS, commit.

### Task 2: `documents` alanı
Files: `server/content.mjs` (TOUR_FIELDS), `server/app.mjs` tourContent, `server/catalog.mjs` (4 yurt dışı tur), `server/catalog-en.mjs`, `src/components/admin/ContentManager.tsx`, `src/pages/TourDetail.tsx`, `src/pages/Booking.tsx`, `src/lib/types.ts`, `src/renkli.css`, Test `tests/content.test.mjs`
- [ ] Test: kayıt `documents` ile döner; `documents` olmadan eski gövde de kabul (default `[]`); 13 satır 400.
- [ ] Uygula, tarayıcıda kontrol, commit.

### Task 3: Renkli footer — `src/renkli.css` (+ gerekirse Layout.tsx sınıfları). Masaüstü+mobil kontrol, commit.
### Task 4: Üyelik çizimi — `public/images/uyelik-rota.svg`, `src/pages/Membership.tsx:130`. Kontrol, commit.
