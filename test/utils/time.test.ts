import { describe, expect, it, vi } from 'vitest'

import { nowUnixSeconds } from '../../src/utils/time'

describe('time utils', () => {
  it('returns unix seconds based on Date.now (mock-friendly)', () => {
    const mockedNow = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_456)

    try {
      expect(nowUnixSeconds()).toBe(1_700_000_000)
    }
    finally {
      mockedNow.mockRestore()
    }
  })
})
