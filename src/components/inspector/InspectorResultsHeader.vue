<script setup lang="ts">
import type { TokenAnalysis } from '../../utils/ucanAnalysis'

type StatusTone = 'info' | 'success' | 'warn' | 'error'

interface StatusChip {
  label: string
  tone: StatusTone
  tooltip?: string
}

defineProps<{
  tokens: TokenAnalysis[]
  selectedTokenIndex: number
  statusChips: StatusChip[]
}>()

const emit = defineEmits<{
  (event: 'select', index: number): void
}>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <div class="flex flex-wrap gap-2">
      <button
        v-for="token in tokens"
        :key="token.id"
        class="rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
        :class="[
          token.index === selectedTokenIndex
            ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
            : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/30 hover:text-white',
        ]"
        type="button"
        @click="emit('select', token.index)"
      >
        Token {{ token.index + 1 }}
      </button>
    </div>

    <div class="ml-auto flex flex-wrap gap-2">
      <span
        v-for="chip in statusChips"
        :key="chip.label"
        class="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
        :class="{
          'bg-emerald-500/15 text-emerald-200': chip.tone === 'success',
          'bg-amber-500/15 text-amber-200': chip.tone === 'warn',
          'bg-rose-500/15 text-rose-200': chip.tone === 'error',
          'bg-white/10 text-slate-200': chip.tone === 'info',
        }"
        :title="chip.tooltip ?? undefined"
      >
        {{ chip.label }}
      </span>
    </div>
  </div>
</template>
