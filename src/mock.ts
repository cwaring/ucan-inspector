import type { MockTokenKind, MockTokens } from '@/utils/mockData'

export async function getMockTokens(): Promise<MockTokens> {
  const module = await import('@/utils/mockData')
  return module.getMockTokens()
}

export async function getMockToken<T extends MockTokenKind>(kind: T): Promise<MockTokens[T]> {
  const module = await import('@/utils/mockData')
  return module.getMockToken(kind)
}
