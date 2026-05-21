# Controller Scroll

Start with `mountScene` and opt into the runtime controller when the scene should
follow a scroll container.

```ts
import { mountScene } from '@isostate/core';
import sceneBundle from './scene.isostate.js';

const target = document.querySelector<HTMLElement>('#scene');
const scroller = document.querySelector<HTMLElement>('#story');

if (!target || !scroller) {
	throw new Error('Missing scene or scroll container');
}

const mounted = mountScene(target, sceneBundle, {
	label: 'Scroll-driven infrastructure scene',
	controller: {
		container: scroller,
		scrollDirection: 'vertical',
		scrollOffset: { top: 120, bottom: 240 },
		minProgress: 0,
		maxProgress: 1,
		keyboardControls: false,
		touchControls: false
	}
});

mounted.controller?.on('progress-change', (progress) => {
	console.log('scene progress', progress);
});

window.addEventListener('pagehide', () => mounted.destroy(), { once: true });
```

The controller batches scroll updates with `requestAnimationFrame`, clamps
progress to the configured range, and forwards the active progress to the
animation engine.

Browser visual and performance checks are opt-in:

```bash
ISOSTATE_BROWSER_TESTS=1 bun test tests/browser
```
