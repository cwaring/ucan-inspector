import { defaultResolver as didDefaultResolver } from 'iso-did'
import { verifier as ecdsaVerifier } from 'iso-signatures/verifiers/ecdsa.js'
import { verifier as eddsaVerifier } from 'iso-signatures/verifiers/eddsa.js'
import { verifier as eip191Verifier } from 'iso-signatures/verifiers/eip191.js'
import { Resolver as SignatureResolver } from 'iso-signatures/verifiers/resolver.js'
import { verifier as rsaVerifier } from 'iso-signatures/verifiers/rsa.js'
import { Delegation } from 'iso-ucan/delegation'
import { decode as decodeEnvelope } from 'iso-ucan/envelope'
import { verifySignature } from 'iso-ucan/utils'

export type SignatureStatus = 'verified' | 'failed' | 'unsupported'

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

export async function verifyDelegationSignature(bytes: Uint8Array): Promise<SignatureVerificationResult> {
  try {
    await Delegation.from({
      bytes,
      verifierResolver: signatureResolver,
      didResolver,
      isRevoked: async () => false,
    })
    return { status: 'verified' }
  }
  catch (error) {
    const message = (error as Error | undefined)?.message ?? 'Unable to verify signature'
    if (isUnsupportedReason(message))
      return { status: 'unsupported', reason: message }

    return { status: 'failed', reason: message }
  }
}

export async function verifyInvocationSignature(bytes: Uint8Array): Promise<SignatureVerificationResult> {
  try {
    const envelope = decodeEnvelope({ envelope: bytes })
    if (envelope.spec !== 'inv')
      return { status: 'unsupported', reason: `Unsupported payload spec: ${envelope.spec}` }

    const verified = await verifySignature(envelope, signatureResolver, didResolver)
    if (!verified)
      return { status: 'failed', reason: 'Signature verification failed' }

    return { status: 'verified' }
  }
  catch (error) {
    const message = (error as Error | undefined)?.message ?? 'Unable to verify signature'
    if (isUnsupportedReason(message))
      return { status: 'unsupported', reason: message }

    return { status: 'failed', reason: message }
  }
}
