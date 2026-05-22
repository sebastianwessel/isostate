# Custom Theme

Use semantic CSS variables in scene YAML, then define their values in page CSS.
This keeps light/dark mode outside the scene definition. The recommended
dark-mode hook is the same root `.dark` class used by shadcn/ui. Authored scene
YAML does not need `header.theme` or `header.className` for this.

```yaml
header:
  assetBaseUrl: ./assets
  assets: []

scenes:
  - id: initial
    elements:
      - id: title
        asset: text
        at: [1, 1]
        text:
          value: Checkout
          fill: var(--iso-label)
```

```css
:root {
  --iso-label: #111111;
  --iso-flow: #2563eb;
}

.dark {
  --iso-label: #f8fafc;
  --iso-flow: #60a5fa;
}

#scene .iso-scene {
  color: var(--iso-label);
}
```

```ts
import { mountScene } from '@sebastianwessel/isostate';
import sceneBundle from './scene.isostate.js';

const target = document.querySelector<HTMLElement>('#scene');
if (!target) throw new Error('Missing #scene mount target');

const mounted = mountScene(target, sceneBundle, {
	controller: false,
	label: 'Themed service map'
});

console.log(mounted.getResolvedConfig().themeVars);
```

Runtime `themeVars` overrides remain available for app-controlled values and do
not mutate the compiled bundle digest. Theme variable names must begin with
`--`. Values are assigned with `style.setProperty`, not string-concatenated
style blocks.
