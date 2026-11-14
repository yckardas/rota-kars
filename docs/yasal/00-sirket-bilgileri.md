# Şirket bilgileri (kaynak belgelerden doğrulanmış)

> Taslak. Bu dosyadaki her satır, yanında yazan belgeden okunmuştur. Belgede olmayan hiçbir bilgi eklenmedi. Çelişen veya eksik noktalar en altta.

Kaynak kısaltmaları:

- **VL**: Vergi levhası (GİB, onay kodu 5ZAR2VW58XQ)
- **İB**: Kültür ve Turizm Bakanlığı A Grubu Seyahat Acentası İşletme Belgesi (düzenleme 05.04.2022, yeni belge, № 040728)
- **FB**: KATSO Faaliyet Belgesi (11.02.2022, sayı 318)
- **OK**: KATSO Oda Kayıt Sicil Sureti (11.02.2022, sayı 317)
- **TSG**: Türkiye Ticaret Sicili Gazetesi, 9 Şubat 2022, sayı 10513, sayfa 364 (Kars Ticaret Sicili Müdürlüğü ilanı, ilan sıra no 73)
- **K**: Kaşe
- **BF**: Seyahat Acentaları Bilgi Formu ve Online Satış ve Pazarlama Kanalı Beyan ve Taahhütnamesi (fotoğraf)

| Alan | Değer | Kaynak | Durum |
|---|---|---|---|
| Ticaret unvanı (tam) | ROTA KARS TURİZM TAŞIMACILIK SEYAHAT ACENTASI LİMİTED ŞİRKETİ | VL, FB, OK, TSG | ✅ 4 belgede aynı |
| Ticaret unvanı (kısa) | ROTA KARS TURİZM TAŞIMACILIK SEYAHAT ACENTASI LTD. ŞTİ. | İB, BF; kaşede "ROTA KARS TUR. TAŞ. SEY. AC. LTD. ŞTİ." | ✅ |
| Acenta unvanı (işletme belgesindeki) | ROTA KARS TURİZM | İB, BF | ✅ |
| Belge grubu | A Grubu Seyahat Acentası | İB | ✅ |
| Seyahat acentası belge no | 13948 | İB, BF | ✅ Sitedeki `tursabNo` ile aynı |
| İşletme belgesi düzenleme tarihi | 05.04.2022 (yeni belge) | İB | ✅ |
| Belgeyi veren | T.C. Kültür ve Turizm Bakanlığı, 1618 sayılı Kanun uyarınca | İB | ✅ |
| Adres | Yeni Mah. Cumhuriyet Cad. Köşk Apt. (Blok) No: 26 İç Kapı No: 13, Merkez / Kars | VL, İB, FB, OK, TSG, K | ✅ Yazım farkı yalnız "Blok" kelimesi (FB, OK, TSG'de var; VL, İB, K'de yok) |
| Merkez | Kars | İB, TSG | ✅ |
| Vergi dairesi | Kars | VL, BF | ✅ |
| Vergi kimlik no | 7351872966 | VL, K, BF | ✅ |
| Vergi türü | Kurumlar vergisi | VL | ✅ |
| İşe başlama tarihi | 09.02.2022 | VL | ✅ |
| Ana faaliyet kodu | 791101 Seyahat acentesi faaliyetleri | VL | ✅ |
| MERSİS no | 0735187296600001 | FB, OK, TSG, K, BF | ✅ 5 belgede aynı |
| Ticaret sicil müdürlüğü | Kars Ticaret Sicili Müdürlüğü | TSG ("T.C. Kars Ticaret Sicili Müdürlüğü'nden") | ✅ Bilgi formunda "Kars Ticaret ve Sanayi Odası" yazıyor; sicil müdürlüğü oda bünyesindedir |
| Ticaret sicil no | 8625 | FB, OK, TSG, K, BF | ✅ |
| Oda | Kars Ticaret ve Sanayi Odası (KATSO) | FB, OK | ✅ |
| Oda sicil no | 8625 | FB, OK | ✅ |
| Tescil / odaya kayıt tarihi | 09.02.2022 | OK, FB, TSG | ✅ |
| Meslek grubu | 8. derece | FB, OK | ✅ |
| NACE (esas) | 79.11.01 Seyahat acentesi faaliyetleri | FB, OK | ✅ |
| NACE (diğer) | 49.39.03 Şehir içi, banliyö ve kırsal alanlarda kara yolu ile personel, öğrenci vb. grup taşımacılığı | FB | ✅ |
| Sermaye | 400.000,00 TL (4.000 pay × 100 TL) | FB, OK, TSG | ✅ |
| Şirket süresi | Süresiz | TSG | ✅ |
| Müdür / yetkili | Himmet Yeniaras (münferiden temsile yetkili müdür) | OK, TSG | ✅ Kişisel veri; künyede gösterilip gösterilmeyeceği size kalmış |
| KEP adresi | rotakarsturizm@hs01.kep.tr | BF | ⚠️ Yalnız bilgi formunda |
| UETS adresi | 25818-46233-07292 | BF | ⚠️ Yalnız bilgi formunda; sitede yayımlanması gerekmez |
| E-posta | info@rotakarsturizm.com | BF | ✅ Sitedeki ile aynı |
| İşyeri telefonu | 0474 223 65 44 | BF | ✅ Sitedeki ile aynı |
| Yetkili cep telefonu | 0545 935 34 10 | BF | ✅ Sitedeki `mobile` ile aynı |

## Sitede bulunup belgelerde olmayanlar

| Sitedeki bilgi | Yer | Not |
|---|---|---|
| WhatsApp 0545 935 34 10 | `server/catalog.mjs` → `business.whatsapp` | Belgelerde yok; yanlış değil, yalnız doğrulanmadı. |
| `founded: 2010` ("2010'dan beri") | `server/catalog.mjs`, altbilgi | ✅ Acente 03.11.2026'da doğru olduğunu teyit etti; ifade kalıyor. Not: bugünkü Ltd. Şti. 09.02.2022'de tescilli, yani 2010 markanın daha önceki faaliyetini anlatıyor. Bir şikâyet hâlinde dayanağını gösterebilecek bir belge (eski vergi levhası, eski işletme belgesi vb.) dosyada bulunsun. |
| "Google'da 456 değerlendirmede 4,9 puan" | `server/catalog.mjs` → `features` | Yasal metin konusu değil; sabit yazılmış bir sayı, canlı veriden gelmiyor. |

## Belgelerde olup sitede eksik olanlar

Ticaret unvanının tamamı, MERSİS, vergi dairesi ve numarası, ticaret sicil müdürlüğü ve numarası, KEP adresi, oda bilgisi. Bunlar `07-yasal-kunye.md` taslağında.
