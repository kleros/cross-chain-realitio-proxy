import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills(),
  ],
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext', // Optimized for modern browsers and Node 20
    rollupOptions: {
      external: ['@kleros/cross-chain-realitio-dynamic-script/lib'],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
    preserveSymlinks: true,
  },
  esbuild: {
    target: 'esnext', // Use latest ECMAScript features
    supported: {
      'top-level-await': true, // Enable top-level await
    },
  },
}) 