// APK derleme: node scripts/build-apk.mjs [debug|release]
// ROTA_APP_URL: uygulamanın açacağı site (varsayılan https://rotakarsturizm.com).
// Release için imza bilgileri: ROTA_KEYSTORE, ROTA_KEYSTORE_PASSWORD, ROTA_KEY_ALIAS, ROTA_KEY_PASSWORD.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const mode = process.argv[2] === "release" ? "release" : "debug";
const root = resolve(import.meta.dirname, "..");
const url = (process.env.ROTA_APP_URL || "https://rotakarsturizm.com").replace(/\/+$/, "");
if (!/^https:\/\/[a-z0-9.-]+$/i.test(url)) throw new Error("ROTA_APP_URL https://alan-adi biçiminde olmalı.");

const config = JSON.parse(readFileSync(resolve(root, "capacitor.config.json"), "utf8"));
config.server.url = url + "/yonetim";
writeFileSync(resolve(root, "capacitor.config.json"), JSON.stringify(config, null, 2) + "\n");
writeFileSync(resolve(root, "www/config.js"), `window.ROTA_APP_URL = ${JSON.stringify(url)};\n`);

if (!existsSync(resolve(root, "android/app/google-services.json")))
  console.warn(
    "UYARI: android/app/google-services.json yok. Uygulama çalışır ama bildirim alamaz.\n" +
      "Firebase konsolu → Proje ayarları → Android uygulaması (com.rotakars.yonetim) → google-services.json indirip bu konuma koyun.",
  );

const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: "inherit", env: process.env });
run("npx", ["cap", "sync", "android"]);
run("./gradlew", [mode === "release" ? "assembleRelease" : "assembleDebug"], resolve(root, "android"));

const version = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;
const out = resolve(root, `android/app/build/outputs/apk/${mode}/app-${mode}.apk`);
mkdirSync(resolve(root, "dist"), { recursive: true });
const target = resolve(root, `dist/rota-kars-yonetim-${version}${mode === "debug" ? "-debug" : ""}.apk`);
copyFileSync(out, target);
console.log("\nAPK hazır: " + target);
