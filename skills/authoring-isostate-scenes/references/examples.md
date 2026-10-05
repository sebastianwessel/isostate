# Isostate YAML Examples

Use this for quick scene skeletons.

## Minimal Scene

```yaml
header:
  name: minimal
  assetBaseUrl: ./assets/aws-3d
  assets:
    - id: server
      path: compute/server
      anchor: [0.5, 1]
  floor:
    visible: true
    layer: ground
  layers:
    - name: ground
    - name: structures

scenes:
  - id: initial
    elements:
      - id: api
        asset: server
        layer: structures
        at: [2, 2]
```

## Four-Step Network Flow

```yaml
header:
  name: network-flow
  assetBaseUrl: ./assets/aws-3d
  assets:
    - id: user
      path: users/user
      anchor: [0.5, 1]
    - id: gateway
      path: networking/internet-gateway
      anchor: [0.125, 1]
    - id: server
      path: compute/server
      anchor: [0.5, 1]
    - id: database
      path: database/database
      anchor: [0.5, 1]
  floor:
    visible: true
    layer: ground
  layers:
    - name: ground
    - name: structures
    - name: labels

scenes:
  - id: initial
    elements:
      - id: public-zone
        asset: rectangle
        layer: ground
        at: [2, 3]
        size: 2
        primitive:
          rectangle:
            fill: "#2563eb"
            opacity: 0.08
      - id: user
        asset: user
        at: [1, 5]
      - id: gateway
        asset: gateway
        at: [2, 3]
        size: 2

  - id: edge-connected
    add:
      connections:
        - id: user-to-gateway
          from:
            element: user
            side: auto
          to:
            element: gateway
            side: auto
          style:
            pattern: dotted
          end: arrow
          ambient:
            - name: flow

  - id: api-added
    add:
      elements:
        - id: api
          asset: server
          at: [5, 3]
      connections:
        - id: gateway-to-api
          from:
            element: gateway
          to:
            element: api
          routing:
            mode: orthogonal
          style:
            pattern: dashed
          end: arrow

  - id: data-added
    add:
      elements:
        - id: database
          asset: database
          at: [7, 2]
      connections:
        - id: api-to-database
          from:
            element: api
          to:
            element: database
          style:
            variant: road
            lane: center-dashed
          start: none
          end: none
```

## AI Agents And Human Workflows

Start from the checked repository examples instead of inventing sprite crops:

- `website/src/scenes/agentic-workflow.isostate.yaml`: four stops from manual
  email intake and human triage to AI triage, REQ/RITM/catalog tasks, prepared
  tools, human approval/escalation, execution, and completion with audit.
- `website/src/scenes/provider-routing.isostate.yaml`: four stops for alternative
  model providers, selected Bedrock with retrieval and Redis cache, API tools and
  a Redis Stream, then human review and approved output.

Both use first-scene snapshots, subsequent deltas, native one-cell sprites,
whole-cell placements, explicit routed arrows, caption labels, and connection
removals whenever endpoint elements leave. Website editor starters are
`?example=agentic-workflow` and `?example=provider-routing`. The full inventory and
semantic mappings live in `docs/guides/agentic-workflows.md`. Regenerate headers,
compiled bundles, and downloads together with `bun run assets:build`.
