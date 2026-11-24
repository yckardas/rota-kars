# Belgeler, şans çarkı, renkli alt bilgi, üyelik çizimi, tur kopyalama — tasarım

Müşteri istekleri, 24.11.2026. Kullanıcı tüm önerileri onayladı ("hepsinde senin önerinle gidelim").
İki PR: **PR 1** = madde 2-5, **PR 2** = tur kopyalama.

## PR 1

### Şans çarkı (hata)
- **Neden:** Üye olduktan sonra Hesabım'da çark dönmüyor.
- **Bulgu:** Canlı kampanyada `requireVerified: true`. E-postasını doğrulamamış üye `/member/spin` → 403 "Önce e-posta adresinizi doğrulayın"; çark kıpırdamaz.
- **Ne:** Doğrulanmamış üye de çevirir; sonuç `member_spins`'e `coupon_id: null` ile yazılır, e-posta doğrulanınca mevcut `activatePending` kupona çevirir (misafir çarkıyla aynı akış). Sahte hesapla kupon toplama koruması korunur. Ekranda "E-postanızı doğrulayınca kuponunuz aktifleşir" yazar.

### Gerekli belgeler ve önemli notlar
- **Neden:** Yurt dışı turlarında kimlik/pasaport/muvafakatname/çıkış harcı bilgisi genel "not" içinde kayboluyor.
- **Ne:** Tur içeriğine yeni alan `documents: string[]` (en fazla 12 satır × 300 karakter). Panelde Site içerikleri → tur düzenleyicide "Gerekli belgeler ve önemli notlar" (her satır bir madde; sahip ve operasyon düzenler).
- Tur sayfasında başlık bilgilerinin hemen altında renkli, dikkat çeken kutu; rezervasyon adımında (yolcu bilgileri) aynı liste kısa kutu olarak.
- Varsayılanlar: Batum, Tiflis, Nahçıvan, Büyük Azerbaycan notlarındaki belge cümleleri listeye taşınır; not alanında kalan genel bilgi korunur.
- İngilizce: varsayılan listelerin çevirisi catalog-en'e eklenir; panelde değişince Türkçe görünür (mevcut `fresh` kuralı).

### Renkli alt bilgi
- Sitenin en altındaki bilgi alanı (footer): gece mavisi zemin, üstte rota renkleri şeridi, sütun başlıkları rota renkleriyle, iletişim sütunu öne çıkan kart. Yalnız `.kp` (herkese açık site); panel etkilenmez.

### Üyelik ekranı görseli
- Fotoğraf üretme aracı yok; kullanıcı onayıyla sitenin renkli dilinde SVG çizim (Ani silueti, dağlar, karlı yol, rota çizgisi). `/images/kars.webp` yerine geçer.

## PR 2: Tur kopyalama
- **Neden:** Müşteri mevcut bir turu (ör. Tiflis) kopyalayıp rotası, gezilecek yerleri, süresi (konaklamalı → günübirlik) farklı yeni bir tur yayınlamak istiyor.
- **Seçilen yaklaşım (A):** Kopya tamamen yeni bir tur kaydıdır (yeni adres/id). Panelde "Kopyala"; kopya turlar listesi, tur sayfası, seferler, araç planı, rezervasyon, SEO'da kendi turu gibi davranır; yayından kaldırılabilir. Kod içindeki turlar değişmez. İngilizce sitede çevrilene kadar Türkçe.
- **Reddedilen (B):** Tur altında program seçenekleri — fiyat/sefer/rezervasyonun seçeneğe bağlanması daha çok değişiklik ister, esnekliği az.
- Ayrıntılı tasarım PR 2 başında yazılır.
