# Custom Theme

Compose theme variables with `composeTheme`, then pass those variables to
`mountScene`. Runtime theme overrides do not mutate the compiled bundle, so
bundle digest validation remains intact.

```ts
import { composeTheme, mountScene } from '@sebastianwessel/isostate';
import sceneBundle from './scene.isostate.js';

const theme = composeTheme('light', {
	'--color-top': '#f8fafc',
	'--color-front': '#38bdf8',
	'--color-side': '#0369a1',
	'--color-back': '#075985',
	'--color-accent': '#f97316'
});

const target = document.querySelector<HTMLElement>('#scene');
if (!target) throw new Error('Missing #scene mount target');

const mounted = mountScene(target, sceneBundle, {
	controller: false,
	label: 'Themed service map',
	themeVars: theme.vars
});

console.log(mounted.getResolvedConfig().themeVars);
```

Theme variable names must begin with `--`. Values are assigned with
`style.setProperty`, not string-concatenated style blocks.
