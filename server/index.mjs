import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import express from "express";
import { createApp } from "./app.mjs";
import { openStore } from "./store.mjs";
import { seoHtmlHandler } from "./seo.mjs";
const port = Number(process.env.PORT || 5173),
  store = await openStore(),
  app = createApp(store);
if (process.env.NODE_ENV === "production") {
  const template = await readFile(resolve("dist/index.html"), "utf8");
  // Adında içerik özeti olan derleme dosyaları bir yıl, görseller bir hafta önbellekte kalır.
  app.use(
    "/assets",
    express.static(resolve("dist/assets"), { immutable: true, maxAge: "365d", index: false }),
  );
  app.use("/images", express.static(resolve("dist/images"), { maxAge: "7d", index: false }));
  app.use(express.static(resolve("dist"), { index: false }));
  app.use(seoHtmlHandler(process.env, async () => template));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: {
      middlewareMode: true,
      hmr: {
        port: port + 100,
      },
    },
    appType: "spa",
  });
  app.use(
    seoHtmlHandler(process.env, async (url) =>
      vite.transformIndexHtml(
        url,
        await readFile(resolve("index.html"), "utf8"),
      ),
    ),
  );
  app.use(vite.middlewares);
}
const host =
  process.env.HOST ||
  (process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "1"
    ? "0.0.0.0"
    : "127.0.0.1");
let jobsBusy = false;
const jobs = setInterval(async () => {
  if (jobsBusy) return;
  jobsBusy = true;
  try {
    await store.workflow.reminders();
    await store.notifications.processBatch();
  } catch (e) {
    console.error(
      JSON.stringify({
        level: "error",
        job: "notifications",
        error: e?.name,
        message: String(e?.message || "").slice(0, 300),
      }),
    );
  } finally {
    jobsBusy = false;
  }
}, 30000);
jobs.unref();
// KVKK saklama süreleri: açılışta ve günde bir kez eski kişisel veriler temizlenir.
const retention = async () => {
  try {
    const r = await store.privacy.runRetention();
    console.log(JSON.stringify({ level: "info", job: "retention", ...r }));
  } catch (e) {
    console.error(JSON.stringify({ level: "error", job: "retention", error: e?.name, message: String(e?.message || "").slice(0, 200) }));
  }
};
setTimeout(retention, 60000).unref();
setInterval(retention, 24 * 3600 * 1000).unref();
const server = app.listen(port, host, () =>
  console.log(`Rota Kars local: http://127.0.0.1:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearInterval(jobs);
    server.close(async () => {
      await store.db.close();
      process.exit(0);
    });
  });
