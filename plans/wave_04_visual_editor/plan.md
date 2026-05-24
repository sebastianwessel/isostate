# Browser Visual Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v1 browser visual editor as a separate `@sebastianwessel/isostate-editor` package while reusing the core renderer, projection, camera, layer, validation, and compiler logic.

**Architecture:** The editor is an authoring package layered around core runtime previews. Core adds browser-safe `dsl/browser` and `editor-support` entrypoints; the editor owns workspace state, semantic commands, overlays, inspector controls, asset browser state, CodeMirror YAML editing, import/export, and Astro/static embedding docs.

**Tech Stack:** Bun, TypeScript, ESM, Biome, core SVG runtime via `mountScene`, React, Radix primitives, shipped CSS variables, CodeMirror 6, browser-safe DSL APIs.

---

# Wave 04: Browser Visual Editor

## Goal

Build the v1 browser visual editor as a separate `@sebastianwessel/isostate-editor`
package while reusing the core renderer, projection, camera, layer, validation,
and compiler logic.

## Architecture

The editor is an authoring package layered around core runtime previews. Core
adds browser-safe `dsl/browser` and `editor-support` entrypoints; the editor
owns workspace state, semantic commands, overlays, inspector controls, asset
browser state, CodeMirror YAML editing, import/export, and Astro/static
embedding docs.

## Tech Stack

- Bun, TypeScript, ESM, Biome.
- Core runtime SVG renderer via `mountScene`.
- Browser-safe DSL parse/validate/compile through
  `@sebastianwessel/isostate/dsl/browser`.
- React + Radix primitives + shipped CSS variables, no Tailwind requirement for
  consumers.
- CodeMirror 6 for YAML editing.

## Sequence

Foundation:

- [ ] `TICKET-015-browser-safe-dsl-editor-support.md`
- [ ] `TICKET-016-cli-asset-manifest.md`

Editor package foundation:

- [ ] `TICKET-017-editor-package-scaffold.md`
- [ ] `TICKET-018-editor-workspace-commands-serializer.md`
- [ ] `TICKET-019-editor-asset-provider.md`

UI slices after editor foundation:

- [ ] `TICKET-020-runtime-preview-canvas-overlays.md`
- [ ] `TICKET-021-inspector-scenes-connections-camera.md`
- [ ] `TICKET-022-codemirror-yaml-sync.md`

Final integration:

- [ ] `TICKET-023-astro-docs-release-wiring.md`
- [ ] `TICKET-024-editor-verification-hardening.md`

## Parallelism

Tickets 015 and 016 can run in parallel after the current specs are accepted.
Tickets 017, 018, and 019 can start after Ticket 015 defines the public package
surface. Tickets 020, 021, and 022 depend on the editor package scaffold and
workspace command model. Tickets 023 and 024 close docs, release wiring, and
verification after the main implementation slices land.

## Completion Gate

- `bun test tests/editor tests/editor-support tests/cli/assets-manifest.test.ts`
  passes.
- `bun run typecheck` passes.
- `bun run lint` passes.
- `bun run build` emits core, CLI, and editor package declarations/ESM without
  pulling editor dependencies into the core runtime entrypoint.
- The editor can be embedded in Astro/static pages with a generated manifest URL.
