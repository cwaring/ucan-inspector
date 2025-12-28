import { EdDSASigner } from 'iso-signatures/signers/eddsa.js'
import { Delegation } from 'iso-ucan/delegation'

import { nowUnixSeconds } from '../../src/utils/time'

export interface SampleDelegation {
  delegation: Delegation
  issuer: string
  audience: string
}

export async function createSampleDelegation(): Promise<SampleDelegation> {
  const issuer = await EdDSASigner.generate()
  const audience = await EdDSASigner.generate()
  const now = nowUnixSeconds()

  const delegation = await Delegation.create({
    iss: issuer,
    aud: audience.did,
    sub: issuer.did,
    pol: [],
    cmd: '/example/read',
    exp: now + 60,
  })

  return {
    delegation,
    issuer: issuer.toString(),
    audience: audience.toString(),
  }
}
