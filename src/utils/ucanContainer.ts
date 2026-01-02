import type { Base64Variant } from '@/utils/base64'

import { decode as decodeCbor } from 'cborg'
import { ungzip } from 'pako'

import { decodeBase64, encodeBase64 } from '@/utils/base64'

/** Supported payload encodings for UCAN container bytes. */
export type ContainerEncoding = 'raw' | 'base64' | 'base64url'
/** Supported compression modes for UCAN container bytes. */
export type ContainerCompression = 'none' | 'gzip'
/** Severity levels for container diagnostics. */
export type ContainerDiagnosticLevel = 'notice' | 'warn'

/**
 * A non-fatal diagnostic produced while parsing a container.
 *
 * @remarks
 * Diagnostics are intended for UI surfacing and debugging, not for flow control.
 */
export interface ContainerDiagnostic {
  level: ContainerDiagnosticLevel
  code: string
  message: string
}

/**
 * Parsed container header details.
 *
 * @remarks
 * `raw` is the first byte/character (ASCII) that encodes encoding + compression.
 */
export interface ContainerHeader {
  raw: number
  encoding: ContainerEncoding
  compression: ContainerCompression
}

/**
 * Result of parsing a UCAN container.
 *
 * @remarks
 * `tokens` is the extracted list of token byte arrays (each representing one UCAN).
 */
export interface ContainerParseResult {
  header: ContainerHeader
  payloadBytes: Uint8Array
  cbor: unknown
  tokens: Uint8Array[]
  diagnostics: ContainerDiagnostic[]
}

/**
 * Error thrown when a UCAN container cannot be parsed.
 *
 * @remarks
 * Includes a parsing stage and a stable error code for UI/diagnostics.
 */
export class ContainerParseError extends Error {
  constructor(
    message: string,
    public readonly stage: 'header' | 'decode' | 'decompress' | 'cbor',
    public readonly code: string = 'container_parse_error',
  ) {
    super(message)
    this.name = 'ContainerParseError'
  }
}

const headerTable: Record<number, { encoding: ContainerEncoding, compression: ContainerCompression, variant?: Base64Variant }> = {
  0x40: { encoding: 'raw', compression: 'none' }, // @
  0x42: { encoding: 'base64', compression: 'none', variant: 'standard' }, // B
  0x43: { encoding: 'base64url', compression: 'none', variant: 'url' }, // C
  0x4D: { encoding: 'raw', compression: 'gzip' }, // M
  0x4F: { encoding: 'base64', compression: 'gzip', variant: 'standard' }, // O
  0x50: { encoding: 'base64url', compression: 'gzip', variant: 'url' }, // P
}

const textHeaderTable: Record<number, { encoding: Exclude<ContainerEncoding, 'raw'>, compression: ContainerCompression, variant: Base64Variant }> = {
  0x42: { encoding: 'base64', compression: 'none', variant: 'standard' }, // B
  0x43: { encoding: 'base64url', compression: 'none', variant: 'url' }, // C
  0x4F: { encoding: 'base64', compression: 'gzip', variant: 'standard' }, // O
  0x50: { encoding: 'base64url', compression: 'gzip', variant: 'url' }, // P
}

/**
 * Heuristic check for whether a string begins with a known container header.
 *
 * @param input - Raw user input.
 * @returns True when the first character matches a supported container header.
 */
export function looksLikeContainerHeader(input: string): boolean {
  if (!input)
    return false
  return input.charCodeAt(0) in headerTable
}

/**
 * Parse a UCAN container provided as text.
 *
 * @param input - Input string beginning with a container header character.
 * @returns Parsed container details and extracted token byte arrays.
 * @throws {@link ContainerParseError} When parsing fails.
 */
export function parseUcanContainerText(input: string): ContainerParseResult {
  const value = input.trim()
  if (!value)
    throw new ContainerParseError('Input is empty', 'header', 'empty_input')

  const diagnostics: ContainerDiagnostic[] = []
  const headerChar = value.charCodeAt(0)
  const headerInfo = textHeaderTable[headerChar]
  if (!headerInfo) {
    if (headerChar in headerTable) {
      const headerAscii = String.fromCharCode(headerChar)
      throw new ContainerParseError(
        `Header '${headerAscii}' indicates a raw-bytes container. Text input only supports B/C/O/P containers.`,
        'header',
        'raw_bytes_header_in_text',
      )
    }
    throw new ContainerParseError(`Unknown header byte: 0x${headerChar.toString(16)}`, 'header', 'unknown_header')
  }

  const encodedPayload = value.slice(1).trim()
  if (!encodedPayload)
    throw new ContainerParseError('Container payload is empty', 'decode', 'empty_payload')

  const normalized = normalizeEncodedPayload(encodedPayload, headerInfo.variant, diagnostics)
  const decodedBytes = decodeBase64WithContext(normalized, headerInfo.variant)
  return parseDecodedBytes({
    headerRaw: headerChar,
    headerEncoding: headerInfo.encoding,
    headerCompression: headerInfo.compression,
    encodedBytes: decodedBytes,
    diagnostics,
  })
}

/**
 * Parse a UCAN container provided as bytes.
 *
 * @param input - Raw container bytes.
 * @returns Parsed container details and extracted token byte arrays.
 * @throws {@link ContainerParseError} When parsing fails.
 */
export function parseUcanContainerBytes(input: Uint8Array): ContainerParseResult {
  if (!input.length)
    throw new ContainerParseError('Input is empty', 'header', 'empty_input')

  const diagnostics: ContainerDiagnostic[] = []
  const headerByte = input[0]!
  const headerInfo = headerTable[headerByte]
  if (!headerInfo)
    throw new ContainerParseError(`Unknown header byte: 0x${headerByte.toString(16)}`, 'header', 'unknown_header')

  const remainder = input.slice(1)
  let decodedBytes: Uint8Array

  if (headerInfo.encoding === 'raw') {
    decodedBytes = remainder
  }
  else {
    const encoded = new TextDecoder().decode(remainder).trim()
    const normalized = normalizeEncodedPayload(encoded, headerInfo.variant ?? 'standard', diagnostics)
    decodedBytes = decodeBase64WithContext(normalized, headerInfo.variant ?? 'standard')
  }

  return parseDecodedBytes({
    headerRaw: headerByte,
    headerEncoding: headerInfo.encoding,
    headerCompression: headerInfo.compression,
    encodedBytes: decodedBytes,
    diagnostics,
  })
}

function parseDecodedBytes({
  headerRaw,
  headerEncoding,
  headerCompression,
  encodedBytes,
  diagnostics,
}: {
  headerRaw: number
  headerEncoding: ContainerEncoding
  headerCompression: ContainerCompression
  encodedBytes: Uint8Array
  diagnostics: ContainerDiagnostic[]
}): ContainerParseResult {
  let payloadBytes = encodedBytes
  if (headerCompression === 'gzip') {
    try {
      payloadBytes = ungzip(encodedBytes)
    }
    catch (error) {
      throw new ContainerParseError(`Failed to decompress gzip payload: ${(error as Error).message}`, 'decompress', 'gzip_decompress_failed')
    }
  }

  let cbor: unknown
  try {
    cbor = decodeCbor(payloadBytes)
  }
  catch (error) {
    throw new ContainerParseError(`Failed to decode CBOR payload: ${(error as Error).message}`, 'cbor', 'cbor_decode_failed')
  }

  const tokens = extractTokensStrict(cbor, diagnostics)
  diagnoseCanonicality(tokens, diagnostics)

  // Spec: ordering of tokens MUST NOT matter, but canonical containers MUST be
  // bytewise sorted for deterministic encoding. For deterministic UI/export
  // behavior we always expose tokens in canonical bytewise order.
  const sortedTokens = tokens.length > 1 ? [...tokens].sort(compareBytes) : tokens

  return {
    header: {
      raw: headerRaw,
      encoding: headerEncoding,
      compression: headerCompression,
    },
    payloadBytes,
    cbor,
    tokens: sortedTokens,
    diagnostics,
  }
}

function decodeBase64WithContext(input: string, variant: Base64Variant): Uint8Array {
  try {
    return decodeBase64(input, variant)
  }
  catch (error) {
    throw new ContainerParseError(
      `Failed to decode ${variant === 'standard' ? 'base64' : 'base64url'} payload: ${(error as Error).message}`,
      'decode',
      'base64_decode_failed',
    )
  }
}

function normalizeEncodedPayload(input: string, variant: Base64Variant, diagnostics: ContainerDiagnostic[]): string {
  const value = input.replaceAll(/\s+/g, '')
  if (variant === 'url') {
    if (value.includes('=')) {
      diagnostics.push({
        level: 'notice',
        code: 'base64url_padding_present',
        message: 'Header indicates base64url (no padding) but payload contains padding. Padding will be stripped for decoding.',
      })
    }
    return value.replaceAll('=', '')
  }

  // standard base64 (padded)
  if (value.length % 4 !== 0) {
    diagnostics.push({
      level: 'notice',
      code: 'base64_padding_missing',
      message: 'Header indicates padded base64 but payload length is not a multiple of 4. Padding will be added for decoding.',
    })
  }
  const padLength = (4 - (value.length % 4)) % 4
  return `${value}${'='.repeat(padLength)}`
}

function extractTokensStrict(cbor: unknown, diagnostics: ContainerDiagnostic[]): Uint8Array[] {
  const { keys, get } = asKeyedMap(cbor)
  if (!keys)
    throw new ContainerParseError('CBOR payload must be a map/object', 'cbor', 'cbor_not_map')

  if (keys.length !== 1 || keys[0] !== 'ctn-v1') {
    throw new ContainerParseError(
      `CBOR payload must be a map with exactly one key "ctn-v1" (found: ${keys.length ? keys.join(', ') : 'none'})`,
      'cbor',
      'invalid_container_map_keys',
    )
  }

  const tokensRaw = get('ctn-v1')
  if (!Array.isArray(tokensRaw))
    throw new ContainerParseError('CBOR payload "ctn-v1" must be an array', 'cbor', 'ctn_v1_not_array')

  if (tokensRaw.length === 0) {
    diagnostics.push({
      level: 'notice',
      code: 'empty_container',
      message: 'Container contains an empty "ctn-v1" array.',
    })
  }

  return tokensRaw.map((entry, index) => {
    if (!(entry instanceof Uint8Array)) {
      throw new ContainerParseError(
        `Container token at index ${index} must be a CBOR byte string (Uint8Array)`,
        'cbor',
        'token_not_byte_string',
      )
    }
    return entry
  })
}

function asKeyedMap(value: unknown): { keys: string[] | null, get: (key: string) => unknown } {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (value instanceof Map) {
      const keys = Array.from(value.keys()).map(String)
      return {
        keys,
        get: (key: string) => value.get(key),
      }
    }

    const record = value as Record<string, unknown>
    return {
      keys: Object.keys(record),
      get: (key: string) => record[key],
    }
  }

  return { keys: null, get: () => undefined }
}

function diagnoseCanonicality(tokens: Uint8Array[], diagnostics: ContainerDiagnostic[]): void {
  if (tokens.length <= 1)
    return

  const tokenKeys = tokens.map(token => encodeBase64(token, 'url'))
  const seen = new Map<string, number>()
  for (const key of tokenKeys)
    seen.set(key, (seen.get(key) ?? 0) + 1)

  const duplicateCount = Array.from(seen.values()).filter(count => count > 1).length
  if (duplicateCount > 0) {
    diagnostics.push({
      level: 'warn',
      code: 'duplicate_tokens',
      message: `Container contains ${duplicateCount} duplicated token${duplicateCount === 1 ? '' : 's'} (tokens SHOULD NOT be duplicated).`,
    })
  }

  let outOfOrder = false
  for (let i = 1; i < tokens.length; i++) {
    if (compareBytes(tokens[i - 1]!, tokens[i]!) > 0) {
      outOfOrder = true
      break
    }
  }

  if (outOfOrder) {
    diagnostics.push({
      level: 'warn',
      code: 'tokens_not_sorted',
      message: 'Container tokens are not bytewise-sorted. Canonical containers MUST be bytewise sorted for deterministic encoding.',
    })
  }
}

function compareBytes(left: Uint8Array, right: Uint8Array): number {
  const minLength = Math.min(left.length, right.length)
  for (let i = 0; i < minLength; i++) {
    const diff = left[i]! - right[i]!
    if (diff !== 0)
      return diff
  }
  return left.length - right.length
}
