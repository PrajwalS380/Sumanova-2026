import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Serves e2e/call-harness with the Supabase client swapped for a local relay.
export default defineConfig({
  root: 'e2e/call-harness',
  resolve: {
    alias: [
      { find: /^@\/lib\/supabase$/, replacement: fileURLToPath(new URL('./e2e/call-harness/supabase-shim.ts', import.meta.url)) },
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
  },
  server: { port: 5199, strictPort: true },
});
