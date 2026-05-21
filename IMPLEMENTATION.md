# IMPLEMENTATION.md

## Code Quality

- Well-structured code, no overengineering. Keep it simple.
- No spaghetti — each module has a single clear responsibility.
- Follow TypeScript and web platform best practices.
- Public API must have JSDoc comments on all exported types, interfaces, and functions. This enables IDE autocompletion and API documentation generation.
- Code coverage >80% for all implemented features.

## Spec Compliance

- **Implementation must always follow the specs.** The `specs/` directory is the source of truth.
- Agents must not invent or decide behavior on their own. If a spec is unclear or missing, **loop back to the human developer** before proceeding.
- When something is implemented, the corresponding spec status must be updated to reflect completion.
- Each implementation must be reviewed against its spec to ensure no drift.
- If implementation reveals a missing or underspecified behavior, update the
  relevant spec first or in the same commit. Do not bury new behavior only in
  tests or code.
- Public DSL/runtime changes require synchronized updates to:
  - `specs/01-domains/*`, `specs/02-capabilities/*`, and `specs/03-contracts/*`
    where affected
  - public TypeScript types and JSDoc
  - parser, validator, compiler, runtime renderer/controller behavior
  - docs and skill references
  - examples and generated `.isostate.js`/`.isostate.json` bundles

## Documentation

- `docs/` contains end-user documentation with a nested file/folder structure.
- Documentation follows a clear narrative: high-level → beginner → technical → expert.
- Docs are structured by topic: installation, usage, configuration, API reference, examples, etc.
- **Every implementation wave must include documentation verification and updates.** The docs must stay in sync with the code.
- Developer-facing changes must update both narrative docs and API/reference
  docs. Example source YAML and generated runtime bundles must be regenerated
  together.
- When authoring rules change, update `skills/authoring-isostate-scenes/` so
  future agents do not drift from the current DSL.

## DSL And Runtime Conventions

- Authored YAML uses `header` plus ordered `scenes`.
- The first scene uses top-level `elements` and optional `connections`; later
  scenes use nested `add`, `update`, and `remove` deltas.
- Authored YAML uses `at`, never runtime `pos`.
- Scene progress is derived by the compiler; do not author scene `at`,
  `progress`, timestamps, `states`, or `keyframes`.
- Built-in generated assets are reserved ids: `text`, `rectangle`, `circle`,
  `polygon`, and `line`. They are not declared in `header.assets` and are not
  URL-loaded.
- Element `size` is a positive whole-grid-cell count. Do not use fractional
  sizes in authored YAML.
- Composite external SVG assets must either be split into separate one-cell
  assets/elements or authored as explicit whole-cell footprints with accurate
  `anchor` values.
- Browser runtime must not ship YAML parsing, validation, compiler code, raw SVG
  parsing, or per-asset CSS injection.

## Completeness

- **No fakes or mocks outside of tests.** Every feature must be fully implemented.
- **Every implementation must be verified end-to-end** — no gaps, no missing pieces.
- Run the full verification chain after changes: `bun test`,
  `bun run typecheck`, `bun run lint`, spec check, `bun run build`,
  `bun run publint`, and `bun run size`.
- For browser-visible example changes, open the local demo in a browser at the
  relevant progress values and visually verify alignment, generated content
  updates, connector placement, and labels.
