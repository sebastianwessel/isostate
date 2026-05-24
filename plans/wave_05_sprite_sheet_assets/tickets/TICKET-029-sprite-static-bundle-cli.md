---
id: TICKET-029
title: Copy sprite sheet sources in static bundle output
wave: 5
status: done
parallel_group: sprite_sheet_029_static_bundle
depends_on: [TICKET-027, TICKET-028]
blocked_by: [TICKET-027, TICKET-028]
spec_refs: [specs/03-contracts/cli.md, specs/03-contracts/static-bundle.md, specs/03-flows/static-deploy.md, specs/04-nfr/runtime-ci.md]
write_scope: [packages/cli/src, tests/cli, tests/fixtures/sprite-sheet-assets, docs/guides/deploy-static-bundle.md]
read_scope: [packages/cli/src, packages/core/src/dsl/compiler.ts, specs/03-contracts/cli.md, specs/03-contracts/static-bundle.md, specs/03-flows/static-deploy.md, tests/fixtures/sprite-sheet-assets]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/cli.md, specs/03-contracts/static-bundle.md, specs/03-flows/static-deploy.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-029: Sprite Static Bundle CLI

## Goal

Make `isostate bundle` copy referenced sprite sheet image files and rewrite
compiled sprite asset URLs for static deployment.

## Context Digest

Static deployment bundles contain runtime code, compiled scene data, copied
external asset source files, and `manifest.json`. Normal URL assets append
`.svg` during local source resolution when extensionless. Sprite sheet paths
already include explicit image extensions and are resolved once for all
referenced sprites in the sheet. Built-in generated assets are not copied.

execution_semantics: `local_process`.

Durable manifest semantics: static bundle `manifest.json` keeps its existing
format version, schema, digest fields, immutable copied-file snapshot, replay
behavior, and canonical path sorting while adding sprite sheet source files to
the existing asset entry list.

## Implementation Approach

Extend existing bundle asset collection to group compiled runtime assets by
source URL and source path. Copy each unique sprite sheet source file once even
when multiple sprite ids reference it. Preserve existing filename collision
rules and manifest sorting by asset id. Keep output atomic behavior.

## Tasks

- Resolve sprite sheet source paths from authored `header.assets[].path` and
  `--asset-dir`.
- Copy each referenced sprite sheet source file once into `<out>/assets`.
- Rewrite all compiled sprite asset URLs to the copied file URL.
- Preserve normal SVG asset resolution and copying behavior.
- Include sprite asset manifest entries with logical sprite id, source file,
  copied file, URL, and digest.
- Avoid duplicate file copies for multiple sprites from the same sheet.
- Add CLI bundle tests for one sheet with multiple referenced sprites.
- Add failure-path tests for missing sprite sheet source file and unsupported
  path resolution.

## Acceptance

- Static bundle output includes the sprite sheet image file.
- Compiled runtime bundle URLs for all sprites point to the copied sheet file.
- Static bundle manifest records each referenced logical sprite id.
- One sheet source file is copied once for multiple sprite ids.
- Normal SVG static bundle tests still pass.
- Built-in generated assets remain excluded from copied assets and manifest
  assets.

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| sprite sheet copied | `bun test tests/cli` |
| sprite URLs rewritten | `bun test tests/cli` |
| manifest entries | `bun test tests/cli` |
| duplicate copy avoidance | `bun test tests/cli` |
| missing file failure | `bun test tests/cli` |
| normal SVG regression | `bun test tests/cli` |

## Verification

```bash
bun test tests/cli
bunx tsc --noEmit
bunx biome check packages/cli/src tests/cli
```

## Decision Ledger

| Decision | Source |
|---|---|
| Sprite sheet paths keep explicit extensions | `specs/03-contracts/static-bundle.md` |
| Static assets include sprite sheet files | `specs/03-flows/static-deploy.md` |
| Generated assets are excluded | `specs/03-contracts/static-bundle.md` |
| Output failures leave no partial deployment | `specs/03-contracts/cli.md` |

## Contract Traceability

| Surface | Contract | Owner Files | Tests |
|---|---|---|---|
| `isostate bundle` asset copy | `cli.md`, `static-bundle.md` | `packages/cli/src` | `tests/cli` |
| static deploy flow | `static-deploy.md` | `packages/cli/src` | `tests/cli` |
| deployment docs | `docs/guides/deploy-static-bundle.md` | docs | docs path tests |

## Non-goals

- Asset manifest generation.
- Editor asset browser.
- Runtime rendering.

## Handoff

TICKET-032 can document static deployment of sprite sheets after this ticket.
