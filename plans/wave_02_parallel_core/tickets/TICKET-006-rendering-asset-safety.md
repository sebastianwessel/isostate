---
id: TICKET-006
title: Implement rendering asset safety, depth sorting, and accessibility
wave: 2
status: implementation_ready
parallel_group: rendering
depends_on: [TICKET-001, TICKET-002]
blocked_by: [TICKET-001, TICKET-002]
spec_refs: [specs/02-capabilities/rendering/rendering-engine.md, specs/01-domains/assets.md, specs/04-nfr/runtime-ci.md, specs/03-contracts/errors.md]
write_scope: [packages/core/src/rendering/rendering-engine.ts, packages/core/src/types/asset-registry.ts, tests/runtime/rendering-engine.test.ts, tests/runtime/asset-safety.test.ts]
read_scope: [packages/core/src/rendering/rendering-engine.ts, packages/core/src/rendering/background-renderer.ts, packages/core/src/types/assets.ts, packages/core/src/types/asset-registry.ts, packages/core/src/types/errors.ts]
contract_readiness:
  status: ready
  required_contracts: [specs/02-capabilities/rendering/rendering-engine.md, specs/04-nfr/runtime-ci.md]
  missing_contracts: []
ticket_readiness:
  status: implementation_ready
  open_decisions: []
  decision_source: spec
  ambiguous_phrases: []
---

# TICKET-006: Rendering Asset Safety

## Goal

Render real sanitized SVG assets with deterministic ordering and accessibility defaults.

## Spec Refs

- `specs/02-capabilities/rendering/rendering-engine.md`
- `specs/01-domains/assets.md`
- `specs/04-nfr/runtime-ci.md`
- `specs/03-contracts/errors.md`

## Context Digest

Renderer currently creates empty asset placeholders. It does not resolve asset SVGs, sanitize SVG input, apply deterministic depth tie-breaks, set accessibility defaults, or respect reduced motion.

## Implementation Approach

Keep rendering SVG-only. Add asset lookup and sanitizer helpers inside the rendering module or adjacent private helpers owned by this ticket.

## Tasks

- Resolve embedded or registry assets.
- Sanitize SVG before insertion.
- Throw required render errors.
- Add deterministic depth tie-breaker.
- Add accessibility defaults and reduced-motion CSS.
- Add rendering and asset-safety tests.

## Read Scope

- `packages/core/src/rendering/rendering-engine.ts`
- `packages/core/src/rendering/background-renderer.ts`
- `packages/core/src/types/assets.ts`
- `packages/core/src/types/asset-registry.ts`
- `packages/core/src/types/errors.ts`

## Write Scope

- `packages/core/src/rendering/rendering-engine.ts`
- `packages/core/src/types/asset-registry.ts`
- `tests/runtime/rendering-engine.test.ts`
- `tests/runtime/asset-safety.test.ts`

## Required Behavior

- Renderer resolves assets from embedded runtime bundle assets or runtime registry.
- Renderer clones actual sanitized SVG markup into element nodes.
- Reject `<script>`, inline `on*` attributes, `javascript:` URLs, and foreign content with `MALFORMED_ASSET_SVG`.
- Missing assets throw `ASSET_NOT_FOUND`.
- Depth sorting is `(x + y)` ascending, then `id` ascending.
- Root SVG uses `aria-hidden="true"` by default and supports labeled `role="img"` when label config exists.
- Built-in animation CSS includes `prefers-reduced-motion: reduce` behavior.

## Acceptance

- Tests verify actual asset markup appears in DOM.
- Tests verify unsafe SVG rejection cases.
- Tests verify missing asset error.
- Tests verify deterministic depth tie-breaker.
- Tests verify accessibility defaults and reduced motion CSS.

## Verification

```bash
bun test tests/runtime/rendering-engine.test.ts tests/runtime/asset-safety.test.ts
bun run typecheck
```

## Contract Readiness

status: ready

required_contracts:

- `specs/02-capabilities/rendering/rendering-engine.md`
- `specs/04-nfr/runtime-ci.md`

missing_contracts: []

## Decision Ledger

- Asset SVG is developer input but sanitized before insertion.
- Accessibility default is hidden when no label is provided.

## Contract Traceability

| Surface | Spec | Owner Files |
|---|---|---|
| asset rendering | `01-domains/assets.md` | `rendering-engine.ts` |
| sanitization | `04-nfr/runtime-ci.md` | rendering tests |
| depth sorting | `02-capabilities/rendering/rendering-engine.md` | rendering tests |

## Acceptance Test Matrix

| Acceptance | Test/Command |
|---|---|
| cloned asset SVG | `tests/runtime/rendering-engine.test.ts` |
| unsafe SVG rejected | `tests/runtime/asset-safety.test.ts` |
| deterministic order | `tests/runtime/rendering-engine.test.ts` |
| accessibility defaults | `tests/runtime/rendering-engine.test.ts` |

## Non-goals

- Runtime bundle digest.
- Controller semantics.

## Handoff

Runtime API and docs can rely on real asset DOM rendering and sanitizer behavior.
