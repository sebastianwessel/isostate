# Conventions

## Naming

- **Types and interfaces**: PascalCase (`SceneNode`, `ScrollState`, `ElementKeyframe`)
- **Classes**: PascalCase (`IsometricEngine`, `ScrollAnimator`)
- **Functions**: camelCase (`parseScene`, `renderFrame`, `easeInOutCubic`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_ANIMATION_DURATION`, `ISO_ANGLE`, `DEFAULT_CELL_SIZE`)
- **Isometric grid variables**: `gridX`, `gridY`, `screenX`, `screenY`, `cellSize`
- **Files**: camelCase with hyphens for multi-word (`scroll-animator.ts`, `scene-parser.ts`)
- **Directories**: kebab-case (`scene-parser`, `animation-engine`)
- **SVG classes**: kebab-case CSS classes (`iso-box`, `scene-edge`)
- **DSL identifiers**: kebab-case (`building-office`, `arrow-server-db`)

## Project Layout

```
packages/
  core/                 # Core library — runtime engine + DSL tools
    src/
      dsl/              # YAML parser, validator, compiler (dev-time only)
      rendering/        # SVG rendering layer (element placement, DOM, transforms)
      animation/        # Animation engine (interpolation, scroll binding)
      components/       # Built-in SVG component library
      types/            # Shared TypeScript types
      utils/            # Shared utilities
      index.ts          # Public API entry point
specs/                  # All spec documents
  02-capabilities/dsl/compiler.md  # Compiler pipeline architecture
skills/                 # AI agent skills for workflow guidance
  dsl-writer/           # Skill for writing YAML scene DSL
  asset-creator/        # Skill for creating isometric assets
  converter/            # Skill for writing format converters
docs/                   # End-user documentation
tests/                  # Shared test fixtures and helpers
```

## Code Size Limits

- Maximum file size: 500 lines
- Maximum function length: 50 lines
- Maximum cyclomatic complexity: 10

## Code Style

- No `any` — use `unknown` with type guards.
- No implicit `any` in function parameters.
- All public API functions must have JSDoc comments.
- All exported types must have JSDoc comments.
- Biome defaults preferred — avoid custom overrides unless necessary.

## Error Handling

- Use structured error classes: `ParseError`, `RenderError`, `AnimationError`.
- All errors include a machine-readable `code` field (e.g., `DSL_PARSE_SYNTAX_ERROR`).
- User-facing error messages are descriptive; internal error details are in `details`.

## Logging

- No logging in production builds.
- Development builds use a `debug`-compatible logger with namespace per module.
- Log level: `warn` and above in production, `debug` in development.

## Git

- Conventional Commits format: `type(scope): message`
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`
