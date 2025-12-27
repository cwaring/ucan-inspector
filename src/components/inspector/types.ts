/**
 * Minimal view used to render a delegation chain list.
 *
 * @remarks
 * Intentionally avoids the full token union to keep presentation components simple.
 */
export interface DelegationLink {
  id: string
  index: number
  iss: string
  aud: string
  cid: string
}
