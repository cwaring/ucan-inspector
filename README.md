# UCAN Inspector web component

A self-contained Vue 3 custom element for inspecting UCAN tokens and containers directly in the browser. The component mirrors the design language of [ucan-staging.pages.dev/inspector](https://ucan-staging.pages.dev/inspector/) and is suitable for embedding inside the UCAN documentation site, browser extensions, and other host applications that need a transport-agnostic analysis tool.

## ✨ Features

- **UCAN-aware parsing** – understands the UCAN container header byte table, CBOR payloads, and gzip/base64 combinations.
- **`iso-ucan` integration** – decodes delegation envelopes and surfaces issuer, audience, capability policies, and CID metadata.
- **Invocation-aware analysis** – inspects UCAN invocation tokens alongside delegations, including proof chains, arguments, and signature validation.
- **Timeline & validation cues** – shows `nbf`/`exp` windows, highlights expired or pending delegations, and keeps signature verification status front-and-centre.
- **Offline signature verification** – validates delegation envelopes against `did:key` and `did:pkh` issuers with `iso-signatures`/`iso-did`, surfacing failures directly in the UI and JSON reports.
- **URL state sync** – optional query-parameter sharing for deep links and reproducible debugging sessions.
- **Debug & export tooling** – structured in-app logs, clipboard copy, and downloadable JSON inspection reports.
- **Mock token generator** – load locally signed sample delegations, invocations, and containers in one click for rapid debugging.
- **Shadow DOM styling** – UnoCSS-powered design that closely follows the UCAN design system while remaining sandbox-friendly.

## 🚀 Quick start

```bash
pnpm add ucan-inspector # or use a relative path during local development
```

Register the custom element once during application bootstrap:

```ts
import { registerUcanInspector } from 'ucan-inspector'

registerUcanInspector()

// later in your DOM
// <ucan-inspector></ucan-inspector>
```

### Framework integrations

- **Vanilla/Docs site** – load the module, call `registerUcanInspector`, and drop `<ucan-inspector>` anywhere.
- **Vue (SFC)** – import `UcanInspectorVueComponent` and register it locally if you prefer the SFC syntax.
- **Browser extension** – `registerUcanInspector()` can run inside the content script before injecting the element into the page.

## ⚙️ Component API

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `default-token` | `string` | `""` | Optional token or container string to parse on first render. |
| `persist-url` | `boolean` | `true` | When truthy, the inspector stores state in `?ucan=` for deep links. |
| `auto-parse` | `boolean` | `true` | Disable to require manual "Inspect token" clicks. |

| Event | Payload | Description |
| --- | --- | --- |
| `analysis` | `AnalysisReport` | Fired after a successful parse with the full report object. |
| `error` | `string \| null` | Raised whenever parsing fails (or resets back to `null`). |
| `export` | `{ kind: 'copy' \| 'download'; report: AnalysisReport }` | Emitted after the user copies or downloads the report. |

All events bubble from the custom element, making them easy to observe from host pages.

## 🧪 Development workflow

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

## � Dependency patching

`iso-ucan` does not yet export its `utils` entrypoint, but the inspector relies on helpers such as `cid()` and `verifySignature()`. Until upstream publishes those exports we ship a pinned patch in [`patches/iso-ucan.patch`](./patches/iso-ucan.patch) that adds the missing `./utils` mapping.

When you bump `iso-ucan`, re-apply the patch by running:

```bash
pnpm patch iso-ucan
# edit package.json to ensure "./utils" is exported (copy the diff in patches/iso-ucan.patch)
pnpm patch-commit "$(pwd)/node_modules/.pnpm_patches/iso-ucan@<version>"
```

After committing the patch, run `pnpm install` so pnpm re-generates the `patches/iso-ucan.patch` file against the new version, then execute the test suite to confirm the inspector still resolves `iso-ucan/utils` correctly.

## �📁 Project structure

- `src/components/UcanInspector.vue` – the inspector component rendered as a custom element.
- `src/utils/*` – shared helpers for base64, container parsing, token analysis, and formatting.
- `scripts/build-css.ts` – UnoCSS token generation for the shadow DOM.
- `playground/` – Vite playground for manual testing.

## 📄 License

[MIT](./LICENSE) © 2025 UCAN Working Group
