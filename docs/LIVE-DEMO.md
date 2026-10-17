# Geçici canlı demo

Bu proje Express + Node SQLite kullanır. Tüm rezervasyon/üyelik işlevlerini koruyan demo, ayrı bir production sunucusu ve Cloudflare Quick Tunnel ile paylaşılır. Statik dosyaları tek başına yayınlamak API'leri çalıştırmaz.

## Çalışan süreçler

- Geliştirme önizlemesi: `127.0.0.1:5174` (mevcut veriler).
- Demo sunucusu: `127.0.0.1:5180` (ayrı örnek veriler).
- Cloudflared tüneli: yalnız 5180 portunu dışarı açar.

Güncel URL ve doğrulama sonucu `work/live-demo/verified.json` dosyasındadır. Bu dosya, tünel aracı/logları ve yerel ayarlar Git'e eklenmez.

## Demo verileri ve erişim

`npm run demo`, eksikse `.env.demo` dosyasını rastgele bir yönetici parolasıyla oluşturur. Ana `.env` dosyasını veya geliştirici API anahtarlarını yüklemez. Veritabanı `data/live-demo.sqlite`, yönetim parolası `.env.demo` içindeki `ADMIN_PASSWORD` alanıdır. Bu parola yerel geliştirme panelindekinden ayrıdır.

Gerçek ödeme kapalıdır. Google/Apple/Facebook girişleri sağlayıcı bilgileri olmadığı için açılmaz. Yerel yanıt veren chatbot, kayıt/giriş, kupon, davet, ön rezervasyon ve yönetim ekranları çalışır. Google yorumları mevcut tarihli kayıttan gelir.

## Yeniden başlatma

```sh
npm run build
npm run demo
```

Başka bir terminalde, proje klasöründen:

```sh
work/live-demo/cloudflared tunnel --config work/live-demo/tunnel.yml --url http://127.0.0.1:5180 --protocol http2 --no-autoupdate --logfile work/live-demo/tunnel.log
```

Araç resmi `cloudflare/cloudflared` GitHub sürümünden indirilip yayınlanan SHA-256 özetiyle doğrulanmıştır. Taşınabilir araç ve ayar dosyası `work/live-demo` içinde bu bilgisayarda bulunur; başka makinede resmi Cloudflare kurulum yönergesini kullanın.

Tünel her yeniden açılışta farklı bir URL üretir. Bilgisayar uyur, ağ kesilir veya demo/tünel süreci kapanırsa link çalışmaz. Kalıcı hosting yerine geçen bir yayın değildir. Sabit adres ve bilgisayardan bağımsız çalışma için Node.js 22.13+ (önerilen 24 LTS) ve kalıcı disk destekleyen bir sunucuya dağıtım gerekir. Mevcut SQLite dosyası bu diskte tutulmalıdır.

Kaynak: [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
