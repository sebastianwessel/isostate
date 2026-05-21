# Compile YAML

Prefer the CLI for local build scripts and release workflows:

```bash
bunx --package @sebastianwessel/isostate-cli isostate compile scene.isostate.yaml --out public/scene.isostate.js
bunx --package @sebastianwessel/isostate-cli isostate compile scene.isostate.yaml --out public/scene.isostate.json --format json
```

The CLI validates before writing and keeps YAML parsing, validation, and
compilation in development tooling. Browser code should import the emitted JS
module or fetch the emitted JSON.

Use the dev-time DSL entrypoint when custom build tooling needs in-process
control. This path may use `yaml`; the browser runtime must load only the
compiled output.

```ts
import {
	compileScene,
	parseScene,
	toJs,
	toJson,
	validateScene
} from '@sebastianwessel/isostate/dsl';

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
