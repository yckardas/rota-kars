import { resolve } from "node:path";
import express from "express";
import { createApp } from "./app.mjs";
import { openStore } from "./store.mjs";
const port = Number(process.env.PORT || 5173),
  store = openStore(process.env.DATABASE_PATH),
  app = createApp(store);
if (process.env.NODE_ENV === "production") {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_q, r) => r.sendFile(resolve("dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const server = app.listen(port, "127.0.0.1", () =>
  console.log(`Rota Kars local: http://127.0.0.1:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      store.db.close();
      process.exit(0);
    }),
  );
