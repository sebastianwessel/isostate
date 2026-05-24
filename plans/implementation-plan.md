# Isostate Implementation Plan

## Status

Core runtime, DSL, rendering, animation, docs, and example work are implemented
against the current specs. The remaining work is the tooling and packaging wave:
turn the working compiler/runtime into a public CLI and static deployment
bundle workflow.

## Verification Baseline

Observed on 2026-05-22:

- `bun run typecheck`: passes.
- `bun run lint`: passes.
- `bun run build`: passes.
- `bun run size`: passes with runtime entrypoint at `19641` bytes gzipped.
- `bun test`: passes from a clean checkout; dist-dependent tests build the
  required runtime artifact when it is absent.
- Wave 04 complete: editor package exports, runtime boundaries, and dist
  entrypoints all verified.

## Waves

| Wave | Goal | Parallelism |
|---|---|---|
| `wave_01_foundation` | Restore default gates and enforce runtime/dev-time package boundary. | Sequential. All later tickets depend on this. |
| `wave_02_parallel_core` | Implement spec-compliant DSL/compiler/runtime/documentation/NFR slices. | Parallel after the foundation wave. |
| `wave_03_tooling_packaging` | Add CLI, standalone static bundle output, package publishing checks, and deployment docs. | Sequential foundation ticket, then package/runtime/bundle/docs slices. |
| `wave_04_visual_editor` | Add browser visual editor, asset manifest generation, editor-support core helpers, Astro/static embedding, and editor package verification. | Parallel foundation slices, then editor package/state/UI slices, then docs/verification. |
| `wave_05_sprite_sheet_assets` | Implement first-class sprite sheet assets end to end across DSL, runtime, CLI, manifest, editor, docs, and verification. | Sequential. Shared asset contracts and generated outputs make parallel execution unsafe. |

## Deferred Scope

`@sebastianwessel/isostate-cli` is no longer deferred. It is specified in
`specs/03-contracts/cli.md`, with static deployment output specified in
`specs/03-contracts/static-bundle.md`.

Still deferred:

- Mermaid converter implementation.
- Server-side rendering.
- Three.js or CSS 3D transforms.

## Agent Execution Rules

- Agents must read only the `spec_refs` and `read_scope` named in their ticket.
- Agents must write only files in their ticket `write_scope`.
- Agents must not introduce new public behavior outside the linked specs.
- Parallel core tickets are intended for parallel execution only after the foundation wave passes.
- Default verification commands remain hermetic: `bun run typecheck`, `bun run lint`, `bun test`, `bun run build`.
- Wave 05 agents must implement only `feature_readiness.sprite_sheet_assets`
  behavior from `specs/.readiness-report.yaml`; unrelated editor readiness work
  remains outside the wave.
