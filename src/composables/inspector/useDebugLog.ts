import type { ComputedRef, Ref } from 'vue'
import { computed, ref } from 'vue'

export interface DebugEntry {
  id: number
  timestamp: string
  stage: string
  detail?: string
  level: 'info' | 'error'
}

/** Public API returned by `useDebugLog`. */
export interface UseDebugLogReturn {
  debugEntries: Ref<DebugEntry[]>
  reversedDebugEntries: ComputedRef<DebugEntry[]>
  /** Push a new debug entry, keeping the buffer bounded. */
  pushDebug: (stage: string, level: DebugEntry['level'], detail?: string) => void
  /** Clear all debug entries. */
  clearDebug: () => void
}

/**
 * Small bounded debug log for the inspector.
 *
 * @param maxEntries - Maximum number of entries to keep.
 * @returns Debug log state + helpers.
 *
 * @remarks
 * Used to surface parse/verify/export diagnostics without spamming the console.
 */
export function useDebugLog(maxEntries = 50): UseDebugLogReturn {
  const debugEntries = ref<DebugEntry[]>([])

  function pushDebug(stage: string, level: DebugEntry['level'], detail?: string): void {
    const entry: DebugEntry = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      stage,
      level,
      detail,
    }
    debugEntries.value = [...debugEntries.value.slice(-(maxEntries - 1)), entry]
  }

  function clearDebug(): void {
    debugEntries.value = []
  }

  const reversedDebugEntries = computed(() => [...debugEntries.value].reverse())

  return {
    debugEntries,
    reversedDebugEntries,
    pushDebug,
    clearDebug,
  }
}
