import { resolve } from "node:path";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import inject from "@rollup/plugin-inject";
import type { Plugin } from "esbuild";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  esbuild: {
    charset: "ascii",
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          buffer: true,
          process: true,
        }) as unknown as Plugin, // Cast through unknown to handle version mismatch
      ],
    },
  },
  plugins: [
    inject({
      process: "process/browser",
      Buffer: ["buffer", "Buffer"],
    }),
  ],
  resolve: {
    alias: {
      buffer: resolve(__dirname, "../node_modules/buffer"),
      process: "process/browser",
    },
  },
  server: {
    open: "/test.html", // Automatically open test.html when running dev server
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["iife"],
      name: "index",
      fileName: "index",
    },
    rollupOptions: {
      // Don't mark the SDK as external since we want it bundled
      external: [],
      output: {
        manualChunks: undefined,
        inlineDynamicImports: true,
      },
    },
    target: "esnext",
    sourcemap: false,
  },
  define: {
    global: "globalThis",
    "process.env.VERSION": JSON.stringify(process.env.npm_package_version),
  },
});
