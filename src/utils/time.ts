import { getUnixTime } from 'date-fns'

/**
 * Returns unix time in whole seconds.
 *
 * Uses `new Date(Date.now())` (instead of `new Date()`) so tests that mock/spyon
 * `Date.now()` behave as expected.
 */
export function nowUnixSeconds(): number {
  return getUnixTime(new Date(Date.now()))
}
