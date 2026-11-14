import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const contracts = fileURLToPath(new URL("../contracts", import.meta.url));
const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@contracts": contracts } },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    fs: { strict: true, allow: [root, contracts] },
    proxy: { "/api": { target: "http://localhost:8000", changeOrigin: true } },
  },
  build: { chunkSizeWarningLimit: 5000 },
  test: { environment: "node", include: ["src/**/*.test.{js,jsx}"] },
});
