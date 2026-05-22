# Camera Focus

Use camera focus when a presentation should direct attention to one element or
one grid area while keeping the scene geometry unchanged.

## Runtime API

```ts
import { mountScene } from '@sebastianwessel/isostate';
import sceneBundle from './scene.isostate.js';

const target = document.querySelector<HTMLElement>('#scene');
if (!target) throw new Error('Missing scene target');

const mounted = mountScene(target, sceneBundle, {
	label: 'Focused deployment scene',
	controller: {
		transitionDuration: 600,
		transitionEasing: 'ease-in-out'
	}
});

mounted.controller?.zoomToElement('api-gateway', {
	padding: 48,
	duration: 500,
	easing: 'ease-out'
});

mounted.controller?.zoomToArea({ at: [0, 0], size: [4, 3] });
mounted.controller?.resetZoom({ duration: 300 });

mounted.controller?.on('camera-change', (state) => {
	console.log('camera viewBox', state.viewBox);
});
```

`zoomToElement()` focuses the element's current frame bounds. `zoomToArea()`
focuses the projected grid area. `resetZoom()` returns to the full scene
viewBox.

## Authored Scene Camera

```yaml
scenes:
  - id: initial
    elements:
      - id: api-gateway
        asset: gateway
        at: [2, 2]
    camera:
      target:
        area:
          at: [0, 0]
          size: [5, 4]

  - id: focus-api
    update:
      elements:
        - id: api-gateway
          ambient:
            - name: pulse
    camera:
      target:
        element: api-gateway
      padding: 48
      duration: 600
      easing: ease-in-out

  - id: zoom-out
    update:
      elements:
        - id: api-gateway
          ambient: []
    camera:
      target:
        reset: true
      duration: 500
      easing: ease-out
```

Navigation to `focus-api` applies the camera focus in parallel with the scene
progress transition. A later scene without `camera` leaves the focused viewBox
unchanged. Use `camera.target.reset: true` when the authored story should return
to the full compiled scene view.

During scroll-driven playback, camera focus follows scene progress. Scrolling
from the overview scene into `focus-api` zooms in; scrolling back over the same
range zooms out along the same path. Scenes without `camera` inherit the
previous camera focus until another scene authors a new camera target or reset.
