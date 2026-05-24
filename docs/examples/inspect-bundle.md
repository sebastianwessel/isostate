# Inspect Bundle

Prefer the CLI when checking generated files from a terminal or CI job:

```bash
npx --package @sebastianwessel/isostate-cli isostate inspect public/scene.isostate.js
npx --package @sebastianwessel/isostate-cli isostate inspect public/scene.isostate.json
```

Inspection verifies the canonical runtime bundle metadata, including `_format`,
`_version`, and `_digest`, and reports scene, layer, asset, and floor counts.

Use `fromJs` and `fromJson` from `@sebastianwessel/isostate/dsl` in tests or diagnostics
that need in-process access to compiled artifacts without mounting a browser
scene.

```ts
import { readFile } from 'node:fs/promises';
import { fromJs, fromJson } from '@sebastianwessel/isostate/dsl';

const jsModuleText = await readFile('scene.isostate.js', 'utf8');
const jsBundle = fromJs(jsModuleText);

console.log(jsBundle._format);
console.log(jsBundle._version);
console.log(jsBundle._digest);
console.log(jsBundle.scenes.map((scene) => scene.id));

const jsonText = await readFile('scene.isostate.json', 'utf8');
const jsonBundle = fromJson(jsonText);

if (jsonBundle._digest !== jsBundle._digest) {
	throw new Error('JS and JSON bundles do not describe the same scene');
}
```

These helpers are for dev-time diagnostics. Browser code should import the
compiled module or fetch the JSON bundle directly.
