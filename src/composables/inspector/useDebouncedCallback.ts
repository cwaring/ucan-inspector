import { onBeforeUnmount } from 'vue'

/**
 * Creates a debounced callback that is automatically cancelled on unmount.
 *
 * @param callback - Function to debounce.
 * @param delayMs - Delay in milliseconds.
 * @returns Debounce controls.
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delayMs: number,
): {
  /** Schedule a call (restarting the debounce timer). */
  schedule: (...args: TArgs) => void
  /** Cancel any pending scheduled call. */
  cancel: () => void
} {
  let handle: ReturnType<typeof setTimeout> | undefined

  function cancel(): void {
    if (handle)
      clearTimeout(handle)
    handle = undefined
  }

  function schedule(...args: TArgs): void {
    cancel()
    handle = setTimeout(() => {
      callback(...args)
    }, delayMs)
  }

  onBeforeUnmount(cancel)

  return {
    schedule,
    cancel,
  }
}
