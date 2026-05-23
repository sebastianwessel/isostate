---
id: TICKET-015
title: Add browser-safe DSL and core editor-support APIs
wave: 4
status: pending
parallel_group: editor_foundation
depends_on: []
blocked_by: []
spec_refs: [specs/03-contracts/public-api.md, specs/03-contracts/editor-support-api.md, specs/02-capabilities/rendering/rendering-engine.md]
write_scope: [packages/core/src/dsl/browser.ts, packages/core/src/editor-support, packages/core/src/types, packages/core/package.json, rollup.config.ts, tests/editor-support, tests/contracts/package-exports.test.ts, tests/nfr/runtime-boundary.test.ts]
read_scope: [packages/core/src/dsl, packages/core/src/runtime, packages/core/src/rendering, packages/core/src/utils/projection.ts, specs/03-contracts/editor-support-api.md]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/editor-support-api.md, specs/03-contracts/public-api.md]
  missing_contracts: []
ticket_readiness:
  status: ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-015: Browser-Safe DSL And Editor Support

## Goal

Expose browser-safe parse/validate/compile APIs and core editor-support geometry
helpers without changing the core runtime rendering model.

## Context Digest

The editor must reuse core runtime logic. `@sebastianwessel/isostate/dsl/browser`
must be browser-bundleable and `@sebastianwessel/isostate/editor-support` must
provide projection, pointer conversion, object metadata, and selection helpers.

execution_semantics: `in_process` browser-safe APIs and `data_only` type exports.

## Implementation Approach

Split pure DSL functions from local-process CLI/static-bundle helpers. Add a
focused `packages/core/src/editor-support` module that wraps existing projection
and runtime DOM state instead of duplicating renderer internals.

## Tasks

- Add `packages/core/src/dsl/browser.ts` exporting `parseScene`, `validateScene`,
  `compileScene`, `toJs`, and `toJson` only when these imports are browser-safe.
- Add package export `./dsl/browser`.
- Add `packages/core/src/editor-support/index.ts`, `geometry.ts`, and
  `hit-test.ts`.
- Add `clientPointToSvgPoint(svg, point)` using `svg.getScreenCTM()?.inverse()`.
- Add `projectGridPoint`, `unprojectScreenPoint`, and `getGridCellPolygon`
  using existing projection/layout helpers.
- Add `createEditorRuntimeAdapter(mounted)` that reads mounted runtime state and
  returns element metadata/bounds for v1.
- Add tests for geometry, pointer conversion, element bounds, package exports,
  and runtime-boundary exclusions.

## Required Behavior

- `@sebastianwessel/isostate/dsl/browser` imports no filesystem, CLI, static
  bundle, or Node/Bun-only modules.
- `@sebastianwessel/isostate/editor-support` imports no YAML parser/compiler.
- `clientPointToSvgPoint` throws `EDITOR_GEOMETRY_UNAVAILABLE` when the SVG CTM
  is missing or not invertible.
- Element selection bounds match the renderer's projected element bounds.
- Connection metadata is present enough for inspector dropdown/form editing;
  pointer-based connection hit testing is not required for v1.

## Acceptance

- `tests/editor-support/geometry.test.ts` covers projection, unprojection, grid
  cell polygons, and client-to-SVG conversion.
- `tests/editor-support/adapter.test.ts` covers adapter metadata for rendered
  elements.
- `tests/contracts/package-exports.test.ts` covers `./dsl/browser` and
  `./editor-support`.
- `tests/nfr/runtime-boundary.test.ts` proves editor-support is runtime-safe.

## Verification

```bash
bun test tests/editor-support tests/contracts/package-exports.test.ts tests/nfr/runtime-boundary.test.ts
bun run typecheck
bun run lint
```

## Decision Ledger

- Core APIs may be modularized when it prevents editor-side duplication.
- V1 does not require pointer-based connection hit testing.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| browser DSL | `specs/03-contracts/public-api.md` | `packages/core/src/dsl/browser.ts` |
| editor support | `specs/03-contracts/editor-support-api.md` | `packages/core/src/editor-support` |
| runtime boundary | `specs/00-stack.md` | `tests/nfr/runtime-boundary.test.ts` |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| browser DSL export exists | `tests/contracts/package-exports.test.ts` |
| editor support export exists | `tests/contracts/package-exports.test.ts` |
| geometry matches projection | `tests/editor-support/geometry.test.ts` |
| adapter metadata works | `tests/editor-support/adapter.test.ts` |
| no Node imports in browser support | `tests/nfr/runtime-boundary.test.ts` |

## Non-goals

- Implementing editor React UI.
- Implementing CLI manifest generation.

## Handoff

After this ticket, editor package code can depend on browser DSL and
editor-support imports.

