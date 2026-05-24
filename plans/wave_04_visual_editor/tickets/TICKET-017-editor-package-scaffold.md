---
id: TICKET-017
title: Scaffold @sebastianwessel/isostate-editor package
wave: 4
status: pending
parallel_group: editor_package_foundation
depends_on: [TICKET-015]
blocked_by: [TICKET-015]
spec_refs: [specs/03-contracts/editor.md, specs/00-stack.md]
write_scope: [packages/editor, package.json, rollup.config.ts, tsconfig.json, tests/editor/mount-editor.test.tsx, tests/contracts/package-exports.test.ts]
read_scope: [packages/core/package.json, packages/cli/package.json, specs/03-contracts/editor.md]
contract_readiness:
  status: ready
  required_contracts: [specs/03-contracts/editor.md]
  missing_contracts: []
ticket_readiness:
  status: ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-017: Editor Package Scaffold

## Goal

Create the `@sebastianwessel/isostate-editor` package with ESM exports, React
entrypoints, shipped CSS, and basic mount/unmount behavior.

## Context Digest

The editor package is browser authoring UI. Consumers import JS and
`@sebastianwessel/isostate-editor/style.css`; they must not need Tailwind or a
shadcn setup.

execution_semantics: `in_process` browser UI package and `data_only` package
metadata.

## Implementation Approach

Add a focused package with `mountEditor`, `IsostateEditor`, `style.css`, and
type exports. Add build wiring without changing core runtime bundle semantics.

## Tasks

- Add `packages/editor/package.json` with exports `.`, `./react`, and
  `./style.css`.
- Add editor `tsconfig.json` and source layout.
- Add `src/index.ts`, `src/react.ts`, `src/IsostateEditor.tsx`, `src/types.ts`,
  and `src/style.css`.
- Add `mountEditor(target, options)` that creates a React root and returns
  `MountedEditor`.
- Add `destroy()` that unmounts React and empties only editor-owned DOM.
- Extend root build/clean/typecheck/lint scripts for editor declarations and
  ESM output.
- Add tests for package exports and mount/destroy lifecycle.

## Required Behavior

- React and React DOM are peer dependencies of the editor package.
- Core runtime package does not import editor package code.
- Editor CSS is shipped as a package export and uses CSS variables plus `.dark`.
- `mountEditor` and `IsostateEditor` exist even before full UI features land.

## Acceptance

- `import '@sebastianwessel/isostate-editor'`,
  `@sebastianwessel/isostate-editor/react`, and
  `@sebastianwessel/isostate-editor/style.css` are valid package exports.
- `mountEditor` creates and destroys without leaking DOM under the target.

## Verification

```bash
bun test tests/editor/mount-editor.test.tsx tests/contracts/package-exports.test.ts
bun run typecheck
bun run lint
bun run build
```

## Decision Ledger

- No Tailwind requirement for consumers.
- The editor package is embeddable; standalone persistence is host-owned.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| editor package exports | `specs/03-contracts/editor.md` | `packages/editor/package.json` |
| mount API | `specs/03-contracts/editor.md` | `packages/editor/src/index.ts` |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| package exports work | `tests/contracts/package-exports.test.ts` |
| mount/destroy works | `tests/editor/mount-editor.test.tsx` |
| build includes editor | `bun run build` |

## Non-goals

- Full canvas or inspector UI.
- Asset manifest provider.

## Handoff

After this ticket, workspace, command, and UI tickets can add real behavior to
the package.

