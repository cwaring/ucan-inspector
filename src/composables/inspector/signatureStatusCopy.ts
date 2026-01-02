import type { SignatureStatus } from '@/utils/ucanAnalysis'

/** UI tone for a status chip/label. */
export type StatusTone = 'info' | 'success' | 'warn' | 'error'

/** Copy + UI treatment for a given signature verification status. */
export interface SignatureStatusMeta {
  label: string
  tone: StatusTone
  helper: string
}

/**
 * Centralized copy for signature verification statuses used across the inspector UI.
 *
 * @remarks
 * Keep this in one place so components/composables don’t duplicate labels/tooltips.
 */
export const signatureStatusCopy: Record<SignatureStatus, SignatureStatusMeta> = {
  verified: {
    label: 'Signature verified',
    tone: 'success',
    helper: 'Signature matches the issuer’s verification method from the DID document.',
  },
  failed: {
    label: 'Signature invalid',
    tone: 'error',
    helper: 'Signature did not match the issuer’s verification method.',
  },
  unsupported: {
    label: 'Verification unavailable',
    tone: 'warn',
    helper: 'The DID method or signature type is not supported for offline verification.',
  },
  skipped: {
    label: 'Signature not checked',
    tone: 'info',
    helper: 'Signature verification was skipped for this token.',
  },
}
