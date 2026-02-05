import { defineConfig } from 'rollup';

const nodeBuiltins = ['fs', 'path', 'url', 'module'];

export default defineConfig([
  {
    input: 'src/index.js',
    output: {
      dir: 'dist',
      format: 'es',
      entryFileNames: 'index.mjs',
    },
    external: nodeBuiltins,
  },
  {
    input: 'src/index.js',
    output: {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: 'index.cjs',
    },
    external: nodeBuiltins,
  },
]);
