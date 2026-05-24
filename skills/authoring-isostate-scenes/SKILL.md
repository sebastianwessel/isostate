---
name: authoring-isostate-scenes
description: Authors, reviews, or fixes isostate .isostate.yaml scene DSL, examples, asset catalogs, visual connections, scene deltas, and converter outputs. Use when working on isostate scenes, demo YAML, generated runtime bundles, or documentation that teaches developers how to define isometric visualizations.
---

# Authoring Isostate Scenes

Use this skill when creating or reviewing isostate scene definitions and examples.

## Core Workflow

1. Start from the user-visible story, not from YAML fields:
   - define the audience and the one thing each scene step should explain
   - follow the public docs flow when teaching or creating a new scene:
     `docs/concepts/how-isostate-works.md` →
     `docs/guides/plan-a-scene.md` → `docs/guides/assets-workflow.md` →
     `docs/guides/animation-and-connections.md` →
     `docs/guides/use-the-cli.md` → `docs/guides/deploy-static-bundle.md`
   - choose an authoring path: manual YAML, website editor, or AI-assisted draft
   - identify required assets before writing a long timeline
2. Read the relevant reference file only when needed:
   - DSL shape and scene deltas: `references/dsl.md`
   - Connections, routing, markers, and removal rules: `references/connections.md`
   - Asset catalogs, anchors, floor, text labels, and generated primitives:
     `references/assets.md`
   - Complete YAML examples: `references/examples.md`
   - CLI validation, compile, bundle, inspect, and static deploy workflow:
     `references/deployment.md`
3. Prefer the current public DSL:
   - first scene: top-level `elements` and optional `connections`
   - later scenes: `add`, `update`, `remove` sections with nested `elements` and/or `connections`
   - public YAML uses `connections`; runtime internals may use connector terminology
4. Keep authored YAML human-readable:
   - use full grid-cell coordinates for hand-authored `at` and manual `route`
   - use `from`/`to` instead of fractional manual routes when connecting to element sides
   - omit unchanged objects in later scenes
5. Treat assets as their own publishable catalog:
   - standalone SVGs for one object per file
   - sprite sheets for generated raster catalogs or many small objects
   - one manifest per asset family; do not mix catalog ownership
   - review anchors against the grid before using an asset repeatedly
6. When changing specs, implementation, docs, or examples, verify the DSL against `specs/03-contracts/scene-schema.md`.
7. Use the CLI for build-time verification:
   - `isostate validate` before treating authored YAML as valid
   - `isostate compile` when generating `.isostate.js` or `.isostate.json`
   - `isostate bundle` when generating static website output
   - `isostate inspect` when checking generated metadata or stale artifacts
   - `isostate assets manifest` when creating editor asset catalogs
8. Keep source YAML and generated bundles together. If an example
   `.isostate.yaml` changes, regenerate its `.isostate.js`/`.isostate.json`
   output in the same change. If the example is meant for static website
   deployment, verify `isostate bundle` output as well.
9. Run available checks after edits:
   ```bash
   node /Users/sebastianwessel/.agents/skills/spec-architect/scripts/check_specs.mjs specs
   bun test tests/nfr/docs-paths.test.ts tests/nfr/assets-manifest.test.ts
   ```
10. For a publishable change, confirm the full path: authored YAML/editor state,
    asset manifests, validation, compile/bundle output, inspect metadata, docs
    links, and generated examples are in sync.

## Guardrails

- Do not write old authored `states`, `keyframes`, scene `at`, element `pos`, or top-level `elements` outside the first scene.
- Do not use `addConnectors`, `updateConnectors`, or `removeConnectors`; use nested `add.connections`, `update.connections`, and `remove.connections`.
- Do not stretch SVG arrow assets for flows. Use `connections`.
- Do not declare built-in generated assets in `header.assets`: `text`,
  `rectangle`, `circle`, `polygon`, or `line`.
- For theme-aware colors, use semantic CSS variables such as
  `var(--iso-label)` or `var(--iso-flow)` in YAML and define their values in
  host CSS. Prefer the shadcn-compatible `.dark` root class for dark mode. Do
  not create separate light/dark scene branches or hard-code both palettes into
  the DSL.
- For `asset: text`, always include the `text.value` field on placements. Empty
  `value: ""` is allowed only when an invisible or deferred label is
  intentional; otherwise write visible text. Treat `EMPTY_TEXT_CONTENT` as a
  warning to review, not as a blocker.
- Do not use fractional `size` values in authored YAML. New placements require
  positive whole-cell `size` values; `update.elements[].size: 0` is allowed only
  to scale an existing element to zero. Do not enlarge imported composite SVGs
  with `size` unless the SVG was authored for that footprint; split
  multi-object SVGs when possible, or keep `size: 1` with a checked anchor.
- Do not auto-remove connections when an endpoint element is removed; remove those connections explicitly in the same scene.
- Do not put parser, validator, compiler, YAML parsing, or routing packages in browser runtime code.
- Do not treat static bundle output as source. Author YAML first, then generate
  `scene.isostate.js`, copied assets, `isostate.runtime.js`, and
  `manifest.json` with the CLI.
- Do not add `theme: light` or `header.className` only for light/dark mode.
  Use semantic CSS variables in YAML and let host CSS define defaults plus
  shadcn-compatible `.dark` overrides; target the built-in `.iso-scene` class
  unless a document-specific SVG hook is required.
