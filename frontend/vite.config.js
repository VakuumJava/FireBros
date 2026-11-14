import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// @contracts -> ../contracts (fixtures and schemas live outside frontend/)
const contracts = fileURLToPath(new URL('../contracts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@contracts': contracts } },
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    // /api/... requests go to FastAPI (P1), so CORS is not needed
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } },
  },
  build: { chunkSizeWarningLimit: 5000 }, // Plotly is lazy-loaded and heavy by nature
  test: { environment: 'node', include: ['src/**/*.test.{js,jsx}'] },
});
