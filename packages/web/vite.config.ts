import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('react-router-dom')) return 'router';
          if (id.includes('recharts') || id.includes('d3-') || id.includes('internmap')) return 'charts';

          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5200,
    strictPort: true,
    proxy: {
      '/v1': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
    },
  },
  resolve: {
    alias: {
      '@japanese-learn/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});
