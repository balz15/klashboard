import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // Required for Capacitor Android — absolute /assets/ paths cause a blank WebView.
  base: './',
  plugins: [react()],
  server: {
    host: true, // expose on LAN so phones can connect via your PC IP
    port: 5173,
    watch: {
      // Supabase SQL/migrations are not part of the web app; ignore to avoid Windows EBUSY crashes.
      ignored: ['**/supabase/**'],
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
