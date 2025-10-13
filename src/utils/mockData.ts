import { encode as encodeCbor } from 'cborg'
import { defaultResolver as didDefaultResolver } from 'iso-did'
import { EdDSASigner } from 'iso-signatures/signers/eddsa.js'
import { verifier as ecdsaVerifier } from 'iso-signatures/verifiers/ecdsa.js'
import { verifier as eddsaVerifier } from 'iso-signatures/verifiers/eddsa.js'
import { verifier as eip191Verifier } from 'iso-signatures/verifiers/eip191.js'
import { Resolver as SignatureResolver } from 'iso-signatures/verifiers/resolver.js'
import { verifier as rsaVerifier } from 'iso-signatures/verifiers/rsa.js'
import { Delegation } from 'iso-ucan/delegation'
import { Invocation } from 'iso-ucan/invocation'

import { encodeBase64 } from './base64'

const signatureResolver = new SignatureResolver(
  {
    ...eddsaVerifier,
    ...ecdsaVerifier,
    ...rsaVerifier,
    ...eip191Verifier,
  },
  { cache: true },
)

const didResolver = didDefaultResolver

export interface MockTokens {
  delegation: string
  invocation: string
  container: string
}

export type MockTokenKind = keyof MockTokens

interface MockTokenCacheEntry {
  promise: Promise<MockTokens>
  refreshAt: number
}

const MOCK_TOKEN_REFRESH_INTERVAL_MS = 4 * 60 * 1000

let cachedTokens: MockTokenCacheEntry | null = null

async function buildMockTokens(): Promise<MockTokens> {
  const rootSigner = await EdDSASigner.generate()
  const invokerSigner = await EdDSASigner.generate()
  const serviceSigner = await EdDSASigner.generate()

  const now = Math.floor(Date.now() / 1000)

  const delegation = await Delegation.create({
    iss: rootSigner,
    aud: invokerSigner.did,
    sub: invokerSigner.did,
    cmd: '/debug/echo',
    pol: [],
    exp: now + 600,
    nbf: now - 60,
    meta: {
      note: 'Mock delegation generated locally by UCAN Inspector',
    },
  })

  const nonce = new Uint8Array(16)
  for (let index = 0; index < nonce.length; index += 1)
    nonce[index] = index + 1

  const invocation = await Invocation.create({
    iss: invokerSigner,
    aud: serviceSigner.did,
    sub: invokerSigner.did,
    cmd: '/debug/echo',
    args: {
      message: 'Hello from UCAN Inspector',
      requestId: 'mock-debug',
    },
    prf: [delegation],
    exp: now + 300,
    nbf: now - 30,
    nonce,
    meta: {
      traceId: 'mock-invocation',
    },
    verifierResolver: signatureResolver,
    didResolver,
    isRevoked: async () => false,
  })

  const containerBytes = encodeCbor({ 'ctn-v1': [delegation.bytes, invocation.bytes] })
  const container = `B${encodeBase64(containerBytes)}`

  return {
    delegation: delegation.toString(),
    invocation: encodeBase64(invocation.bytes),
    container,
  }
}

async function ensureMockTokens(): Promise<MockTokens> {
  const now = Date.now()
  if (!cachedTokens || now >= cachedTokens.refreshAt) {
    const promise = buildMockTokens()
    cachedTokens = {
      promise,
      refreshAt: now + MOCK_TOKEN_REFRESH_INTERVAL_MS,
    }
    promise.catch(() => {
      if (cachedTokens?.promise === promise)
        cachedTokens = null
    })
  }
  return cachedTokens.promise
}

export async function getMockTokens(): Promise<MockTokens> {
  return ensureMockTokens()
}

export async function getMockToken<T extends MockTokenKind>(kind: T): Promise<MockTokens[T]> {
  const tokens = await ensureMockTokens()
  return tokens[kind]
}
