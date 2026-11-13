import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Renders every face lens on a synthetic face (visual regression check).
export default defineConfig({
  root: 'e2e/lens-harness',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5198, strictPort: true },
});
