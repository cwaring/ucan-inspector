<script setup lang="ts">
import type { TokenTimeline } from '../../utils/ucanAnalysis'

defineProps<{
  summaryCards: Array<{ label: string, value: string, helper: string }>
  timeline: TokenTimeline | null
  timelineProgress: number
  timelineSummary: null | { statusLabel: string, expText: string | null, nbfText: string | null }
}>()
</script>

<template>
  <div class="space-y-6">
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
  </div>
</template>
