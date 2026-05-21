# Compile YAML

Use the dev-time DSL entrypoint from build tooling, tests, or generation
scripts. This path may use `yaml`; the browser runtime must load only the
compiled output.

```ts
import {
	compileScene,
	parseScene,
	toJs,
	toJson,
	validateScene
} from '@isostate/core/dsl';

const yamlText = await Bun.file('scene.isostate.yaml').text();
const document = parseScene(yamlText);
const report = validateScene(document);

if (!report.isValid) {
	throw new Error(report.errors[0]?.message ?? 'Invalid scene');
}

const bundle = compileScene(document);

await Bun.write('scene.isostate.js', toJs(bundle));
await Bun.write('scene.isostate.json', toJson(bundle));
```

Keep this compile step in local build or CI processes. The emitted JS or JSON
bundle is the artifact imported by browser code.

External assets must resolve through `header.assetBaseUrl`; the compiler emits
browser-loadable URLs instead of embedding SVG markup.
