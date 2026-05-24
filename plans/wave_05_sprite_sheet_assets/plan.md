# Wave 05: Sprite Sheet Assets

## Goal

Implement first-class sprite sheet assets end to end from authored YAML through
validation, compilation, runtime rendering, CLI/static deployment, asset
manifest discovery, editor use, docs, examples, and release verification.

## Readiness

This wave is scoped to `specs/.readiness-report.yaml`
`feature_readiness.sprite_sheet_assets`, which is approved for implementation
planning. The top-level readiness report remains pending for unrelated editor
specs and is not changed by this wave.

## Dependency Order

1. `TICKET-025` updates shared public type contracts and test fixtures.
2. `TICKET-026` implements parser and validator support.
3. `TICKET-027` implements compiler and runtime bundle serialization support.
4. `TICKET-028` implements runtime rendering of compiled sprite assets.
5. `TICKET-029` implements static bundle asset copying for sprite sheets.
6. `TICKET-030` implements asset manifest sprite sheet generation.
7. `TICKET-031` implements editor asset-provider and drag behavior for sprites.
8. `TICKET-032` completes docs, examples, skill guidance, and release gates.

## Parallelism

No same-wave tickets are marked parallel. The feature touches shared asset
contracts, validator behavior, runtime asset entries, CLI asset resolution,
manifest generation, and editor asset handling. Sequential execution prevents
contract drift and avoids overlapping writes to shared assets, docs, and tests.

## Non-Goals

- Animated sprite playback.
- GIF sprite sheets.
- Runtime image-dimension inspection.
- CSS theming inside raster sprites.
- Element-level `sprite` fields.
- New package boundaries.

## Default Verification

Each ticket runs its own focused verification. The wave completion gate is:

```bash
bunx tsc --noEmit
bunx biome check packages/core/src packages/cli/src packages/editor/src tests docs specs skills/authoring-isostate-scenes
bun test
bun run build
bun run size
node /Users/sebastianwessel/.agents/skills/spec-architect/scripts/check_specs.mjs specs
```
