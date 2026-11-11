# Yasal künye (altbilgi ve İletişim sayfası)

> **Taslak.** 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun md. 3 ve Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik'teki bilgi verme yükümlülüğü ile Türk Ticaret Kanunu'nun ticari belgelerde ve internet sitesinde unvan/sicil bilgisi gösterilmesine ilişkin hükümleri göz önüne alındı. Hangi alanın zorunlu olduğunu avukat teyit etmeli; aşağıdaki liste bunların hepsini kapsıyor.
> Tüm değerler `00-sirket-bilgileri.md`'deki doğrulanmış tablodan.

## Altbilgi (footer-bottom) önerisi

Bugün:

> © 2026 Rota Kars Turizm · TÜRSAB A Grubu · Belge No 13948 · 2010'dan beri

Önerilen (iki satır, küçük punto):

> © 2026 Rota Kars Turizm Taşımacılık Seyahat Acentası Ltd. Şti. · T.C. Kültür ve Turizm Bakanlığı A Grubu Seyahat Acentası · Belge No 13948 · TÜRSAB üyesidir
> MERSİS 0735187296600001 · Kars V.D. 7351872966 · Kars Ticaret Sicili 8625 · KEP rotakarsturizm@hs01.kep.tr · [Yasal bilgiler](/iletisim#kunye)

- **"2010'dan beri"**: acente doğru olduğunu teyit etti (03.11.2026), kalıyor. Önerilen altbilgide de korunabilir: "… · TÜRSAB üyesidir · 2010'dan beri". Bugünkü şirket 2022'de kurulduğu için dayanak belgesini dosyada tutmanız yeterli.
- Belge doğrulama: TÜRSAB rozetinin bağlantısı (`tursab.org.tr/tr/ddsv`) zaten doğrulama sayfasına gidiyor. ✅

## İletişim sayfasına "Yasal bilgiler" bölümü (`/iletisim#kunye`)

| | |
|---|---|
| Ticaret unvanı | Rota Kars Turizm Taşımacılık Seyahat Acentası Limited Şirketi |
| Acenta unvanı | Rota Kars Turizm |
| Seyahat acentası belgesi | T.C. Kültür ve Turizm Bakanlığı, A Grubu, Belge No 13948 |
| Meslek birliği | TÜRSAB (Türkiye Seyahat Acentaları Birliği) üyesi |
| Merkez adresi | Yeni Mah. Cumhuriyet Cad. Köşk Apt. No: 26 İç Kapı No: 13, Merkez / Kars |
| MERSİS no | 0735187296600001 |
| Ticaret sicili | Kars Ticaret Sicili Müdürlüğü · Sicil No 8625 |
| Meslek odası | Kars Ticaret ve Sanayi Odası · Oda Sicil No 8625 |
| Vergi dairesi / no | Kars Vergi Dairesi · 7351872966 |
| Telefon | 0474 223 91 63 · 0545 935 34 10 |
| E-posta | info@rotakarsturizm.com |
| KEP | rotakarsturizm@hs01.kep.tr |
| Sermaye *(isteğe bağlı)* | 400.000,00 TL |
| Yetkili *(isteğe bağlı)* | `[sizin kararınız: müdürün adı yazılsın mı?]` |
| Davranış kuralları / meslek kuralları erişimi | `[avukat: 6563 kapsamında gerekiyorsa TÜRSAB / Bakanlık mevzuat bağlantısı]` |

Yayımlanmaması önerilenler: **UETS adresi** (tebligat içindir, sitede gerekmez), müdürün T.C. kimlik numarası, vergi levhası onay kodu.

## Kodda nereye bağlanır (onaydan sonra)

`server/catalog.mjs` → `business` nesnesine yeni alanlar:

```js
legalName: "Rota Kars Turizm Taşımacılık Seyahat Acentası Limited Şirketi",
mersis: "0735187296600001",
taxOffice: "Kars",
taxNo: "7351872966",
tradeRegistry: "Kars Ticaret Sicili Müdürlüğü",
tradeRegistryNo: "8625",
chamber: "Kars Ticaret ve Sanayi Odası",
kep: "rotakarsturizm@hs01.kep.tr",
licenseGroup: "A",
```

Sonra `src/components/Layout.tsx` (altbilgi), `src/pages/OtherPages.tsx` (`Contact` ve `Information`) ve e-posta şablonları bu alanlardan okur. Bu dosyalar şu an tasarım oturumunun üzerinde çalıştığı dosyalar; çakışma olmasın diye o iş bittikten sonra bağlanmalı.
