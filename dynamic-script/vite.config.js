import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { loadEnv } from 'vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    build: {
      lib: {
        entry: path.resolve(__dirname, 'src/index.js'),
        name: 'realitio-dynamic-script',
        fileName: (format) => `realitio-dynamic-script-v${env.npm_package_version}.js`,
        formats: ['cjs'],
      },
      rollupOptions: {
        external: [
          '@reality.eth/reality-eth-lib',
          'web3'
        ],
        output: {
          format: 'cjs',
        }
      },
      sourcemap: true,
      target: 'node18',
    },
    plugins: [
      nodePolyfills({
        include: ['path', 'fs', 'net', 'tls'],
      }),
    ],
    define: {
      'process.env.VERSION': JSON.stringify(env.npm_package_version),
    }
  };
});
