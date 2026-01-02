import { fileURLToPath } from 'node:url'

import Vue from 'unplugin-vue/vite'
import { defineConfig } from 'vite'
import pkg from '../package.json'

import { buildCSS } from '../scripts/build-css'

const version = pkg.version

export default defineConfig({
  define: {
    __INSPECTOR_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../src', import.meta.url)),
    },
  },
  plugins: [
    Vue(),
    {
      name: 'build-css',
      handleHotUpdate({ file }) {
        if (file.endsWith('.vue')) {
          buildCSS().catch(console.error)
        }
      },
    },
  ],
})
