import { copyFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { siteRoutes } from './src/lib/docs-manifest';

/**
 * Copy the built app shell to every client route (for example `tools/index.html`) and to
 * `404.html`, so any static host serves deep links without server rewrite rules.
 */
function routePages(): Plugin {
  let outDir = 'dist';
  return {
    name: 'devicebench-route-pages',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const shell = join(outDir, 'index.html');
      for (const route of siteRoutes) {
        mkdirSync(join(outDir, route), { recursive: true });
        copyFileSync(shell, join(outDir, route, 'index.html'));
      }
      copyFileSync(shell, join(outDir, '404.html'));
    },
  };
}

export default defineConfig({ plugins: [react(), routePages()] });
