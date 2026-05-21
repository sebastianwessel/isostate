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
      - id: user
        asset: user
        at: [1, 5]
      - id: gateway
        asset: gateway
        at: [3, 4]

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

