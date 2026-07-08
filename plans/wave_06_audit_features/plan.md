# Wave 06: Audit Features

## Goal

Implement the improvement backlog from the 2026-07 repository audit, except
the built-in component library: snapshot export, mermaid2dsl converter,
element interactivity, diagnostics overlay, CLI help + diagnostics grouping,
error-code documentation completeness, and the CI coverage gate (including
raising coverage to the required 80%).

## Source Specs

Every ticket implements an already-written spec. Implementers MUST NOT make
behavioral decisions: when a needed behavior is not in the spec, stop and
escalate instead of choosing.

| Ticket | Spec |
|---|---|
| TICKET-033 | `specs/02-capabilities/export.md` |
| TICKET-034 | `specs/02-capabilities/dsl/mermaid2dsl.md`, `specs/03-contracts/cli.md` (`mermaid2dsl` section), `specs/03-contracts/errors.md` (Converter section) |
| TICKET-035 | `specs/03-contracts/cli.md` (Help + Diagnostics sections) |
| TICKET-036 | `specs/02-capabilities/interactivity.md` |
| TICKET-037 | `specs/02-capabilities/diagnostics-overlay.md` |
| TICKET-038 | `specs/03-contracts/errors.md` (Documentation Completeness section) |
| TICKET-039 | `specs/04-nfr/runtime-ci.md` (CI Gates), `IMPLEMENTATION.md` (coverage >80%) |

## Dependency Order and Parallelism

Slots run in order; tickets within a slot run in parallel (disjoint files):

1. Slot A (parallel): `TICKET-033` (core: export), `TICKET-034` (cli:
   converter), `TICKET-038` (docs/nfr-test: error docs completeness).
2. Slot B (parallel): `TICKET-036` (core: interactivity), `TICKET-035`
   (cli: help/diagnostics), `TICKET-039` (tests: coverage raise + CI
   workflow).
3. Slot C: `TICKET-037` (core: diagnostics overlay; depends on
   `MOUNT_DESTROYED` from TICKET-036 and export's overlay-stripping from
   TICKET-033).

File-ownership rule: a ticket may only modify the files listed in its
"Files" section. Shared files (`packages/core/src/index.ts`,
`packages/cli/src/commands.ts`, `docs/reference/public-api.md`,
`docs/reference/errors.md`, `docs/README.md`, `README.md`) are only ever
owned by one ticket per slot.

## Verification (every ticket)

`bun test <ticket test files>`, then at slot end the full chain:
`bun test`, `bun run typecheck`, `bun run lint`, `bun run build`,
`bun run size`, `bun run publint`. TICKET-039 additionally makes
`bun run coverage` pass.

## Non-Goals

- Built-in isometric component/asset library (audit item 3, explicitly
  excluded).
- Any DSL/schema/runtime-bundle format change.
- Node-side snapshot export, animated export, keyboard/ARIA interactivity,
  Mermaid features beyond the specified subset.
