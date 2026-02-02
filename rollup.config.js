import { defineConfig } from 'rollup';

const nodeBuiltins = ['fs', 'path', 'url', 'module'];

export default defineConfig([
  {
    input: 'src/index.js',
    output: {
      file: 'index.mjs',
      format: 'es',
    },
    external: nodeBuiltins,
  },
  {
    input: 'src/index.cjs.js',
    output: {
      file: 'index.cjs',
      format: 'cjs',
    },
    external: nodeBuiltins,
  },
]);
