import { defineConfig } from "vite";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
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
    "process.env.VERSION": JSON.stringify(process.env.npm_package_version),
  },
});
