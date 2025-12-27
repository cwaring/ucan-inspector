import { encode as encodeDagJson } from '@ipld/dag-json'

import { encodeBase64 } from './base64'

/** Output format for JSON-like inspector views. */
export type JsonFormat = 'json' | 'dag-json'

/**
 * Encode bytes into base64 (standard).
 *
 * @param bytes - Bytes to encode.
 * @returns Base64 string.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  return encodeBase64(bytes)
}

/**
 * JSON stringify helper with stable 2-space indentation.
 *
 * @param value - Any JSON-serializable value.
 * @returns Pretty-printed JSON.
 */
export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

const dagJsonDecoder = new TextDecoder()

/**
 * Encode a value as DAG-JSON.
 *
 * @param value - Value to encode.
 * @returns Encoded string.
 *
 * @remarks
 * Falls back to {@link prettyJson} if DAG-JSON encoding fails.
 */
export function toDagJsonString(value: unknown): string {
  try {
    return dagJsonDecoder.decode(encodeDagJson(value as unknown))
  }
  catch {
    return prettyJson(value)
  }
}

/**
 * Stringify a value for an inline, one-line display context.
 *
 * @remarks
 * - `dag-json` uses DAG-JSON encoding (useful for bytes/CIDs).
 * - `json` avoids dumping `Uint8Array` as numeric-key objects by encoding bytes as base64.
 */
export function stringifyInline(value: unknown, format: JsonFormat): string {
  if (format === 'dag-json')
    return toDagJsonString(value)

  if (value instanceof Uint8Array)
    return encodeBase64(value)

  if (value == null)
    return ''

  if (typeof value === 'string')
    return value

  return String(value)
}

/**
 * Stringify a value for a preformatted block display context.
 *
 * @remarks
 * - `dag-json` uses pretty DAG-JSON.
 * - `json` uses stable 2-space JSON.
 */
export function stringifyBlock(value: unknown, format: JsonFormat): string {
  return format === 'dag-json' ? toPrettyDagJsonString(value) : prettyJson(value)
}

/**
 * Like {@link toDagJsonString} but attempts to re-parse and re-print as pretty JSON.
 *
 * @param value - Value to encode.
 * @returns A human-friendly string.
 */
export function toPrettyDagJsonString(value: unknown): string {
  const dagJson = toDagJsonString(value)
  try {
    return prettyJson(JSON.parse(dagJson))
  }
  catch {
    return dagJson
  }
}

/**
 * Format a Unix timestamp (seconds) into an ISO label and a Date.
 *
 * @param seconds - Unix timestamp in seconds.
 * @returns Label + Date (null when unset).
 */
export function formatTimestamp(seconds: number | null | undefined): { label: string, date: Date | null } {
  if (seconds == null)
    return { label: 'Not set', date: null }
  const date = new Date(seconds * 1000)
  return { label: date.toISOString(), date }
}

/**
 * Render a human-readable relative time string from a Date.
 *
 * @param target - Target date.
 * @returns Relative string (e.g. "in 5 minutes", "2 hours ago", or "—").
 */
export function relativeTime(target: Date | null): string {
  if (!target)
    return '—'
  const now = Date.now()
  const diff = target.getTime() - now
  const absDiff = Math.abs(diff)
  const minutes = Math.round(absDiff / 60000)
  if (minutes < 1)
    return diff >= 0 ? 'in <1 minute' : '<1 minute ago'
  if (minutes < 60)
    return diff >= 0 ? `in ${minutes} minute${minutes === 1 ? '' : 's'}` : `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48)
    return diff >= 0 ? `in ${hours} hour${hours === 1 ? '' : 's'}` : `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 60)
    return diff >= 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.round(days / 30)
  if (months < 24)
    return diff >= 0 ? `in ${months} month${months === 1 ? '' : 's'}` : `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.round(days / 365)
  return diff >= 0 ? `in ${years} year${years === 1 ? '' : 's'}` : `${years} year${years === 1 ? '' : 's'} ago`
}
