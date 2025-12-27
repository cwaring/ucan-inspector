[![UCAN Inspector](https://s6.imgcdn.dev/YliMci.jpg)](https://s6.imgcdn.dev/YliMci.jpg)

# UCAN Inspector (web component)

A Vue 3 custom element for inspecting UCAN tokens (delegations and invocations) and UCAN containers directly in the browser.

## Features

- Parses raw tokens and UCAN containers (CBOR, optional gzip, base64/base64url)
- Decodes delegations and invocations via `iso-ucan`, including proofs, args, and CIDs
- Verifies signatures when possible using `iso-signatures` + `iso-did` (some DID methods may require network access)
- Shows `nbf`/`exp` status and highlights pending/expired tokens
- Exports a structured JSON report (copy or download)
- Optional URL state sync via the `ucan` query parameter

## Quick start

```bash
pnpm add @ucan-wg/inspector
```

Register the custom element once during application bootstrap:

```ts
import { registerUcanInspector } from '@ucan-wg/inspector'

registerUcanInspector()

// later in your DOM
// <ucan-inspector></ucan-inspector>
```

`registerUcanInspector()` is safe to call multiple times, and the package also registers the default tag (`ucan-inspector`) on import.

This package also exports `getMockToken()` and `getMockTokens()` for generating locally signed sample tokens for debugging.

## Component API

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `default-token` | `string` | `""` | Optional token or container string to parse on first render. |
| `persist-url` | `boolean` | `true` | When truthy, syncs the input value to the `ucan` query parameter and reads it on mount. |
| `auto-parse` | `boolean` | `true` | Disable to require manual "Inspect token" clicks. |

| Event | Payload | Description |
| --- | --- | --- |
| `analysis` | `AnalysisReport` | Fired after a successful parse with the full report object. |
| `error` | `string \| null` | Raised whenever parsing fails (or resets back to `null`). |
| `export` | `{ kind: 'copy' \| 'download'; report: AnalysisReport }` | Emitted after the user copies or downloads the report. |

All events bubble from the custom element, making them easy to observe from host pages.

## Development workflow

```bash
pnpm install              # install dependencies
pnpm play                 # start the playground for manual QA
pnpm lint                 # run ESLint
pnpm typecheck            # ensure TypeScript types stay healthy
pnpm test                 # execute Vitest unit tests
pnpm build                # produce the distributable bundle
```

The playground mounts the custom element and is useful for verifying URL persistence, visual styling, and regression behaviour.

### Tests

- `test/utils/ucan-container.test.ts` – container header detection, CBOR extraction, and mixed delegation/invocation payloads.
- `test/utils/ucan-analysis.test.ts` – successful delegation and invocation decoding plus failure handling.

Both suites generate UCAN samples at runtime using `iso-ucan` and `iso-signatures` so the coverage stays realistic.

## Dependency patching

This repo includes a pnpm patch that adds an `iso-ucan` export for `iso-ucan/utils` (see [`patches/iso-ucan.patch`](./patches/iso-ucan.patch)).

When bumping `iso-ucan`, re-apply the patch:

```bash
pnpm patch iso-ucan
# edit package.json to ensure "./utils" is exported (copy the diff in patches/iso-ucan.patch)
pnpm patch-commit "$(pwd)/node_modules/.pnpm_patches/iso-ucan@<version>"
```

Then run `pnpm install` and `pnpm test`.

## Project structure

- `src/components/UcanInspector.vue` – the inspector component rendered as a custom element.
- `src/utils/*` – shared helpers for base64, container parsing, token analysis, and formatting.
- `scripts/build-css.ts` – UnoCSS token generation for the shadow DOM.
- `playground/` – Vite playground for manual testing.

## License

[MIT](./LICENSE.md) © 2025 [Chris Waring](https://github.com/cwaring)
