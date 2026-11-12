# Eski site arşivi (rotakarsturizm.com, WordPress)

Derleme tarihi: 12 Kasım 2026. Kaynak: Internet Archive Wayback Machine.

Eski site WordPress + WooCommerce üzerinde çalışıyordu (tasarım: Öztürk Media). Turlar `/tur/<slug>/` adresinde WooCommerce ürünü olarak duruyordu. Domain artık yeni siteyi gösteriyor ve eski WordPress kaldırıldı.

## Arşivde ne var, ne yok

| İçerik | Durum |
| --- | --- |
| Tur listesi (24 tur) | Var. Ürün sitemap'inden alındı, bkz. `turlar.json` |
| Ana sayfadaki 6–7 popüler turun fiyatı | Var. Temmuz 2024 – Temmuz 2025 arası |
| Tur programı, gün gün akış, dahil/hariç | **Yok.** Tur sayfalarının çoğu hiç arşivlenmemiş. Nahçıvan ve Şavşat Karagöl'ün Eylül 2025 kayıtları bozuk, açılmıyor |
| Hakkımızda, Hizmetlerimiz, Galeri, Tur İptali sayfaları | **Yok.** Hiç arşivlenmemiş |
| Fotoğraflar | 17 sağlam görsel indirildi, `gorseller/` klasöründe. Eylül 2025 taramasındaki yaklaşık 25 görselin kayıtları bozuk |

Ani–Çıldır, Sarıkamış, Batum ve Konaklamalı Van turlarının programları 16 Ekim 2026'da, eski site henüz yayındayken alındı ve `server/catalog.mjs` içine işlendi (bkz. `docs/SOURCES.md`).

Kalan turların tam içeriği yalnızca eski WordPress veritabanında var. Eski hosting firmasında ya da Öztürk Media'da bir yedek bulunursa (`.sql` dökümü ya da cPanel yedeği) tüm turlar oradan çıkarılabilir.

## Fiyat geçmişi (kişi başı taban fiyat, ₺)

| Tur | 27.07.2024 | 29.03.2025 | 13.07.2025 | Yeni katalog |
| --- | ---: | ---: | ---: | --- |
| Ani, Çıldır Gölü ve Kars Şehir Turu | 350 | 750 | 750 | `ani-cildir` |
| Sarıkamış Kayak Turu | 600 | 850 | 850 | `sarikamis` |
| Günübirlik Batum Turu | 1.299 | 1.299 | 1.750 | `batum` |
| Konaklamalı Van Turu | 3.500 | 3.500 | 4.000 | `van` |
| Günübirlik Van Turu | 1.500 | 1.500 | 1.750 | `van-gunubirlik` |
| Van Havzası Turu | – | – | 7.000 | `van-havzasi` |
| Kapadokya Turu | 1 (yer tutucu) | 1 (yer tutucu) | – | yok |

Temmuz 2025'te kartlarda fiyat aralığı da görünüyordu (ör. Ani 750–7.500 ₺). Üst değer büyük ihtimalle kişi sayısı seçeneğinin en yüksek tutarıdır.

## Yeni katalogda olmayan turlar (18)

Şavşat Karagöl, Konaklamalı Karadeniz, Konaklamalı Batum, 2 Gece Konaklamalı Batum (Yılbaşı), Batum–Tiflis (2 gece), Konaklamalı Tiflis, 2 Gece Konaklamalı Tiflis, Bakü–Tiflis (uçuşlu), Azerbaycan Bakü, Azerbaycan Bakü (Yılbaşı), Büyük Azerbaycan (Nahçıvan–Bakü), Nahçıvan, Narman Peri Bacaları–Tortum Şelalesi, Tuzluca Tuz Mağaraları–İshak Paşa Sarayı, Kapadokya, Güneydoğu, Güneydoğu (3 günlük), Butik Mardin.

Bu turların adları ana sayfada görünmüyordu, adreslerinden türetildi. Yazımı firmaya doğrulatılmalı.

## Görseller

Hepsi eski sitenin `wp-content/uploads` klasöründen. Bazıları (Kapadokya balonları, Akdamar, genel turizm kolajı) büyük ihtimalle internetten alınmış stok görseller. Telif durumu belli olmadan yeni sitede kullanılmamalı. Firmanın kendi çektiği kesin görünenler: 13, 14, 15 (Rota otobüsü ve karşılama).

| # | Dosya | Ne gösteriyor | Boyut |
| --- | --- | --- | --- |
| 1 | `2022-10-1-10-400x300.jpg` | Kapadokya, balonlar | 400×300 |
| 2 | `2022-10-1-4-400x300.jpg` | Van Kedi Villası | 400×300 |
| 3 | `2022-10-11-3-400x300.jpg` | Sarıkamış kardan heykeller | 400×300 |
| 4 | `2022-10-12-4.jpg` | Ters ev (büyük ihtimalle Batum) | 2048×1536 |
| 5 | `2022-10-2-7-400x300.jpg` | Ani'de bir kilise, kar | 400×300 |
| 6 | `2022-10-3-400x300.webp` | Akdamar Adası ve Van Gölü | 400×300 |
| 7 | `2022-10-3-6-400x300.jpg` | Kapadokya, gün batımı balonlar | 400×300 |
| 8 | `2022-10-32-400x300.png` | Çıldır Gölü'nde buz pateni (kolaj) | 400×300 |
| 9 | `2022-10-34453.jpg` | Genel turizm/araç kolajı | 666×341 |
| 10 | `2022-10-4-4-400x300.jpg` | Ali ve Nino heykeli, Batum | 400×300 |
| 11 | `2022-10-54645654.jpg` | Göl kıyısında kasaba (yer belirsiz) | 666×341 |
| 12 | `2022-10-8-2-400x300.jpg` | Van Müzesi | 400×300 |
| 13 | `2022-10-rota-kars-tur-slider_0000_4-1-1900x1265-1.jpg` | Otobüs içi, siyah-beyaz (slider) | 1920×1080 |
| 14 | `2022-10-rota-kars-tur-slider_0001_3-1900x1265-1.jpg` | Rota logolu otobüs (slider) | 1920×1080 |
| 15 | `2022-10-rota-kars-tur-slider_0002_2-1900x1082-1.jpg` | Rota tabelasıyla karşılama (slider) | 1920×1080 |
| 16 | `2022-10-rota-kars-tur-slider_0004_maxresdefault-1280x720-1.jpg` | Kars Garı, gece | 1920×1080 |
| 17 | `2025-05-AHLAT-MEZARLIK-400x300.webp` | Ahlat Selçuklu Mezarlığı | 400×300 |

## Kaynak adresler

- Wayback dizini: `https://web.archive.org/cdx/search/cdx?url=rotakarsturizm.com/*`
- Tur listesi: `https://web.archive.org/web/20250713070931/https://rotakarsturizm.com/wp-sitemap-posts-product-1.xml`
- Ana sayfa kayıtları: 20240727233307, 20250329024503, 20250713014840
- Görseller: `https://web.archive.org/web/<tarih>id_/https://rotakarsturizm.com/wp-content/uploads/<dosya>`
