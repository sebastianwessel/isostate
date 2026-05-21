# Inspect Bundle

Use `fromJs` and `fromJson` from `@isostate/core/dsl` in tests or diagnostics to
inspect compiled artifacts without mounting a browser scene.

```ts
import { fromJs, fromJson } from '@isostate/core/dsl';

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
