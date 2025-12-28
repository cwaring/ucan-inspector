<script setup lang="ts">
import type { TokenTimeline } from '../../utils/ucanAnalysis'

defineProps<{
  summaryCards: Array<{ label: string, value: string, helper: string }>
  timeline: TokenTimeline | null
  timelineState: TokenTimeline['state']
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

    <div
      v-if="timeline"
      class="rounded-2xl border p-5"
      :class="{
        'border-rose-500/30 bg-rose-500/5': timelineState === 'expired',
        'border-amber-500/30 bg-amber-500/5': timelineState === 'pending',
        'border-white/10 bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-slate-900/80': timelineState === 'valid' || timelineState === 'none',
      }"
    >
      <div class="grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
        <div class="flex min-w-0 gap-1">
          <span class="shrink-0">Not before:</span>
          <span class="min-w-0 truncate font-semibold text-slate-200" :title="timeline.nbfLabel">
            {{ timeline.nbfLabel }}
          </span>
        </div>
        <div class="flex min-w-0 gap-1 sm:justify-end sm:text-right">
          <span class="shrink-0">Expires:</span>
          <span class="min-w-0 truncate font-semibold text-slate-200" :title="timeline.expLabel">
            {{ timeline.expLabel }}
          </span>
        </div>
      </div>
      <div class="mt-3 h-2 w-full rounded-full bg-slate-800/80">
        <div
          class="h-full rounded-full transition-all"
          :class="{
            'bg-emerald-400/80': timelineState === 'valid',
            'bg-amber-400/80': timelineState === 'pending',
            'bg-rose-400/80': timelineState === 'expired',
            'bg-indigo-400/80': timelineState === 'none',
          }"
          :style="timelineProgress > 0 ? { width: `${timelineProgress}%`, minWidth: '2px' } : { width: '0%' }"
        />
      </div>
      <p v-if="timelineSummary" class="mt-2 text-sm text-slate-300">
        Status:
        <span
          class="font-semibold"
          :class="{
            'text-rose-200': timelineState === 'expired',
            'text-amber-200': timelineState === 'pending',
            'text-emerald-200': timelineState === 'valid',
            'text-white': timelineState === 'none',
          }"
        >{{ timelineSummary.statusLabel }}</span>
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
