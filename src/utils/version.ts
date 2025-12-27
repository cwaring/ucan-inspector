declare const __INSPECTOR_VERSION__: string | undefined

export function getInspectorVersion(): string {
  // Injected at build time by Vite / tsdown via `define`.
  // Use `typeof` so this remains safe in environments where it isn't defined (e.g. certain test runners).
  return typeof __INSPECTOR_VERSION__ === 'string' ? __INSPECTOR_VERSION__ : '0.0.0'
}
