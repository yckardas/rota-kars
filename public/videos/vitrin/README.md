# Vitrin videoları

Ana sayfa vitrininde (HeroSlider) tur fotoğrafının yerine sessiz, döngüde oynayan kısa videolar. Hangi turda hangi dosyanın oynayacağı `src/lib/heroVideos.ts` içinde, tur kimliğine göre yazılır.

- `portrait` (dikey, 9:16) yalnız telefonda (≤760 px), `landscape` (yatay, 16:9) geniş ekranda oynar. Biri yoksa o ekranda fotoğraf kalır.
- Süre slayt süresine yakın olsun (vitrin 6,5 sn'de bir döner), 6–10 sn. Ses olmaz (`-an`).
- Boyut: dikey 720×1280, yatay 1920×1080 en çok; dosya 1,5 MB altında. Örnek kodlama:
  `ffmpeg -i girdi.mp4 -an -c:v libx264 -profile:v high -preset slow -crf 27 -movflags +faststart cikti.mp4`
- Video sayfa yüklendikten sonra iner; "hareketi azalt" ya da veri tasarrufu açıksa hiç inmez.

## Mevcut

| Dosya | Tur | Kaynak |
| --- | --- | --- |
| `ani-cildir-dikey.mp4` | `ani-cildir` | `../cildir-atli-kizak.mp4` 5–8 sn, `../kars-ani-gezisi.mp4` 15,1–16,9 ve 17,1–18,9 sn (6,6 sn) |
