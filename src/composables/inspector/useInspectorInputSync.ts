import type { Ref } from 'vue'

import { watch } from 'vue'

export interface InspectorUrlSync {
  consumeSuppressed: () => boolean
  writeToUrl: (value: string) => void
}

/** Options for keeping the inspector input synchronized with props + URL + auto-inspect. */
export interface UseInspectorInputSyncOptions {
  /** Inspector input model. */
  inputValue: Ref<string>
  /** URL sync helper (write + suppression handling). */
  urlSync: InspectorUrlSync
  /** Getter for the `ucan` prop value. */
  ucanProp: () => string
  /** Getter for `syncUrl` prop. */
  syncUrl: () => boolean
  /** Getter for `autoInspect` prop. */
  autoInspect: () => boolean
  /** Debounced trigger for parsing/inspection. */
  scheduleParse: (context: string) => void
}

/**
 * Wires up the inspector input flow.
 *
 * @param options - Wiring options.
 * @remarks
 * - Prop change can populate the input.
 * - Input change can update URL and schedule analysis.
 */
export function useInspectorInputSync(options: UseInspectorInputSyncOptions): void {
  watch(
    () => options.ucanProp(),
    (value) => {
      if (!value)
        return
      options.inputValue.value = value
      if (options.autoInspect())
        options.scheduleParse('prop-change')
    },
  )

  watch(options.inputValue, (value) => {
    if (options.urlSync.consumeSuppressed()) {
      return
    }

    if (options.syncUrl())
      options.urlSync.writeToUrl(value)

    if (options.autoInspect())
      options.scheduleParse('input')
  })
}
