import { encode as encodeCbor } from 'cborg'
import { describe, expect, it } from 'vitest'

import { decodeBase64, encodeBase64 } from '../../src/utils/base64'
import { getMockTokens } from '../../src/utils/mockData'
import { isLikelyContainer, parseContainer } from '../../src/utils/ucanContainer'

import { createSampleDelegation } from './utils'

describe('ucan container parsing', () => {
  it('detects and parses a base64 container payload', async () => {
    const sample = await createSampleDelegation()
    const cbor = encodeCbor({ 'ctn-v1': [sample.delegation.bytes] })
    const encoded = `B${encodeBase64(cbor)}`

    expect(isLikelyContainer(encoded)).toBe(true)

    const parsed = parseContainer(encoded)
    expect(parsed.header.encoding).toBe('base64')
    expect(parsed.tokens).toHaveLength(1)
    expect(parsed.tokens[0]).toBeInstanceOf(Uint8Array)
    expect(Array.from(parsed.tokens[0]!)).toStrictEqual(Array.from(sample.delegation.bytes))
  })

  it('throws for missing header byte', () => {
    expect(() => parseContainer('not-container')).toThrowError(/Unknown header byte/)
  })

  it('parses containers containing delegations and invocations', async () => {
    const tokens = await getMockTokens()
    const delegation = decodeBase64(tokens.delegation, 'standard')
    const invocation = decodeBase64(tokens.invocation, 'standard')
    const cbor = encodeCbor({ 'ctn-v1': [delegation, invocation] })
    const encoded = `B${encodeBase64(cbor)}`

    const parsed = parseContainer(encoded)
    expect(parsed.tokens).toHaveLength(2)
    expect(parsed.tokens[0]).toBeInstanceOf(Uint8Array)
    expect(parsed.tokens[1]).toBeInstanceOf(Uint8Array)
  })
})
