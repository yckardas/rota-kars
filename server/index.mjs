import { resolve } from "node:path";
import express from "express";
import { createApp } from "./app.mjs";
import { openStore } from "./store.mjs";
const port = Number(process.env.PORT || 5173),
  store = await openStore(process.env.DATABASE_PATH),
  app = createApp(store);
if (process.env.NODE_ENV === "production") {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_q, r) => r.sendFile(resolve("dist/index.html")));
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
  } catch {
    console.error("Background notification job failed");
  } finally {
    jobsBusy = false;
  }
}, 30000);
jobs.unref();
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
