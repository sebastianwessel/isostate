# Wave 01: Foundation

## Goal

Restore a compilable, testable baseline and enforce the package/export boundary required by the specs.

## Tickets

1. `TICKET-001-foundation-gates-package-boundary.md`

## Start Condition

Can start immediately.

## Completion Gate

All commands pass:

```bash
bun run typecheck
bun run lint
bun test
bun run build
```

Wave 02 must not start until this gate passes.
