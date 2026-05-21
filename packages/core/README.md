# @sebastianwessel/isostate

Scroll-driven animated isometric scenes for product storytelling, technical
docs, and visual explainers.

Isostate renders compiled scene bundles as lightweight SVG. YAML parsing,
validation, and compilation happen at build time; browsers only receive the
runtime, compiled scene data, and referenced assets.

## Links

- Website: https://sebastianwessel.github.io/isostate
- Repository: https://github.com/sebastianwessel/isostate
- Issues: https://github.com/sebastianwessel/isostate/issues
- Documentation: https://sebastianwessel.github.io/isostate/docs/getting-started.md/

## Install

```bash
npm install @sebastianwessel/isostate
```

The browser runtime has no production dependencies. The optional `yaml` peer is
only needed when you use the dev-time DSL APIs from `@sebastianwessel/isostate/dsl`.

## Runtime Usage

```ts
import { mountScene, type RuntimeBundle } from '@sebastianwessel/isostate';
import sceneBundle from './scene.isostate.js';

const target = document.querySelector<HTMLElement>('#scene');
if (!target) throw new Error('Missing #scene');

const mounted = mountScene(target, sceneBundle as RuntimeBundle, {
	label: 'Product story',
	controller: false
});

mounted.engine.setProgress(0.5);
```

## Dev-Time DSL Usage

```ts
import {
	compileScene,
	parseScene,
	toJs,
	validateScene
} from '@sebastianwessel/isostate/dsl';

const document = parseScene(yamlText);
const report = validateScene(document);
if (!report.isValid) throw new Error(report.errors[0]?.message);

const bundle = compileScene(document);
const jsModule = toJs(bundle);
```

For CLI validation, compilation, and static bundles, use
`@sebastianwessel/isostate-cli`.
