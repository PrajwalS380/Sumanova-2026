import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Renders a grid of sculpted avatars (visual check of the 3D figure).
export default defineConfig({
  root: 'e2e/avatar-harness',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5199, strictPort: true },
});
