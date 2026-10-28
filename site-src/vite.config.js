import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The tools talk to dustmaps3d-backend (backend/README.md). `pnpm dev` and
// `pnpm preview` forward /api and /files to it, so the browser sees one origin;
// DUSTMAPS_BACKEND points the proxy elsewhere.
const backend = process.env.DUSTMAPS_BACKEND || 'http://127.0.0.1:58123';
const proxy = { '/api': backend, '/files': backend };

// The galaxy engine (three.js) is a lazily imported chunk, so on its own the browser only
// asks for it once the app has started, behind the fonts; section 02's map can't draw
// without it. This puts a modulepreload for it in the built page so it downloads at once.
const preloadEngine = {
  name: 'preload-engine',
  apply: 'build',
  transformIndexHtml(html, { bundle }) {
    const engine = Object.values(bundle || {}).find((c) => c.type === 'chunk' && c.name === 'engine');
    if (!engine) return html;
    return [{ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `./${engine.fileName}` }, injectTo: 'head' }];
  },
};

// `base: './'` keeps every asset URL relative, so the built `dist/` folder
// works from a domain root, a sub-path (GitHub Pages) or a plain directory.
export default defineConfig({
  base: './',
  plugins: [react(), preloadEngine],
  server: { proxy },
  // `pnpm preview` may be shared through a Cloudflare quick tunnel (backend/README.md)
  preview: { proxy, allowedHosts: ['.trycloudflare.com'] },
  build: {
    assetsInlineLimit: 0,
  },
  test: {
    include: ['tests/**/*.test.js'],
  },
});
