# Custom Assets

For browser-loadable SVG files, declare a local id and path in YAML:

```yaml
header:
  assetBaseUrl: ./assets
  assets:
    - id: database
      path: custom/database-node
      anchor: [0.5, 1]
```

The compiler emits `./assets/custom/database-node.svg`, and the browser loads it
with an SVG `<image>` element.

`anchor` is optional. It defaults to `[0.5, 1]`, meaning the bottom-center of
the normalized square runtime asset viewport sits on the element's grid
footprint anchor. Set it when imported SVGs have their real ground contact point
intentionally off-center.
For shared asset catalogs, declare `anchor` explicitly on every asset so review
can distinguish "checked and centered" from "not checked yet".

Runtime integration is unchanged: import the compiled bundle and pass it to
`mountScene`. Asset loading is fully described by the compiled bundle URLs.

```ts
import { mountScene } from '@sebastianwessel/isostate';
import scene from './scene.isostate.js';

mountScene(document.querySelector('#scene'), scene);
```

Plain labels do not need custom SVG assets. Use the reserved built-in
`asset: text` with a `text.value` payload instead.

Simple underlays and markers also do not need custom SVG assets. Use reserved
built-in primitive assets such as `asset: rectangle` with a matching
`primitive.rectangle` payload.

## Sprite Sheets

Use sprite sheets when one image file should provide many logical asset ids:

```yaml
header:
  assetBaseUrl: ./assets
  assets:
    - id: app-icons
      type: sprite-sheet
      path: app-icons.png
      sheetSize: [512, 256]
      tileSize: [64, 64]
      anchor: [0.5, 1]
      sprites:
        server: [0, 0]
        database:
          at: [1, 0]
          anchor: [0.5, 0.92]
        wide-service:
          rect: [128, 0, 96, 64]

scenes:
  - id: initial
    elements:
      - id: api
        asset: server
        at: [1, 1]
```

`sheetSize`, `tileSize`, and `rect` use source-image pixels. Elements reference
the nested sprite id (`server`), not the sheet namespace id (`app-icons`).
Sprite sheet paths must include `.png`, `.webp`, `.jpg`, `.jpeg`, or `.svg`;
`.gif` is not supported.

This also works with path-style libraries such as draw.io SVG sets: set
`assetBaseUrl` to the library root, then use paths like
`mscae/Active_Directory` or `azure2/Virtual_Machine`. Asset files must be
standalone SVG documents with an SVG namespace and a valid `viewBox`.

Do not pass raw SVG strings to the browser runtime. Keep asset customization in
the SVG files themselves, with fixed viewBox sizing and CSS variables or classes
inside the file.

## Asset Blueprint

Use a `64 x 64` viewBox for one-cell assets. The renderer places every external
SVG into a square runtime image viewport, preserves aspect ratio with
`xMidYMax meet`, and places the declared anchor point on the projected footprint
anchor. A reusable starter file is
available at [`assets/blueprints/isometric-one-cell.svg`](../../assets/blueprints/isometric-one-cell.svg).

```svg
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Database">
	<g id="asset" stroke="#202020" stroke-width="1.25" stroke-linejoin="round">
		<!-- Top diamond: keep the object centered around x=32. -->
		<path d="M16 24 32 16 48 24 32 32Z" fill="var(--iso-top, #f4f4f4)" />
		<!-- Left/front face. -->
		<path d="M16 24v20l16 10V32Z" fill="var(--iso-front, #d4d4d4)" />
		<!-- Right/side face. -->
		<path d="M48 24v20L32 54V32Z" fill="var(--iso-side, #a8a8a8)" />
	</g>
	<!-- Optional authoring guide only; remove before publishing the asset. -->
	<circle cx="32" cy="64" r="2" fill="#ef4444" />
</svg>
```

Matching YAML:

```yaml
header:
  assetBaseUrl: ./assets
  assets:
    - id: database
      path: database
      anchor: [0.5, 1]
```

## Anchor Rules

- `anchor: [0.5, 1]` means the visual ground contact is centered at the bottom
  of the square runtime viewport. This is the normal case for one-cell assets.
- `anchor: [0, 1]` places the left bottom corner on the grid footprint anchor.
- `anchor: [1, 1]` places the right bottom corner on the grid footprint anchor.
- Values between `0` and `1` are allowed. Use them for imported assets whose
  visible base is off-center inside the viewBox.
- The anchor is not a CSS transform origin. It is a geometry contract between
  the asset catalog and the renderer, and the renderer does not infer it from
  SVG path geometry.
- Do not enlarge imported composite SVGs with `size` unless the SVG was
  intentionally authored for that multi-cell footprint. If it contains
  independent objects, split it into two asset files or two elements so each
  object owns its own grid footprint and connector ports. If splitting is not
  practical, keep the source asset at `size: 1` and declare the anchor that
  matches its real ground contact.

## Authoring Checklist

- Use a standalone SVG file with an explicit `viewBox`.
- Prefer `viewBox="0 0 64 64"` for a one-cell asset.
- Draw the object so its bottom visual contact point matches the declared
  `anchor`.
- Keep empty padding out of the SVG. If padding is unavoidable in an imported
  set, compensate with `anchor`.
- Use consistent stroke width across the asset set. The AWS 3D example uses
  approximately `1.25` to `2` viewBox units depending on source asset scale.
- Keep colors inside the SVG or expose CSS variables such as `--iso-top`,
  `--iso-front`, and `--iso-side`.
- Do not use one asset for long arrows or connections. Use first-class
  connections; stretched SVG arrows distort dash patterns and arrowheads.

```svg
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
	<path d="M8 18 32 6l24 12-24 12z" fill="var(--color-top, #e2e8f0)" />
	<path d="M8 18v28l24 12V30z" fill="var(--color-front, #94a3b8)" />
	<path d="M56 18v28L32 58V30z" fill="var(--color-side, #64748b)" />
</svg>
```
