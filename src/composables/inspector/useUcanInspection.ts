import type { Ref } from 'vue'

import type { AnalysisReport, Issue, SignatureStatus, TokenAnalysis } from '../../utils/ucanAnalysis'
import type { ContainerParseResult } from '../../utils/ucanContainer'

import { ref } from 'vue'

import { decodeBase64 } from '../../utils/base64'
import { analyseBytes, createReport } from '../../utils/ucanAnalysis'
import { ContainerParseError, looksLikeContainerHeader, parseUcanContainerText } from '../../utils/ucanContainer'

/** Current state of the parsing/analysis pipeline. */
export type ParseState = 'idle' | 'parsing' | 'ready' | 'error'

/** Detail tabs shown in the token inspector UI. */
export type DetailTab = 'summary' | 'payload' | 'header' | 'raw' | 'policy' | 'args' | 'proofs'

/** Log levels accepted by the inspector debug panel. */
export type DebugLogLevel = 'info' | 'error'

/** Copy used when presenting signature verification outcomes. */
export interface SignatureStatusCopy {
  label: string
  helper: string
}

export interface UseUcanInspectionOptions {
  /** Text input containing a raw token or container. */
  inputValue: Ref<string>
  /** Copy used for signature status (used by analysis + debug). */
  signatureStatusCopy: Record<SignatureStatus, SignatureStatusCopy>
  /** Debug log hook. */
  pushDebug: (stage: string, level: DebugLogLevel, detail?: string) => void
  /** Called when a report is produced (even for empty input). */
  onReport: (report: AnalysisReport) => void
  /** Called when a user-visible parse error occurs. */
  onReportError: (error: string | null) => void
}

export interface UseUcanInspectionReturn {
  tokens: Ref<TokenAnalysis[]>
  report: Ref<AnalysisReport | null>
  parseState: Ref<ParseState>
  parseError: Ref<string | null>
  containerInfo: Ref<ContainerParseResult | null>
  selectedTokenIndex: Ref<number>
  activeTab: Ref<DetailTab>
  /** Decode + analyze the current `inputValue`. */
  runAnalysis: (context: string) => Promise<void>
  /** Clear input and reset analysis state. */
  clearInput: () => void
}

/**
 * Core parsing + analysis pipeline for the inspector.
 *
 * @param options - Input refs and callbacks.
 * @returns Reactive analysis state + actions.
 *
 * @remarks
 * Handles container parsing, base64/base64url decoding, UCAN analysis, and emits a
 * normalized `AnalysisReport`.
 */
export function useUcanInspection(options: UseUcanInspectionOptions): UseUcanInspectionReturn {
  const tokens = ref<TokenAnalysis[]>([])
  const report = ref<AnalysisReport | null>(null)
  const parseState = ref<ParseState>('idle')
  const parseError = ref<string | null>(null)
  const containerInfo = ref<ContainerParseResult | null>(null)
  const selectedTokenIndex = ref(0)
  const activeTab = ref<DetailTab>('summary')

  let parseTicket = 0

  function decodeInputToTokenBytes(raw: string): { bytes: Uint8Array, issues: Issue[] } {
    const trimmed = raw.trim()
    const issues: Issue[] = []
    const decoders = [
      () => decodeBase64(trimmed, 'standard'),
      () => decodeBase64(trimmed, 'url'),
    ] as const

    for (const decode of decoders) {
      try {
        return { bytes: decode(), issues }
      }
      catch {
        // try next decoder
      }
    }

    issues.push({
      level: 'notice',
      code: 'raw_utf8_fallback',
      message: 'Input is not valid base64/base64url; treating it as UTF-8 bytes.',
    })

    options.pushDebug('parse:raw-fallback', 'info', 'Decoding as UTF-8 bytes')
    return { bytes: new TextEncoder().encode(trimmed), issues }
  }

  async function runAnalysis(context: string): Promise<void> {
    const raw = options.inputValue.value.trim()
    const ticket = ++parseTicket

    if (!raw) {
      tokens.value = []
      report.value = null
      containerInfo.value = null
      parseState.value = 'idle'
      parseError.value = null
      options.onReport(createReport('raw', '', undefined, []))
      options.onReportError(null)
      return
    }

    parseState.value = 'parsing'
    parseError.value = null
    options.pushDebug('parse:start', 'info', `Context: ${context}`)

    try {
      let bytesList: Uint8Array[] = []
      let container: ContainerParseResult | undefined
      let source: 'container' | 'raw' = 'raw'
      const issues: Issue[] = []

      if (looksLikeContainerHeader(raw)) {
        try {
          container = parseUcanContainerText(raw)
          bytesList = container.tokens
          source = 'container'
          containerInfo.value = container
          options.pushDebug('parse:container', 'info', `Header 0x${container.header.raw.toString(16)}`)

          for (const diagnostic of container.diagnostics) {
            issues.push({ level: diagnostic.level, code: diagnostic.code, message: diagnostic.message })
            options.pushDebug(
              'parse:container-diagnostic',
              diagnostic.level === 'warn' ? 'error' : 'info',
              diagnostic.message,
            )
          }
        }
        catch (error) {
          containerInfo.value = null
          container = undefined

          if (error instanceof ContainerParseError) {
            issues.push({ level: 'warn', code: error.code, message: error.message })
            options.pushDebug('parse:container-failed', 'error', `${error.message} (falling back to raw token parsing)`)
          }
          else {
            throw error
          }
        }
      }

      if (!bytesList.length) {
        containerInfo.value = null
        const decoded = decodeInputToTokenBytes(raw)
        bytesList = [decoded.bytes]
        issues.push(...decoded.issues)
      }

      const analyses = await Promise.all(bytesList.map((bytes, index) => analyseBytes(bytes, index)))
      if (ticket !== parseTicket)
        return

      tokens.value = analyses

      for (const tokenAnalysis of analyses) {
        if (tokenAnalysis.type === 'unknown')
          continue

        const signatureMeta = options.signatureStatusCopy[tokenAnalysis.signature.status]
        const descriptor = tokenAnalysis.type === 'invocation' ? 'Invocation' : 'Delegation'
        const details = [`${descriptor} #${tokenAnalysis.index + 1}: ${signatureMeta.label}`]

        if (tokenAnalysis.signature.reason)
          details.push(tokenAnalysis.signature.reason)

        const level: DebugLogLevel = tokenAnalysis.signature.status === 'failed' ? 'error' : 'info'
        options.pushDebug('signature:check', level, details.join(' · '))
      }

      selectedTokenIndex.value = 0
      activeTab.value = 'summary'

      const generatedReport = createReport(source, raw, container, analyses, issues)
      report.value = generatedReport
      parseState.value = 'ready'
      options.onReport(generatedReport)
      options.onReportError(null)

      options.pushDebug('parse:complete', 'info', `Tokens decoded: ${analyses.length}`)
    }
    catch (error) {
      if (ticket !== parseTicket)
        return

      const message = error instanceof ContainerParseError
        ? error.message
        : (error as Error).message ?? 'Failed to parse token'

      parseState.value = 'error'
      parseError.value = message
      options.pushDebug('parse:error', 'error', message)
      options.onReportError(message)
    }
  }

  function clearInput(): void {
    options.inputValue.value = ''
    tokens.value = []
    parseError.value = null
    report.value = null
    containerInfo.value = null
    parseState.value = 'idle'
    options.onReport(createReport('raw', '', undefined, []))
  }

  return {
    tokens,
    report,
    parseState,
    parseError,
    containerInfo,
    selectedTokenIndex,
    activeTab,
    runAnalysis,
    clearInput,
  }
}
