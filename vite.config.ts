import path from 'node:path';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Dev-server counterpart of docker/nginx/default.conf.template.
 * The browser only ever talks to /api/<source>/...; the proxy forwards to the
 * real API and injects the secret key server-side, so keys never reach the bundle.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const withQueryKey = (name: string, key = '') => (p: string) =>
    `${p.replace(new RegExp(`^/api/${name}`), '')}${p.includes('?') ? '&' : '?'}api-key=${encodeURIComponent(key)}`;

  return {
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: {
      port: 5173,
      proxy: {
        '/api/newsapi': {
          target: 'https://newsapi.org',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/newsapi/, '/v2'),
          headers: { 'X-Api-Key': env.NEWSAPI_KEY ?? '' },
        },
        '/api/guardian': {
          target: 'https://content.guardianapis.com',
          changeOrigin: true,
          rewrite: withQueryKey('guardian', env.GUARDIAN_KEY),
        },
        '/api/nyt': {
          target: 'https://api.nytimes.com',
          changeOrigin: true,
          rewrite: (p) => `/svc/search/v2${withQueryKey('nyt', env.NYT_KEY)(p)}`,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  };
});
