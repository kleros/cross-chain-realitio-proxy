import { resolve } from "path";
import inject from "@rollup/plugin-inject";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  esbuild: {
    charset: "ascii",
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["iife"],
      name: "index",
      fileName: "index",
    },
    rollupOptions: {
      external: [],
      output: {
        manualChunks: undefined,
        inlineDynamicImports: true,
      },
      plugins: [
        inject({
          Buffer: ["buffer", "Buffer"],
        }),
      ],
    },
    target: "esnext",
    sourcemap: false,
  },
  define: {
    "process.env.VERSION": JSON.stringify(process.env.npm_package_version),
  },
});
