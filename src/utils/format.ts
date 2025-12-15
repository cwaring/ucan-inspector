import { encode as encodeDagJson } from '@ipld/dag-json'

import { encodeBase64 } from './base64'

export function bytesToBase64(bytes: Uint8Array): string {
  return encodeBase64(bytes)
}

export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

const dagJsonDecoder = new TextDecoder()

export function toDagJsonString(value: unknown): string {
  try {
    return dagJsonDecoder.decode(encodeDagJson(value as any))
  }
  catch {
    return prettyJson(value)
  }
}

export function toPrettyDagJsonString(value: unknown): string {
  const dagJson = toDagJsonString(value)
  try {
    return prettyJson(JSON.parse(dagJson))
  }
  catch {
    return dagJson
  }
}

export function formatTimestamp(seconds: number | null | undefined): { label: string, date: Date | null } {
  if (seconds == null)
    return { label: 'Not set', date: null }
  const date = new Date(seconds * 1000)
  return { label: date.toISOString(), date }
}

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
