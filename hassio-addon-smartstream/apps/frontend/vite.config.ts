import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: parseInt(process.env.VITE_PORT || '3001'),
      host: true,
      proxy: isDev ? {
        '/api': {
          target: process.env.VITE_API_URL || 'http://localhost:3000',
          changeOrigin: true,
        },
        '/health': {
          target: process.env.VITE_API_URL || 'http://localhost:3000',
          changeOrigin: true,
        },
      } : undefined,
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      sourcemap: true,
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
    },
    // Home Assistant compatibility - use relative paths
    base: './',
    // Home Assistant compatibility
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env.ADDON_VERSION': JSON.stringify(process.env.ADDON_VERSION || '1.0.6'),
      'process.env.HOME_ASSISTANT': JSON.stringify(process.env.HOME_ASSISTANT || 'false'),
    },
  };
});
