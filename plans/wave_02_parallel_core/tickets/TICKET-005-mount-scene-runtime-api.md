---
id: TICKET-005
title: Implement mountScene and runtime bundle loading
wave: 2
status: implementation_ready
parallel_group: runtime_api
depends_on: [TICKET-001, TICKET-002, TICKET-004]
blocked_by: [TICKET-001, TICKET-002, TICKET-004]
spec_refs: [specs/03-contracts/public-api.md, specs/03-contracts/runtime-bundle.md, specs/03-flows/dsl-to-runtime.md, specs/04-nfr/runtime-ci.md]
write_scope: [packages/core/src/index.ts, packages/core/src/runtime, tests/runtime/mount-scene.test.ts, tests/contracts/runtime-entrypoint.test.ts]
read_scope: [packages/core/src/index.ts, packages/core/src/dsl/compiler.ts, packages/core/src/rendering/rendering-engine.ts, packages/core/src/animation/animation-engine.ts, packages/core/src/animation/controller.ts, packages/core/src/types/asset-registry.ts]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/public-api.md, specs/03-contracts/runtime-bundle.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-005: mountScene Runtime API

## Goal

Implement the primary runtime API for loading a compiled bundle into a DOM target.

## Spec Refs

- `specs/03-contracts/public-api.md`
- `specs/03-contracts/runtime-bundle.md`
- `specs/03-flows/dsl-to-runtime.md`
- `specs/04-nfr/runtime-ci.md`

## Context Digest

Primary runtime API `mountScene` is missing. Runtime loading does not check `_format`, `_version`, or `_digest`, and there is no `MountedScene.getResolvedConfig()`.

execution_semantics: `in_process`.

## Implementation Approach

Add a small runtime loader module and export it from the runtime root. Keep DSL parsing and compiling outside the runtime root.

## Tasks

- Add `mountScene`, `MountSceneOptions`, and `MountedScene`.
- Validate bundle format, version, and digest.
- Build SVG DOM, initialize engine, and initialize controller when configured.
- Implement resolved config inspection and cleanup.
- Add runtime API tests.

## Read Scope

- `packages/core/src/index.ts`
- `packages/core/src/dsl/compiler.ts`
- `packages/core/src/rendering/rendering-engine.ts`
- `packages/core/src/animation/animation-engine.ts`
- `packages/core/src/animation/controller.ts`
- `packages/core/src/types/asset-registry.ts`

## Write Scope

- `packages/core/src/index.ts`
- `packages/core/src/runtime/`
- `tests/runtime/mount-scene.test.ts`
- `tests/contracts/runtime-entrypoint.test.ts`

## Required Behavior

- Export `mountScene`, `MountedScene`, and `MountSceneOptions` from the runtime root.
- `mountScene(target, bundle, options)` validates runtime bundle format, version, and digest.
- `mountScene` builds SVG DOM, initializes animation engine, and optionally initializes controller.
- `MountedScene.getResolvedConfig()` returns resolved grid, theme, theme vars, states, and layer order.
- `MountedScene.destroy()` cleans owned SVG/controller/engine resources.
- Root runtime import still excludes DSL APIs and `yaml`.

## Acceptance

- Runtime tests cover successful mount, resolved config, destroy cleanup, invalid format, version mismatch, digest mismatch, and controller disabled.
- Contract test proves root public API exports `mountScene` and does not export DSL APIs.

## Verification

```bash
bun test tests/runtime/mount-scene.test.ts tests/contracts/runtime-entrypoint.test.ts
bun run typecheck
```

## Contract Readiness

status: ready

required_contracts:

- `specs/03-contracts/public-api.md`
- `specs/03-contracts/runtime-bundle.md`

missing_contracts: []

## Decision Ledger

- `mountScene` is the primary runtime path.
- Low-level helpers remain advanced APIs.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| `mountScene` | `03-contracts/public-api.md` | `packages/core/src/index.ts`, `packages/core/src/runtime/` |
| bundle checks | `03-contracts/runtime-bundle.md` | runtime loader tests |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| mount success | `tests/runtime/mount-scene.test.ts` |
| resolved config | `tests/runtime/mount-scene.test.ts` |
| invalid bundle errors | `tests/runtime/mount-scene.test.ts` |
| root API boundary | `tests/contracts/runtime-entrypoint.test.ts` |

## Non-goals

- Parser/validator changes.
- CLI.

## Handoff

Docs and NFR tickets can document and verify the final public runtime path.
