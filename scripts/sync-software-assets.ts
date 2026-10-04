/** Regenerate the website catalog and compiled showcase from their sources. */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, isScalar, visit } from 'yaml';
import {
	compileScene,
	parseScene,
	toJs,
	validateScene
} from '../packages/core/src/dsl/index.ts';
import type { AssetManifestEntry } from '../packages/editor/src/types.ts';
import { regenerateSoftwareManifest } from './regenerate-software-manifest.ts';

await regenerateSoftwareManifest();

const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(root, 'assets/software-architecture');
const destination = resolve(
	root,
	'website/public/assets/software-architecture'
);
const scenePath = resolve(
	root,
	'website/src/scenes/software-architecture.isostate.yaml'
);
const manifest = JSON.parse(
	await readFile(resolve(source, 'manifest.json'), 'utf8')
) as { assets: AssetManifestEntry[] };
const declarations = manifest.assets.map((asset) => {
	if (asset.type !== 'sprite-sheet')
		return { id: asset.id, path: asset.path, anchor: asset.anchor };
	return {
		id: asset.id,
		type: asset.type,
		path: asset.path,
		sheetSize: asset.sheetSize,
		tileSize: asset.tileSize,
		anchor: asset.anchor,
		sprites: Object.fromEntries(
			Object.entries(asset.sprites).map(([id, sprite]) => [
				id,
				Array.isArray(sprite)
					? sprite
					: { at: sprite.at, rect: sprite.rect, anchor: sprite.anchor }
			])
		)
	};
});
const original = await readFile(scenePath, 'utf8');
const declarationDocument = new Document({ assets: declarations });
visit(declarationDocument, {
	Seq(_key, node) {
		if (
			node.items.every(
				(item) => isScalar(item) && typeof item.value === 'number'
			)
		)
			node.flow = true;
	}
});
const assetYaml = declarationDocument
	.toString({ indent: 2 })
	.split('\n')
	.filter((line) => line.length)
	.map((line) => `  ${line}`)
	.join('\n');
const yaml = original.replace(
	/ {2}assets:\n[\s\S]*?(?= {2}grid:)/,
	`${assetYaml}\n`
);
await writeFile(scenePath, yaml);
const document = parseScene(yaml);
const report = validateScene(document);
if (report.errors.length) {
	throw new Error(
		report.errors.map((error) => `${error.code}: ${error.message}`).join('\n')
	);
}
const bundle = toJs(compileScene(document), { minify: true });
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const path of new Set(manifest.assets.map((asset) => asset.path))) {
	const output = resolve(destination, path);
	await mkdir(resolve(output, '..'), { recursive: true });
	await cp(resolve(source, path), output);
}
await cp(
	resolve(source, 'manifest.json'),
	resolve(destination, 'manifest.json')
);
for (const file of ['LICENSE', 'README.md', 'IMAGEGEN-PROMPTS.md']) {
	await cp(resolve(source, file), resolve(destination, file));
}
await writeFile(scenePath.replace('.yaml', '.js'), bundle);
const downloads = resolve(root, 'website/public/scenes');
await mkdir(downloads, { recursive: true });
await writeFile(
	resolve(downloads, 'software-architecture.isostate.yaml'),
	yaml
);
await writeFile(
	resolve(downloads, 'software-architecture.isostate.js'),
	bundle
);
console.log('Software assets and showcase synchronized.');
