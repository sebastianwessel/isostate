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

## Documentation

- `docs/` contains end-user documentation with a nested file/folder structure.
- Documentation follows a clear narrative: high-level → beginner → technical → expert.
- Docs are structured by topic: installation, usage, configuration, API reference, examples, etc.
- **Every implementation wave must include documentation verification and updates.** The docs must stay in sync with the code.

## Completeness

- **No fakes or mocks outside of tests.** Every feature must be fully implemented.
- **Every implementation must be verified end-to-end** — no gaps, no missing pieces.
- Run the full verification chain after changes: lint → typecheck → test.
