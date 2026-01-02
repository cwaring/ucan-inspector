import type { DecodedEnvelope } from 'iso-ucan/types'
import { defaultResolver as didDefaultResolver } from 'iso-did'
import { verifier as ecdsaVerifier } from 'iso-signatures/verifiers/ecdsa.js'
import { verifier as eddsaVerifier } from 'iso-signatures/verifiers/eddsa.js'
import { verifier as eip191Verifier } from 'iso-signatures/verifiers/eip191.js'
import { Resolver as SignatureResolver } from 'iso-signatures/verifiers/resolver.js'
import { verifier as rsaVerifier } from 'iso-signatures/verifiers/rsa.js'
import { decode as decodeEnvelope } from 'iso-ucan/envelope'
import { verifySignature } from 'iso-ucan/utils'

/** High-level signature verification outcomes. */
export type SignatureStatus = 'verified' | 'failed' | 'unsupported'

/** Result of attempting to verify a UCAN signature. */
export interface SignatureVerificationResult {
  status: SignatureStatus
  reason?: string
}

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

function isUnsupportedReason(message: string): boolean {
  return /unsupported/i.test(message) || /No verification method/i.test(message) || /No DID Document/i.test(message) || /fetch is not defined/i.test(message)
}

/**
 * Verify a delegation signature from raw token bytes.
 *
 * @param bytes - Delegation token bytes.
 * @returns Verification result.
 */
export async function verifyDelegationSignature(bytes: Uint8Array): Promise<SignatureVerificationResult> {
  try {
    const envelope = decodeEnvelope({ envelope: bytes }) as DecodedEnvelope<'dlg'>
    if (envelope.spec !== 'dlg')
      return { status: 'unsupported', reason: `Unsupported payload spec: ${envelope.spec}` }

    await verifySignature(envelope, signatureResolver, didResolver)
    return { status: 'verified' }
  }
  catch (error) {
    const message = (error as Error | undefined)?.message ?? 'Unable to verify signature'
    if (isUnsupportedReason(message))
      return { status: 'unsupported', reason: message }

    return { status: 'failed', reason: message }
  }
}

/**
 * Verify an invocation signature from a decoded UCAN envelope.
 *
 * @param envelope - Decoded invocation envelope.
 * @returns Verification result.
 */
export async function verifyInvocationSignature(envelope: DecodedEnvelope<'inv'>): Promise<SignatureVerificationResult> {
  try {
    if (envelope.spec !== 'inv')
      return { status: 'unsupported', reason: `Unsupported payload spec: ${envelope.spec}` }

    await verifySignature(envelope, signatureResolver, didResolver)
    return { status: 'verified' }
  }
  catch (error) {
    const message = (error as Error | undefined)?.message ?? 'Unable to verify signature'
    if (isUnsupportedReason(message))
      return { status: 'unsupported', reason: message }

    return { status: 'failed', reason: message }
  }
}
