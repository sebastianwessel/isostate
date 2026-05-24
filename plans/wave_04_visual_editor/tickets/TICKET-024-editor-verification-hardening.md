---
id: TICKET-024
title: Harden editor verification and dependency boundaries
wave: 4
status: pending
parallel_group: editor_finish
depends_on: [TICKET-015, TICKET-016, TICKET-017, TICKET-018, TICKET-019, TICKET-020, TICKET-021, TICKET-022, TICKET-023]
blocked_by: [TICKET-015, TICKET-016, TICKET-017, TICKET-018, TICKET-019, TICKET-020, TICKET-021, TICKET-022, TICKET-023]
spec_refs: [specs/00-stack.md, specs/03-contracts/editor.md, specs/03-contracts/public-api.md]
write_scope: [tests/nfr/runtime-boundary.test.ts, tests/contracts/package-exports.test.ts, tests/editor, tests/editor-support, scripts, package.json, plans]
read_scope: [packages/core/package.json, packages/editor/package.json, packages/cli/package.json, rollup.config.ts, specs/00-stack.md]
contract_readiness:
  status: ready
  required_contracts: [specs/00-stack.md, specs/03-contracts/editor.md, specs/03-contracts/public-api.md]
  missing_contracts: []
ticket_readiness:
  status: ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-024: Editor Verification Hardening

## Goal

Close Wave 04 by proving package exports, runtime boundaries, default tests,
typecheck, lint, and build all pass with the editor package included.

## Context Digest

V1 does not require browser automation. The risk is dependency leakage:
CodeMirror, React, Radix, YAML editor tooling, parser/compiler code, and editor
code must not become imports of the core runtime or static deployment runtime.

execution_semantics: local verification.

## Implementation Approach

Strengthen existing NFR and contract tests rather than adding broad browser
automation. Update planning status only after commands pass.

## Tasks

- Extend runtime-boundary tests to assert core runtime and static runtime do not
  import editor package, React, CodeMirror, Radix, CLI, filesystem, or browser
  DSL parser/compiler modules.
- Extend package export tests for core `./dsl/browser`, core
  `./editor-support`, and editor package exports.
- Ensure `bun test` covers editor, editor-support, and asset manifest tests by
  default.
- Ensure `bun run build` emits declarations and ESM for core, CLI, and editor.
- Ensure `bun run lint` covers `packages/editor`.
- Update plan status files to mark Wave 04 tickets complete only when their
  acceptance commands have passed.

## Required Behavior

- Default root verification remains hermetic and does not require browser
  automation.
- Runtime package size check remains scoped to core runtime, not editor package.
- Editor dependencies are isolated to `packages/editor` outputs.

## Acceptance

- `bun test` passes.
- `bun run build` passes.
- `bun run typecheck` passes.
- `bun run lint` passes.
- Runtime boundary tests explicitly cover editor dependency isolation.

## Verification

```bash
bun test
bun run build
bun run typecheck
bun run lint
```

## Decision Ledger

- No Playwright requirement for v1.
- Manual visual review is acceptable until a later UI automation wave.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| dependency isolation | `specs/00-stack.md` | `tests/nfr/runtime-boundary.test.ts` |
| package exports | `specs/03-contracts/public-api.md` | `tests/contracts/package-exports.test.ts` |
| editor verification | `specs/03-contracts/editor.md` | `tests/editor` |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| all tests pass | `bun test` |
| build passes | `bun run build` |
| type/lint pass | `bun run typecheck`, `bun run lint` |
| boundaries enforced | `tests/nfr/runtime-boundary.test.ts` |

## Non-goals

- Adding browser automation.
- Performance tuning beyond obvious test/runtime issues.

## Handoff

After this ticket, Wave 04 is complete and can be reviewed for release.

