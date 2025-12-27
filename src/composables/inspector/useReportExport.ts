import type { ComputedRef, Ref } from 'vue'

import type { AnalysisReport } from '../../utils/ucanAnalysis'
import type { UseDebugLogReturn } from './useDebugLog'

import { computed } from 'vue'

import { stringifyReport } from '../../utils/ucanAnalysis'

export interface UseReportExportReturn {
  /** Whether export actions should be enabled. */
  canExport: ComputedRef<boolean>
  /** Copy the current report JSON to the clipboard (with fallback). */
  copyReport: () => Promise<void>
  /** Download the current report JSON as a file (browser-only). */
  downloadReport: () => void
}

/**
 * Report export helpers (copy/download) for the inspector.
 *
 * @param options - Required inputs (report state, environment flags, and callbacks).
 * @param options.report - Current report (null when nothing parsed).
 * @param options.hasTokens - Whether there are any decoded tokens available.
 * @param options.isBrowser - True when running in a browser environment.
 * @param options.pushDebug - Debug log hook used by the inspector.
 * @param options.onExport - Called after a successful export action.
 * @returns Export helpers for use by UI components.
 *
 * @remarks
 * Centralizes export UX behavior: serialization, browser guards, debug logging, and
 * emitting the `reportExport` event.
 */
export function useReportExport(options: {
  /** Current report (null when nothing parsed). */
  report: Readonly<Ref<AnalysisReport | null>> | ComputedRef<AnalysisReport | null>
  /** Whether there are any decoded tokens available. */
  hasTokens: Readonly<Ref<boolean>> | ComputedRef<boolean>
  /** True when running in a browser environment. */
  isBrowser: boolean
  /** Debug log hook used by the inspector. */
  pushDebug: UseDebugLogReturn['pushDebug']
  /** Called after a successful export action. */
  onExport: (payload: { action: 'copy' | 'download', report: AnalysisReport }) => void
}): UseReportExportReturn {
  const canExport = computed(() => Boolean(options.report.value) && options.hasTokens.value)

  async function copyReport(): Promise<void> {
    const currentReport = options.report.value
    if (!currentReport)
      return

    const serialized = stringifyReport(currentReport)

    try {
      if (typeof navigator !== 'undefined' && navigator?.clipboard) {
        await navigator.clipboard.writeText(serialized)
      }
      else if (typeof document !== 'undefined') {
        const element = document.createElement('textarea')
        element.value = serialized
        document.body.appendChild(element)
        element.select()
        document.execCommand('copy')
        document.body.removeChild(element)
      }
      else {
        throw new TypeError('Clipboard API not available')
      }

      options.pushDebug('export:copy', 'info', 'Report copied to clipboard')
      options.onExport({ action: 'copy', report: currentReport })
    }
    catch (error) {
      options.pushDebug('export:copy', 'error', (error as Error).message)
    }
  }

  function downloadReport(): void {
    const currentReport = options.report.value
    if (!currentReport || !options.isBrowser)
      return

    const serialized = stringifyReport(currentReport)
    const blob = new Blob([serialized], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `ucan-inspection-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)

    options.pushDebug('export:download', 'info', 'Report downloaded')
    options.onExport({ action: 'download', report: currentReport })
  }

  return {
    canExport,
    copyReport,
    downloadReport,
  }
}
