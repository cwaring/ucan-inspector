<script setup lang="ts">
import type { Issue } from '../../utils/ucanAnalysis'
import type { ContainerParseResult } from '../../utils/ucanContainer'

defineProps<{
  modelValue: string
  inspectorVersion: string
  parseState: 'idle' | 'parsing' | 'ready' | 'error'
  tokenCount: number
  parseError: string | null
  reportIssues: Issue[]
  containerInfo: ContainerParseResult | null
  debugMode: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'inspect'): void
  (event: 'clear'): void
  (event: 'toggleDebug'): void
}>()
</script>

<template>
  <section class="rounded-3xl border border-white/10 bg-slate-950/60 p-6 backdrop-blur">
    <div>
      <h2 class="text-xl font-semibold text-white">
        UCAN Inspector <span class="mt-2 text-[11px] text-slate-400"> v{{ inspectorVersion }}</span>
      </h2>
      <p class="mt-1 text-sm text-slate-400">
        Supports UCAN tokens and container formats defined in the
        <a href="https://ucan.xyz/specification/" target="_blank" rel="noreferrer" class="underline">UCAN v1.0 specification</a>.
      </p>
    </div>

    <textarea
      :value="modelValue"
      class="mt-4 h-60 w-full resize-y rounded-2xl border border-white/10 bg-slate-900/80 p-4 font-mono text-sm text-slate-100 shadow-inner outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40"
      placeholder="Paste a UCAN token or container here…"
      spellcheck="false"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />

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
      <button
        class="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-white transition hover:border-white/40 hover:bg-white/10"
        type="button"
        @click="emit('inspect')"
      >
        Inspect token
      </button>
      <button
        class="rounded-full border border-transparent bg-white/10 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-white transition hover:bg-white/20"
        type="button"
        @click="emit('clear')"
      >
        Clear
      </button>
      <button
        class="rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition"
        :class="debugMode
          ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100 hover:border-indigo-300 hover:bg-indigo-500/30'
          : 'border-white/10 bg-white/5 text-slate-200 hover:border-white/30 hover:bg-white/10'"
        type="button"
        :aria-pressed="debugMode"
        @click="emit('toggleDebug')"
      >
        Debug: {{ debugMode ? 'On' : 'Off' }}
      </button>
    </div>

    <p v-if="parseState === 'error'" class="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
      {{ parseError }}
    </p>

    <div v-if="parseState === 'ready' && reportIssues.length" class="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
      <p class="font-semibold">
        Notices & warnings
      </p>
      <ul class="mt-1 list-disc space-y-1 pl-5">
        <li v-for="(issue, idx) in reportIssues" :key="`${issue.code}-${idx}`">
          <span class="font-semibold">{{ issue.level }}</span>: {{ issue.message }}
        </li>
      </ul>
    </div>

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

      <div v-if="containerInfo.diagnostics.length" class="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
        <p class="font-semibold">
          Container diagnostics
        </p>
        <ul class="mt-1 list-disc space-y-1 pl-5">
          <li v-for="(diag, idx) in containerInfo.diagnostics" :key="`${diag.code}-${idx}`">
            <span class="font-semibold">{{ diag.level }}</span>: {{ diag.message }}
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
