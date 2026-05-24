---
id: TICKET-023
title: Add Astro/static docs and release wiring
wave: 4
status: pending
parallel_group: editor_finish
depends_on: [TICKET-016, TICKET-017, TICKET-019, TICKET-022]
blocked_by: [TICKET-016, TICKET-017, TICKET-019, TICKET-022]
spec_refs: [docs/guides/use-editor-in-astro.md, specs/03-contracts/editor.md, specs/03-contracts/asset-manifest.md]
write_scope: [docs/guides/use-editor-in-astro.md, docs/reference/editor.md, docs/examples/editor-basic.md, docs/examples/editor-react.md, docs/examples/editor-export.md, docs/examples/asset-manifest.md, package.json, scripts, tests/nfr/docs-paths.test.ts, tests/nfr/package-scripts.test.ts]
read_scope: [docs/README.md, package.json, specs/03-contracts/editor.md]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/editor.md, specs/03-contracts/asset-manifest.md]
  missing_contracts: []
ticket_readiness:
  status: ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-023: Astro Docs And Release Wiring

## Goal

Make the editor package and asset manifest workflow discoverable and releaseable
from docs, scripts, package exports, and NFR checks.

## Context Digest

The intended static workflow is: put assets in `website/public/assets`, run
`isostate assets manifest`, then mount the editor as an Astro React island with
the manifest URL.

execution_semantics: docs/data and local-process scripts.

## Implementation Approach

Update docs and package scripts after implementation APIs exist. Keep examples
focused and consistent with package exports.

## Tasks

- Update editor docs with actual imports and minimal examples.
- Update Astro guide with confirmed command and page snippet.
- Update asset manifest example with real command output shape.
- Add package scripts `editor:build` and `editor:test` when the editor package
  has package-local build/test entrypoints; otherwise document that root
  `build` and `test` are the supported commands.
- Add `publint` coverage for editor package if it is publishable.
- Update docs path tests for new guide/example/reference pages.
- Add package script tests for new scripts.

## Required Behavior

- Docs do not imply Tailwind or host shadcn setup is required.
- Astro guide uses `client:only="react"` and `assetManifestUrl`.
- Docs state persistence is host-owned.
- Package scripts include editor in normal build/type/lint where appropriate.

## Acceptance

- Docs path tests pass.
- Package script tests pass.
- `bun run build`, `bun run typecheck`, and `bun run lint` include editor files.

## Verification

```bash
bun test tests/nfr/docs-paths.test.ts tests/nfr/package-scripts.test.ts
bun run build
bun run typecheck
bun run lint
```

## Decision Ledger

- Editor is publishable as an embeddable package.
- Static Astro workflow is the primary docs path.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| Astro guide | `docs/guides/use-editor-in-astro.md` | docs |
| editor package | `specs/03-contracts/editor.md` | `package.json`, `packages/editor/package.json` |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| docs links valid | `tests/nfr/docs-paths.test.ts` |
| scripts valid | `tests/nfr/package-scripts.test.ts` |
| package builds | `bun run build` |

## Non-goals

- Building a standalone hosted editor app.
- Browser automation.

## Handoff

This ticket can run after package APIs and docs examples are real.
