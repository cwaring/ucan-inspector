import type { Base64Variant } from './base64'

import { decode as decodeCbor } from 'cborg'
import { ungzip } from 'pako'

import { decodeBase64 } from './base64'

export type ContainerEncoding = 'raw' | 'base64' | 'base64url'
export type ContainerCompression = 'none' | 'gzip'

export interface ContainerHeader {
  raw: number
  encoding: ContainerEncoding
  compression: ContainerCompression
}

export interface ContainerParseResult {
  header: ContainerHeader
  payloadBytes: Uint8Array
  cbor: unknown
  tokens: Uint8Array[]
}

export class ContainerParseError extends Error {
  constructor(message: string, public readonly stage: 'header' | 'decode' | 'decompress' | 'cbor') {
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

export function isLikelyContainer(input: string): boolean {
  if (!input)
    return false
  const headerChar = input.charCodeAt(0)
  return headerChar in headerTable
}

export function parseContainer(input: string): ContainerParseResult {
  if (!input)
    throw new ContainerParseError('Input is empty', 'header')

  const headerChar = input.charCodeAt(0)
  const headerInfo = headerTable[headerChar]
  if (!headerInfo)
    throw new ContainerParseError(`Unknown header byte: 0x${headerChar.toString(16)}`, 'header')

  const dataPart = input.slice(1).trim()
  let bytes: Uint8Array

  if (headerInfo.encoding === 'raw') {
    bytes = stringToBytes(dataPart)
  }
  else {
    const variant = headerInfo.variant ?? 'standard'
    bytes = decodeBase64(dataPart, variant)
  }

  let payloadBytes = bytes
  if (headerInfo.compression === 'gzip') {
    try {
      payloadBytes = ungzip(bytes)
    }
    catch (error) {
      throw new ContainerParseError(`Failed to decompress gzip payload: ${(error as Error).message}`, 'decompress')
    }
  }

  let cbor: unknown
  try {
    cbor = decodeCbor(payloadBytes)
  }
  catch (error) {
    throw new ContainerParseError(`Failed to decode CBOR payload: ${(error as Error).message}`, 'cbor')
  }

  const map = cbor as Record<string, unknown>
  const tokensRaw = Array.isArray(map?.['ctn-v1']) ? map['ctn-v1'] : undefined
  if (!tokensRaw)
    throw new ContainerParseError('CBOR payload does not include "ctn-v1" array', 'cbor')

  const tokens = (tokensRaw as unknown[]).map(entry => ensureUint8Array(entry))

  return {
    header: {
      raw: headerChar,
      encoding: headerInfo.encoding,
      compression: headerInfo.compression,
    },
    payloadBytes,
    cbor,
    tokens,
  }
}

function stringToBytes(value: string): Uint8Array {
  const encoder = new TextEncoder()
  return encoder.encode(value)
}

function ensureUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array)
    return value
  if (value instanceof ArrayBuffer)
    return new Uint8Array(value)
  if (ArrayBuffer.isView(value))
    return new Uint8Array((value as ArrayBufferView).buffer.slice((value as ArrayBufferView).byteOffset, (value as ArrayBufferView).byteOffset + (value as ArrayBufferView).byteLength))
  if (Array.isArray(value))
    return Uint8Array.from(value)
  throw new ContainerParseError('Container entry is not binary data', 'decode')
}
