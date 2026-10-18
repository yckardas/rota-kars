import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { parseEnv } from "node:util";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const settings = new URL("../.env.demo", import.meta.url);
if (!existsSync(settings))
  writeFileSync(
    settings,
    [
      "NODE_ENV=production",
      "DEMO_MODE=1",
      "PORT=5180",
      "MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true",
      "MONGODB_DB=rota-kars-demo",
      "TRUST_PROXY=1",
      "PAYMENT_PROVIDER=disabled",
      "GOOGLE_REVIEWS_PROVIDER=business",
      "ADMIN_PASSWORD=" + randomBytes(24).toString("base64url"),
      "PUBLIC_BASE_URL=",
    ].join("\n") + "\n",
    { flag: "wx", mode: 0o600 },
  );
const config = parseEnv(readFileSync(settings, "utf8"));
if (!existsSync(new URL("../dist/index.html", import.meta.url)))
  throw new Error("Önce npm run build çalıştırın.");
if (!config.MONGODB_DB || config.MONGODB_DB === "rota-kars")
  throw new Error("Canlı demo için ayrı bir veritabanı kullanın.");
// Deliberately isolate the demo from the developer's service credentials and .env.
const child = spawn(process.execPath, ["server/index.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: {
    PATH: process.env.PATH,
    ...config,
    NODE_ENV: "production",
    DEMO_MODE: "1",
  },
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
