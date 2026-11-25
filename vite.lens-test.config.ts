import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Renders every face lens on a synthetic face, or on a real photo with ?photo=/portrait.jpg
// (drop any frontal portrait into e2e/lens-harness/; it is git-ignored).
export default defineConfig({
  root: 'e2e/lens-harness',
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5198, strictPort: true, fs: { allow: ['.'] } },
});
