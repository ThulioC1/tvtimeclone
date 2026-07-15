import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'firebase';
            if (
              id.includes('react-dom') ||
              id.includes('react-router') ||
              id.includes('@tanstack')
            ) {
              return 'react-vendor';
            }
          }
        },
      },
    },
  },
});
