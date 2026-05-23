---
id: TICKET-016
title: Add CLI asset manifest generation
wave: 4
status: pending
parallel_group: editor_foundation
depends_on: []
blocked_by: []
spec_refs: [specs/03-contracts/cli.md, specs/03-contracts/asset-manifest.md]
write_scope: [packages/cli/src, tests/cli/assets-manifest.test.ts, tests/fixtures/assets-manifest, docs/examples/asset-manifest.md]
read_scope: [packages/cli/src/commands.ts, packages/cli/src/diagnostics.ts, specs/03-contracts/asset-manifest.md]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/asset-manifest.md, specs/03-contracts/cli.md]
  missing_contracts: []
ticket_readiness:
  status: ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-016: CLI Asset Manifest

## Goal

Implement `isostate assets manifest` so static sites can publish a discoverable
asset catalog for the browser editor.

## Context Digest

The editor cannot read server folders directly. The CLI scans
`assets/group-folder/asset.svg`, optional `.isostate-assets.yaml` metadata, and
writes `isostate.asset-manifest` JSON.

execution_semantics: `local_process`.

## Implementation Approach

Add an assets command branch to the existing CLI dispatcher. Keep scanning and
manifest serialization in focused CLI modules. Treat SVGs as opaque bytes except
for minimal root-dimension inspection and safety checks.

## Tasks

- Add `assets manifest` parsing to the CLI dispatcher.
- Add manifest id normalization from relative SVG paths.
- Skip dotfiles, dot-directories, and symlinks.
- Reject reserved ids, duplicate ids, case-only collisions, invalid filenames,
  SVG files over 512KB, `<script>`, event-handler attributes, and external SVG
  references.
- Read optional metadata from `<asset-dir>/.isostate-assets.yaml` or
  `--metadata`.
- Compute `sha256:<hex>` digest for every SVG file.
- Write sorted manifest JSON atomically.
- Add CLI fixtures and tests for happy path and every rejection case.

## Required Behavior

- Output shape follows `specs/03-contracts/asset-manifest.md`.
- `assetBaseUrl` is written exactly from `--asset-base-url`.
- The command exits non-zero and writes no partial output on validation or file
  access failure.
- Metadata labels, anchors, and tags appear only in the manifest, never in
  authored YAML.

## Acceptance

- Tests cover nested groups, ungrouped assets, metadata, digest, sorting,
  duplicate ids, reserved ids, hidden files, symlink skipping, unsafe SVG,
  external references, oversized files, and case-only collisions.

## Verification

```bash
bun test tests/cli/assets-manifest.test.ts
bun run typecheck
bun run lint
```

## Decision Ledger

- Manifest URL is the v1 asset discovery workflow.
- Local browser folder import is out of scope for v1.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| `isostate assets manifest` | `specs/03-contracts/cli.md` | `packages/cli/src` |
| manifest shape | `specs/03-contracts/asset-manifest.md` | `tests/cli/assets-manifest.test.ts` |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| happy path manifest | `tests/cli/assets-manifest.test.ts` |
| safety rejection | `tests/cli/assets-manifest.test.ts` |
| metadata validation | `tests/cli/assets-manifest.test.ts` |

## Non-goals

- Editor UI asset browser.
- Runtime static bundle manifest changes.

## Handoff

After this ticket, Astro/static projects can generate asset manifests consumed
by Ticket 019.

