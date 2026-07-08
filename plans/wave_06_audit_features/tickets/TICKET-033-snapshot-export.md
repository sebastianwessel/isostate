---
id: TICKET-033
title: Snapshot export (SVG string, PNG blob)
wave: 6
status: done
parallel_group: wave06_slot_a
depends_on: []
blocked_by: []
spec_refs: [specs/02-capabilities/export.md, specs/03-contracts/errors.md, specs/03-contracts/public-api.md]
write_scope: [packages/core/src/runtime/export.ts, packages/core/src/index.ts, tests/runtime/export.test.ts, docs/reference/public-api.md, docs/examples/export-snapshot.md, docs/README.md, README.md]
read_scope: [packages/core/src, specs/02-capabilities/export.md, specs/03-contracts/errors.md, tests/runtime/mount-scene.test.ts]
contract_readiness:
  status: ready
  required_contracts: [specs/02-capabilities/export.md, specs/03-contracts/errors.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-033: Snapshot Export

## Goal

Implement `exportSceneSvg` / `exportScenePng` exactly per
`specs/02-capabilities/export.md`.

## Steps

1. Create `packages/core/src/runtime/export.ts` implementing the normative
   behavior list (steps 1-8) of the spec, using `RenderError` from
   `packages/core/src/types/errors.ts` with the four spec'd codes.
2. Export both functions plus `SnapshotOptions`/`PngSnapshotOptions` from
   `packages/core/src/index.ts` with JSDoc. Do NOT import the module from
   `packages/core/src/browser-runtime.ts`.
3. Add `tests/runtime/export.test.ts` covering every bullet in the spec's
   Testing section. Follow the DOM-shim pattern of
   `tests/runtime/mount-scene.test.ts`; extend the shim only with
   real-DOM-faithful behavior.
4. Write `docs/examples/export-snapshot.md` and the public-api reference
   section per the spec's Documentation section; add the docs-tree links.

## Done Criteria

- All spec Testing bullets have passing tests.
- `bun run size` unchanged budget passes (export not in standalone runtime;
  verify `packages/core/dist/browser/isostate.runtime.js` does not contain
  the string "EXPORT_TARGET_DESTROYED" after `bun run build`).
- Docs build links resolve (`bun test tests/nfr/docs-paths.test.ts`).
