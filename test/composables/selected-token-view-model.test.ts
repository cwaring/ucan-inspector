import { describe, expect, it, vi } from 'vitest'
import { computed, effectScope, ref } from 'vue'

import { useSelectedTokenViewModel } from '@/composables/inspector/useSelectedTokenViewModel'

describe('useSelectedTokenViewModel timeline updates', () => {
  it('updates timelineProgress as time advances', () => {
    vi.useFakeTimers()

    const base = new Date('2025-01-01T00:00:00.000Z')
    vi.setSystemTime(base)

    const baseSeconds = Math.floor(base.getTime() / 1000)

    const token = {
      type: 'delegation',
      cid: 'bafy-test',
      tokenBase64: 'AA==',
      header: { algorithm: 'EdDSA', encoding: 'base64url', version: '1', spec: 'dlg' },
      payload: {
        iss: 'did:example:issuer',
        aud: 'did:example:aud',
        sub: null,
        cmd: 'store/add',
        pol: [],
        exp: baseSeconds + 60,
        nbf: baseSeconds - 60,
        meta: {},
        nonce: 'AA==',
      },
      timeline: {
        expLabel: new Date((baseSeconds + 60) * 1000).toISOString(),
        expRelative: 'in 1 minute',
        nbfLabel: new Date((baseSeconds - 60) * 1000).toISOString(),
        nbfRelative: '1 minute ago',
        state: 'valid',
      },
      json: {
        token: 'AA==',
        cid: 'bafy-test',
        envelope: {
          payload: {
            iss: 'did:example:issuer',
            aud: 'did:example:aud',
            sub: null,
            cmd: 'store/add',
            pol: [],
            exp: baseSeconds + 60,
            nbf: baseSeconds - 60,
            nonce: 'AA==',
            meta: {},
          },
          signature: 'AA==',
          alg: 'EdDSA',
          enc: 'base64url',
          spec: 'dlg',
          version: '1',
        },
      },
      id: 'token-0',
      index: 0,
      bytes: new Uint8Array(),
      issues: [],
      signature: { status: 'skipped' },
    } as any

    const scope = effectScope()
    const result = scope.run(() => {
      const selectedToken = computed(() => token)
      const activeTab = ref<'summary' | 'payload' | 'policy' | 'header' | 'raw'>('summary')

      return useSelectedTokenViewModel({
        selectedToken,
        activeTab,
        signatureStatusCopy: {} as any,
      })
    })!

    const p0 = result.timelineProgress.value

    vi.advanceTimersByTime(30_000)

    const p1 = result.timelineProgress.value
    expect(p1).toBeGreaterThan(p0)

    scope.stop()
    vi.useRealTimers()
  })

  it('updates timelineProgress when nbf is missing', () => {
    vi.useFakeTimers()

    const base = new Date('2025-01-01T00:00:00.000Z')
    vi.setSystemTime(base)

    const baseSeconds = Math.floor(base.getTime() / 1000)

    const token = {
      type: 'delegation',
      cid: 'bafy-test',
      tokenBase64: 'AA==',
      header: { algorithm: 'EdDSA', encoding: 'base64url', version: '1', spec: 'dlg' },
      payload: {
        iss: 'did:example:issuer',
        aud: 'did:example:aud',
        sub: null,
        cmd: 'store/add',
        pol: [],
        exp: baseSeconds + 60,
        meta: {},
        nonce: 'AA==',
      },
      timeline: {
        expLabel: new Date((baseSeconds + 60) * 1000).toISOString(),
        expRelative: 'in 1 minute',
        nbfLabel: 'Not set',
        nbfRelative: '—',
        state: 'valid',
      },
      json: {
        token: 'AA==',
        cid: 'bafy-test',
        envelope: {
          payload: {
            iss: 'did:example:issuer',
            aud: 'did:example:aud',
            sub: null,
            cmd: 'store/add',
            pol: [],
            exp: baseSeconds + 60,
            nonce: 'AA==',
            meta: {},
          },
          signature: 'AA==',
          alg: 'EdDSA',
          enc: 'base64url',
          spec: 'dlg',
          version: '1',
        },
      },
      id: 'token-0',
      index: 0,
      bytes: new Uint8Array(),
      issues: [],
      signature: { status: 'skipped' },
    } as any

    const scope = effectScope()
    const result = scope.run(() => {
      const selectedToken = computed(() => token)
      const activeTab = ref<'summary' | 'payload' | 'policy' | 'header' | 'raw'>('summary')

      return useSelectedTokenViewModel({
        selectedToken,
        activeTab,
        signatureStatusCopy: {} as any,
      })
    })!

    const p0 = result.timelineProgress.value
    vi.advanceTimersByTime(30_000)
    const p1 = result.timelineProgress.value

    expect(p0).toBeGreaterThanOrEqual(0)
    expect(p1).toBeGreaterThan(p0)

    scope.stop()
    vi.useRealTimers()
  })
})
