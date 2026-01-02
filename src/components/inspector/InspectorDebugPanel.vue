<script setup lang="ts">
import type { DebugEntry } from '@/composables/inspector/useDebugLog'
import type { MockTokenKind } from '@/utils/mockData'

defineProps<{
  open: boolean
  debugEntries: DebugEntry[]
  mockLoadingKind: MockTokenKind | null
}>()

const emit = defineEmits<{
  (event: 'loadMock', kind: MockTokenKind): void
  (event: 'clearLog'): void
}>()
</script>

<template>
  <transition name="fade">
    <aside v-if="open" class="mt-6 space-y-4 rounded-3xl border border-white/10 bg-slate-950/85 p-6">
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
            Quickly inject valid and intentionally malformed examples.
          </p>
          <div class="mt-3 space-y-4">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Valid
              </p>
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-200 transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  :disabled="mockLoadingKind === 'delegation'"
                  @click="emit('loadMock', 'delegation')"
                >
                  {{ mockLoadingKind === 'delegation' ? 'Loading delegation…' : 'Delegation' }}
                </button>
                <button
                  class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-200 transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  :disabled="mockLoadingKind === 'invocation'"
                  @click="emit('loadMock', 'invocation')"
                >
                  {{ mockLoadingKind === 'invocation' ? 'Loading invocation…' : 'Invocation' }}
                </button>
                <button
                  class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-200 transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  :disabled="mockLoadingKind === 'container'"
                  @click="emit('loadMock', 'container')"
                >
                  {{ mockLoadingKind === 'container' ? 'Loading container…' : 'Container' }}
                </button>

                <button
                  class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-200 transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  :disabled="mockLoadingKind === 'containerBase64url'"
                  @click="emit('loadMock', 'containerBase64url')"
                >
                  {{ mockLoadingKind === 'containerBase64url' ? 'Loading…' : 'Container (base64url)' }}
                </button>
              </div>
            </div>

            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Malformed
              </p>
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  class="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-amber-100 transition hover:border-amber-500/30 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  :disabled="mockLoadingKind === 'nonCanonicalContainer'"
                  @click="emit('loadMock', 'nonCanonicalContainer')"
                >
                  {{ mockLoadingKind === 'nonCanonicalContainer' ? 'Loading…' : 'Non-canonical container' }}
                </button>

                <button
                  class="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-amber-100 transition hover:border-amber-500/30 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  :disabled="mockLoadingKind === 'tamperedDelegation'"
                  @click="emit('loadMock', 'tamperedDelegation')"
                >
                  {{ mockLoadingKind === 'tamperedDelegation' ? 'Loading…' : 'Tampered delegation' }}
                </button>

                <button
                  class="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-amber-100 transition hover:border-amber-500/30 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  :disabled="mockLoadingKind === 'badContainer'"
                  @click="emit('loadMock', 'badContainer')"
                >
                  {{ mockLoadingKind === 'badContainer' ? 'Loading…' : 'Invalid container' }}
                </button>

                <button
                  class="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-amber-100 transition hover:border-amber-500/30 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  :disabled="mockLoadingKind === 'badRawInput'"
                  @click="emit('loadMock', 'badRawInput')"
                >
                  {{ mockLoadingKind === 'badRawInput' ? 'Loading…' : 'Invalid raw input' }}
                </button>
              </div>
            </div>
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
          <button
            class="mt-3 self-start rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:border-white/30 hover:bg-white/10"
            type="button"
            @click="emit('clearLog')"
          >
            Clear log
          </button>
        </section>
      </div>

      <div class="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-300">
          Log entries
        </h4>
        <ul class="mt-3 max-h-64 space-y-2 overflow-auto pr-2 text-xs">
          <li
            v-for="entry in debugEntries"
            :key="entry.id"
            class="rounded-xl border border-white/5 p-3"
            :class="entry.level === 'error' ? 'bg-rose-500/10 text-rose-200' : 'bg-white/5 text-slate-200'"
          >
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
