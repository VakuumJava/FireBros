import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// @contracts -> ../contracts (фикстуры и схемы лежат вне frontend/)
const contracts = fileURLToPath(new URL('../contracts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@contracts': contracts } },
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    // Запросы /api/... уходят на FastAPI (P1), поэтому CORS не нужен
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } },
  },
  build: { chunkSizeWarningLimit: 5000 }, // Plotly грузится лениво, он тяжёлый по природе
  test: { environment: 'node', include: ['src/**/*.test.{js,jsx}'] },
});
