import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Stamp a unique build id into the service worker's cache name so each deploy
// busts the old cache (the SW purges non-matching caches on activate).
function stampServiceWorker() {
  return {
    name: 'stamp-sw',
    apply: 'build',
    writeBundle(options) {
      const file = resolve(options.dir || 'dist', 'sw.js');
      if (!existsSync(file)) return;
      const id = Date.now().toString(36);
      writeFileSync(file, readFileSync(file, 'utf8').replace(/__BUILD_ID__/g, id));
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), stampServiceWorker()],
});
