<script setup lang="ts">
defineProps<{
  disabled: boolean
}>()

const emit = defineEmits<{
  (event: 'copy'): void
  (event: 'download'): void
}>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <button
      class="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white/40 hover:bg-white/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-300"
      type="button"
      :disabled="disabled"
      @click="emit('copy')"
    >
      Copy JSON report
    </button>
    <button
      class="rounded-full border border-indigo-400/40 bg-indigo-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-100 transition hover:border-indigo-300/80 hover:bg-indigo-400/30 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-300"
      type="button"
      :disabled="disabled"
      @click="emit('download')"
    >
      Download report
    </button>
  </div>
</template>
