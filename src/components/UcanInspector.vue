<script setup lang="ts">
import type { MockTokenKind } from '../utils/mockData'
import type { AnalysisReport, SignatureStatus, TokenAnalysis } from '../utils/ucanAnalysis'
import type { ContainerParseResult } from '../utils/ucanContainer'

import { CID } from 'multiformats/cid'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import { decodeBase64 } from '../utils/base64'
import { prettyJson, toDagJsonString, toPrettyDagJsonString } from '../utils/format'
import { getMockTokens } from '../utils/mockData'
import { analyseBytes, createReport, stringifyReport } from '../utils/ucanAnalysis'
import { ContainerParseError, isLikelyContainer, parseContainer } from '../utils/ucanContainer'

interface InspectorProps {
  defaultToken?: string
  persistUrl?: boolean
  autoParse?: boolean
}

interface DebugEntry {
  id: number
  timestamp: string
  stage: string
  detail?: string
  level: 'info' | 'error'
}

type StatusTone = 'info' | 'success' | 'warn' | 'error'

interface StatusChip {
  label: string
  tone: StatusTone
  tooltip?: string
}

const props = withDefaults(defineProps<InspectorProps>(), {
  defaultToken: '',
  persistUrl: true,
  autoParse: true,
})

const emit = defineEmits<{
  (event: 'analysis', payload: AnalysisReport): void
  (event: 'error', payload: string | null): void
  (event: 'export', payload: { kind: 'copy' | 'download', report: AnalysisReport }): void
}>()

const signatureStatusCopy: Record<SignatureStatus, { label: string, tone: StatusTone, helper: string }> = {
  verified: {
    label: 'Signature verified',
    tone: 'success',
    helper: 'Signature matches the issuer’s verification method from the DID document.',
  },
  failed: {
    label: 'Signature invalid',
    tone: 'error',
    helper: 'Signature did not match the issuer’s verification method.',
  },
  unsupported: {
    label: 'Verification unavailable',
    tone: 'warn',
    helper: 'The DID method or signature type is not supported for offline verification.',
  },
  skipped: {
    label: 'Signature not checked',
    tone: 'info',
    helper: 'Signature verification was skipped for this token.',
  },
}

const inputValue = ref(props.defaultToken)
const tokens = ref<TokenAnalysis[]>([])
const report = ref<AnalysisReport | null>(null)
const parseState = ref<'idle' | 'parsing' | 'ready' | 'error'>('idle')
const parseError = ref<string | null>(null)
const containerInfo = ref<ContainerParseResult | null>(null)
const selectedTokenIndex = ref(0)
const activeTab = ref<'summary' | 'payload' | 'header' | 'raw' | 'policy' | 'args' | 'proofs'>('summary')
const debugMode = ref(false)
const debugEntries = ref<DebugEntry[]>([])
const mockLoadingKind = ref<MockTokenKind | null>(null)

const isBrowser = typeof window !== 'undefined'
let suppressUrlSync = false
let debounceHandle: ReturnType<typeof setTimeout> | undefined
let parseTicket = 0

const selectedToken = computed(() => tokens.value[selectedTokenIndex.value] ?? null)
const tokenCount = computed(() => tokens.value.length)
const hasTokens = computed(() => tokenCount.value > 0)

interface DelegationLink {
  id: string
  index: number
  iss: string
  aud: string
  cid: string
}

type DetailTab = 'summary' | 'payload' | 'policy' | 'header' | 'raw' | 'args' | 'proofs'

const delegationLinks = computed<DelegationLink[]>(() => {
  const links: DelegationLink[] = []
  for (const token of tokens.value) {
    if (token.type !== 'delegation')
      continue
    links.push({
      id: token.id,
      index: token.index,
      iss: token.payload.iss,
      aud: token.payload.aud,
      cid: token.cid,
    })
  }
  return links
})

const detailTabs = computed<DetailTab[]>(() => {
  const token = selectedToken.value
  if (!token)
    return []
  if (token.type === 'delegation')
    return ['summary', 'payload', 'policy', 'header', 'raw']
  if (token.type === 'invocation')
    return ['summary', 'payload', 'args', 'proofs', 'header', 'raw']
  return []
})

function safeCidParse(value: string): CID | string {
  try {
    return CID.parse(value)
  }
  catch {
    return value
  }
}

const selectedNonceDagJson = computed(() => {
  const token = selectedToken.value
  if (!token || token.type === 'unknown')
    return ''
  return toDagJsonString(decodeBase64(token.payload.nonce))
})

const selectedCauseDagJson = computed(() => {
  const token = selectedToken.value
  if (!token || token.type !== 'invocation')
    return ''
  if (!token.payload.cause)
    return ''
  return toDagJsonString(safeCidParse(token.payload.cause))
})

const selectedPayloadJson = computed(() => {
  const token = selectedToken.value
  if (!token || token.type === 'unknown')
    return ''

  if (token.type === 'delegation') {
    const payload = token.payload
    return toPrettyDagJsonString({
      iss: payload.iss,
      aud: payload.aud,
      sub: payload.sub ?? null,
      cmd: payload.cmd,
      pol: payload.pol,
      exp: payload.exp,
      nbf: payload.nbf,
      nonce: decodeBase64(payload.nonce),
      meta: payload.meta,
    })
  }

  const payload = token.payload
  return toPrettyDagJsonString({
    iss: payload.iss,
    aud: payload.aud,
    sub: payload.sub,
    cmd: payload.cmd,
    args: payload.args ?? {},
    prf: payload.proofs.map(proof => safeCidParse(proof)),
    cause: payload.cause ? safeCidParse(payload.cause) : undefined,
    exp: payload.exp,
    nbf: payload.nbf,
    iat: payload.iat,
    meta: payload.meta,
    nonce: decodeBase64(payload.nonce),
  })
})

const selectedHeaderJson = computed(() => {
  const token = selectedToken.value as any
  if (!token || token.type === 'unknown')
    return ''
  return prettyJson(token.header)
})

const summaryCards = computed(() => {
  const token = selectedToken.value
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
  const token = selectedToken.value
  if (!token || token.type === 'unknown')
    return null
  return token.timeline
})

const timelineProgress = computed(() => {
  const token = selectedToken.value
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

const timelineSummary = computed(() => {
  const token = selectedToken.value
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
  const token = selectedToken.value
  if (!token)
    return [] as StatusChip[]

  if (token.type === 'unknown')
    return [{ label: 'Unknown token format', tone: 'warn' }] as StatusChip[]

  const chips: StatusChip[] = []
  switch (token.timeline.state) {
    case 'expired':
      chips.push({ label: `Expired ${token.timeline.expRelative}`, tone: 'error' })
      break
    case 'pending': {
      // If nbf is in the future, use 'Will become valid in X'
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
      // If exp is in the future, use 'Expires in X', else 'Became active X ago'
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
      tooltip: proofsCount > 0 ? 'Delegations referenced by this invocation.' : 'This invocation does not reference any proofs.',
    })
  }

  const signatureMeta = signatureStatusCopy[token.signature.status]
  chips.push({
    label: signatureMeta.label,
    tone: signatureMeta.tone,
    tooltip: token.signature.reason ?? signatureMeta.helper,
  })
  return chips
})

const policyJson = computed(() => {
  const token = selectedToken.value
  if (!token || token.type !== 'delegation')
    return '[]'
  return prettyJson(token.payload.pol ?? [])
})

const metaJson = computed(() => {
  const token = selectedToken.value
  if (!token || token.type === 'unknown' || !token.payload.meta)
    return null
  return prettyJson(token.payload.meta)
})

const argsJson = computed(() => {
  const token = selectedToken.value
  if (!token || token.type !== 'invocation')
    return '{}'
  return prettyJson(token.payload.args ?? {})
})

const proofsList = computed(() => {
  const token = selectedToken.value
  if (!token || token.type !== 'invocation')
    return [] as string[]
  return token.payload.proofs
})

const canExport = computed(() => !!report.value && hasTokens.value)

const signatureSummary = computed(() => {
  const token = selectedToken.value
  if (!token || token.type === 'unknown')
    return null

  const base = signatureStatusCopy[token.signature.status]
  return {
    status: token.signature.status,
    label: base.label,
    tone: base.tone,
    helper: base.helper,
    reason: token.signature.reason ?? null,
  }
})

watch(
  () => props.defaultToken,
  (value) => {
    if (!value)
      return
    inputValue.value = value
    if (props.autoParse)
      scheduleParse('prop-change')
  },
)

watch(detailTabs, (tabs) => {
  if (!tabs.includes(activeTab.value))
    activeTab.value = tabs[0] ?? 'summary'
}, { immediate: true })

watch(inputValue, (value) => {
  if (suppressUrlSync) {
    suppressUrlSync = false
    return
  }
  if (props.persistUrl)
    updateUrlState(value)
  if (props.autoParse)
    scheduleParse('input')
})

function scheduleParse(context: string) {
  if (debounceHandle)
    clearTimeout(debounceHandle)
  debounceHandle = setTimeout(() => {
    runAnalysis(context).catch((error) => {
      console.error(error)
    })
  }, 420)
}

function pushDebug(stage: string, level: DebugEntry['level'], detail?: string) {
  const entry: DebugEntry = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString(),
    stage,
    level,
    detail,
  }
  debugEntries.value = [...debugEntries.value.slice(-49), entry]
}

async function runAnalysis(context: string) {
  const raw = inputValue.value.trim()
  const ticket = ++parseTicket

  if (!raw) {
    tokens.value = []
    report.value = null
    containerInfo.value = null
    parseState.value = 'idle'
    parseError.value = null
    emit('analysis', createReport('raw', '', undefined, []))
    emit('error', null)
    return
  }

  parseState.value = 'parsing'
  parseError.value = null
  pushDebug('parse:start', 'info', `Context: ${context}`)

  try {
    let bytesList: Uint8Array[] = []
    let container: ContainerParseResult | undefined
    let source: 'container' | 'raw' = 'raw'

    if (isLikelyContainer(raw)) {
      container = parseContainer(raw)
      bytesList = container.tokens
      source = 'container'
      containerInfo.value = container
      pushDebug('parse:container', 'info', `Header 0x${container.header.raw.toString(16)}`)
    }
    else {
      containerInfo.value = null
      const decoders = [
        () => decodeBase64(raw, 'standard'),
        () => decodeBase64(raw, 'url'),
      ] as const
      let decoded: Uint8Array | null = null
      for (const decode of decoders) {
        try {
          decoded = decode()
          break
        }
        catch {
          // try next decoder
        }
      }
      if (!decoded) {
        decoded = new TextEncoder().encode(raw)
        pushDebug('parse:raw-fallback', 'info', 'Decoding as UTF-8 bytes')
      }
      bytesList = [decoded]
    }

    const analyses = await Promise.all(bytesList.map((bytes, index) => analyseBytes(bytes, index)))
    if (ticket !== parseTicket)
      return

    tokens.value = analyses
    for (const tokenAnalysis of analyses) {
      if (tokenAnalysis.type === 'unknown')
        continue
      const signatureMeta = signatureStatusCopy[tokenAnalysis.signature.status]
      const descriptor = tokenAnalysis.type === 'invocation' ? 'Invocation' : 'Delegation'
      const details = [`${descriptor} #${tokenAnalysis.index + 1}: ${signatureMeta.label}`]
      if (tokenAnalysis.signature.reason)
        details.push(tokenAnalysis.signature.reason)
      const level: DebugEntry['level'] = tokenAnalysis.signature.status === 'failed' ? 'error' : 'info'
      pushDebug('signature:check', level, details.join(' · '))
    }
    selectedTokenIndex.value = 0
    activeTab.value = 'summary'

    const generatedReport = createReport(source, raw, container, analyses)
    report.value = generatedReport
    parseState.value = 'ready'
    emit('analysis', generatedReport)
    emit('error', null)

    pushDebug('parse:complete', 'info', `Tokens decoded: ${analyses.length}`)
  }
  catch (error) {
    if (ticket !== parseTicket)
      return
    const message = error instanceof ContainerParseError ? error.message : (error as Error).message ?? 'Failed to parse token'
    parseState.value = 'error'
    parseError.value = message
    pushDebug('parse:error', 'error', message)
    emit('error', message)
  }
}

function updateUrlState(value: string) {
  if (!isBrowser)
    return
  const url = new URL(window.location.href)
  if (value.trim())
    url.searchParams.set('ucan', encodeURIComponent(value.trim()))
  else
    url.searchParams.delete('ucan')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

async function copyReport() {
  const currentReport = report.value
  if (!currentReport)
    return
  const serialized = stringifyReport(currentReport as any)
  try {
    if (navigator?.clipboard) {
      await navigator.clipboard.writeText(serialized)
    }
    else {
      const element = document.createElement('textarea')
      element.value = serialized
      document.body.appendChild(element)
      element.select()
      document.execCommand('copy')
      document.body.removeChild(element)
    }
    pushDebug('export:copy', 'info', 'Report copied to clipboard')
    emit('export', { kind: 'copy', report: currentReport as any })
  }
  catch (error) {
    pushDebug('export:copy', 'error', (error as Error).message)
  }
}

function downloadReport() {
  const currentReport = report.value
  if (!currentReport || !isBrowser)
    return
  const serialized = stringifyReport(currentReport as any)
  const blob = new Blob([serialized], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `ucan-inspection-${Date.now()}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
  pushDebug('export:download', 'info', 'Report downloaded')
  emit('export', { kind: 'download', report: currentReport as any })
}

function clearInput() {
  inputValue.value = ''
  tokens.value = []
  parseError.value = null
  report.value = null
  containerInfo.value = null
  parseState.value = 'idle'
  emit('analysis', createReport('raw', '', undefined, []))
}

async function inspectNow() {
  await runAnalysis('manual')
}

async function loadMockToken(kind: MockTokenKind) {
  mockLoadingKind.value = kind
  try {
    const tokens = await getMockTokens()
    suppressUrlSync = true
    inputValue.value = tokens[kind]
    pushDebug('mock:load', 'info', `Mock ${kind} token loaded`)
    if (props.autoParse)
      scheduleParse(`mock-${kind}`)
  }
  catch (error) {
    pushDebug('mock:error', 'error', (error as Error).message)
  }
  finally {
    mockLoadingKind.value = null
  }
}

function clearDebug() {
  debugEntries.value = []
}

function toggleDebugMode() {
  debugMode.value = !debugMode.value
}

onMounted(async () => {
  if (!isBrowser)
    return

  const params = new URLSearchParams(window.location.search)
  const encoded = params.get('ucan')
  if (encoded) {
    suppressUrlSync = true
    try {
      inputValue.value = decodeURIComponent(encoded)
    }
    catch {
      inputValue.value = encoded
    }
    await nextTick()
    if (props.autoParse) {
      await runAnalysis('url-boot')
    }
  }
  else if (props.defaultToken && props.autoParse) {
    await runAnalysis('default-prop')
  }
})
</script>

<template>
  <div class="space-y-8 text-slate-100">
    <header class="hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-8 shadow-2xl ring-1 ring-white/10">
      <p class="text-sm uppercase tracking-[0.35em] text-slate-400">
        UCAN Inspector
      </p>
      <h1 class="mt-3 text-3xl font-semibold text-white lg:text-4xl">
        Inspect, validate, and understand your UCAN tokens
      </h1>
      <p class="mt-4 max-w-3xl text-base text-slate-300">
        Paste a UCAN token or container to decode headers, payloads, capability policies, and delegation chains. Visualize freshness windows, export structured reports, and share insight with your team.
      </p>
      <div class="mt-6 flex flex-wrap gap-3">
        <a href="https://ucan-staging.pages.dev/specification/" target="_blank" rel="noreferrer" class="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-indigo-200 transition hover:border-white/40 hover:bg-white/10">
          Read the spec
        </a>
        <a href="https://ucan-staging.pages.dev/libraries/" target="_blank" rel="noreferrer" class="inline-flex items-center gap-2 rounded-full border border-transparent bg-indigo-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">
          Explore libraries
        </a>
      </div>
    </header>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      <section class="rounded-3xl border border-white/10 bg-slate-950/60 p-6 backdrop-blur">
        <div>
          <h2 class="text-xl font-semibold text-white">
            Token input
          </h2>
          <p class="mt-1 text-sm text-slate-400">
            Supports raw UCAN payloads and UCAN containers.
          </p>
        </div>

        <textarea v-model="inputValue" class="mt-4 h-60 w-full resize-y rounded-2xl border border-white/10 bg-slate-900/80 p-4 font-mono text-sm text-slate-100 shadow-inner outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40" placeholder="Paste a UCAN token or container here…" spellcheck="false" />

        <p class="mt-2 text-xs text-slate-300">
          {{
            parseState === 'parsing'
              ? 'Parsing token…'
              : parseState === 'ready'
                ? `Decoded ${tokenCount} token${tokenCount === 1 ? '' : 's'}.`
                : parseState === 'idle'
                  ? 'Waiting for input.'
                  : 'An error occurred while parsing.'
          }}
        </p>

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <button class="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-white transition hover:border-white/40 hover:bg-white/10" type="button" @click="inspectNow">
            Inspect token
          </button>
          <button class="rounded-full border border-transparent bg-white/10 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-white transition hover:bg-white/20" type="button" @click="clearInput">
            Clear
          </button>
          <button
            class="rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition" :class="debugMode
              ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100 hover:border-indigo-300 hover:bg-indigo-500/30'
              : 'border-white/10 bg-white/5 text-slate-200 hover:border-white/30 hover:bg-white/10'" type="button" :aria-pressed="debugMode" @click="toggleDebugMode"
          >
            Debug: {{ debugMode ? 'On' : 'Off' }}
          </button>
        </div>

        <p v-if="parseState === 'error'" class="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {{ parseError }}
        </p>

        <div v-if="containerInfo" class="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
          <div class="flex items center justify-between">
            <span class="text-slate-400">Header byte</span>
            <span class="font-mono text-sm">0x{{ containerInfo.header.raw.toString(16).padStart(2, '0') }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-400">Encoding</span>
            <span class="font-semibold capitalize">{{ containerInfo.header.encoding }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-400">Compression</span>
            <span class="font-semibold capitalize">{{ containerInfo.header.compression }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-400">Tokens detected</span>
            <span class="font-semibold">{{ containerInfo.tokens.length }}</span>
          </div>
        </div>
      </section>

      <section class="rounded-3xl border border-white/10 bg-slate-950/70 p-6 backdrop-blur">
        <div v-if="!hasTokens" class="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-400">
          <h3 class="text-xl font-semibold text-white">
            Ready when you are
          </h3>
          <p class="max-w-md text-sm">
            Paste a UCAN delegation or container to see decoded headers, payloads, capability policies, and delegation chains. All processing happens locally in your browser.
          </p>
        </div>

        <div v-else class="space-y-6">
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="token in tokens" :key="token.id" class="rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide" :class="[
                  token.index === selectedTokenIndex ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200' : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/30 hover:text-white',
                ]" type="button" @click="selectedTokenIndex = token.index"
              >
                Token {{ token.index + 1 }}
              </button>
            </div>

            <div class="ml-auto flex flex-wrap gap-2">
              <span
                v-for="chip in statusChips" :key="chip.label" class="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide" :class="{
                  'bg-emerald-500/15 text-emerald-200': chip.tone === 'success',
                  'bg-amber-500/15 text-amber-200': chip.tone === 'warn',
                  'bg-rose-500/15 text-rose-200': chip.tone === 'error',
                  'bg-white/10 text-slate-200': chip.tone === 'info',
                }" :title="chip.tooltip ?? undefined"
              >
                {{ chip.label }}
              </span>
            </div>
          </div>

          <div v-if="selectedToken && selectedToken.type !== 'unknown'" class="space-y-6">
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article v-for="card in summaryCards" :key="card.label" class="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p class="text-xs uppercase tracking-wide text-slate-400">
                  {{ card.label }}
                </p>
                <p class="mt-2 truncate text-sm font-semibold text-white" :title="card.value">
                  {{ card.value }}
                </p>
                <p class="mt-1 text-xs text-slate-300">
                  {{ card.helper }}
                </p>
              </article>
            </div>

            <div v-if="timeline" class="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-slate-900/80 p-5">
              <div class="flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate-400">
                <span>Not before: <span class="font-semibold text-slate-200">{{ timeline.nbfLabel }}</span></span>
                <span>Expires: <span class="font-semibold text-slate-200">{{ timeline.expLabel }}</span></span>
              </div>
              <div class="mt-3 h-2 w-full rounded-full bg-slate-800/80">
                <div class="h-full rounded-full bg-indigo-400/80 transition-all" :style="{ width: `${timelineProgress}%` }" />
              </div>
              <p v-if="timelineSummary" class="mt-2 text-sm text-slate-300">
                Status: <span class="font-semibold text-white">{{ timelineSummary.statusLabel }}</span>
                <template v-if="timelineSummary.expText">
                  · {{ timelineSummary.expText }}
                </template>
                <template v-if="timelineSummary.nbfText">
                  · {{ timelineSummary.nbfText }}
                </template>
              </p>
            </div>

            <div class="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <nav v-if="detailTabs.length" class="flex border-b border-white/5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <button v-for="tab in detailTabs" :key="tab" class="flex-1 px-3 py-2 capitalize" :class="tab === activeTab ? 'bg-white/10 text-white' : 'hover:bg-white/5'" type="button" @click="activeTab = tab">
                  {{ tab }}
                </button>
              </nav>

              <div class="max-h-[420px] overflow-auto p-4 text-sm">
                <div v-if="activeTab === 'summary'" class="space-y-3 text-slate-200">
                  <div v-if="signatureSummary" class="rounded-xl border border-white/5 bg-white/5 p-3">
                    <p class="text-xs uppercase tracking-wide text-slate-400">
                      Signature
                    </p>
                    <p
                      class="mt-1 text-sm font-semibold" :class="{
                        'text-emerald-200': signatureSummary.tone === 'success',
                        'text-amber-200': signatureSummary.tone === 'warn',
                        'text-rose-200': signatureSummary.tone === 'error',
                        'text-slate-200': signatureSummary.tone === 'info',
                      }"
                    >
                      {{ signatureSummary.label }}
                    </p>
                    <p class="mt-1 text-xs text-slate-300">
                      {{ signatureSummary.reason ?? signatureSummary.helper }}
                    </p>
                  </div>
                  <div class="flex items-start justify-between gap-4 rounded-xl border border-white/5 bg-white/5 p-3">
                    <div>
                      <p class="text-xs uppercase tracking-wide text-slate-400">
                        Nonce
                      </p>
                      <p class="mt-1 font-mono text-xs">
                        {{ selectedNonceDagJson }}
                      </p>
                    </div>
                    <div class="text-right">
                      <p class="text-xs uppercase tracking-wide text-slate-400">
                        CID
                      </p>
                      <p class="mt-1 font-mono text-xs">
                        {{ selectedToken.cid }}
                      </p>
                    </div>
                  </div>
                  <div v-if="selectedToken.type === 'delegation'" class="rounded-xl border border-white/5 bg-white/5 p-3">
                    <p class="text-xs uppercase tracking-wide text-slate-400">
                      Policy
                    </p>
                    <p class="mt-2 text-xs text-slate-300">
                      {{ Array.isArray(selectedToken.payload.pol) ? selectedToken.payload.pol.length : 0 }} predicate{{ Array.isArray(selectedToken.payload.pol) && selectedToken.payload.pol.length === 1 ? '' : 's' }}
                    </p>
                    <p class="mt-1 text-xs text-slate-300">
                      Policies constrain invocation arguments using the UCAN policy language.
                    </p>
                  </div>
                  <div v-else class="rounded-xl border border-white/5 bg-white/5 p-3">
                    <p class="text-xs uppercase tracking-wide text-slate-400">
                      Proofs
                    </p>
                    <p class="mt-2 text-xs text-slate-300">
                      {{ proofsList.length }} proof{{ proofsList.length === 1 ? '' : 's' }} referenced
                    </p>
                    <p class="mt-1 text-xs text-slate-300">
                      Proofs reference delegations that authorize this invocation.
                    </p>
                  </div>
                  <div v-if="selectedToken.type === 'invocation' && selectedToken.payload.cause" class="rounded-xl border border-white/5 bg-white/5 p-3">
                    <p class="text-xs uppercase tracking-wide text-slate-400">
                      Cause
                    </p>
                    <p class="mt-2 font-mono text-xs break-all text-slate-200">
                      {{ selectedCauseDagJson }}
                    </p>
                    <p class="mt-1 text-xs text-slate-300">
                      Receipt or task CID linked to this invocation.
                    </p>
                  </div>
                  <div v-if="metaJson" class="rounded-xl border border-white/5 bg-white/5 p-3">
                    <p class="text-xs uppercase tracking-wide text-slate-400">
                      Meta
                    </p>
                    <pre class="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-slate-200">{{ metaJson }}</pre>
                  </div>
                </div>

                <pre v-else-if="activeTab === 'payload'" class="whitespace-pre-wrap break-words font-mono text-xs text-slate-100">{{ selectedPayloadJson }}</pre>

                <pre v-else-if="activeTab === 'policy' && selectedToken.type === 'delegation'" class="whitespace-pre-wrap break-words font-mono text-xs text-slate-100">{{ policyJson }}</pre>

                <pre v-else-if="activeTab === 'args' && selectedToken.type === 'invocation'" class="whitespace-pre-wrap break-words font-mono text-xs text-slate-100">{{ argsJson }}</pre>

                <div v-else-if="activeTab === 'proofs' && selectedToken.type === 'invocation'" class="space-y-2 text-xs text-slate-200">
                  <p v-if="proofsList.length === 0" class="text-slate-300">
                    No proofs attached to this invocation.
                  </p>
                  <ol v-else class="space-y-2">
                    <li v-for="(proof, proofIndex) in proofsList" :key="proof" class="rounded-lg border border-white/5 bg-slate-900/60 p-2 font-mono text-[11px]">
                      Proof {{ proofIndex + 1 }}: {{ proof }}
                    </li>
                  </ol>
                </div>

                <pre v-else-if="activeTab === 'header'" class="whitespace-pre-wrap break-words font-mono text-xs text-slate-100">{{ selectedHeaderJson }}</pre>

                <pre v-else class="whitespace-pre-wrap break-all font-mono text-xs text-slate-100">{{ selectedToken.tokenBase64 }}</pre>
              </div>
            </div>
          </div>

          <div v-else-if="selectedToken?.type === 'unknown'" class="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">
            <p class="font-semibold">
              Token could not be decoded as a UCAN delegation or invocation.
            </p>
            <p v-if="selectedToken.reason" class="mt-1 text-xs text-amber-200/80">
              {{ selectedToken.reason }}
            </p>
          </div>

          <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Delegation chain
            </h3>
            <ol class="mt-3 space-y-3">
              <li v-for="link in delegationLinks" :key="link.id" class="rounded-xl border border-white/5 bg-slate-900/70 p-3 text-xs text-slate-300">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-full bg-indigo-500/20 px-2 py-0.5 font-semibold text-indigo-200">#{{ link.index + 1 }}</span>
                  <span class="font-semibold text-slate-100">{{ link.iss }}</span>
                  <span class="text-slate-300">→</span>
                  <span class="font-semibold text-slate-100">{{ link.aud }}</span>
                </div>
                <p class="mt-1 font-mono text-[11px] text-slate-400">
                  CID: {{ link.cid }}
                </p>
              </li>
            </ol>
            <p v-if="delegationLinks.length === 0" class="text-xs text-slate-300">
              No valid delegations detected.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button class="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white/40 hover:bg-white/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-300" type="button" :disabled="!canExport" @click="copyReport">
              Copy JSON report
            </button>
            <button class="rounded-full border border-indigo-400/40 bg-indigo-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-100 transition hover:border-indigo-300/80 hover:bg-indigo-400/30 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-300" type="button" :disabled="!canExport" @click="downloadReport">
              Download report
            </button>
          </div>
        </div>
      </section>
    </div>

    <transition name="fade">
      <aside v-if="debugMode" class="mt-6 space-y-4 rounded-3xl border border-white/10 bg-slate-950/85 p-6">
        <header>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Debug mode
          </h3>
          <p class="mt-2 text-xs text-slate-400">
            Access mock UCANs and review structured logs while debugging.
          </p>
        </header>

        <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_240px]">
          <section class="rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-200">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-300">
              Sample tokens
            </p>
            <p class="mt-1 text-[11px] text-slate-400">
              Quickly inject delegation, invocation, or container examples.
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <button class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-200 transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60" type="button" :disabled="mockLoadingKind === 'delegation'" @click="loadMockToken('delegation')">
                {{ mockLoadingKind === 'delegation' ? 'Loading delegation…' : 'Delegation' }}
              </button>
              <button class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-200 transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60" type="button" :disabled="mockLoadingKind === 'invocation'" @click="loadMockToken('invocation')">
                {{ mockLoadingKind === 'invocation' ? 'Loading invocation…' : 'Invocation' }}
              </button>
              <button class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-200 transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60" type="button" :disabled="mockLoadingKind === 'container'" @click="loadMockToken('container')">
                {{ mockLoadingKind === 'container' ? 'Loading container…' : 'Container' }}
              </button>
            </div>
          </section>

          <section class="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-200">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Log status
              </p>
              <p class="mt-1 text-[11px] text-slate-400">
                Entries append in real time when operations run.
              </p>
            </div>
            <div class="mt-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/60 bg-indigo-500/10 px-3 py-1.5 text-[11px] uppercase tracking-wide text-indigo-100">
              <span>Status</span>
              <span class="font-semibold">Active</span>
            </div>
            <button class="mt-3 self-start rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:border-white/30 hover:bg-white/10" type="button" @click="clearDebug">
              Clear log
            </button>
          </section>
        </div>

        <div class="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Log entries
          </h4>
          <ul class="mt-3 max-h-64 space-y-2 overflow-auto pr-2 text-xs">
            <li v-for="entry in [...debugEntries].reverse()" :key="entry.id" class="rounded-xl border border-white/5 p-3" :class="entry.level === 'error' ? 'bg-rose-500/10 text-rose-200' : 'bg-white/5 text-slate-200'">
              <div class="flex items-center justify-between">
                <span class="font-semibold">{{ entry.stage }}</span>
                <span class="text-[10px] uppercase tracking-wide text-slate-400">{{ new Date(entry.timestamp).toLocaleTimeString() }}</span>
              </div>
              <p class="mt-1 whitespace-pre-wrap break-words text-[11px]">
                {{ entry.detail }}
              </p>
            </li>
            <li v-if="debugEntries.length === 0" class="rounded-xl border border-dashed border-white/10 bg-white/5 p-3 text-xs text-slate-400">
              No entries yet. Run an inspection or load a sample token to see activity.
            </li>
          </ul>
        </div>
      </aside>
    </transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
