<script setup lang="ts">
import type { DelegationLink } from '@/components/inspector/types'
import type { JsonFormat } from '@/utils/format'
import type { MockTokenKind } from '@/utils/mockData'
import type { AnalysisReport, Issue } from '@/utils/ucanAnalysis'

import { computed, ref } from 'vue'

import DelegationChainList from '@/components/inspector/DelegationChainList.vue'
import InspectorDebugPanel from '@/components/inspector/InspectorDebugPanel.vue'
import InspectorInputPanel from '@/components/inspector/InspectorInputPanel.vue'
import InspectorResultsHeader from '@/components/inspector/InspectorResultsHeader.vue'
import ReportExportControls from '@/components/inspector/ReportExportControls.vue'
import TokenDetailsTabs from '@/components/inspector/TokenDetailsTabs.vue'
import TokenOverview from '@/components/inspector/TokenOverview.vue'

import { signatureStatusCopy } from '@/composables/inspector/signatureStatusCopy'
import { useDebouncedCallback } from '@/composables/inspector/useDebouncedCallback'
import { useDebugLog } from '@/composables/inspector/useDebugLog'
import { useInspectorInputSync } from '@/composables/inspector/useInspectorInputSync'
import { useReportExport } from '@/composables/inspector/useReportExport'
import { useSelectedTokenViewModel } from '@/composables/inspector/useSelectedTokenViewModel'
import { useUcanInspection } from '@/composables/inspector/useUcanInspection'
import { useUcanUrlBootstrap } from '@/composables/inspector/useUcanUrlBootstrap'
import { useUcanUrlSync } from '@/composables/inspector/useUcanUrlSync'

import { getMockTokens } from '@/mock'
import { getInspectorVersion } from '@/utils/version'

interface InspectorProps {
  ucan?: string
  syncUrl?: boolean
  autoInspect?: boolean
}

const props = withDefaults(defineProps<InspectorProps>(), {
  ucan: '',
  syncUrl: true,
  autoInspect: true,
})

const emit = defineEmits<{
  (event: 'report', payload: AnalysisReport): void
  (event: 'reportError', payload: string | null): void
  (event: 'reportExport', payload: { action: 'copy' | 'download', report: AnalysisReport }): void
}>()

const inputValue = ref(props.ucan)
const debugMode = ref(false)
const { reversedDebugEntries, pushDebug, clearDebug } = useDebugLog(50)
const mockLoadingKind = ref<MockTokenKind | null>(null)

const jsonFormat = ref<JsonFormat>('json')
const includeRawBytes = ref(false)

const {
  tokens,
  report,
  parseState,
  parseError,
  containerInfo,
  selectedTokenIndex,
  activeTab,
  runAnalysis,
  clearInput,
} = useUcanInspection({
  inputValue,
  signatureStatusCopy,
  pushDebug,
  onReport: report => emit('report', report),
  onReportError: error => emit('reportError', error),
})

const inspectorVersion = getInspectorVersion()

const urlSync = useUcanUrlSync('ucan')

useUcanUrlBootstrap({
  urlSync,
  inputValue,
  defaultUcan: props.ucan,
  autoInspect: props.autoInspect,
  runAnalysis,
})

const debouncedAnalysis = useDebouncedCallback((context: string) => {
  runAnalysis(context).catch((error) => {
    console.error(error)
  })
}, 420)

useInspectorInputSync({
  inputValue,
  urlSync,
  ucanProp: () => props.ucan,
  syncUrl: () => props.syncUrl,
  autoInspect: () => props.autoInspect,
  scheduleParse: context => debouncedAnalysis.schedule(context),
})

const selectedToken = computed(() => tokens.value[selectedTokenIndex.value] ?? null)
const tokenCount = computed(() => tokens.value.length)
const hasTokens = computed(() => tokenCount.value > 0)
const reportIssues = computed<Issue[]>(() => report.value?.issues ?? [])

const {
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
  timelineState,
  timelineProgress,
  timelineSummary,
  statusChips,
  policyJson,
  metaJson,
  argsJson,
  proofsList,
  signatureSummary,
  selectedTokenIssues,
} = useSelectedTokenViewModel({
  selectedToken,
  activeTab,
  signatureStatusCopy,
  jsonFormat,
})

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

const { canExport, copyReport, downloadReport } = useReportExport({
  report,
  hasTokens,
  jsonFormat,
  includeRawBytes,
  isBrowser: urlSync.isBrowser,
  pushDebug,
  onExport: payload => emit('reportExport', payload),
})

async function inspectNow() {
  await runAnalysis('manual')
}

async function loadMockToken(kind: MockTokenKind) {
  mockLoadingKind.value = kind
  try {
    const tokens = await getMockTokens()
    urlSync.suppressOnce()
    inputValue.value = tokens[kind]
    pushDebug('mock:load', 'info', `Mock ${kind} token loaded`)
    if (props.autoInspect)
      debouncedAnalysis.schedule(`mock-${kind}`)
  }
  catch (error) {
    pushDebug('mock:error', 'error', (error as Error).message)
  }
  finally {
    mockLoadingKind.value = null
  }
}

function toggleDebugMode(): void {
  debugMode.value = !debugMode.value
}
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
      <InspectorInputPanel
        v-model="inputValue"
        v-model:json-format="jsonFormat"
        v-model:include-raw-bytes="includeRawBytes"
        :inspector-version="inspectorVersion"
        :parse-state="parseState"
        :token-count="tokenCount"
        :parse-error="parseError"
        :report-issues="reportIssues"
        :container-info="containerInfo"
        :debug-mode="debugMode"
        @inspect="inspectNow"
        @clear="clearInput"
        @toggle-debug="toggleDebugMode"
      />

      <section class="rounded-3xl border border-white/10 bg-slate-950/70 p-6 backdrop-blur">
        <div v-if="!hasTokens" class="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-400">
          <h3 class="text-xl font-semibold text-white">
            Ready when you are
          </h3>
          <p class="max-w-md text-sm">
            Paste a UCAN token or container to decode headers, payloads, policies, proofs, and delegation chains. Everything runs locally in your browser.
          </p>
        </div>

        <div v-else class="space-y-6">
          <InspectorResultsHeader
            :tokens="tokens"
            :selected-token-index="selectedTokenIndex"
            :status-chips="statusChips"
            @select="(index) => selectedTokenIndex = index"
          />

          <div v-if="selectedToken && selectedToken.type !== 'unknown'" class="space-y-6">
            <TokenOverview
              :summary-cards="summaryCards"
              :timeline="timeline"
              :timeline-state="timelineState"
              :timeline-progress="timelineProgress"
              :timeline-summary="timelineSummary"
            />

            <TokenDetailsTabs
              v-model:active-tab="activeTab"
              :detail-tabs="detailTabs"
              :selected-token-type="selectedTokenType"
              :selected-token-cid="selectedTokenCid"
              :selected-token-token-base64="selectedTokenTokenBase64"
              :delegation-policy-predicate-count="delegationPolicyPredicateCount"
              :invocation-has-cause="invocationHasCause"
              :signature-summary="signatureSummary"
              :selected-nonce-dag-json="selectedNonceDagJson"
              :selected-cause-dag-json="selectedCauseDagJson"
              :meta-json="metaJson"
              :selected-payload-json="selectedPayloadJson"
              :policy-json="policyJson"
              :args-json="argsJson"
              :proofs-list="proofsList"
              :selected-header-json="selectedHeaderJson"
            />
          </div>

          <div v-else-if="selectedToken && selectedToken.type === 'unknown'" class="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-200">
            <p class="text-sm font-semibold text-white">
              Unable to decode token
            </p>
            <p class="mt-2 text-sm text-slate-300">
              {{ selectedToken.reason }}
            </p>
            <div v-if="selectedTokenIssues.length" class="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
              <p class="font-semibold">
                Diagnostics
              </p>
              <ul class="mt-1 list-disc space-y-1 pl-5">
                <li v-for="(issue, idx) in selectedTokenIssues" :key="`${issue.code}-${idx}`">
                  <span class="font-semibold">{{ issue.level }}</span>: {{ issue.message }}
                </li>
              </ul>
            </div>
          </div>

          <DelegationChainList :delegation-links="delegationLinks" />

          <ReportExportControls :disabled="!canExport" @copy="copyReport" @download="downloadReport" />
        </div>
      </section>
    </div>

    <InspectorDebugPanel
      :open="debugMode"
      :debug-entries="reversedDebugEntries"
      :mock-loading-kind="mockLoadingKind"
      @load-mock="loadMockToken"
      @clear-log="clearDebug"
    />
  </div>
</template>
