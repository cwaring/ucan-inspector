<script setup lang="ts">
type StatusTone = 'info' | 'success' | 'warn' | 'error'

export type DetailTab = 'summary' | 'payload' | 'policy' | 'header' | 'raw' | 'args' | 'proofs'

type SelectedTokenType = 'delegation' | 'invocation'

defineProps<{
  detailTabs: DetailTab[]
  activeTab: DetailTab
  selectedTokenType: SelectedTokenType
  selectedTokenCid: string
  selectedTokenTokenBase64: string
  delegationPolicyPredicateCount: number
  invocationHasCause: boolean
  signatureSummary: null | { label: string, tone: StatusTone, helper: string, reason: string | null }
  selectedNonceDagJson: string
  selectedCauseDagJson: string
  metaJson: string | null
  selectedPayloadJson: string
  policyJson: string
  argsJson: string
  proofsList: string[]
  selectedHeaderJson: string
}>()

const emit = defineEmits<{
  (event: 'update:activeTab', value: DetailTab): void
}>()
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
    <nav v-if="detailTabs.length" class="flex border-b border-white/5 text-xs font-semibold uppercase tracking-wide text-slate-400">
      <button
        v-for="tab in detailTabs"
        :key="tab"
        class="flex-1 px-3 py-2 capitalize"
        :class="tab === activeTab ? 'bg-white/10 text-white' : 'hover:bg-white/5'"
        type="button"
        @click="emit('update:activeTab', tab)"
      >
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
            class="mt-1 text-sm font-semibold"
            :class="{
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
              {{ selectedTokenCid }}
            </p>
          </div>
        </div>

        <div v-if="selectedTokenType === 'delegation'" class="rounded-xl border border-white/5 bg-white/5 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">
            Policy
          </p>
          <p class="mt-2 text-xs text-slate-300">
            {{ delegationPolicyPredicateCount }} predicate{{ delegationPolicyPredicateCount === 1 ? '' : 's' }}
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

        <div v-if="selectedTokenType === 'invocation' && invocationHasCause" class="rounded-xl border border-white/5 bg-white/5 p-3">
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

      <pre v-else-if="activeTab === 'policy' && selectedTokenType === 'delegation'" class="whitespace-pre-wrap break-words font-mono text-xs text-slate-100">{{ policyJson }}</pre>

      <pre v-else-if="activeTab === 'args' && selectedTokenType === 'invocation'" class="whitespace-pre-wrap break-words font-mono text-xs text-slate-100">{{ argsJson }}</pre>

      <div v-else-if="activeTab === 'proofs' && selectedTokenType === 'invocation'" class="space-y-2 text-xs text-slate-200">
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

      <pre v-else class="whitespace-pre-wrap break-all font-mono text-xs text-slate-100">{{ selectedTokenTokenBase64 }}</pre>
    </div>
  </div>
</template>
