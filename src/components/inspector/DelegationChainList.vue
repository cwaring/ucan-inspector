<script setup lang="ts">
import type { DelegationLink } from '@/components/inspector/types'

defineProps<{
  delegationLinks: DelegationLink[]
}>()
</script>

<template>
  <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
    <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-300">
      Delegation chain
    </h3>
    <ol class="mt-3 space-y-3">
      <li
        v-for="link in delegationLinks"
        :key="link.id"
        class="rounded-xl border border-white/5 bg-slate-900/70 p-3 text-xs text-slate-300"
      >
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
</template>
