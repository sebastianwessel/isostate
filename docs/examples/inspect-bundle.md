# Inspect Bundle

Prefer the CLI when checking generated files from a terminal or CI job:

```bash
bunx --package @sebastianwessel/isostate-cli isostate inspect public/scene.isostate.js
bunx --package @sebastianwessel/isostate-cli isostate inspect public/scene.isostate.json
```

Inspection verifies the canonical runtime bundle metadata, including `_format`,
`_version`, and `_digest`, and reports scene, layer, asset, and floor counts.

Use `fromJs` and `fromJson` from `@sebastianwessel/isostate/dsl` in tests or diagnostics
that need in-process access to compiled artifacts without mounting a browser
scene.

```ts
import { fromJs, fromJson } from '@sebastianwessel/isostate/dsl';

const jsModuleText = await Bun.file('scene.isostate.js').text();
const jsBundle = fromJs(jsModuleText);

console.log(jsBundle._format);
console.log(jsBundle._version);
console.log(jsBundle._digest);
console.log(jsBundle.scenes.map((scene) => scene.id));

const jsonText = await Bun.file('scene.isostate.json').text();
const jsonBundle = fromJson(jsonText);

if (jsonBundle._digest !== jsBundle._digest) {
	throw new Error('JS and JSON bundles do not describe the same scene');
}
```

These helpers are for dev-time diagnostics. Browser code should import the
compiled module or fetch the JSON bundle directly.
