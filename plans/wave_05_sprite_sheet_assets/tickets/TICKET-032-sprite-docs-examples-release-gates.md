---
id: TICKET-032
title: Complete sprite sheet docs examples and release gates
wave: 5
status: pending
parallel_group: sprite_sheet_032_finish
depends_on: [TICKET-025, TICKET-026, TICKET-027, TICKET-028, TICKET-029, TICKET-030, TICKET-031]
blocked_by: [TICKET-025, TICKET-026, TICKET-027, TICKET-028, TICKET-029, TICKET-030, TICKET-031]
spec_refs: [docs/reference/public-api.md, docs/reference/runtime-bundle.md, docs/reference/types.md, docs/examples/custom-assets.md, docs/examples/asset-manifest.md, specs/04-nfr/runtime-ci.md, skills/authoring-isostate-scenes/references/assets.md]
write_scope: [docs, skills/authoring-isostate-scenes, examples, tests/nfr, tests/fixtures/sprite-sheet-assets, specs/.readiness-report.yaml]
read_scope: [docs, skills/authoring-isostate-scenes, examples, tests/nfr, specs, packages/core/src, packages/cli/src, packages/editor/src]
contract_readiness:
  status: ready
  required_contracts: [specs/04-nfr/runtime-ci.md, docs/reference/public-api.md, docs/reference/runtime-bundle.md, docs/reference/types.md, docs/examples/custom-assets.md, docs/examples/asset-manifest.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-032: Sprite Docs Examples Release Gates

## Goal

Finish public documentation, examples, authoring skill guidance, and release
verification for sprite sheet assets after code implementation is complete.

## Context Digest

Sprite sheets are a public DSL, runtime bundle, CLI, manifest, and editor
workflow. Docs must show the flat sprite-id authoring UX, required `sheetSize`,
tuple and verbose sprite forms, supported extensions, `.gif` rejection, static
bundle behavior, asset manifest metadata, editor drag behavior, and runtime
compiled bundle shape. The authoring skill must guide AI agents to use nested
sprite ids and avoid sheet namespace ids in element placements.

execution_semantics: data_only.

Durable manifest semantics: docs must describe asset manifest version `1`,
documented URL or sprite-sheet schema, `sha256:<hex>` digest behavior, immutable
generation snapshots, replay from literal JSON, and canonical sorted entries.

## Implementation Approach

Update docs and examples only after earlier implementation tickets establish
actual behavior and test fixtures. Keep docs examples focused and executable by
existing docs-path and fixture checks. Update readiness report for the
sprite-sheet feature after all verification passes.

## Tasks

- Add or update a focused sprite sheet example in `docs/examples/custom-assets.md`.
- Add or update manifest metadata and output examples in
  `docs/examples/asset-manifest.md`.
- Update reference docs for public API, types, runtime bundle, errors, and
  editor behavior.
- Update static deployment and author-scene guides with sprite sheet asset
  resolution.
- Update `skills/authoring-isostate-scenes/references/assets.md` and deployment
  guidance.
- Add example fixture assets under `examples` or `tests/fixtures` with a small
  transparent PNG/WebP sheet fixture.
- Add NFR/docs tests that prevent reverting docs to SVG-only asset language.
- Run full default release gates.
- Update `specs/.readiness-report.yaml`
  `feature_readiness.sprite_sheet_assets.verification` with final pass results.

## Acceptance

- Public docs include minimal sprite sheet setup and advanced `rect` form.
- Docs explain that elements reference nested sprite ids.
- Docs explain supported extensions and `.gif` rejection.
- Asset manifest docs include sprite sheet metadata and generated output shape.
- Authoring skill reference includes sprite sheet rules.
- Docs-path tests pass.
- Full default release verification passes.

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| docs inventory | `bun test tests/nfr/docs-paths.test.ts` |
| no stale SVG-only wording | `rg -n "external SVG assets|browser-loadable SVG files" specs docs skills/authoring-isostate-scenes` |
| typecheck | `bunx tsc --noEmit` |
| lint/format | `bunx biome check packages/core/src packages/cli/src packages/editor/src tests docs specs skills/authoring-isostate-scenes` |
| all tests | `bun test` |
| build | `bun run build` |
| size | `bun run size` |
| spec check | `node /Users/sebastianwessel/.agents/skills/spec-architect/scripts/check_specs.mjs specs` |

## Verification

```bash
bun test tests/nfr/docs-paths.test.ts
bunx tsc --noEmit
bunx biome check packages/core/src packages/cli/src packages/editor/src tests docs specs skills/authoring-isostate-scenes
bun test
bun run build
bun run size
node /Users/sebastianwessel/.agents/skills/spec-architect/scripts/check_specs.mjs specs
```

## Decision Ledger

| Decision | Source |
|---|---|
| Docs must teach flat sprite-id UX | `docs/reference/public-api.md`, `specs/03-contracts/scene-schema.md` |
| Authoring skill must stay in sync with asset rules | AGENTS.md required sync discipline |
| Full verification is required before readiness completion | `specs/04-nfr/runtime-ci.md` |

## Contract Traceability

| Surface | Contract | Owner Files | Tests |
|---|---|---|---|
| public docs | reference docs and examples | `docs` | `docs-paths.test.ts` |
| authoring skill | asset rules | `skills/authoring-isostate-scenes` | docs-path/skill tests |
| final readiness | readiness report | `specs/.readiness-report.yaml` | spec check |
| release gates | NFR | root scripts | full commands |

## Non-goals

- New runtime behavior.
- New parser, compiler, CLI, or editor behavior beyond documentation fixes for
  completed tickets.
- Marketing pages.

## Handoff

After this ticket passes, sprite sheet assets are implemented end to end and the
feature readiness block can remain marked implementation-complete with evidence.
