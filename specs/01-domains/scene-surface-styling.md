# Domain: Scene Surface Styling

## Overview

Scene surface styling is owned by the host page, not by the authored DSL or SVG
renderer. The renderer builds the isometric SVG content and exposes a CSS hook
on the root SVG.

## Contract

```ts
interface SceneHeader {
  className?: string;
}
```

When `header.className` is present, the runtime adds the class string to the
root `<svg>` element. The root SVG always includes the built-in `iso-scene`
class.

```yaml
header:
  className: demo-surface
```

```css
.stage .demo-surface {
  background: linear-gradient(130deg, #f8fafc 0%, #dbeafe 100%);
}
```

The DSL does not define gradients, image backgrounds, or decorative backdrop
syntax. This keeps the runtime focused on scene state, projection, assets,
animation, and layout.
