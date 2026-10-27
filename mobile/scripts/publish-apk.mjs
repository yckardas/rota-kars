// Release APK'yı GitHub Releases'a yükler ve sunucunun güncelleme bilgisini yazar.
// Kullanım: node scripts/publish-apk.mjs "Sürüm notu" [--zorunlu]
//   --zorunlu: bu sürümden eskiler "güncelleme gerekli" uyarısı görür.
// Önce: npm run apk:release. Sonra server/android-release.json commit + push edilir;
// Railway yayına alınca telefonlardaki uygulama "Yeni sürüm hazır" uyarısını gösterir.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const required = args.includes("--zorunlu");
const notes = args.filter((a) => !a.startsWith("--")).join(" ").trim();
if (!notes) throw new Error('Sürüm notu gerekli: node scripts/publish-apk.mjs "Ne değişti"');
if (notes.length > 500) throw new Error("Sürüm notu en fazla 500 karakter olmalı.");

const version = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;
const apk = resolve(root, `dist/rota-kars-yonetim-${version}.apk`);
if (!existsSync(apk)) throw new Error(`${apk} yok. Önce: npm run apk:release`);

// İndirme bağlantısı herkese açık depoda olmalı (telefon girişsiz indirir).
const repo = process.env.ROTA_RELEASE_REPO || "yckardas/rota-kars";
const tag = `android-v${version}`;
execFileSync(
  "gh",
  ["release", "create", tag, apk, "--repo", repo, "--target", "main", "--latest",
    "--title", `Yönetim uygulaması ${version}`, "--notes", notes],
  { stdio: "inherit" },
);

const file = resolve(root, "../server/android-release.json");
const previous = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
const release = {
  version,
  minVersion: required ? version : previous.minVersion || null,
  apkUrl: `https://github.com/${repo}/releases/download/${tag}/${basename(apk)}`,
  notes,
};
writeFileSync(file, JSON.stringify(release, null, 2) + "\n");
console.log(`\nYayımlandı: ${release.apkUrl}\nŞimdi server/android-release.json dosyasını commit edip push edin.`);
