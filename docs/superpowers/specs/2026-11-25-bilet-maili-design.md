# Bilet maili ve PDF belgeler — kısa tasarım

## Neden
Onay maili sözleşme ve ön bilgilendirme formunun tamamını gövdeye döküyor; müşteri için çok uzun ve okunmuyor (kullanıcı kendi hesabıyla denedi, 2026-11-25). İstenen: kısa, estetik, QR'lı bir bilet maili; yasal metinler PDF eki.

## Hedefler
- **Onay maili** (`reservation_confirmed`): logolu, kısa bilet kartı + QR.
  - Online ödeme: başlık "Ödemeniz alındı, rezervasyonunuz onaylandı", **ödenen tutar**.
  - Acente onayı: başlık "Rezervasyonunuz acente tarafından onaylandı"; ödeme varsa **ödenen tutar**, kalan varsa **kalan bakiye** (ikisi de olabilir: kısmi ödeme).
  - Ek: Tur Hizmet Sözleşmesi (PDF) + Ön Bilgilendirme Formu (PDF).
- **Ön rezervasyon maili** (`reservation_created`): aynı düzen, QR yok (henüz kesin bilet değil), "onay bekliyor" vurgusu, toplam tutar; ek: Ön Bilgilendirme Formu (PDF). *(Benim önerim; kullanıcı itiraz etmedi.)*
- QR, `/bilet/<token>` bağlantısını taşır; paneldeki bilet okuyucu bugünkü gibi okur.

## Hedef dışı
- İptal, hatırlatma, hesap güvenliği, acente bildirimleri: değişmez.
- Bilet sayfası ve panel arayüzü: değişmez.
- Başarısız eski mesajların yeniden gönderimi: ayrı iş.

## Olmaması gerekenler
- Yasal metin yalnız bağlantı olarak verilmemeli: mesafeli satışta kalıcı veri saklayıcısı şartı için PDF **ek olarak** gider.
- Türkçe karakterler (ğ, ş, ı, İ) PDF'te bozulmamalı.
- QR uzak görsel/`data:` olmamalı (Gmail göstermez): logo gibi gömülü (`cid:`).

## Yaklaşımlar
1. **Seçilen — anlık görüntü kuyrukta, üretim gönderimde.** Kuyruk kaydına bilet alanları (`ticket`) ve belge metinleri (`documents: [{ title, filename, text }]`) yazılır; gönderici HTML bileti, QR PNG'yi ve PDF'leri gönderim anında bu kayıttan üretir. Mail onay anının birebir kopyasıdır; yeniden denemede aynı içerik gider; veritabanına dosya yazılmaz.
2. Kuyrukta yalnız rezervasyon numarası, gönderici rezervasyondan okur — elendi: arada değişiklik olursa farklı içerik gider, gönderici veritabanına bağımlı olur.
3. PDF'leri önceden üretip kuyrukta saklamak — elendi: veritabanı büyür, kazanç yok.

## Kararlar
- PDF: `pdfkit` (metni sayfalara kendisi böler). Yazı tipi: sitenin gövde yazı tipi **Onest**, tam TTF (OFL lisanslı, google/fonts deposundan) `server/assets/fonts/` altına eklenir; fontsource dosyaları alt kümelere bölündüğü için uygun değil.
- QR: mevcut `qrcode` paketi, bilet sayfasıyla aynı renk/ayar (lacivert, beyaz zemin), PNG olarak gömülü.
- Düz metin sürümü kısa kalır (özet + bilet bağlantısı); belgeler gövdeye eklenmez.
- Resend ve SMTP yolları ekleri aynı `renderMail` çıktısından alır.
- `ticket`/`documents` olmayan eski kuyruk kayıtları bugünkü gibi düz gövdeyle gider.
- KVKK saklama işi kuyruktaki `documents` alanını da temizlemeli (bugün `body` nasıl temizleniyorsa).

## Görünüm (taslak)
```
[Rota Kars logosu]
Ödemeniz alındı, rezervasyonunuz onaylandı
Merhaba Yusuf,

┌──────────────────────────────────────────┐
│ ANİ ANTİK KENTİ, ÇILDIR GÖLÜ, KARS GEZİSİ │
│ 28 Kasım 2026 Cumartesi · 08:30           │
│ Buluşma  Kars merkezde ev, otel…          │
│ Koltuk 4          Rezervasyon RK-06AE…    │
│ Ödenen 2.400 TL   (Kalan bakiye 1.680 TL) │
│                 [  QR  ]                  │
│        Girişte bu kodu gösterin           │
└──────────────────────────────────────────┘
        [ Biletinizi açın ]
Ekler: Tur Hizmet Sözleşmesi.pdf · Ön Bilgilendirme Formu.pdf
──────────────
Rota Kars Turizm · TÜRSAB A Grubu 13948 · iletişim
```

## Uygulayıcıya kalan
Kartın tam görsel ayrıntısı (sitenin bilet kartı ve renkleriyle uyumlu), PDF sayfa düzeni (logo, başlık, sayfa numarası), dosya adları.
