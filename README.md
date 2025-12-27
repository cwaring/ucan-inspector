[![UCAN Inspector](https://s6.imgcdn.dev/YliMci.jpg)](https://s6.imgcdn.dev/YliMci.jpg)

# UCAN Inspector (web component)

A Vue 3 custom element for inspecting UCAN tokens (delegations and invocations) and UCAN containers directly in the browser.

## Features

- Parses UCAN tokens and UCAN Containers (`ctn-v1`) locally in the browser (no server required)
- Decodes delegations and invocations via `iso-ucan`, and produces a structured `AnalysisReport`
- Verifies signatures when possible (`iso-signatures` + `iso-did`)

  - Some verification methods may require network access, depending on the DID method used
- Produces structured diagnostics

  - `issues` at the report level and token level (`notice` / `warn` / `error`)
  - Container-specific `diagnostics` when parsing `ctn-v1`
- Helps debug “almost valid” inputs

  - Non-canonical containers (duplicates, non-sorted entries, padding mismatches) can still parse, but emit notices/warnings
  - If an input starts with a container header byte but fails strict container parsing, the inspector records a warning and falls back to raw token parsing

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

## Mock tokens

In the UI, enable Debug mode to load locally generated samples.

The exported helpers include intentionally malformed samples so you can verify warning paths end-to-end:

- `delegation`: a valid delegation
- `invocation`: a valid invocation
- `container`: a valid `ctn-v1` container containing a delegation + invocation
- `containerBase64url`: same container payload, but encoded as base64url (`C` header)
- `badRawInput`: not base64/container; triggers UTF-8 fallback notice + envelope decode warning
- `badContainer`: looks like a container but violates strict CBOR shape (should fail container parsing)
- `nonCanonicalContainer`: parses, but emits diagnostics for duplicates and ordering
- `tamperedDelegation`: decodes but signature verification fails

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

### Report diagnostics

The `analysis` payload includes `issues` at the report and token levels:

- `report.issues[]`
- `report.tokens[].issues[]`

Each issue is `{ level, code, message }`.

The package exports the types so host apps can consume reports in a type-safe way:

- `AnalysisReport`, `TokenAnalysis`
- `Issue`, `IssueLevel`

## UCAN Container input formats

This inspector validates the container CBOR shape strictly:

- The decoded CBOR MUST be a map with exactly one key: `ctn-v1`.
- `ctn-v1` MUST be an array of CBOR byte strings (each entry is one UCAN token's bytes).

In the web component's text input, supported header bytes are:

- `B` = base64 (standard alphabet, padded)
- `C` = base64url (URL alphabet, no padding)
- `O` = base64 + gzip
- `P` = base64url + gzip

The raw-bytes variants (`@` and `M`) are not supported in the text input because arbitrary bytes cannot be represented safely as a plain string.

Notes:

- Non-canonical containers (duplicates, non-sorted entries, padding mismatches) produce notices/warnings.
- If input starts with a container header byte but fails strict parsing, the inspector records a warning and falls back to raw token parsing.

### Container diagnostics

When a container parses successfully, the report includes `diagnostics` describing canonicality and normalization decisions. These are intended to be developer-friendly and deterministic.

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

Tip: enable Debug mode in the UI to load sample tokens, including intentionally malformed inputs that exercise diagnostics.

## Maintainers

This repo includes a pnpm patch that adds an `iso-ucan` export for `iso-ucan/utils` (see `patches/iso-ucan.patch`). Re-apply when bumping `iso-ucan`.

## License

[MIT](./LICENSE.md) © 2025 [Chris Waring](https://github.com/cwaring)
