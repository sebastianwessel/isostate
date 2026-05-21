# Domain: Assets

## Overview

Assets are reusable SVG building blocks. An asset is a single SVG graphic that fills its own canvas with no padding or margins — every pixel in the SVG contributes to the shape. Assets are decoupled from grid positioning and animation; they only define what the element looks like.

External SVG assets are rendered into a square runtime image viewport for each
grid cell with `preserveAspectRatio="xMidYMax meet"`. `anchor` is normalized
against that square runtime viewport, not against path geometry inspected by the
browser. The renderer never infers a better anchor from SVG contents.

Authored YAML references external SVG assets through document-local ids in `header.assets[]`. Those ids resolve to browser-loaded SVG files through `header.assetBaseUrl`.

The reserved id `text` is the only built-in generic asset. It is not an SVG source, is not declared in `header.assets[]`, and is rendered from an element-level `text` payload.

## Asset Definition

An asset is a standalone SVG file that fills its canvas with no empty margins. Assets scale to grid cells via the DSL `size` property: size 1 fills 1 cell, size 2 fills a 2×2 area, etc.

```ts
interface AssetDefinition {
  /** Unique asset id used by authored YAML and runtime elements. */
  id: string;
  /** Optional relative SVG path. Defaults to id when omitted. */
  path?: string;
  /** Normalized viewport point placed on the projected footprint anchor. */
  anchor?: [number, number];
  /** Optional category for authoring tooling. */
  category?: AssetCategory;
}
```

Asset files must be standalone SVG documents with `xmlns="http://www.w3.org/2000/svg"` and a valid `viewBox`. Asset SVG should use semantic CSS classes or CSS variables inside the file when theming is needed.

`anchor` defaults to `[0.5, 1]`, the bottom-center of the normalized square
runtime viewport.
Shared asset sets should declare an anchor for every SVG. Use `[0.5, 1]` for
checked centered assets, and use an off-center value when the imported SVG's real
ground contact point is intentionally not centered in its runtime viewport.

## SVG Blueprint

One-cell assets should use this geometry contract:

- `viewBox="0 0 64 64"`
- visual ground contact at `(32, 64)` for `anchor: [0.5, 1]`
- visual mass centered around the vertical centerline `x=32`
- no empty padding around the asset
- consistent stroke widths across the asset set
- no connector or long-arrow geometry in object assets

```svg
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Asset">
  <g stroke="#202020" stroke-width="1.25" stroke-linejoin="round">
    <path d="M16 24 32 16 48 24 32 32Z" fill="var(--iso-top, #f4f4f4)" />
    <path d="M16 24v20l16 10V32Z" fill="var(--iso-front, #d4d4d4)" />
    <path d="M48 24v20L32 54V32Z" fill="var(--iso-side, #a8a8a8)" />
  </g>
</svg>
```

The repo contains a copy with visible authoring guides at
`assets/blueprints/isometric-one-cell.svg`.

## Asset Categories

| Category       | Purpose |
|---|---|
| `building`     | Structures: houses, offices, warehouses, factories |
| `nature`       | Trees, bushes, flowers, rocks, water |
| `infrastructure` | Roads, bridges, fences, signs |
| `equipment`    | Servers, crates, barrels, machinery |
| `decoration`   | Clouds, birds, text, accent elements |
| `custom`       | User-defined assets |

```ts
type AssetCategory =
  | 'building'
  | 'nature'
  | 'infrastructure'
  | 'equipment'
  | 'decoration'
  | 'custom';
```

## Asset Catalog Tooling

The optional registry maps asset ids to metadata for authoring tools. It is not used by the browser renderer and does not carry raw SVG markup.

```ts
interface AssetRegistry {
  /** Register an asset definition (merges into registry) */
  register(asset: AssetDefinition): void;

  /** Get a single asset by id */
  get(id: string): AssetDefinition | undefined;

  /** Get all assets, optionally filtered by category */
  getAll(category?: AssetCategory): AssetDefinition[];

  /** Check if an asset exists */
  has(id: string): boolean;

  /** Remove an asset from the registry */
  remove(id: string): void;
}
```

## Asset Instantiation

An asset becomes an **element** when placed in a scene. Instantiation creates an SVG `<image>` node for the compiled URL and assigns position/transform based on grid coordinates.

The asset's visual size is determined by its `size` property in the DSL: `visualSize = cellSize * size`. The SVG image is scaled via CSS `transform: scale()` to fill the allocated grid cell area. Runtime validates asset URLs but does not parse or inject SVG markup.

## Built-In Text Asset

`asset: text` creates a generated SVG text label:

```yaml
- id: gateway-label
  asset: text
  layer: labels
  at: [2, 3]
  text:
    value: |
      Authentication
      Gateway
    align: middle
    fontSize: 12
    fontWeight: 700
    lineHeight: 1.2
    fill: "#111111"
```

Text elements do not use `assetBaseUrl`, image loading, or SVG parsing. The renderer creates `<text>` and `<tspan>` nodes directly and assigns authored lines through `textContent`. This makes labels safe for untrusted YAML text content and keeps common labels out of the asset catalog.

## Theme System

Themes define CSS variable values applied to all asset instances. A theme is a flat record of variable → color:

```ts
interface Theme {
  name: string;
  vars: Record<string, string>; // e.g. { '--color-leaf': '#15803d' }
}
```

### Built-in Themes

| Theme  | Description |
|---|---|
| `light` | Default light mode palette |
| `dark` | Dark mode palette |
| `brand` | Custom brand palette (configurable) |

Themes can be composed or extended:

```ts
const customTheme = composeTheme('dark', {
  '--color-trunk': '#a16207',
  '--color-leaf': '#166534',
});
```

## Depth Shading

Isometric assets use CSS `color-mix()` to create depth shading from a single color variable. Each face of a 3D shape maps to one or more CSS classes:

| CSS Class   | Meaning | Mix |
|---|---|---|
| `iso-top`   | Top face (lightest) | base color |
| `iso-front` | Front face | base color 70% |
| `iso-side`  | Side face | base color 85% |
| `iso-back`  | Back face (darkest) | base color 100% |

Asset geometry only needs one color variable per material, and all depth shading is handled by CSS.
