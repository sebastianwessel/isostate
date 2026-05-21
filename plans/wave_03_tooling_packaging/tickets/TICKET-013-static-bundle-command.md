---
id: TICKET-013
title: Implement static bundle command and manifest
wave: 3
status: done
parallel_group: static_bundle
depends_on: [TICKET-011, TICKET-012]
blocked_by: []
spec_refs: [specs/03-contracts/cli.md, specs/03-contracts/static-bundle.md, specs/03-flows/static-deploy.md]
write_scope: [packages/cli, tests/cli/bundle.test.ts, tests/fixtures]
read_scope: [packages/core/src/dsl, packages/core/dist/browser, specs/03-contracts/cli.md, specs/03-contracts/static-bundle.md, examples/basic/source.isostate.yaml]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/cli.md, specs/03-contracts/static-bundle.md]
  missing_contracts: []
ticket_readiness:
  status: done
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-013: Static Bundle Command

## Goal

Implement `isostate bundle` and `isostate inspect`.

## Context Digest

Ticket 011 provides the CLI package and compile command. Ticket 012 provides the
standalone runtime artifact. This ticket combines those pieces into the durable
static deployment bundle contract.

execution_semantics: `local_process`.

## Implementation Approach

Add bundle and inspect command modules to `packages/cli`. Use the core compiler
for runtime data, a CLI-owned asset resolver/copier for SVG files, and a
manifest writer that follows the static bundle schema.

## Tasks

- Implement asset resolution and copy planning.
- Rewrite compiled asset URLs to the public asset base.
- Copy the standalone runtime artifact.
- Write `manifest.json` with version, schema, digest, source, runtime, scene,
  and asset entries.
- Implement `inspect` for JS and JSON runtime bundles.
- Add failure-path tests for missing assets and malformed bundles.

## Required Behavior

- `isostate bundle <input> --out <dir>` writes `isostate.runtime.js`,
  `scene.isostate.js`, `assets/`, and `manifest.json`.
- Copied assets exactly match referenced external assets in the compiled bundle.
- Built-in generated assets are never copied.
- Compiled asset URLs are rewritten to `--public-asset-base`.
- Manifest follows `specs/03-contracts/static-bundle.md`.
- `isostate inspect` validates canonical JS/JSON runtime bundles and reports
  scene count, asset count, layer count, floor size, and digest.

## Acceptance

- Tests cover complete bundle output, missing asset failure, built-in asset
  exclusion, manifest digest fields, and inspect success/failure.
- Bundle command avoids publishing partial output on failure.

## Verification

```bash
bun test tests/cli/bundle.test.ts tests/cli/inspect.test.ts
bun run build
bun run typecheck
```

## Decision Ledger

- Manifest schema semantics are fixed by `StaticBundleManifest` in
  `specs/03-contracts/static-bundle.md`.
- Manifest version semantics use the CLI package version.
- Asset digest semantics use SHA-256 hex over copied file bytes.
- Bundle output preserves durable scene bundle identity through
  `RuntimeBundle._digest`.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| `isostate bundle` | `specs/03-contracts/cli.md` | `packages/cli`, `tests/cli/bundle.test.ts` |
| static manifest | `specs/03-contracts/static-bundle.md` | `packages/cli`, `manifest.json` fixtures |
| `isostate inspect` | `specs/03-contracts/cli.md` | `packages/cli`, `tests/cli/inspect.test.ts` |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| expected output files exist | `tests/cli/bundle.test.ts` |
| copied asset set is exact | `tests/cli/bundle.test.ts` |
| built-ins are excluded | `tests/cli/bundle.test.ts` |
| manifest version/schema/digests valid | `tests/cli/bundle.test.ts` |
| inspect validates bundles | `tests/cli/inspect.test.ts` |

## Non-goals

- Browser visual tests in default verification.
- Mermaid conversion.

## Handoff

After this ticket, Ticket 014 can document and release-check the complete
workflow.
