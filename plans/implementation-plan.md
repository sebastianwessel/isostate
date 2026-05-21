# Isostate Implementation Plan

## Status

Current implementation is not spec-compliant and default verification is red. The first foundation wave repairs shared gates and package boundaries. Parallel implementation starts only after the foundation wave passes.

## Verification Baseline

Observed on 2026-05-20:

- `bun test`: fails 3 DSL tests.
- `bun run typecheck`: fails on syntax errors in `packages/core/src/animation/animation-engine.ts`.
- `bun run lint`: fails on formatting plus the same parse error.
- `bun run build`: blocked by Rollup config/package boundary issues.

## Waves

| Wave | Goal | Parallelism |
|---|---|---|
| `wave_01_foundation` | Restore default gates and enforce runtime/dev-time package boundary. | Sequential. All later tickets depend on this. |
| `wave_02_parallel_core` | Implement spec-compliant DSL/compiler/runtime/documentation/NFR slices. | Parallel after the foundation wave. |

## Deferred Scope

`@isostate/cli` remains deferred. Specs mention it as planned, but no CLI command contract exists. No implementation ticket may add CLI commands until a CLI contract is added.

## Agent Execution Rules

- Agents must read only the `spec_refs` and `read_scope` named in their ticket.
- Agents must write only files in their ticket `write_scope`.
- Agents must not introduce new public behavior outside the linked specs.
- Parallel core tickets are intended for parallel execution only after the foundation wave passes.
- Default verification commands remain hermetic: `bun run typecheck`, `bun run lint`, `bun test`, `bun run build`.
