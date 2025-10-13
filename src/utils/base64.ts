import { base64pad, base64url } from 'iso-base/rfc4648'

export type Base64Variant = 'standard' | 'url'

export function decodeBase64(input: string, variant: Base64Variant = 'standard'): Uint8Array {
  const decoder = variant === 'url' ? base64url : base64pad
  return decoder.decode(input.trim())
}

export function encodeBase64(bytes: Uint8Array, variant: Base64Variant = 'standard'): string {
  const encoder = variant === 'url' ? base64url : base64pad
  return encoder.encode(bytes)
}
