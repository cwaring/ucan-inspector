import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

import pkg from './package.json'

const version = pkg.version

export default defineConfig({
  define: {
    __INSPECTOR_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    server: {
      deps: {
        inline: ['vitest-package-exports'],
      },
    },
  },
})
