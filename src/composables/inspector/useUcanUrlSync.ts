/**
 * Tiny helper for keeping the inspector input synchronized with a URL query parameter.
 *
 * @param paramName - Query parameter to read/write.
 * @returns URL sync helpers.
 */
export function useUcanUrlSync(paramName = 'ucan'): {
  /** Whether we're running in a browser environment. */
  isBrowser: boolean
  /** Suppress the next URL write caused by a corresponding input update. */
  suppressOnce: () => void
  /** Consume the suppression flag (returns true when suppressed). */
  consumeSuppressed: () => boolean
  /** Read the encoded token from the URL (query param). */
  readFromUrl: () => string | null
  /** Write the encoded token to the URL (query param). */
  writeToUrl: (value: string) => void
} {
  const isBrowser = typeof window !== 'undefined'
  let suppressNextSync = false

  function suppressOnce(): void {
    suppressNextSync = true
  }

  function consumeSuppressed(): boolean {
    if (!suppressNextSync)
      return false
    suppressNextSync = false
    return true
  }

  function readFromUrl(): string | null {
    if (!isBrowser)
      return null
    const params = new URLSearchParams(window.location.search)
    return params.get(paramName)
  }

  function writeToUrl(value: string): void {
    if (!isBrowser)
      return
    const url = new URL(window.location.href)
    if (value.trim())
      url.searchParams.set(paramName, encodeURIComponent(value.trim()))
    else
      url.searchParams.delete(paramName)
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }

  return {
    isBrowser,
    suppressOnce,
    consumeSuppressed,
    readFromUrl,
    writeToUrl,
  }
}
