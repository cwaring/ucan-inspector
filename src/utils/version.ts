declare const __INSPECTOR_VERSION__: string | undefined

/**
 * Returns the library/build version string.
 *
 * @returns Version string.
 *
 * @remarks
 * Injected at build time via `define` (Vite/tsdown). Falls back to `0.0.0` in
 * environments where the constant is not defined.
 */
export function getInspectorVersion(): string {
  return typeof __INSPECTOR_VERSION__ === 'string' ? __INSPECTOR_VERSION__ : '0.0.0'
}
