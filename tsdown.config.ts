import { fileURLToPath } from 'node:url'

import { defineConfig } from 'tsdown'
import Vue from 'unplugin-vue/rolldown'
import pkg from './package.json' with { type: 'json' }

const version = pkg.version

export default defineConfig({
  entry: [
    'src/index.ts',
  ],
  fixedExtension: true,
  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
  },
  define: {
    __INSPECTOR_VERSION__: JSON.stringify(version),
  },
  plugins: [
    Vue(),
  ],
})
