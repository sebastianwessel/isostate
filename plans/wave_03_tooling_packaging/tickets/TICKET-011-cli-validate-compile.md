---
id: TICKET-011
title: Add @sebastianwessel/isostate-cli package with validate and compile
wave: 3
status: done
parallel_group: cli_core
depends_on: [TICKET-010]
blocked_by: []
spec_refs: [specs/03-contracts/cli.md, specs/03-contracts/runtime-bundle.md, specs/03-flows/dsl-to-runtime.md]
write_scope: [packages/cli, package.json, tests/cli/validate.test.ts, tests/cli/compile.test.ts]
read_scope: [packages/core/src/dsl, packages/core/package.json, specs/03-contracts/cli.md, specs/03-contracts/runtime-bundle.md]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/cli.md, specs/03-contracts/runtime-bundle.md]
  missing_contracts: []
ticket_readiness:
  status: done
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-011: CLI Validate and Compile

## Goal

Create `@sebastianwessel/isostate-cli` with the `isostate validate` and `isostate compile`
commands.

## Context Digest

The core DSL entrypoint already parses, validates, compiles, and serializes
runtime bundles. This ticket wraps that behavior in a local-process CLI package.

execution_semantics: `local_process`.

## Implementation Approach

Create a focused `packages/cli` package with a small command dispatcher and
command modules for `validate` and `compile`. Keep command behavior thin and
delegate schema semantics to `@sebastianwessel/isostate/dsl`.

## Tasks

- Add `packages/cli/package.json`, TypeScript config, and bin entry.
- Add CLI dispatcher and shared diagnostic helpers.
- Implement `validate`.
- Implement `compile`.
- Add CLI tests for success and failure cases.

## Required Behavior

- `packages/cli/package.json` publishes a `bin` named `isostate`.
- `isostate validate <input>` parses and validates YAML, prints stable error
  codes, exits `0` for valid input and `1` for parse/validation/file errors.
- `isostate compile <input> --out <path> --format js|json --pretty` validates
  before writing and writes canonical runtime bundle output.
- CLI code imports `@sebastianwessel/isostate/dsl` and never imports runtime DOM modules.

## Acceptance

- Tests cover valid validation, invalid validation, JS compile, JSON compile,
  unsupported format, and missing input.
- Root scripts expose a local way to run the CLI in development.

## Verification

```bash
bun test tests/cli/validate.test.ts tests/cli/compile.test.ts
bun run typecheck
bun run lint
```

## Decision Ledger

- CLI command behavior is fixed by `specs/03-contracts/cli.md`.
- Docs/examples work has an approved deferral to Ticket 014.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| `isostate validate` | `specs/03-contracts/cli.md` | `packages/cli`, `tests/cli/validate.test.ts` |
| `isostate compile` | `specs/03-contracts/cli.md` | `packages/cli`, `tests/cli/compile.test.ts` |
| runtime serialization | `specs/03-contracts/runtime-bundle.md` | `@sebastianwessel/isostate/dsl` usage |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| valid input exits 0 | `tests/cli/validate.test.ts` |
| invalid input exits 1 with codes | `tests/cli/validate.test.ts` |
| JS and JSON output written | `tests/cli/compile.test.ts` |
| unsupported format fails | `tests/cli/compile.test.ts` |

## Non-goals

- Implementing `bundle` or `inspect`.
- Writing deployment docs; approved deferral to Ticket 014.

## Handoff

After this ticket, Ticket 013 can reuse the CLI package structure.
