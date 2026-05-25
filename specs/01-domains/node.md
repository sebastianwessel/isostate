# Domain: Element

## Overview

An element is a placed instance of an asset in the scene timeline. In authored YAML, elements appear inside scene operations, not as top-level objects with keyframes.

The rendering DSL uses the term **element**. Logical diagram concepts such as nodes and edges belong to converter layers.

## Placement

`elements[]` in the first scene and `add.elements[]` in later scenes use `ElementPlacement`.

```ts
interface ElementPlacement {
  id: string;
  asset: string;
  at: [number, number];
  size?: number;
  layer?: string;
  enter?: EntryAnimation;
  exit?: ExitAnimation;
  ambient?: AmbientAnimation[];
  text?: TextContent;
  primitive?: PrimitiveContent;
}
```

### Placement Properties

- `id`: unique kebab-case element id across the resolved timeline.
- `asset`: document-local external asset id declared in `header.assets`, or the reserved built-in id `text`.
- `at`: grid coordinate `[x, y]`. Use this in authored YAML. The older `pos` name is runtime/internal only.
- `size`: positive whole-cell grid scale. Defaults to `1`.
- `layer`: render layer. Defaults to `structures` when that layer exists, otherwise the first declared layer.
- `enter`: entry animation used when the element is added.
- `exit`: default exit animation used when the element is removed.
- `ambient`: ambient animations active while the element is present.
- `text`: required when `asset: text`; forbidden for all other assets.

## Update Patch

`update.elements[]` changes an already-present element. It includes only changed properties.

```ts
interface ElementPatch {
  id: string;
  at?: [number, number];
  size?: number;
  layer?: string;
  enter?: EntryAnimation;
  exit?: ExitAnimation;
  ambient?: AmbientAnimation[];
  text?: TextContentPatch;
  primitive?: PrimitiveContentPatch;
}
```

Omitted fields retain the previous resolved value.

Nested update payloads are sparse patches. `update.elements[].text` merges
field-by-field into the previous resolved text payload, and
`update.elements[].primitive.<kind>` merges field-by-field into the previous
matching primitive payload. Updating only `text.fill` preserves `text.value`,
`align`, `fontSize`, and other text fields.

`update.elements[].size` may be `0` to scale an already-present element to zero
without removing it from the resolved scene. Initial placements and
`add.elements[]` placements must still use positive whole-cell `size` values.

## Text Content

```ts
interface TextContent {
  value: string;
  align?: 'start' | 'middle' | 'end';
  placement?: 'cell' | 'caption';
  fontSize?: number;
  fontWeight?: number | 'normal' | 'bold';
  lineHeight?: number;
  fill?: string;
}

type TextContentPatch = Partial<TextContent>;
```

`text.value` supports explicit line breaks. YAML authors may use either escaped `\n` in a quoted string or a block scalar. The renderer creates one SVG `<tspan>` per line and assigns each line through `textContent`.

`PrimitiveContentPatch` is the sparse update counterpart for generated
primitive payloads. It uses the same child key as the element's primitive asset
id and may include only the primitive fields that change. Polygon and line
patches may omit `points` when only style changes.

Validation constraints:

- `value`: required for placements. Empty or whitespace-only values are valid
  but emit `EMPTY_TEXT_CONTENT` because they render no visible label. Values
  over `1000` characters or `20` lines emit `INVALID_TEXT_CONTENT`.
- `align`: `start`, `middle`, or `end`; default `middle`.
- `placement`: `cell` or `caption`; default `cell`. `cell` centers text inside
  the element's one-cell text canvas. `caption` preserves the legacy
  top-floating label position.
- `fontSize`: positive finite number; default `12`.
- `fontWeight`: `normal`, `bold`, or a positive finite number; default `700`.
- `lineHeight`: positive finite number; default `1.2`.
- `fill`: safe CSS color token; no control characters, `<`, `>`, `url(`, or `javascript:`.

## Removal

`remove.elements[]` exits an already-present element.

```ts
interface ElementRemoval {
  id: string;
  exit?: ExitAnimation;
}
```

After removal, the element is absent from later scenes until a later `add.elements[]` reintroduces the same id. Re-addition must provide a full `ElementPlacement`.

## Interpolation Rules

The compiler resolves scene deltas into complete scene snapshots. The runtime interpolates between adjacent snapshots:

- `at`: linearly interpolated in projected space through the element's grid coordinates.
- `size`: linearly interpolated. A destination patch value of `0` scales the
  element to zero while keeping it present.
- `layer`: discrete switch at the destination scene boundary unless a future layer-transition contract changes this.
- `ambient`: discrete set applied at the destination scene boundary.
- `text` and `primitive`: resolved by sparse patch merge during compilation,
  then applied discretely at the destination scene boundary.
- `add`: element is absent before the destination scene and enters using `enter`.
- `remove`: element exits using `exit` and is absent after the destination scene.

The authored DSL does not expose `lifecycle.status`. Lifecycle is derived from `add`, `update`, and `remove`.

## Entry Animations

```ts
type EntryAnimation =
  | 'fade-in'
  | 'fade-in-grow'
  | 'fall-in'
  | 'rise-from-ground'
  | 'slide-in-left'
  | 'slide-in-right'
  | 'flip-in'
  | 'none';
```

## Exit Animations

```ts
type ExitAnimation =
  | 'fade-out'
  | 'fade-out-shrink'
  | 'fall-through-ground'
  | 'rise-away'
  | 'slide-out-left'
  | 'slide-out-right'
  | 'flip-out'
  | 'none';
```

## Ambient Animations

```ts
interface AmbientAnimation {
  name: string;
  infinite?: boolean;
  iterations?: number;
}
```

Built-in ambient names:

| Name | Description |
|---|---|
| `pulse` | Gentle opacity oscillation |
| `float` | Subtle vertical bobbing |
| `shake` | Horizontal vibration |
| `glow` | Pulsing drop-shadow |
| `spin` | Continuous rotation |
| `blink` | Periodic visibility toggle |
| `bounce` | Vertical bounce |

## Placement Calculation

Raw isometric projection is independent of viewport size:

```text
rawX = cellSize * (x - y) * 0.5
rawY = cellSize * (x + y) * 0.25
```

The layout step computes projected bounds and translates raw coordinates into the final viewBox:

```text
screenX = rawX - bounds.minX + paddingX
screenY = rawY - bounds.minY + paddingY
transform = translate(screenX, screenY) scale(size)
```

The authored `at` coordinate is the top-left grid coordinate of the element footprint. For a footprint `size`, the renderer projects `[at.x + size, at.y + size]` and anchors the asset's normalized viewport anchor there. The default asset anchor is bottom-center `[0.5, 1]`; imported SVGs may override it in `header.assets[].anchor` when their real ground contact is off-center.

Depth sorting uses layer order first, then `(x + y)` ascending, then `id` ascending as a deterministic tie-breaker.

## Example

```yaml
scenes:
  - id: initial
    elements:
      - id: app-server
        asset: iso-server
        layer: structures
        at: [2, 2]

  - id: scaled
    update:
      - id: app-server
        at: [1, 1]
        size: 2
        ambient:
          - name: pulse
```
