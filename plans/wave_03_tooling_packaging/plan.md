# Wave 03: Tooling and Packaging

## Goal

Turn the working core compiler/runtime into a public developer workflow:
`isostate validate`, `isostate compile`, `isostate bundle`, `isostate inspect`,
and a static deployment folder that can be copied into a website `public/`
directory.

## Sequence

Foundation:

- `TICKET-010-verification-status-refresh.md`

Parallel after Ticket 010:

- `TICKET-011-cli-validate-compile.md`
- `TICKET-012-standalone-runtime-artifact.md`

After Tickets 011 and 012:

- `TICKET-013-static-bundle-command.md`

Final documentation and release slice:

- `TICKET-014-deploy-docs-release-checks.md`

## Completion Gate

Default verification passes from a clean checkout, CLI tests pass, package
publishing checks pass for affected packages, and generated static bundle output
imports without dev-time dependencies.
