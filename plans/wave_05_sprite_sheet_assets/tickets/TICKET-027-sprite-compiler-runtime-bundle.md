---
id: TICKET-027
title: Compile sprite sheets into flat runtime asset entries
wave: 5
status: pending
parallel_group: sprite_sheet_027_compiler
depends_on: [TICKET-026]
blocked_by: [TICKET-026]
spec_refs: [specs/03-contracts/runtime-bundle.md, specs/02-capabilities/dsl/compiler.md, specs/03-flows/dsl-to-runtime.md, specs/03-contracts/scene-schema.md]
write_scope: [packages/core/src/dsl/compiler.ts, packages/core/src/types/runtime-bundle.ts, tests/dsl, tests/contracts, tests/fixtures/sprite-sheet-assets]
read_scope: [packages/core/src/dsl/compiler.ts, packages/core/src/dsl/scene-validator.ts, packages/core/src/types, tests/fixtures/sprite-sheet-assets, specs/03-contracts/runtime-bundle.md, specs/02-capabilities/dsl/compiler.md]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/runtime-bundle.md, specs/02-capabilities/dsl/compiler.md, specs/03-flows/dsl-to-runtime.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-027: Sprite Compiler Runtime Bundle

## Goal

Compile validated sprite sheets into deterministic flat runtime `assets` entries
that runtime code can resolve by `RuntimeElementState.asset`.

## Context Digest

The runtime bundle keeps `assets?: Record<string, CompiledAsset>`. For sprite
sheets, the compiler emits one `CompiledAsset` entry per referenced logical
sprite id. Each entry uses the sheet URL, inherited or overridden anchor, and
`sprite: { sheetSize, rect }`. Tuple and `at` definitions compile through
`tileSize`: `x = column * tileWidth`, `y = row * tileHeight`, `width =
tileWidth`, `height = tileHeight`. Authored `rect` definitions compile without
conversion. Sprite sheet paths keep their explicit extension.

execution_semantics: in_process.

Docs/examples are an approved deferral to TICKET-032. This ticket implements
compiler and runtime bundle data behavior only.

Durable manifest semantics: no durable manifest is changed by this ticket;
asset manifest version, digest, schema, immutable snapshot, replay, and
canonical behavior remain unchanged.

## Implementation Approach

Extend asset URL compilation only. Keep runtime scenes flat and keep built-ins
excluded from `RuntimeBundle.assets`. Add helper functions for asset lookup,
sprite rect compilation, URL resolution, and anchor inheritance. Preserve
canonical JSON serialization and digest behavior by returning normalized plain
objects.

## Tasks

- Build a compiler lookup from normal URL asset ids and sprite ids.
- Include referenced floor sprite ids when `header.floor.asset` points to a
  sprite id.
- Resolve sprite sheet URLs from `assetBaseUrl` plus explicit sheet `path`
  without appending `.svg`.
- Compile tuple and `at` sprites to pixel `rect`.
- Preserve authored `rect` sprites unchanged after validator guarantees.
- Apply anchor precedence: sprite anchor, sheet anchor, default `[0.5, 1]`.
- Emit flat `assets[spriteId]` entries containing `url`, `sprite.sheetSize`,
  `sprite.rect`, and `anchor` when non-default or required by existing runtime
  anchor behavior.
- Keep normal URL asset compilation backward compatible.
- Add canonical `toJson`, `toJs`, `fromJson`, and `fromJs` tests for sprite
  runtime bundles.
- Add digest stability test for repeated compilation.

## Acceptance

- Compact sprite fixture compiles to `server` with rect `[0, 0, 64, 64]`.
- Verbose `at` sprite compiles through `tileSize`.
- Verbose `rect` sprite compiles unchanged.
- Sheet URL has `.png`, `.webp`, `.jpg`, `.jpeg`, or `.svg` exactly as authored.
- Normal SVG URL assets still append `.svg` when extensionless.
- Built-in generated assets do not appear under runtime `assets`.
- Bundle serialization stays canonical and digest-stable.

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| compact compile output | `bun test tests/dsl` |
| verbose compile output | `bun test tests/dsl` |
| explicit sheet extension preserved | `bun test tests/dsl` |
| normal SVG compatibility | existing compiler tests via `bun test tests/dsl` |
| canonical module/json parse | `bun test tests/contracts` |
| digest stability | `bun test tests/dsl` |

## Verification

```bash
bun test tests/dsl tests/contracts
bunx tsc --noEmit
bunx biome check packages/core/src/dsl packages/core/src/types tests/dsl tests/contracts
```

## Decision Ledger

| Decision | Source |
|---|---|
| Runtime assets remain flat by logical sprite id | `specs/03-contracts/runtime-bundle.md` |
| Sprite URL is shared sheet URL | `specs/03-contracts/runtime-bundle.md` |
| Tuple and `at` rect math is fixed | `specs/03-contracts/runtime-bundle.md` |
| Sprite metadata participates in digest | `specs/03-contracts/runtime-bundle.md` |

## Contract Traceability

| Surface | Contract | Owner Files | Tests |
|---|---|---|---|
| `CompiledAsset.sprite` | `runtime-bundle.md` | `compiler.ts`, `runtime-bundle.ts` | `tests/dsl`, `tests/contracts` |
| URL resolution | `dsl/compiler.md` | `compiler.ts` | `tests/dsl` |
| DSL-to-runtime flow | `dsl-to-runtime.md` | `compiler.ts` | `tests/dsl` |

## Non-goals

- Renderer DOM output.
- CLI file copying.
- Asset manifest generation.
- Editor drag behavior.

## Handoff

TICKET-028 can render compiled sprite assets without reading authored YAML.
