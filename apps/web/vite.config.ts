import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('../../', import.meta.url)), '');
  return {
    plugins: [react()], server: {
      host: '127.0.0.1', port: 5173, strictPort: true,
      proxy: { '/api': {
        target: 'http://127.0.0.1:4000', changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (request, incoming) => {
            const origin = incoming.headers.origin;
            if (!incoming.headers.authorization && (!origin || origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173')) {
              request.setHeader('Authorization', `Bearer ${env.DEMO_ACCESS_TOKEN ?? ''}`);
            }
          });
        },
      } },
    },
  };
});
