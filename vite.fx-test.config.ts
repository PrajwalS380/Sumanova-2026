import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Serves e2e/fx-harness (music synthesis + video effects check, run by e2e/fx.e2e.cjs).
export default defineConfig({
  root: 'e2e/fx-harness',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5196, strictPort: true },
});
