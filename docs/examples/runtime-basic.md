# Runtime Basic

Use the browser runtime with a precompiled `.isostate.js` bundle. Do not parse
YAML in the browser path.

```ts
import { mountScene } from '@sebastianwessel/isostate';
import sceneBundle from './scene.isostate.js';

const target = document.querySelector<HTMLElement>('#scene');
if (!target) throw new Error('Missing #scene mount target');

const mounted = mountScene(target, sceneBundle, {
	label: 'Deployment pipeline overview',
	controller: false
});

const config = mounted.getResolvedConfig();
console.log(config.scenes.map((scene) => scene.id));

window.addEventListener('pagehide', () => mounted.destroy(), { once: true });
```

`mountScene` validates the compiled bundle, creates the SVG DOM, initializes the
animation engine, and returns a `MountedScene` handle. Use `destroy()` when the
host page removes the scene.

For direct progress control without scroll, keep `controller: false` and update
the engine from application state:

```ts
mounted.engine.setProgress(0.5);
```
