import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['path', 'fs', 'os'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext', // Optimized for modern browsers and Node 20
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  esbuild: {
    target: 'esnext', // Use latest ECMAScript features
    supported: {
      'top-level-await': true, // Enable top-level await
    },
  },
}) 