import { encode as encodeEnvelope, getSignaturePayload } from 'iso-ucan/envelope'

import { describe, expect, it, vi } from 'vitest'

import { decodeBase64, encodeBase64 } from '../../src/utils/base64'
import { getMockTokens } from '../../src/utils/mockData'
import { analyseBytes, buildTokenExportModel, createReport, stringifyExportValue, stringifyReport, stringifyReportWithFormat } from '../../src/utils/ucanAnalysis'
import { createSampleDelegation } from './utils'

describe('ucan analysis', () => {
  it('applies delegation payload key order deterministically', () => {
    const payload = {
      aud: 'did:example:aud',
      cmd: '/example/read',
      exp: 123,
      iss: 'did:example:iss',
      nonce: 'AAEC',
      pol: [],
      sub: 'did:example:sub',
    }

    const direct = stringifyExportValue(payload, 'json')
    const keys = direct
      .split('\n')
      .map(line => line.match(/^\s+"([^"]+)":/))
      .filter(Boolean)
      .map(match => match![1])

    expect(keys).toEqual(['iss', 'aud', 'sub', 'cmd', 'pol', 'nonce', 'exp'])
  })
  it('decodes a delegation token', async () => {
    const sample = await createSampleDelegation()
    const analysed = await analyseBytes(sample.delegation.bytes, 0)

    expect(analysed.type).toBe('delegation')
    if (analysed.type !== 'delegation')
      throw new Error('expected delegation analysis')

    expect(analysed.payload.iss).toBe(sample.issuer)
    expect(analysed.payload.aud).toBe(sample.audience)
    expect(analysed.cid).toBe(sample.delegation.cid.toString())
    expect(['valid', 'expired', 'pending', 'none']).toContain(analysed.timeline.state)
    expect(analysed.signature.status).toBe('verified')
  })

  it('returns unknown type for invalid bytes', async () => {
    const analysed = await analyseBytes(new Uint8Array([1, 2, 3, 4]), 0)
    expect(analysed.type).toBe('unknown')
    expect(analysed.issues.length).toBeGreaterThan(0)
    expect(analysed.issues.some(issue => issue.code === 'envelope_decode_failed')).toBe(true)
    expect(analysed.signature.status).toBe('skipped')
  })

  it('still decodes delegations after they expire', async () => {
    const sample = await createSampleDelegation()
    const exp = sample.delegation.exp ?? 0
    const mockedNow = vi.spyOn(Date, 'now').mockReturnValue((exp + 5) * 1000)

    try {
      const analysed = await analyseBytes(sample.delegation.bytes, 0)

      expect(analysed.type).toBe('delegation')
      if (analysed.type !== 'delegation')
        throw new Error('expected delegation analysis')

      expect(analysed.timeline.state).toBe('expired')
    }
    finally {
      mockedNow.mockRestore()
    }
  })

  it('decodes an invocation token', async () => {
    const tokens = await getMockTokens()
    const bytes = decodeBase64(tokens.invocation, 'standard')
    const analysed = await analyseBytes(bytes, 0)

    expect(analysed.type).toBe('invocation')
    if (analysed.type !== 'invocation')
      throw new Error('expected invocation analysis')

    expect(analysed.payload.proofs.length).toBeGreaterThan(0)
    expect(['verified', 'unsupported']).toContain(analysed.signature.status)
  })

  it('flags invalid signatures while preserving payload insights', async () => {
    const sample = await createSampleDelegation()
    const mutatedSignature = new Uint8Array(sample.delegation.envelope.signature)
    mutatedSignature[0] ^= 0xFF

    const signaturePayload = getSignaturePayload({
      spec: sample.delegation.envelope.spec,
      version: sample.delegation.envelope.version,
      signatureType: sample.delegation.envelope.alg,
      payload: sample.delegation.envelope.payload,
    })

    const tamperedBytes = new Uint8Array(encodeEnvelope({
      signature: mutatedSignature,
      signaturePayload,
    }))

    const analysed = await analyseBytes(tamperedBytes, 0)
    expect(analysed.type).toBe('delegation')
    if (analysed.type !== 'delegation')
      throw new Error('expected delegation analysis')

    expect(analysed.signature.status).toBe('failed')
    expect(analysed.signature.reason).toBeTruthy()
    expect(analysed.issues.length).toBeGreaterThan(0)
    expect(analysed.issues.some(issue => issue.code === 'signature_invalid')).toBe(true)
  })

  it('omits raw byte arrays in default report JSON export', async () => {
    const sample = await createSampleDelegation()
    const analysed = await analyseBytes(sample.delegation.bytes, 0)

    const report = createReport('raw', sample.delegation.toString(), undefined, [analysed], [])
    const serialized = stringifyReport(report)

    expect(serialized).not.toContain('"bytes"')
    expect(serialized).not.toContain('"payloadBytes"')
    expect(serialized).not.toContain('"cbor"')

    // The analyzed token list should be present in default exports.
    expect(serialized).toContain('"tokens"')

    const dagJson = stringifyReportWithFormat(report, { format: 'dag-json' })
    expect(dagJson).not.toContain('"payloadBytes"')
    expect(dagJson).not.toContain('"cbor"')
    expect(dagJson).toContain('"tokens"')

    if (analysed.type === 'unknown')
      throw new Error('expected delegation analysis')

    const expectedDagJsonNonce = encodeBase64(decodeBase64(analysed.payload.nonce, 'standard'), 'standard').replace(/=+$/, '')
    expect(dagJson).toMatch(/"nonce"\s*:\s*\{/)
    expect(dagJson).toContain(`"bytes": "${expectedDagJsonNonce}"`)

    // Still allows explicit raw-bytes export when requested.
    const withBytes = stringifyReportWithFormat(report, { format: 'json', includeRawBytes: true })
    expect(withBytes).toContain('"bytes"')
  })

  it('serializes delegation payload fields in spec order', async () => {
    const sample = await createSampleDelegation()
    const analysed = await analyseBytes(sample.delegation.bytes, 0)
    if (analysed.type !== 'delegation')
      throw new Error('expected delegation analysis')

    const exportToken = buildTokenExportModel(analysed, { includeRawBytes: false })
    const payload = (exportToken as any)?.json?.envelope?.payload
    expect(payload).toBeTruthy()

    const extractKeys = (serialized: string): string[] => {
      return Object.keys(JSON.parse(serialized) as Record<string, unknown>)
    }

    // Sample delegations omit optional `meta` and `nbf`.
    expect(extractKeys(stringifyExportValue(payload, 'json'))).toEqual(['iss', 'aud', 'sub', 'cmd', 'pol', 'nonce', 'exp'])
    expect(extractKeys(stringifyExportValue(payload, 'dag-json'))).toEqual(['iss', 'aud', 'sub', 'cmd', 'pol', 'nonce', 'exp'])
  })
})
