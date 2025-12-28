import type { ComputedRef, Ref } from 'vue'

import type { JsonFormat } from '../../utils/format'
import type { Issue, SignatureStatus, TokenAnalysis, TokenTimeline } from '../../utils/ucanAnalysis'
import type { SignatureStatusMeta, StatusTone } from './signatureStatusCopy'
import type { DetailTab } from './useUcanInspection'

import { computed, watch } from 'vue'

import { stringifyBlock, stringifyInline } from '../../utils/format'
import { buildTokenExportModel, stringifyExportValue } from '../../utils/ucanAnalysis'

export interface StatusChip {
  label: string
  tone: StatusTone
  tooltip?: string
}

/** Normalized signature status info for presentation components. */
export interface SignatureSummary {
  status: SignatureStatus
  label: string
  tone: StatusTone
  helper: string
  reason: string | null
}

/** Human-readable timeline summary derived from token exp/nbf. */
export interface TimelineSummary {
  statusLabel: string
  expText: string | null
  nbfText: string | null
}

/** Small "card" displayed in the token overview summary section. */
export interface SummaryCard {
  label: string
  value: string
  helper: string
}

/**
 * View-model for the currently-selected token.
 *
 * @remarks
 * Keeps the container component thin by centralizing derived state needed by
 * presentational components (tabs, JSON strings, chips, timeline info, etc.).
 */
export interface UseSelectedTokenViewModelReturn {
  detailTabs: ComputedRef<DetailTab[]>

  selectedNonceDagJson: ComputedRef<string>
  selectedCauseDagJson: ComputedRef<string>
  selectedPayloadJson: ComputedRef<string>
  selectedHeaderJson: ComputedRef<string>

  selectedTokenCid: ComputedRef<string>
  selectedTokenTokenBase64: ComputedRef<string>
  selectedTokenType: ComputedRef<'delegation' | 'invocation'>
  delegationPolicyPredicateCount: ComputedRef<number>
  invocationHasCause: ComputedRef<boolean>

  summaryCards: ComputedRef<SummaryCard[]>
  timeline: ComputedRef<TokenTimeline | null>
  timelineProgress: ComputedRef<number>
  timelineSummary: ComputedRef<TimelineSummary | null>

  statusChips: ComputedRef<StatusChip[]>
  policyJson: ComputedRef<string>
  metaJson: ComputedRef<string | null>
  argsJson: ComputedRef<string>
  proofsList: ComputedRef<string[]>

  signatureSummary: ComputedRef<SignatureSummary | null>
  selectedTokenIssues: ComputedRef<Issue[]>
}

/**
 * Build the derived UI state for the selected token.
 *
 * @param options - Inputs required to derive the selected-token UI state.
 * @param options.selectedToken - Currently selected token (or null if nothing selected).
 * @param options.activeTab - Active detail tab (kept in sync with `detailTabs`).
 * @param options.signatureStatusCopy - Copy/tone mapping used for signature status chips/labels.
 * @param options.jsonFormat - Preferred JSON formatting for JSON-like views.
 * @returns Derived view-model state for the inspector UI.
 *
 * @remarks
 * This also guards `activeTab` to ensure it stays valid when switching between token kinds.
 */
export function useSelectedTokenViewModel(options: {
  /** Currently selected token (or null if nothing selected). */
  selectedToken: ComputedRef<TokenAnalysis | null>
  /** Active detail tab (kept in sync with `detailTabs`). */
  activeTab: Ref<DetailTab>
  /** Copy/tone mapping used for signature status chips/labels. */
  signatureStatusCopy: Record<SignatureStatus, SignatureStatusMeta>
  /** Preferred JSON formatting for JSON-like views. */
  jsonFormat?: Readonly<Ref<JsonFormat>>
}): UseSelectedTokenViewModelReturn {
  const detailTabs = computed<DetailTab[]>(() => {
    const token = options.selectedToken.value
    if (!token)
      return []
    if (token.type === 'delegation')
      return ['summary', 'payload', 'policy', 'header', 'raw']
    if (token.type === 'invocation')
      return ['summary', 'payload', 'args', 'proofs', 'header', 'raw']
    return []
  })

  watch(detailTabs, (tabs) => {
    if (!tabs.includes(options.activeTab.value))
      options.activeTab.value = tabs[0] ?? 'summary'
  }, { immediate: true })

  const selectedTokenIssues = computed<Issue[]>(() => {
    return options.selectedToken.value?.issues ?? []
  })

  const jsonFormat = computed<JsonFormat>(() => options.jsonFormat?.value ?? 'json')

  const selectedNonceDagJson = computed(() => {
    const token = options.selectedToken.value
    if (!token || token.type === 'unknown')
      return ''

    const exportToken = buildTokenExportModel(token, { includeRawBytes: false })
    const nonce = (exportToken as any)?.json?.envelope?.payload?.nonce
    return stringifyInline(nonce, jsonFormat.value)
  })

  const selectedCauseDagJson = computed(() => {
    const token = options.selectedToken.value
    if (!token || token.type !== 'invocation')
      return ''

    const exportToken = buildTokenExportModel(token, { includeRawBytes: false })
    const cause = (exportToken as any)?.json?.envelope?.payload?.cause
    return stringifyInline(cause, jsonFormat.value)
  })

  const selectedPayloadJson = computed(() => {
    const token = options.selectedToken.value
    if (!token || token.type === 'unknown')
      return ''

    const exportToken = buildTokenExportModel(token, { includeRawBytes: false })
    const payload = (exportToken as any)?.json?.envelope?.payload
    if (!payload)
      return ''

    return stringifyExportValue(payload, jsonFormat.value)
  })

  const selectedHeaderJson = computed(() => {
    const token = options.selectedToken.value
    if (!token || token.type === 'unknown')
      return ''
    return stringifyBlock(token.header, jsonFormat.value)
  })

  const selectedTokenCid = computed(() => {
    const token = options.selectedToken.value
    if (!token || token.type === 'unknown')
      return ''
    return token.cid
  })

  const selectedTokenTokenBase64 = computed(() => {
    return options.selectedToken.value?.tokenBase64 ?? ''
  })

  const selectedTokenType = computed<'delegation' | 'invocation'>(() => {
    const token = options.selectedToken.value
    if (!token || token.type === 'unknown')
      return 'delegation'
    return token.type
  })

  const delegationPolicyPredicateCount = computed(() => {
    const token = options.selectedToken.value
    if (!token || token.type !== 'delegation')
      return 0
    return Array.isArray(token.payload.pol) ? token.payload.pol.length : 0
  })

  const invocationHasCause = computed(() => {
    const token = options.selectedToken.value
    if (!token || token.type !== 'invocation')
      return false
    return Boolean(token.payload.cause)
  })

  const summaryCards = computed<SummaryCard[]>(() => {
    const token = options.selectedToken.value
    if (!token || token.type === 'unknown')
      return []

    if (token.type === 'delegation') {
      const payload = token.payload
      return [
        { label: 'Issuer', value: payload.iss, helper: 'DID that issued the delegation' },
        { label: 'Audience', value: payload.aud, helper: 'Delegate receiving authority' },
        { label: 'Command', value: payload.cmd, helper: 'Capability command path' },
        { label: 'Subject', value: payload.sub ?? '—', helper: 'Principal the delegation applies to' },
      ]
    }

    const payload = token.payload
    return [
      { label: 'Issuer', value: payload.iss, helper: 'Invoker issuing the request' },
      { label: 'Subject', value: payload.sub, helper: 'Principal whose authority is invoked' },
      { label: 'Audience', value: payload.aud ?? '—', helper: 'Target service or recipient' },
      { label: 'Command', value: payload.cmd, helper: 'Capability command path' },
    ]
  })

  const timeline = computed(() => {
    const token = options.selectedToken.value
    if (!token || token.type === 'unknown')
      return null
    return token.timeline
  })

  const timelineProgress = computed(() => {
    const token = options.selectedToken.value
    if (!token || token.type === 'unknown')
      return 0

    const exp = token.payload.exp
    const nbf = token.payload.nbf ?? null

    if (exp == null)
      return token.timeline.state === 'expired' ? 100 : 0

    const now = Math.floor(Date.now() / 1000)
    const start = nbf ?? now
    if (exp <= start)
      return token.timeline.state === 'expired' ? 100 : 0

    const progress = ((now - start) / (exp - start)) * 100
    return Math.max(0, Math.min(100, progress))
  })

  const timelineSummary = computed<TimelineSummary | null>(() => {
    const token = options.selectedToken.value
    if (!token || token.type === 'unknown')
      return null

    const now = Math.floor(Date.now() / 1000)
    const exp = token.payload.exp ?? null
    const nbf = token.payload.nbf ?? null
    const { state, expRelative, nbfRelative } = token.timeline

    const statusLabelMap: Record<typeof state, string> = {
      expired: 'Expired',
      valid: 'Active',
      pending: 'Pending',
      none: 'No expiration',
    }

    const formatFuture = (relative: string): string => {
      if (relative === '—')
        return 'for an unknown duration'
      if (relative.startsWith('in ')) {
        const remainder = relative.slice(3)
        if (remainder === '<1 minute')
          return 'for less than a minute'
        return `for another ${remainder}`
      }
      return relative
    }

    let expText: string | null = null
    if (exp != null && expRelative !== '—') {
      if (exp <= now)
        expText = `Expired ${expRelative}`
      else if (state === 'pending')
        expText = `Active ${formatFuture(expRelative)} once valid`
      else
        expText = `Active ${formatFuture(expRelative)}`
    }

    let nbfText: string | null = null
    if (nbf == null || nbfRelative === '—') {
      nbfText = 'Valid immediately'
    }
    else if (nbf > now) {
      nbfText = `Becomes valid ${nbfRelative}`
    }
    else {
      nbfText = `Became valid ${nbfRelative}`
    }

    if (state === 'none') {
      expText = null
      nbfText = null
    }

    return {
      statusLabel: statusLabelMap[state],
      expText,
      nbfText,
    }
  })

  const statusChips = computed((): StatusChip[] => {
    const token = options.selectedToken.value
    if (!token)
      return []

    if (token.type === 'unknown')
      return [{ label: 'Unknown token format', tone: 'warn' }]

    const chips: StatusChip[] = []

    const typeTag = typeof token.header?.spec === 'string' ? token.header.spec : ''
    if (typeTag) {
      chips.push({
        label: `Type: ${typeTag}`,
        tone: 'info',
        tooltip: 'Token type tag from the decoded UCAN envelope header.',
      })
    }

    const specVersion = typeof token.header?.version === 'string' ? token.header.version : ''
    if (specVersion) {
      chips.push({
        label: `Spec: v${specVersion}`,
        tone: 'info',
        tooltip: 'UCAN spec version from the decoded envelope header.',
      })
    }

    switch (token.timeline.state) {
      case 'expired':
        chips.push({ label: `Expired ${token.timeline.expRelative}`, tone: 'error' })
        break
      case 'pending': {
        const nbfFuture = token.timeline.nbfRelative.startsWith('in ')
        chips.push({
          label: nbfFuture
            ? `Will become valid ${token.timeline.nbfRelative}`
            : `Became valid ${token.timeline.nbfRelative}`,
          tone: 'warn',
        })
        break
      }
      case 'valid': {
        const expFuture = token.timeline.expRelative.startsWith('in ')
        chips.push({
          label: expFuture
            ? `Active (expires ${token.timeline.expRelative})`
            : `Became active ${token.timeline.expRelative}`,
          tone: 'success',
        })
        break
      }
      default:
        chips.push({ label: 'No expiration', tone: 'info' })
        break
    }

    if (token.type === 'invocation') {
      const proofsCount = token.payload.proofs.length
      chips.push({
        label: proofsCount > 0 ? `${proofsCount} proof${proofsCount === 1 ? '' : 's'}` : 'No proofs',
        tone: proofsCount > 0 ? 'info' : 'warn',
        tooltip: proofsCount > 0
          ? 'Delegations referenced by this invocation.'
          : 'This invocation does not reference any proofs.',
      })
    }

    const signatureMeta = options.signatureStatusCopy[token.signature.status]
    chips.push({
      label: signatureMeta.label,
      tone: signatureMeta.tone,
      tooltip: token.signature.reason ?? signatureMeta.helper,
    })

    return chips
  })

  const policyJson = computed(() => {
    const token = options.selectedToken.value
    if (!token || token.type !== 'delegation')
      return '[]'
    return stringifyBlock(token.payload.pol ?? [], jsonFormat.value)
  })

  const metaJson = computed(() => {
    const token = options.selectedToken.value
    if (!token || token.type === 'unknown' || !token.payload.meta)
      return null
    return stringifyBlock(token.payload.meta, jsonFormat.value)
  })

  const argsJson = computed(() => {
    const token = options.selectedToken.value
    if (!token || token.type !== 'invocation')
      return '{}'
    return stringifyBlock(token.payload.args ?? {}, jsonFormat.value)
  })

  const proofsList = computed(() => {
    const token = options.selectedToken.value
    if (!token || token.type !== 'invocation')
      return [] as string[]
    return token.payload.proofs
  })

  const signatureSummary = computed<SignatureSummary | null>(() => {
    const token = options.selectedToken.value
    if (!token || token.type === 'unknown')
      return null

    const base = options.signatureStatusCopy[token.signature.status]
    return {
      status: token.signature.status,
      label: base.label,
      tone: base.tone,
      helper: base.helper,
      reason: token.signature.reason ?? null,
    }
  })

  return {
    detailTabs,

    selectedNonceDagJson,
    selectedCauseDagJson,
    selectedPayloadJson,
    selectedHeaderJson,

    selectedTokenCid,
    selectedTokenTokenBase64,
    selectedTokenType,
    delegationPolicyPredicateCount,
    invocationHasCause,

    summaryCards,
    timeline,
    timelineProgress,
    timelineSummary,

    statusChips,
    policyJson,
    metaJson,
    argsJson,
    proofsList,

    signatureSummary,
    selectedTokenIssues,
  }
}
