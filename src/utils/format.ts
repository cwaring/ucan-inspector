import { encode as encodeDagJson } from '@ipld/dag-json'

import { encodeBase64 } from './base64'

/** Output format for JSON-like inspector views. */
export type JsonFormat = 'json' | 'dag-json'

/**
 * JSON stringify helper with stable 2-space indentation.
 *
 * @param value - Any JSON-serializable value.
 * @returns Pretty-printed JSON.
 */
function prettyJson(value: unknown): string {
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
 * @param value - Value to stringify.
 * @param format - Output format.
 * @returns A short string suitable for inline display.
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
 * Pretty-print DAG-JSON while allowing a post-process step on the parsed value.
 *
 * @remarks
 * This is useful when the encoder canonicalizes map keys (re-ordering objects),
 * but you want deterministic display ordering.
 *
 * @param value - Value to encode as DAG-JSON.
 * @param postProcess - Function applied to the parsed DAG-JSON value prior to pretty-printing.
 * @returns A human-friendly string.
 */
export function toPrettyDagJsonStringWithPostProcess(
  value: unknown,
  postProcess: (parsed: unknown) => unknown,
): string {
  const dagJson = toDagJsonString(value)
  try {
    const parsed = JSON.parse(dagJson) as unknown
    return prettyJson(postProcess(parsed))
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

function relativeTimeFromMillis(targetMillis: number | null, nowMillis: number): string {
  if (targetMillis == null)
    return '—'

  const diff = targetMillis - nowMillis
  const absDiff = Math.abs(diff)
  const minutesRaw = absDiff / 60000
  const minutes = diff >= 0 ? Math.ceil(minutesRaw) : Math.floor(minutesRaw)
  if (minutes < 1)
    return diff >= 0 ? 'in <1 minute' : '<1 minute ago'
  if (minutes < 60)
    return diff >= 0 ? `in ${minutes} minute${minutes === 1 ? '' : 's'}` : `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hoursRaw = minutesRaw / 60
  const hours = diff >= 0 ? Math.ceil(hoursRaw) : Math.floor(hoursRaw)
  if (hours < 48)
    return diff >= 0 ? `in ${hours} hour${hours === 1 ? '' : 's'}` : `${hours} hour${hours === 1 ? '' : 's'} ago`
  const daysRaw = hoursRaw / 24
  const days = diff >= 0 ? Math.ceil(daysRaw) : Math.floor(daysRaw)
  if (days < 60)
    return diff >= 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${days} day${days === 1 ? '' : 's'} ago`
  const monthsRaw = daysRaw / 30
  const months = diff >= 0 ? Math.ceil(monthsRaw) : Math.floor(monthsRaw)
  if (months < 24)
    return diff >= 0 ? `in ${months} month${months === 1 ? '' : 's'}` : `${months} month${months === 1 ? '' : 's'} ago`
  const yearsRaw = daysRaw / 365
  const years = diff >= 0 ? Math.ceil(yearsRaw) : Math.floor(yearsRaw)
  return diff >= 0 ? `in ${years} year${years === 1 ? '' : 's'}` : `${years} year${years === 1 ? '' : 's'} ago`
}

/**
 * Render a human-readable relative time string from a Date.
 *
 * @param target - Target date.
 * @returns Relative string (e.g. "in 5 minutes", "2 hours ago", or "—").
 */
export function relativeTime(target: Date | null): string {
  return relativeTimeFromMillis(target?.getTime() ?? null, Date.now())
}

/**
 * Render a human-readable relative time string from a unix timestamp (seconds).
 *
 * @remarks
 * This mirrors {@link relativeTime} but allows callers (e.g. Vue view-models) to
 * drive updates from a reactive clock.
 */
export function relativeTimeFromSeconds(targetSeconds: number | null | undefined, nowSeconds: number): string {
  if (targetSeconds == null)
    return '—'
  return relativeTimeFromMillis(targetSeconds * 1000, nowSeconds * 1000)
}
