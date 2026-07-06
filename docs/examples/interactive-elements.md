# Interactive Elements

Use `interactive: true` when a scene should react to pointer hover and click,
for example showing a tooltip on hover and zooming the camera in on click.

## Runtime API

```ts
import { mountScene } from '@sebastianwessel/isostate';
import sceneBundle from './scene.isostate.js';

const target = document.querySelector<HTMLElement>('#scene');
if (!target) throw new Error('Missing scene target');

const tooltip = document.querySelector<HTMLElement>('#tooltip');
if (!tooltip) throw new Error('Missing tooltip target');

const mounted = mountScene(target, sceneBundle, {
	label: 'Deployment scene',
	interactive: true,
	controller: {
		transitionDuration: 500,
		transitionEasing: 'ease-out'
	}
});

mounted.on('element-enter', (event) => {
	tooltip.textContent = event.id;
	tooltip.style.display = 'block';
});

mounted.on('element-leave', () => {
	tooltip.style.display = 'none';
});

mounted.on('element-click', (event) => {
	mounted.controller?.zoomToElement(event.id, { padding: 48 });
});
```

`element-enter`/`element-leave` fire once per element group crossing, so a
tooltip driven this way does not flicker while the pointer moves between child
nodes of the same element. `element-click` combined with
`controller.zoomToElement()` gives click-to-zoom navigation without any
per-element listeners: `mountScene()` attaches exactly three delegated
listeners (`click`, `pointerover`, `pointerout`) to the root SVG.

## Hover Styling

The runtime toggles the `iso-hover` class on the hovered element group and
scopes `cursor: pointer` to interactive scenes automatically. Add custom hover
styling with a CSS rule targeting the same class:

```css
.iso-interactive g[data-id].iso-hover {
	filter: brightness(1.1);
}
```

## Notes

- `interactive` defaults to `false`. Without it, `mounted.on()` still
  registers listeners but they never fire, and the SVG never gains the
  `iso-interactive` class.
- Floor, connectors, `<defs>`, and the diagnostics overlay never produce
  events. An element whose current presence is `removed` never produces
  events either.
- `mounted.on()` throws `MOUNT_DESTROYED` if called after `mounted.destroy()`.
  Unsubscribe with the function `on()` returns instead of leaking closures past
  destroy.
