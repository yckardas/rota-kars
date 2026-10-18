import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  optimizeDeps: { entries: ["index.html"] },
  server: { host: "127.0.0.1" },
  // Lightning CSS: tekrar eden kuralları birleştirerek daha küçük CSS üretir.
  build: { sourcemap: false, cssMinify: "lightningcss" },
});
