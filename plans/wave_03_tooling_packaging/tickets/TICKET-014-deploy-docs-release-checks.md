---
id: TICKET-014
title: Add deployment docs, example output, and release checks
wave: 3
status: done
parallel_group: docs_release
depends_on: [TICKET-013]
blocked_by: []
spec_refs: [specs/03-contracts/cli.md, specs/03-contracts/static-bundle.md, specs/03-flows/static-deploy.md, specs/04-nfr/runtime-ci.md]
write_scope: [docs/guides/deploy-static-bundle.md, docs/examples/compile-yaml.md, docs/examples/inspect-bundle.md, examples/basic, package.json, tests/nfr]
read_scope: [specs/03-contracts/cli.md, specs/03-contracts/static-bundle.md, specs/03-flows/static-deploy.md, examples/basic]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/cli.md, specs/03-contracts/static-bundle.md, specs/04-nfr/runtime-ci.md]
  missing_contracts: []
ticket_readiness:
  status: done
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-014: Deployment Docs and Release Checks

## Goal

Document the static deployment workflow and add release checks for the new
packages and generated output.

## Context Digest

The CLI and static bundle command exist by this point. Public developer docs and
release checks must make the workflow discoverable and guard against packaging
regressions.

execution_semantics: `data_only` for docs, `local_process` for release checks,
and `in_process` for browser snippets using `mountScene`.

## Implementation Approach

Update focused docs and examples to prefer the CLI for deployment while keeping
SDK examples intact. Extend NFR checks so published packages and generated
static output stay aligned with specs.

## Tasks

- Finalize `docs/guides/deploy-static-bundle.md`.
- Update compile and inspect examples for CLI usage.
- Add an example script for generating the basic static bundle.
- Extend package release scripts and NFR tests for both packages.
- Run release-oriented checks.

## Required Behavior

- Add `docs/guides/deploy-static-bundle.md` with the public-folder workflow,
  generated directory shape, website import snippet, and common path guidance.
- Update compile and inspect docs to reference the CLI where appropriate.
- Add an example script for generating `examples/basic` static bundle output.
- Extend NFR tests so docs paths and package scripts cover CLI/static bundle
  release readiness.
- `publint` covers both publishable packages.

## Acceptance

- Docs mention that browser output never includes YAML/parser/compiler code.
- Example generation command produces the documented output shape.
- Release checks pass for affected packages.

## Verification

```bash
bun test tests/nfr
bun run build
bun run size
bun run publint
```

## Decision Ledger

- Static deployment docs are required by the public API inventory.
- CLI publishing checks cover `@sebastianwessel/isostate-cli`; runtime checks continue to cover
  `@sebastianwessel/isostate`.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| deploy guide | `specs/03-flows/static-deploy.md` | `docs/guides/deploy-static-bundle.md` |
| CLI examples | `specs/03-contracts/cli.md` | `docs/examples/compile-yaml.md`, `docs/examples/inspect-bundle.md` |
| release checks | `specs/04-nfr/runtime-ci.md` | `package.json`, `tests/nfr` |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| docs paths exist | `tests/nfr/docs-paths.test.ts` |
| release scripts cover packages | `tests/nfr/package-scripts.test.ts` |
| runtime size still passes | `bun run size` |
| package lint passes | `bun run publint` |

## Non-goals

- Implementing new CLI behavior beyond documentation and release polish.
- Adding default browser automation.

## Handoff

After this ticket, Wave 03 is complete and the project is ready for package
publishing or PR preparation.
