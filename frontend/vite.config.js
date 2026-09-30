import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const apiPrefix = (env.VITE_MYRAA_API_PREFIX || '/myraa-api').replace(/\/+$/, '');
  const wsPath = env.VITE_MYRAA_WS_PATH || (mode === 'production' ? '/live' : '/myraa-live');
  const wsUrl = env.VITE_MYRAA_WS_URL || '';
  const assetPrefix = env.VITE_MYRAA_ASSET_PREFIX || '/myraa-assets';

  return {
    plugins: [react()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@myraa': path.resolve(__dirname, '../myraa/Myraa-Voice-Assistant-main/src'),
        'lucide-react': path.resolve(__dirname, 'node_modules/lucide-react/dist/esm/lucide-react.js'),
        'motion/react': path.resolve(__dirname, 'node_modules/motion/dist/es/react.mjs')
      }
    },
    define: {
      'import.meta.env.VITE_MYRAA_API_PREFIX': JSON.stringify(apiPrefix),
      'import.meta.env.VITE_MYRAA_WS_PATH': JSON.stringify(wsPath),
      'import.meta.env.VITE_MYRAA_WS_URL': JSON.stringify(wsUrl),
      'import.meta.env.VITE_MYRAA_ASSET_PREFIX': JSON.stringify(assetPrefix)
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      fs: {
        allow: [path.resolve(__dirname, '..')]
      },
      proxy: {
        '/myraa-api': {
          target: 'http://127.0.0.1:3001',
          rewrite: (requestPath) => requestPath.replace(/^\/myraa-api/, '')
        },
        '/myraa-live': {
          target: 'ws://127.0.0.1:3001',
          ws: true,
          rewrite: (requestPath) => requestPath.replace(/^\/myraa-live/, '')
        }
      }
    }
  };
});
