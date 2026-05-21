---
name: authoring-isostate-scenes
description: Authors, reviews, or fixes isostate .isostate.yaml scene DSL, examples, asset catalogs, visual connections, scene deltas, and converter outputs. Use when working on isostate scenes, demo YAML, generated runtime bundles, or documentation that teaches developers how to define isometric visualizations.
---

# Authoring Isostate Scenes

Use this skill when creating or reviewing isostate scene definitions and examples.

## Core Workflow

1. Read the relevant reference file only when needed:
   - DSL shape and scene deltas: `references/dsl.md`
   - Connections, routing, markers, and removal rules: `references/connections.md`
   - Asset catalogs, anchors, floor, text labels, and generated primitives:
     `references/assets.md`
   - Complete YAML examples: `references/examples.md`
   - Static deploy and CLI bundle workflow: `references/deployment.md`
2. Prefer the current public DSL:
   - first scene: top-level `elements` and optional `connections`
   - later scenes: `add`, `update`, `remove` sections with nested `elements` and/or `connections`
   - public YAML uses `connections`; runtime internals may use connector terminology
3. Keep authored YAML human-readable:
   - use full grid-cell coordinates for hand-authored `at` and manual `route`
   - use `from`/`to` instead of fractional manual routes when connecting to element sides
   - omit unchanged objects in later scenes
4. When changing specs, implementation, docs, or examples, verify the DSL against `specs/03-contracts/scene-schema.md`.
5. Keep source YAML and generated bundles together. If an example
   `.isostate.yaml` changes, regenerate its `.isostate.js`/`.isostate.json`
   output in the same change. If the example is meant for static website
   deployment, verify `isostate bundle` output as well.
6. Run available checks after edits:
   ```bash
   node /Users/sebastianwessel/.agents/skills/spec-architect/scripts/check_specs.mjs specs
   bun test tests/nfr/docs-paths.test.ts tests/nfr/assets-manifest.test.ts
   ```

## Guardrails

- Do not write old authored `states`, `keyframes`, scene `at`, element `pos`, or top-level `elements` outside the first scene.
- Do not use `addConnectors`, `updateConnectors`, or `removeConnectors`; use nested `add.connections`, `update.connections`, and `remove.connections`.
- Do not stretch SVG arrow assets for flows. Use `connections`.
- Do not declare built-in generated assets in `header.assets`: `text`,
  `rectangle`, `circle`, `polygon`, or `line`.
- Do not use fractional `size` values in authored YAML. Do not enlarge imported
  composite SVGs with `size` unless the SVG was authored for that footprint;
  split multi-object SVGs when possible, or keep `size: 1` with a checked
  anchor.
- Do not auto-remove connections when an endpoint element is removed; remove those connections explicitly in the same scene.
- Do not put parser, validator, compiler, YAML parsing, or routing packages in browser runtime code.
- Do not treat static bundle output as source. Author YAML first, then generate
  `scene.isostate.js`, copied assets, `isostate.runtime.js`, and
  `manifest.json` with the CLI.
