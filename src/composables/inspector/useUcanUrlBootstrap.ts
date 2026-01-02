import type { Ref } from 'vue'

import { nextTick, onMounted } from 'vue'

export interface UcanUrlSync {
  isBrowser: boolean
  suppressOnce: () => void
  readFromUrl: () => string | null
}

/** Options for bootstrapping the inspector input from the URL. */
export interface UseUcanUrlBootstrapOptions {
  /** URL helper for reading/suppressing the `ucan` query param. */
  urlSync: UcanUrlSync
  /** Inspector input model. */
  inputValue: Ref<string>
  /** Initial prop value to fall back to when URL is empty. */
  defaultUcan: string
  /** Whether to auto-run analysis after bootstrapping. */
  autoInspect: boolean
  /** Function that triggers analysis for the current input. */
  runAnalysis: (context: string) => Promise<void>
}

/**
 * Bootstraps `inputValue` from the URL on mount.
 *
 * @param options - Bootstrap inputs.
 * @remarks
 * If a URL param is present it wins (and URL sync is suppressed once). Otherwise the
 * default prop is used.
 */
export function useUcanUrlBootstrap(options: UseUcanUrlBootstrapOptions): void {
  onMounted(async () => {
    if (!options.urlSync.isBrowser)
      return

    const encoded = options.urlSync.readFromUrl()
    if (encoded) {
      options.urlSync.suppressOnce()
      try {
        options.inputValue.value = decodeURIComponent(encoded)
      }
      catch {
        options.inputValue.value = encoded
      }

      await nextTick()

      if (options.autoInspect) {
        await options.runAnalysis('url-boot')
      }

      return
    }

    if (options.defaultUcan && options.autoInspect) {
      await options.runAnalysis('default-prop')
    }
  })
}
