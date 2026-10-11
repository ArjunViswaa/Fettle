import { statSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/** Same idea as apps/api/src/lib/watchdog.ts: exit once scripts/run.mjs stops its heartbeat. */
function watchLauncher(): Plugin {
  return {
    name: 'fettle-watch-launcher',
    apply: 'serve',
    configureServer(server) {
      const file = process.env.FETTLE_HEARTBEAT;
      if (!file) return;
      let last = Date.now();
      const timer = setInterval(async () => {
        const now = Date.now();
        const delayed = now - last > 6000;
        last = now;
        if (delayed) return;
        let beatAt = 0;
        try {
          beatAt = statSync(file).mtimeMs;
        } catch {
          // removed: launcher stopping
        }
        if (now - beatAt > 10_000) {
          clearInterval(timer);
          await server.close();
          process.exit(0);
        }
      }, 3000);
      timer.unref();
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), watchLauncher()],
  server: {
    port: 5174,
    strictPort: true,
    // Same-origin in dev so auth cookies just work.
    proxy: {
      '/api': { target: 'http://127.0.0.1:4100', changeOrigin: false },
    },
  },
  build: {
    // ECharts dominates the bundle; fine for a self-hosted app served from the same machine.
    chunkSizeWarningLimit: 1600,
  },
});
