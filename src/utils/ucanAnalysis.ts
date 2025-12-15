import type { DecodedEnvelope, InvocationPayload } from 'iso-ucan/types'

import type { SignatureVerificationResult } from './signatureVerification'
import type { ContainerParseResult } from './ucanContainer'
import { decode as decodeEnvelope } from 'iso-ucan/envelope'
import { cid as computeCid } from 'iso-ucan/utils'

import { encodeBase64 } from './base64'
import { formatTimestamp, prettyJson, relativeTime } from './format'
import { verifyDelegationSignature, verifyInvocationSignature } from './signatureVerification'

export type TokenKind = 'delegation' | 'invocation' | 'unknown'

interface DelegationPayload {
  iss: string
  aud: string
  sub: string | null
  cmd: string
  pol: unknown
  exp: number | null
  nbf?: number
  nonce: Uint8Array
  meta?: Record<string, unknown>
}

export interface DelegationJSON {
  token: string
  cid: string
  envelope: {
    payload: {
      iss: string
      aud: string
      sub: string | null
      cmd: string
      pol: unknown
      exp: number | null
      nbf?: number
      nonce: string
      meta?: Record<string, unknown>
    }
    signature: string
    alg: string
    enc: string
    spec: string
    version: string
  }
}

export interface InvocationJSON {
  cid: string
  envelope: {
    payload: Omit<InvocationPayload, 'nonce' | 'prf' | 'cause'> & {
      nonce: string
      prf: string[]
      cause?: string
    }
    signature: string
    alg: string
    enc: string
    spec: string
    version: string
  }
}

export type SignatureStatus = SignatureVerificationResult['status'] | 'skipped'

export interface SignatureInsight {
  status: SignatureStatus
  reason?: string
}

export interface TokenTimeline {
  expLabel: string
  expRelative: string
  nbfLabel: string
  nbfRelative: string
  state: 'valid' | 'expired' | 'pending' | 'none'
}

export interface DelegationSummary {
  iss: string
  aud: string
  sub: string | null
  cmd: string
  pol: unknown
  exp: number | null
  nbf?: number
  meta?: Record<string, unknown>
  nonce: string
}

export interface InvocationSummary {
  iss: string
  aud?: string
  sub: string
  cmd: string
  args: Record<string, unknown>
  proofs: string[]
  exp: number | null
  nbf?: number
  iat?: number
  meta?: Record<string, unknown>
  cause?: string
  nonce: string
}

export interface DelegationView {
  type: 'delegation'
  tokenBase64: string
  cid: string
  header: {
    algorithm: string
    encoding: string
    version: string
    spec: string
  }
  payload: DelegationSummary
  timeline: TokenTimeline
  json: DelegationJSON
}

export interface InvocationView {
  type: 'invocation'
  tokenBase64: string
  cid: string
  header: {
    algorithm: string
    encoding: string
    version: string
    spec: string
  }
  payload: InvocationSummary
  timeline: TokenTimeline
  json: InvocationJSON
}

export interface UnknownTokenView {
  type: 'unknown'
  reason: string
  tokenBase64: string
}

interface TokenAnalysisMeta {
  id: string
  index: number
  bytes: Uint8Array
  errors: string[]
  signature: SignatureInsight
}

export type TokenAnalysis = (DelegationView | InvocationView | UnknownTokenView) & TokenAnalysisMeta

export interface AnalysisReport {
  source: 'container' | 'raw'
  rawInput: string
  container?: ContainerParseResult
  tokens: TokenAnalysis[]
  createdAt: string
}

export async function analyseBytes(bytes: Uint8Array, index: number): Promise<TokenAnalysis> {
  const base64 = encodeBase64(bytes)
  const id = `token-${index}`
  const failureReasons: string[] = []

  try {
    return await analyseDelegationToken({ bytes, base64, id, index })
  }
  catch (error) {
    failureReasons.push(formatFailure('Delegation', error))
  }

  try {
    return await analyseInvocationToken({ bytes, base64, id, index })
  }
  catch (error) {
    failureReasons.push(formatFailure('Invocation', error))
  }

  const reason = failureReasons[0]?.replace(/^[^:]+:\s*/, '') ?? 'Token could not be decoded'
  const errorStack = failureReasons.length > 0 ? failureReasons : ['Token could not be decoded']

  return {
    id,
    index,
    type: 'unknown',
    reason,
    tokenBase64: base64,
    bytes,
    errors: errorStack,
    signature: {
      status: 'skipped',
      reason,
    },
  }
}

export function createReport(source: 'container' | 'raw', rawInput: string, container: ContainerParseResult | undefined, tokens: TokenAnalysis[]): AnalysisReport {
  return {
    source,
    rawInput,
    container,
    tokens,
    createdAt: new Date().toISOString(),
  }
}

export function stringifyReport(report: AnalysisReport): string {
  return prettyJson(report)
}

function formatFailure(context: string, error: unknown): string {
  const message = (error as Error | undefined)?.message ?? 'Unknown error'
  const stack = (error as Error | undefined)?.stack
  return `${context} decode failed: ${stack ?? message}`
}

async function analyseDelegationToken({ bytes, base64, id, index }: { bytes: Uint8Array, base64: string, id: string, index: number }): Promise<TokenAnalysis> {
  const envelope = decodeEnvelope({ envelope: bytes }) as DecodedEnvelope<'inv' | 'dlg'>
  if (envelope.spec !== 'dlg')
    throw new Error(`Unsupported payload spec: ${envelope.spec}`)

  const payload = envelope.payload as DelegationPayload
  const nonce = payload.nonce
  const signature = await verifyDelegationSignature(bytes)
  const errors: string[] = []
  if (signature.status === 'failed')
    errors.push(signature.reason ?? 'Signature verification failed')

  const timeline = buildTimeline(payload.exp, payload.nbf ?? undefined)
  const cid = (await computeCid(envelope)).toString()

  const json: DelegationJSON = {
    token: base64,
    cid,
    envelope: {
      payload: {
        iss: payload.iss,
        aud: payload.aud,
        sub: payload.sub ?? null,
        cmd: payload.cmd,
        pol: payload.pol,
        exp: payload.exp,
        nbf: payload.nbf,
        nonce: encodeBase64(nonce),
        meta: payload.meta,
      },
      signature: encodeBase64(envelope.signature),
      alg: envelope.alg,
      enc: envelope.enc,
      spec: envelope.spec,
      version: envelope.version,
    },
  }

  return {
    id,
    index,
    type: 'delegation',
    tokenBase64: base64,
    cid,
    header: {
      algorithm: envelope.alg,
      encoding: envelope.enc,
      version: envelope.version,
      spec: envelope.spec,
    },
    payload: {
      iss: payload.iss,
      aud: payload.aud,
      sub: payload.sub ?? null,
      cmd: payload.cmd,
      pol: payload.pol,
      exp: payload.exp,
      nbf: payload.nbf ?? undefined,
      meta: payload.meta,
      nonce: encodeBase64(nonce),
    },
    timeline,
    json,
    bytes,
    errors,
    signature,
  }
}

async function analyseInvocationToken({ bytes, base64, id, index }: { bytes: Uint8Array, base64: string, id: string, index: number }): Promise<TokenAnalysis> {
  const envelope = decodeEnvelope({ envelope: bytes }) as DecodedEnvelope<'inv' | 'dlg'>
  if (envelope.spec !== 'inv')
    throw new Error(`Unsupported payload spec: ${envelope.spec}`)

  const signature = await verifyInvocationSignature(bytes)
  const errors: string[] = []
  if (signature.status === 'failed')
    errors.push(signature.reason ?? 'Signature verification failed')

  const payload = envelope.payload as InvocationPayload
  const { nonce, prf, cause: payloadCause, ...payloadRest } = payload
  const proofs = (prf ?? []).map(proof => proof.toString())
  const cause = payloadCause ? payloadCause.toString() : undefined
  const timeline = buildTimeline(payloadRest.exp ?? null, payloadRest.nbf ?? undefined)
  const invocationCid = (await computeCid(envelope)).toString()

  const json: InvocationJSON = {
    cid: invocationCid,
    envelope: {
      payload: {
        ...payloadRest,
        nonce: encodeBase64(nonce),
        prf: proofs,
        cause,
      },
      signature: encodeBase64(envelope.signature),
      alg: envelope.alg,
      enc: envelope.enc,
      spec: envelope.spec,
      version: envelope.version,
    },
  }

  return {
    id,
    index,
    type: 'invocation',
    tokenBase64: base64,
    cid: invocationCid,
    header: {
      algorithm: envelope.alg,
      encoding: envelope.enc,
      version: envelope.version,
      spec: envelope.spec,
    },
    payload: {
      iss: payloadRest.iss,
      aud: payloadRest.aud,
      sub: payloadRest.sub,
      cmd: payloadRest.cmd,
      args: payloadRest.args ?? {},
      proofs,
      exp: payloadRest.exp ?? null,
      nbf: payloadRest.nbf ?? undefined,
      iat: payloadRest.iat,
      meta: payloadRest.meta,
      cause,
      nonce: encodeBase64(nonce),
    },
    timeline,
    json,
    bytes,
    errors,
    signature,
  }
}

function buildTimeline(exp: number | null, nbf?: number): TokenTimeline {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const expInfo = formatTimestamp(exp)
  const nbfInfo = formatTimestamp(nbf ?? null)

  let state: TokenTimeline['state'] = 'none'
  if (exp != null)
    state = exp < nowSeconds ? 'expired' : 'valid'

  if (nbf != null && nbf > nowSeconds)
    state = 'pending'

  return {
    expLabel: expInfo.label,
    expRelative: relativeTime(expInfo.date),
    nbfLabel: nbfInfo.label,
    nbfRelative: relativeTime(nbfInfo.date),
    state,
  }
}
