import { defineConfig } from "vite";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "realitio-dynamic-script",
      fileName: "realitio-dynamic-script",
    },
    rollupOptions: {
      output: {
        format: "es",
        inlineDynamicImports: true,
      },
    },
    target: "esnext",
    sourcemap: true,
  },
  define: {
    "process.env.VERSION": JSON.stringify(process.env.npm_package_version),
  },
});
