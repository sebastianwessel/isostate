# Sequence Diagrams

Use this reference only for Mermaid `sequenceDiagram` extraction details. Apply
shared storytelling, branch, label, marker, camera, layout, and verification
rules from `story-mapping.md`.

## Interpret The Sequence

Extract:

- participants and aliases
- message order
- message direction and labels
- sync vs async arrows when visible in Mermaid syntax
- `alt`, `else`, `opt`, `loop`, `par`, `critical`, and `break` blocks
- activation spans when they clarify responsibility

Create a message inventory before designing the scene:

| Message | Required visual check |
|---|---|
| `A->>B: label` | connection from participant A to participant B, arrow toward B |
| `A-->>B: label` | return-style or muted reverse connection toward B |
| async syntax / enqueue wording | async styling and correct async target |
| `alt` / `else` / `opt` | branch labels preserved as route semantics |

The conversion fails if a participant is mislabeled, a message is reversed, or a
viewer cannot tell which participant sends and receives the active message.
Use `story-mapping.md` for message story beats, condition labels, semantic
markers, decision lanes, and rendered verification.

The sequence order is the primary timeline, but do not automatically create one
scene per message. Group adjacent messages when they express one conceptual
step, such as request enters system, auth check, data fetch, enqueue job, or
response returns.

Every Mermaid message label is source data. Represent it as route-adjacent text
unless the fidelity map explicitly explains why it is omitted and the meaning
is still reconstructable. Labels such as `submit request`, `call endpoint`,
`verify token`, `token ok`, `account data`, `response`, `render result`,
`enqueue audit job`, `process audit`, and `write audit log` must not disappear
just because the arrow direction is visually clear.

## Mapping Rules

| Mermaid concept | Isostate mapping |
|---|---|
| Participant | stable element plus text label |
| Message | connection between participant elements |
| Return message | muted reverse connection or short labeled route when important |
| Async message | dotted route to queue/worker or async target |
| Activation | subtle highlight ring/rectangle on active participant |
| `alt` / `else` | alternative colored or dashed routes with labels |
| `opt` | optional dashed route |
| `loop` | small loop marker or repeat label near route |
| `par` | multiple active routes introduced together |

## Sequence-Specific Guidance

Connections should reflect the sequence more than element changes do. The
participants often remain stable after they are introduced; arrows and labels
show what is happening now.

Do not introduce an unlabeled participant and an active message to it in the
same visual beat unless the label is immediately readable. The viewer should
understand who participates before interpreting the message.

Do not mirror the Mermaid lifeline layout literally unless it is the clearest
choice. A sequence diagram can become a compact system map: services can cluster
by responsibility, queues can sit near async producers/consumers, and shared
resources can be central. The message order still drives scene progression.

Sequence diagrams need more breathing room than simple flowcharts because
message labels, return paths, and muted completed routes accumulate around the
same participants. As a default, leave at least two empty grid cells between
primary participants that exchange labeled messages, and reserve separate label
lanes above, below, or beside the message route. Tighten only after rendered
verification shows labels do not collide with participant labels, icons,
arrowheads, or other message labels.

For request/response pairs between the same participants, place request and
return labels in different lanes, not on top of the same connection corridor.
For async tails, give the queue and worker enough distance from the synchronous
request path so async labels do not read as part of the response path.

Use a cumulative visual state:

- completed messages remain visible in muted style
- current message is bright and animated
- future optional paths may appear faintly only when useful
- final overview shows the complete interaction map

When labeled returns or async messages are important to the story, give them
their own active scene instead of hiding them inside a grouped request scene.
This is especially true for `-->>` returns and async syntax such as `-)`: the
viewer should be able to see both the direction and the message label while
that message is current.

## Questions To Ask When Ambiguous

- Which messages can be grouped into one conceptual scene?
- Are all participants involved in the next message already visible and labeled?
- Are returns important, or can they be implied?
- Should async messages introduce a queue/worker asset?
- Should `alt` branches be shown simultaneously or one after another?
- What is the final takeaway: successful response, system state change, or
  operational flow?
