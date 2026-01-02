import { base64pad, base64url } from 'iso-base/rfc4648'

/** Supported base64 alphabets used by this project. */
export type Base64Variant = 'standard' | 'url'

/**
 * Decode a base64/base64url string into bytes.
 *
 * @param input - Encoded string.
 * @param variant - Encoding variant to use.
 * @returns Decoded bytes.
 */
export function decodeBase64(input: string, variant: Base64Variant = 'standard'): Uint8Array {
  const decoder = variant === 'url' ? base64url : base64pad
  return decoder.decode(input.trim())
}

/**
 * Encode bytes as base64/base64url.
 *
 * @param bytes - Raw bytes.
 * @param variant - Encoding variant to use.
 * @returns Encoded string.
 */
export function encodeBase64(bytes: Uint8Array, variant: Base64Variant = 'standard'): string {
  const encoder = variant === 'url' ? base64url : base64pad
  return encoder.encode(bytes)
}
