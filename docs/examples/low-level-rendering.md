# Low-Level Rendering

Most applications should use `mountScene`. Advanced integrations and tests can
build the SVG DOM directly when they need to own the animation engine and
controller lifecycle.

```ts
import { AnimationEngine, buildSceneDOM } from '@isostate/core';
import sceneBundle from './scene.isostate.js';

const target = document.querySelector<HTMLElement>('#scene');
if (!target) throw new Error('Missing #scene mount target');

const svg = buildSceneDOM(target, sceneBundle, {
	label: 'Manually rendered scene'
});

const engine = new AnimationEngine();
engine.init(sceneBundle);
engine.setProgress(0.25);

window.addEventListener(
	'pagehide',
	() => {
		engine.destroy();
		svg.remove();
	},
	{ once: true }
);
```

Direct rendering is an escape hatch. It bypasses `MountedScene.destroy()` and
`getResolvedConfig()`, so the caller owns cleanup and inspection.
