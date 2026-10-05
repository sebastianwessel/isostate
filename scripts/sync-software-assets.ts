/** Regenerate the website catalog and compiled showcase from their sources. */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, isScalar, parse, visit } from 'yaml';
import {
	compileScene,
	parseScene,
	toJs,
	validateScene
} from '../packages/core/src/dsl/index.ts';
import type { AssetManifestEntry } from '../packages/editor/src/types.ts';
import { regenerateSoftwareManifest } from './regenerate-software-manifest.ts';
import { softwareCatalogFiles } from './software-catalog-files.ts';

await regenerateSoftwareManifest();

const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(root, 'assets/software-architecture');
const destination = resolve(
	root,
	'website/public/assets/software-architecture'
);
const sceneNames = [
	'software-architecture',
	'agentic-workflow',
	'provider-routing'
];
const manifest = JSON.parse(
	await readFile(resolve(source, 'manifest.json'), 'utf8')
) as { assets: AssetManifestEntry[] };
/** Find placed assets, including later-scene additions and replacements. */
function referencedAssets(
	value: unknown,
	ids = new Set<string>()
): Set<string> {
	if (Array.isArray(value)) {
		for (const item of value) referencedAssets(item, ids);
	} else if (value && typeof value === 'object') {
		for (const [key, child] of Object.entries(value)) {
			if (key === 'asset' && typeof child === 'string') ids.add(child);
			else referencedAssets(child, ids);
		}
	}
	return ids;
}

/** Include only the source crops used by this runnable scene. */
function sceneDeclarations(used: Set<string>) {
	return manifest.assets.flatMap((asset) => {
		if (asset.type !== 'sprite-sheet') {
			return used.has(asset.id)
				? [{ id: asset.id, path: asset.path, anchor: asset.anchor }]
				: [];
		}
		const sprites = Object.entries(asset.sprites).filter(([id]) =>
			used.has(id)
		);
		if (!sprites.length) return [];
		return [
			{
				id: asset.id,
				type: asset.type,
				path: asset.path,
				sheetSize: asset.sheetSize,
				tileSize: asset.tileSize,
				anchor: asset.anchor,
				sprites: Object.fromEntries(
					sprites.map(([id, sprite]) => [
						id,
						Array.isArray(sprite)
							? sprite
							: { at: sprite.at, rect: sprite.rect, anchor: sprite.anchor }
					])
				)
			}
		];
	});
}

async function syncScene(name: string): Promise<void> {
	const scenePath = resolve(root, `website/src/scenes/${name}.isostate.yaml`);
	const original = await readFile(scenePath, 'utf8');
	const used = referencedAssets(
		(parse(original) as { scenes: unknown }).scenes
	);
	const declarationDocument = new Document({ assets: sceneDeclarations(used) });
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
		/ {2}assets:[\s\S]*?(?= {2}grid:)/,
		`${assetYaml}\n`
	);
	const document = parseScene(yaml);
	const report = validateScene(document);
	if (report.errors.length) {
		throw new Error(
			`${name}: ${report.errors.map((error) => `${error.code}: ${error.message}`).join('\n')}`
		);
	}
	const bundle = toJs(compileScene(document), { minify: true });
	await writeFile(scenePath, yaml);
	await writeFile(scenePath.replace('.yaml', '.js'), bundle);
	const downloads = resolve(root, 'website/public/scenes');
	await mkdir(downloads, { recursive: true });
	await writeFile(resolve(downloads, `${name}.isostate.yaml`), yaml);
	await writeFile(resolve(downloads, `${name}.isostate.js`), bundle);
}

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const path of softwareCatalogFiles(manifest.assets)) {
	const output = resolve(destination, path);
	await mkdir(resolve(output, '..'), { recursive: true });
	await cp(resolve(source, path), output);
}
for (const name of sceneNames) await syncScene(name);
console.log('Software assets and three showcase examples synchronized.');
