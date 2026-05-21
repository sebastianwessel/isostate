---
id: TICKET-001
title: Restore gates and split runtime/dev-time package boundary
wave: 1
status: done
parallel_group: foundation
depends_on: []
blocked_by: []
spec_refs: [specs/03-contracts/public-api.md, specs/04-nfr/runtime-ci.md, specs/00-stack.md, specs/00-conventions.md]
write_scope: [packages/core/src/animation/animation-engine.ts, packages/core/src/index.ts, packages/core/src/dsl/index.ts, package.json, packages/core/package.json, rollup.config.ts, tsconfig.json, packages/core/tsconfig.json, tests/contracts/runtime-entrypoint.test.ts]
read_scope: [packages/core/src/animation/animation-engine.ts, packages/core/src/index.ts, packages/core/src/dsl/index.ts, package.json, packages/core/package.json, rollup.config.ts, tsconfig.json, packages/core/tsconfig.json, tests/scene-parser.test.ts, tests/scene-validator.test.ts]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/public-api.md, specs/04-nfr/runtime-ci.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-001: Restore Gates and Package Boundary

## Goal

Restore default verification and make the root runtime entrypoint separate from the dev-time DSL entrypoint.

## Spec Refs

- `specs/03-contracts/public-api.md`
- `specs/04-nfr/runtime-ci.md`
- `specs/00-stack.md`
- `specs/00-conventions.md`

## Context Digest

Default verification is red. `animation-engine.ts` has malformed braces. Root `@sebastianwessel/isostate` exports DSL parser/validator/compiler, violating the runtime/dev-time split. Root and package manifests both publish as `@sebastianwessel/isostate`, and build output paths do not line up with package exports.

execution_semantics: `in_process` for runtime exports and `local_process` for DSL exports.

## Implementation Approach

Repair the syntax break first, then align manifests and Rollup outputs so `@sebastianwessel/isostate` exposes runtime-only exports and `@sebastianwessel/isostate/dsl` exposes parser, validator, compiler, and serializers.

## Tasks

- Repair `AnimationEngine.init()` syntax.
- Remove DSL implementation exports from the runtime root.
- Keep DSL exports under `packages/core/src/dsl/index.ts`.
- Align manifests, TypeScript config, and Rollup outputs with the two entrypoints.
- Add a contract test for the runtime root export boundary.

## Read Scope

- `packages/core/src/animation/animation-engine.ts`
- `packages/core/src/index.ts`
- `packages/core/src/dsl/index.ts`
- `package.json`
- `packages/core/package.json`
- `rollup.config.ts`
- `tsconfig.json`
- `packages/core/tsconfig.json`
- existing `tests/*.test.ts`

## Write Scope

- `packages/core/src/animation/animation-engine.ts`
- `packages/core/src/index.ts`
- `packages/core/src/dsl/index.ts`
- `package.json`
- `packages/core/package.json`
- `rollup.config.ts`
- `tsconfig.json`
- `packages/core/tsconfig.json`
- focused tests under `tests/contracts/` when needed

## Required Behavior

- Fix the syntax error in `AnimationEngine.init()` without changing public semantics beyond making the file compile.
- Root runtime entrypoint `packages/core/src/index.ts` must not export `parseScene`, `validateScene`, `compileScene`, serializers, or other DSL implementation APIs.
- `packages/core/src/dsl/index.ts` remains the dev-time DSL entrypoint.
- Package manifests and build config produce separate runtime and DSL outputs matching the exports in `specs/03-contracts/public-api.md`.
- Default commands run without browser, network, credentials, or external services.
- Approved deferral: documentation and examples are handled by `TICKET-009`.
- CLI commands are not added.

## Acceptance

- `bun run typecheck` passes.
- `bun run lint` passes or reports only issues in tickets outside this write scope.
- `bun test` no longer fails because of syntax errors.
- `bun run build` produces runtime and DSL outputs matching package exports.
- A contract test proves importing the root runtime entrypoint does not expose DSL APIs.

## Verification

```bash
bun run typecheck
bun run lint
bun test
bun run build
```

## Contract Readiness

status: ready

required_contracts:

- `specs/03-contracts/public-api.md`
- `specs/04-nfr/runtime-ci.md`

missing_contracts: []

## Decision Ledger

- CLI is deferred by readiness report and must not be implemented.
- Runtime root and DSL entrypoint are separate deployment surfaces.
- Default CI commands are hermetic.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| `@sebastianwessel/isostate` runtime exports | `03-contracts/public-api.md` | `packages/core/src/index.ts`, manifests |
| `@sebastianwessel/isostate/dsl` exports | `03-contracts/public-api.md` | `packages/core/src/dsl/index.ts`, manifests |
| default CI gates | `04-nfr/runtime-ci.md` | root package scripts, build config |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| syntax and type baseline restored | `bun run typecheck` |
| formatting/lint baseline restored | `bun run lint` |
| existing tests executable | `bun test` |
| package exports build | `bun run build` |
| root excludes DSL API | `tests/contracts/runtime-entrypoint.test.ts` |

## Non-goals

- Implementing `mountScene`.
- Implementing runtime bundle digest checks.
- Implementing CLI.

## Handoff

Parallel core agents can rely on passing default gates and separate runtime/DSL entrypoints.
