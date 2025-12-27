import type { DecodedEnvelope, InvocationPayload } from 'iso-ucan/types'

import type { SignatureVerificationResult } from './signatureVerification'
import type { ContainerParseResult } from './ucanContainer'
import { decode as decodeEnvelope } from 'iso-ucan/envelope'
import { cid as computeCid } from 'iso-ucan/utils'

import { encodeBase64 } from './base64'
import { formatTimestamp, prettyJson, relativeTime, toPrettyDagJsonString } from './format'
import { verifyDelegationSignature, verifyInvocationSignature } from './signatureVerification'

/** High-level token classification used by the inspector UI. */
export type TokenKind = 'delegation' | 'invocation' | 'unknown'

/** Severity level for analysis issues. */
export type IssueLevel = 'notice' | 'warn' | 'error'

/**
 * An issue discovered during decoding / analysis.
 *
 * @remarks
 * Issues are intended for UI presentation and diagnostics.
 */
export interface Issue {
  level: IssueLevel
  code: string
  message: string
}

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

/** JSON view of a delegation token suitable for export. */
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

/** JSON view of an invocation token suitable for export. */
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

/**
 * Signature verification status.
 *
 * @remarks
 * Includes `skipped` for cases where verification isn't attempted.
 */
export type SignatureStatus = SignatureVerificationResult['status'] | 'skipped'

/** Signature verification insight attached to a token analysis. */
export interface SignatureInsight {
  status: SignatureStatus
  reason?: string
}

/**
 * Token freshness timeline derived from exp/nbf.
 *
 * @remarks
 * Used for overview UI and status chips.
 */
export interface TokenTimeline {
  expLabel: string
  expRelative: string
  nbfLabel: string
  nbfRelative: string
  state: 'valid' | 'expired' | 'pending' | 'none'
}

/** Minimal, UI-friendly view of a delegation payload. */
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

/** Minimal, UI-friendly view of an invocation payload. */
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

/**
 * Fully decoded delegation token view.
 *
 * @remarks
 * Includes both a presentation-friendly payload and an export-friendly `json` shape.
 */
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

/**
 * Fully decoded invocation token view.
 *
 * @remarks
 * Includes both a presentation-friendly payload and an export-friendly `json` shape.
 */
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

/**
 * Fallback view for inputs that cannot be decoded as a supported UCAN envelope.
 */
export interface UnknownTokenView {
  type: 'unknown'
  reason: string
  tokenBase64: string
}

interface TokenAnalysisMeta {
  id: string
  index: number
  bytes: Uint8Array
  issues: Issue[]
  signature: SignatureInsight
}

/**
 * Union of all token analysis variants returned by {@link analyseBytes}.
 *
 * @remarks
 * Every variant includes shared metadata like `id`, `index`, `bytes`, `issues`, and `signature`.
 */
export type TokenAnalysis = (DelegationView | InvocationView | UnknownTokenView) & TokenAnalysisMeta

/**
 * Full analysis output for an inspection run.
 *
 * @remarks
 * This is the primary payload emitted by the inspector and exported as JSON.
 */
export interface AnalysisReport {
  source: 'container' | 'raw'
  rawInput: string
  container?: ContainerParseResult
  tokens: TokenAnalysis[]
  issues: Issue[]
  createdAt: string
}

/**
 * Analyse a single UCAN token represented as bytes.
 *
 * @param bytes - Token bytes.
 * @param index - Token index within the input.
 * @returns Token analysis view.
 */
export async function analyseBytes(bytes: Uint8Array, index: number): Promise<TokenAnalysis> {
  const base64 = encodeBase64(bytes)
  const id = `token-${index}`

  const envelopeResult = decodeEnvelopeSafe(bytes)
  if (!envelopeResult.ok) {
    const reason = envelopeResult.issues[0]?.message ?? 'Token could not be decoded'
    return {
      id,
      index,
      type: 'unknown',
      reason,
      tokenBase64: base64,
      bytes,
      issues: envelopeResult.issues,
      signature: {
        status: 'skipped',
        reason,
      },
    }
  }

  const { envelope } = envelopeResult
  if (envelope.spec === 'dlg') {
    return await analyseDelegationEnvelope({
      envelope: envelope as DecodedEnvelope<'dlg'>,
      bytes,
      base64,
      id,
      index,
      initialIssues: envelopeResult.issues,
    })
  }
  if (envelope.spec === 'inv') {
    return await analyseInvocationEnvelope({
      envelope: envelope as DecodedEnvelope<'inv'>,
      bytes,
      base64,
      id,
      index,
      initialIssues: envelopeResult.issues,
    })
  }

  const reason = `Unsupported payload spec: ${envelope.spec}`
  return {
    id,
    index,
    type: 'unknown',
    reason,
    tokenBase64: base64,
    bytes,
    issues: [
      ...envelopeResult.issues,
      { level: 'warn', code: 'unsupported_payload_spec', message: reason },
    ],
    signature: {
      status: 'skipped',
      reason,
    },
  }
}

/**
 * Create an {@link AnalysisReport} for a set of analyzed tokens.
 *
 * @param source - Whether input was parsed as a container or a single raw token.
 * @param rawInput - Raw user input.
 * @param container - Container details when `source === 'container'`.
 * @param tokens - Analysed tokens.
 * @param issues - Report-level issues.
 * @returns New report.
 */
export function createReport(
  source: 'container' | 'raw',
  rawInput: string,
  container: ContainerParseResult | undefined,
  tokens: TokenAnalysis[],
  issues: Issue[] = [],
): AnalysisReport {
  return {
    source,
    rawInput,
    container,
    tokens,
    issues,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Serialize an {@link AnalysisReport} as formatted JSON.
 *
 * @param report - Report to serialize.
 * @returns JSON string.
 */
export function stringifyReport(report: AnalysisReport): string {
  return stringifyReportWithFormat(report)
}

/** Supported report serialization formats. */
export type ReportStringifyFormat = 'dag-json' | 'json'

/** Options for {@link stringifyReportWithFormat}. */
export interface StringifyReportOptions {
  /** Output format. Defaults to `json`. */
  format?: ReportStringifyFormat
  /**
   * Include raw byte arrays / CBOR blobs in JSON output.
   *
   * @remarks
   * The report already includes shareable string forms like `tokenBase64` and CID strings.
   * Raw bytes are redundant for most use-cases and are intentionally omitted by default.
   */
  includeRawBytes?: boolean
}

/**
 * Serialize an {@link AnalysisReport} in the requested format.
 *
 * @param report - Report to serialize.
 * @param options - Serialization options.
 * @param options.format - Output format (defaults to `json`).
 * @returns Formatted string suitable for copy/download.
 */
export function stringifyReportWithFormat(report: AnalysisReport, options: StringifyReportOptions = {}): string {
  const format = options.format ?? 'json'

  const exportValue = options.includeRawBytes
    ? report
    : stripReportBinaryFields(report)

  if (format === 'dag-json')
    return toPrettyDagJsonString(exportValue)

  if (options.includeRawBytes)
    return prettyJson(exportValue)

  return JSON.stringify(exportValue, reportJsonReplacer, 2)
}

function stripReportBinaryFields(value: unknown): unknown {
  if (value == null)
    return value

  if (Array.isArray(value))
    return value.map(stripReportBinaryFields)

  if (value instanceof Uint8Array)
    return value

  if (typeof value !== 'object')
    return value

  const record = value as Record<string, unknown>
  const result: Record<string, unknown> = {}

  for (const [key, inner] of Object.entries(record)) {
    // Remove noisy binary fields from exports.
    // Token bytes are already represented as `tokenBase64`.
    if (key === 'bytes' || key === 'payloadBytes' || key === 'cbor')
      continue

    // Container parses include `tokens: Uint8Array[]` (raw token bytes).
    // Keep the inspector's analyzed `report.tokens` (objects), but drop the raw byte list.
    if (key === 'tokens' && Array.isArray(inner) && inner.every(v => v instanceof Uint8Array))
      continue

    result[key] = stripReportBinaryFields(inner)
  }

  return result
}

function reportJsonReplacer(key: string, value: unknown): unknown {
  // Remove noisy binary fields from plain JSON exports.
  // Token bytes are already represented as `tokenBase64`.
  if (key === 'bytes' || key === 'payloadBytes' || key === 'cbor')
    return undefined

  // Container parses include `tokens: Uint8Array[]` (raw token bytes).
  // Keep the inspector's analyzed `report.tokens` (objects), but drop the raw byte list.
  if (key === 'tokens' && Array.isArray(value) && value.every(v => v instanceof Uint8Array))
    return undefined

  // Prevent Uint8Array values from exploding into numeric-key objects.
  // If new binary fields are added in the future, they should be explicitly mapped.
  if (value instanceof Uint8Array)
    return encodeBase64(value)

  return value
}

async function analyseDelegationEnvelope({
  envelope,
  bytes,
  base64,
  id,
  index,
  initialIssues,
}: {
  envelope: DecodedEnvelope<'dlg'>
  bytes: Uint8Array
  base64: string
  id: string
  index: number
  initialIssues: Issue[]
}): Promise<TokenAnalysis> {
  const issues: Issue[] = [...initialIssues]
  const payload = envelope.payload as DelegationPayload
  const nonce = payload.nonce

  const signature = await verifyDelegationSignature(bytes)
  if (signature.status === 'failed') {
    issues.push({
      level: 'warn',
      code: 'signature_invalid',
      message: signature.reason ?? 'Signature verification failed',
    })
  }

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
    issues,
    signature,
  }
}

async function analyseInvocationEnvelope({
  envelope,
  bytes,
  base64,
  id,
  index,
  initialIssues,
}: {
  envelope: DecodedEnvelope<'inv'>
  bytes: Uint8Array
  base64: string
  id: string
  index: number
  initialIssues: Issue[]
}): Promise<TokenAnalysis> {
  const issues: Issue[] = [...initialIssues]
  const signature = await verifyInvocationSignature(envelope)
  if (signature.status === 'failed') {
    issues.push({
      level: 'warn',
      code: 'signature_invalid',
      message: signature.reason ?? 'Signature verification failed',
    })
  }

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
    issues,
    signature,
  }
}

function decodeEnvelopeSafe(bytes: Uint8Array):
  | { ok: true, envelope: DecodedEnvelope<'dlg' | 'inv'>, issues: Issue[] }
  | { ok: false, issues: Issue[] } {
  try {
    const envelope = decodeEnvelope({ envelope: bytes }) as DecodedEnvelope<'dlg' | 'inv'>
    const issues: Issue[] = []

    if (!envelope.version || !envelope.spec) {
      issues.push({
        level: 'notice',
        code: 'missing_header_fields',
        message: 'Envelope header is missing version/spec fields.',
      })
    }

    return { ok: true, envelope, issues }
  }
  catch (error) {
    const message = (error as Error | undefined)?.message ?? 'Unable to decode envelope'
    return {
      ok: false,
      issues: [{ level: 'warn', code: 'envelope_decode_failed', message }],
    }
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
