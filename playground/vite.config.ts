import { fileURLToPath } from 'node:url'

import { visualizer } from 'rollup-plugin-visualizer'
import Vue from 'unplugin-vue/vite'
import { defineConfig } from 'vite'
import pkg from '../package.json'

import { buildCSS } from '../scripts/build-css'

const { version } = pkg
const srcAlias = fileURLToPath(new URL('../src', import.meta.url))

export default defineConfig(({ mode }) => {
  const isAnalyze = mode === 'analyze'
  const analyzePlugins = isAnalyze
    ? [
        visualizer({
          filename: 'dist/bundle-stats.html',
          open: true,
          gzipSize: true,
          brotliSize: true,
        }),
      ]
    : []

  return {
    define: {
      __INSPECTOR_VERSION__: JSON.stringify(version),
    },
    resolve: {
      alias: {
        '@': srcAlias,
      },
    },
    plugins: [
      Vue(),
      {
        name: 'build-css',
        handleHotUpdate({ file }) {
          if (file.endsWith('.vue'))
            buildCSS().catch(console.error)
        },
      },
      ...analyzePlugins,
    ],
  }
})
