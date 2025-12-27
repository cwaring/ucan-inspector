import { encode as encodeCbor } from 'cborg'
import { gzip } from 'pako'
import { describe, expect, it } from 'vitest'

import { decodeBase64, encodeBase64 } from '../../src/utils/base64'
import { getMockTokens } from '../../src/utils/mockData'
import { looksLikeContainerHeader, parseUcanContainerText } from '../../src/utils/ucanContainer'

import { createSampleDelegation } from './utils'

describe('ucan container parsing', () => {
  it('detects and parses a base64 container payload', async () => {
    const sample = await createSampleDelegation()
    const cbor = encodeCbor({ 'ctn-v1': [sample.delegation.bytes] })
    const encoded = `B${encodeBase64(cbor)}`

    expect(looksLikeContainerHeader(encoded)).toBe(true)

    const parsed = parseUcanContainerText(encoded)
    expect(parsed.header.encoding).toBe('base64')
    expect(parsed.tokens).toHaveLength(1)
    expect(parsed.tokens[0]).toBeInstanceOf(Uint8Array)
    expect(Array.from(parsed.tokens[0]!)).toStrictEqual(Array.from(sample.delegation.bytes))
  })

  it('throws for missing header byte', () => {
    expect(() => parseUcanContainerText('not-container')).toThrowError(/Unknown header byte/)
  })

  it('parses base64url (no padding) containers', () => {
    const token = Uint8Array.from([1, 2, 3, 4])
    const cbor = encodeCbor({ 'ctn-v1': [token] })
    const encoded = `C${encodeBase64(cbor, 'url')}`

    const parsed = parseUcanContainerText(encoded)
    expect(parsed.header.encoding).toBe('base64url')
    expect(parsed.tokens).toHaveLength(1)
    expect(Array.from(parsed.tokens[0]!)).toStrictEqual(Array.from(token))
  })

  it('parses gzip + base64 containers (O)', () => {
    const token = Uint8Array.from([9, 9, 9])
    const cbor = encodeCbor({ 'ctn-v1': [token] })
    const compressed = gzip(cbor)
    const encoded = `O${encodeBase64(compressed, 'standard')}`

    const parsed = parseUcanContainerText(encoded)
    expect(parsed.header.compression).toBe('gzip')
    expect(parsed.tokens).toHaveLength(1)
    expect(Array.from(parsed.tokens[0]!)).toStrictEqual(Array.from(token))
  })

  it('parses gzip + base64url containers (P)', () => {
    const token = Uint8Array.from([7, 8, 9])
    const cbor = encodeCbor({ 'ctn-v1': [token] })
    const compressed = gzip(cbor)
    const encoded = `P${encodeBase64(compressed, 'url')}`

    const parsed = parseUcanContainerText(encoded)
    expect(parsed.header.compression).toBe('gzip')
    expect(parsed.header.encoding).toBe('base64url')
    expect(parsed.tokens).toHaveLength(1)
    expect(Array.from(parsed.tokens[0]!)).toStrictEqual(Array.from(token))
  })

  it('rejects containers with extra map keys (spec MUST)', () => {
    const token = Uint8Array.from([1])
    const cbor = encodeCbor({ 'ctn-v1': [token], 'extra': 1 })
    const encoded = `B${encodeBase64(cbor)}`

    expect(() => parseUcanContainerText(encoded)).toThrowError(/exactly one key/)
  })

  it('rejects containers where tokens are not CBOR byte strings', () => {
    const cbor = encodeCbor({ 'ctn-v1': [[1, 2, 3]] })
    const encoded = `B${encodeBase64(cbor)}`

    expect(() => parseUcanContainerText(encoded)).toThrowError(/CBOR byte string/)
  })

  it('emits diagnostics for duplicates and non-sorted tokens', () => {
    const a = Uint8Array.from([2])
    const b = Uint8Array.from([1])
    const cbor = encodeCbor({ 'ctn-v1': [a, b, a] })
    const encoded = `B${encodeBase64(cbor)}`

    const parsed = parseUcanContainerText(encoded)
    expect(parsed.diagnostics.some(d => d.code === 'duplicate_tokens')).toBe(true)
    expect(parsed.diagnostics.some(d => d.code === 'tokens_not_sorted')).toBe(true)
  })

  it('parses containers containing delegations and invocations', async () => {
    const tokens = await getMockTokens()
    const delegation = decodeBase64(tokens.delegation, 'standard')
    const invocation = decodeBase64(tokens.invocation, 'standard')
    const cbor = encodeCbor({ 'ctn-v1': [delegation, invocation] })
    const encoded = `B${encodeBase64(cbor)}`

    const parsed = parseUcanContainerText(encoded)
    expect(parsed.tokens).toHaveLength(2)
    expect(parsed.tokens[0]).toBeInstanceOf(Uint8Array)
    expect(parsed.tokens[1]).toBeInstanceOf(Uint8Array)
  })
})
