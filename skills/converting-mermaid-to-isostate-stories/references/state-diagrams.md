# State Diagrams

Use this reference only for Mermaid `stateDiagram` and `stateDiagram-v2`
extraction details. Apply shared storytelling, branch, label, marker, camera,
layout, and verification rules from `story-mapping.md`.

## Interpret The State Machine

Extract:

- states and state descriptions
- transition order as written, when no better lifecycle order is implied
- transition labels such as events, guards, actions, or outcomes
- start and end markers using `[*]`
- composite states and nested state bodies
- choice, fork, and join pseudostates
- notes attached to states
- direction hints
- concurrency regions

Create a transition inventory before designing the scene:

| Source item | Required visual check |
|---|---|
| `A --> B` | connection from visual state A to visual state B, arrow toward B |
| `A --> B: label` | same direction plus visible route label when the label changes meaning |
| `[*] --> A` | entrance/start marker routes into state A |
| `A --> [*]` | state A routes to terminal/exit marker |
| `state X { ... }` | composite state becomes a grouped zone or region |
| `<<choice>>` | decision/branch marker with distinct outgoing lanes |
| `<<fork>>` / `<<join>>` | split/merge marker with simultaneous or converging routes |

The conversion fails if a transition is missing, reversed, appears to attach to
the wrong state, or loses a transition label that distinguishes behavior.

## Mapping Rules

| Mermaid concept | Isostate mapping |
|---|---|
| State | element plus label; use one calm, consistent state tile or generated rectangle style unless the source explicitly gives different state classes |
| Transition | connection with `from`/`to`, active/completed styling by scene |
| Transition label | route-adjacent `text` in a clear grid lane |
| Start marker `[*] -->` | neutral entry pseudostate near perimeter or first state, such as a filled primitive circle |
| End marker `--> [*]` | neutral terminal pseudostate near perimeter, such as an outlined primitive circle |
| Composite state | translucent zone plus demoted group label once inner states appear |
| Choice | decision marker or small diamond-like primitive, with separate branch lanes |
| Fork/join | split/join marker; introduce parallel active routes together when needed |
| Note | quiet callout text near the related state, not a primary node |
| Concurrency `--` | separate internal lanes or zones; do not stack concurrent transitions |

Do not use success/failure/check/cross assets for `[*]` start or end
pseudostates. Those markers add semantics that Mermaid did not specify and can
make a state machine look like a flowchart outcome. Use success/failure markers
only for transition labels or guards whose source meaning is actually success,
failure, allowed, denied, complete, invalid, timeout, or similar.

Do not map ordinary states to service, router, database, or warning assets just
because those icons look polished. In state diagrams, the node is a state of one
subject, not usually an actor or infrastructure component. Use semantic icons
only when the state name or note clearly implies that metaphor, and document the
choice in the fidelity map.

## Storyboard Guidance

State diagrams are lifecycles. The story should show how an entity moves
through possible states, not merely place every state on the board.

Prefer this scene pattern:

| Scene role | Purpose |
|---|---|
| `initial` | Introduce the lifecycle subject and start marker. |
| `first-state` | Add the first state with label, then activate the start transition. |
| `transition-*` | Activate one event/transition or a small conceptual group. |
| `branch-*` | Show choices, failures, retries, and terminal outcomes as separate beats. |
| `composite-*` | Introduce region first, then inner state movement. |
| `overview` | Show the complete reconstructable state machine with current path muted. |

When one state has multiple outgoing transitions, do not reveal all outgoing
paths as one static cluster unless they are truly simultaneous concurrency.
Create separate scenes for meaningful alternatives: activate one labeled
transition, settle it into completed or muted styling, then activate the next
transition. This applies to regular state transitions just as it applies to
flowchart decisions. For example, show `Review --> Rework: changes requested`
and its `Rework --> Draft: revise` recovery as their own beats before showing
`Review --> Approved: ok`, or show rollback/recovery before the terminal retire
path when that teaches the lifecycle better.

Do not remove alternate transitions by default. State machines often define
valid future transitions, not temporary error branches. Keep alternatives
visible with quiet styling unless they were temporary explanatory aids.

Every labeled transition must be represented, including return, retry, recovery,
and terminal transitions. Labels such as `submit`, `revise`, `fix`, `retire`,
or `rollback` are usually events/actions rather than optional annotations; the
conversion fails if they disappear or are replaced only by color.

## Layout Guidance

- Place start states near an entrance edge and terminal states near exit edges
  when it clarifies lifecycle movement.
- Put common or stable states near the center; put error, cancelled, expired,
  or terminal states toward side/perimeter lanes.
- Use composite states as zones with at least one grid-cell gutter between
  sibling composite regions when possible.
- Keep self-transitions and retries readable with loop-like routes or a nearby
  retry label. Avoid tiny loops that disappear in isometric projection.
- For choices, route different outcomes through different ports/lanes. Do not
  rely only on color to distinguish guards.
- For return transitions, place the event label in the lane where the viewer can
  see the route is returning to the earlier state. Prefer a separate recovery
  beat when the return route would otherwise cross the whole machine.

## Questions To Ask When Ambiguous

- What object or process is moving through these states?
- Which transition path is the primary happy lifecycle?
- Are failure/cancel/timeout states terminal or recoverable?
- Should composite states become visible regions or be summarized?
- Are transition labels events, conditions, or actions?
- Should concurrency be shown simultaneously or as separate story beats?
