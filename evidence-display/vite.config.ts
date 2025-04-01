import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react(), nodePolyfills()],
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "esnext", // Optimized for modern browsers and Node 20
    rollupOptions: {
      // Don't mark the SDK as external since we want it bundled
      external: [],
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
    preserveSymlinks: true,
  },
  esbuild: {
    target: "esnext", // Use latest ECMAScript features
    supported: {
      "top-level-await": true, // Enable top-level await
    },
  },
  define: {
    "process.env.VERSION": JSON.stringify(process.env.npm_package_version),
  },
});
