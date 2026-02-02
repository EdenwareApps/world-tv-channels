import { defineConfig } from 'rollup';

export default defineConfig([
  {
    input: 'src/index.js',
    output: {
      file: 'index.mjs',
      format: 'es',
    },
  },
  {
    input: 'src/index.cjs.js',
    output: {
      file: 'index.cjs',
      format: 'cjs',
    },
  },
]);
