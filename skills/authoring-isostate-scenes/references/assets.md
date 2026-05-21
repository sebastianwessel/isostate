# Isostate Assets Reference

Use this when defining `header.assets`, SVG asset paths, anchors, floors, and labels.

## Asset Catalog

```yaml
header:
  assetBaseUrl: ./assets/aws-3d
  assets:
    - id: api-server
      path: compute/server
      anchor: [0.5, 1]
    - id: internet-gateway
      path: networking/internet-gateway
      anchor: [0.125, 1]
```

Rules:

- `id` is the document-local asset id used by elements.
- `path` is combined with `assetBaseUrl`; `.svg` may be omitted.
- `anchor` is normalized viewport coordinate `[x, y]`, default `[0.5, 1]`.
- Asset declaration order has no render-order meaning.
- External assets must be browser-loadable standalone SVG files.

## Text Labels

`asset: text` is built in and must not be declared in `header.assets`.

```yaml
- id: api-label
  asset: text
  layer: labels
  at: [2, 2]
  text:
    value: |
      Public
      API
    align: middle
    fontSize: 14
    fontWeight: 700
    lineHeight: 1.2
    fill: "#111111"
```

Text rules:

- `text.value` is required for `asset: text`.
- Line breaks are supported.
- Non-text assets must not include `text`.

## Floor And Fit

```yaml
floor:
  visible: true
  layer: ground
```

Rules:

- Omit `floor.size` unless a larger fixed surface is needed.
- The compiler derives floor size from resolved scene footprints when omitted.
- Authored YAML does not expose `layout.fit`, `layout.align`, `layout.padding`, or `layout.bounds`.
- Page backgrounds belong in CSS via `header.className`, not YAML gradient config.

