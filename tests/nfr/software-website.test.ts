import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	compileScene,
	parseScene,
	toJs,
	validateScene
} from '../../packages/core/src/dsl/index.ts';
import type { AssetManifestEntry } from '../../packages/editor/src/types.ts';
import { softwareCatalogPreviews } from '../../website/src/lib/software-catalog.ts';

const root = process.cwd();
const catalogRoot = join(root, 'assets/software-architecture');
const siteCatalog = join(root, 'website/public/assets/software-architecture');
const sceneRoot = join(
	root,
	'website/src/scenes/software-architecture.isostate'
);

async function readManifest() {
	return JSON.parse(
		await readFile(join(catalogRoot, 'manifest.json'), 'utf8')
	) as {
		assets: AssetManifestEntry[];
	};
}

describe('software collection website integration', () => {
	test('shows every logical sprite in its domain with exact source crops', async () => {
		const manifest = await readManifest();
		const previews = softwareCatalogPreviews(manifest.assets);
		expect(previews).toHaveLength(20);
		expect(
			previews.filter((asset) => asset.group === 'architecture')
		).toHaveLength(12);
		expect(previews.filter((asset) => asset.group === 'workflow')).toHaveLength(
			5
		);
		expect(previews.filter((asset) => asset.group === 'process')).toHaveLength(
			3
		);
		for (const preview of previews) {
			expect(preview.label.length).toBeGreaterThan(0);
			expect(preview.rect).toBeDefined();
			const source = manifest.assets.find(
				(asset) => asset.path === preview.path
			);
			if (source?.type !== 'sprite-sheet')
				throw new Error('Missing source sheet.');
			const sprite = source.sprites[preview.id];
			if (Array.isArray(sprite))
				throw new Error('Expected an explicit pixel crop.');
			expect(preview.rect).toEqual(sprite.rect);
			expect(preview.sheetSize).toEqual(source.sheetSize);
		}
	});

	test('ships byte-identical source images and manifest to the website', async () => {
		const manifest = await readManifest();
		for (const path of [
			'manifest.json',
			'LICENSE',
			...new Set(manifest.assets.map((asset) => asset.path))
		]) {
			expect(await readFile(join(siteCatalog, path))).toEqual(
				await readFile(join(catalogRoot, path))
			);
		}
	});

	test('keeps the authored sample, compiled scene, and downloads synchronized', async () => {
		const yaml = await readFile(`${sceneRoot}.yaml`, 'utf8');
		const document = parseScene(yaml);
		expect(validateScene(document).errors).toEqual([]);
		expect(document.scenes.map((scene) => scene.id)).toEqual([
			'architecture',
			'workflow',
			'process'
		]);
		for (const scene of document.scenes) {
			for (const element of [
				...(scene.elements ?? []),
				...(scene.add?.elements ?? [])
			]) {
				expect(element.at.every(Number.isInteger)).toBe(true);
				expect(element.size ?? 1).toBe(1);
			}
		}
		const compiled = toJs(compileScene(document), { minify: true });
		expect(await readFile(`${sceneRoot}.js`, 'utf8')).toBe(compiled);
		expect(
			await readFile(
				join(root, 'website/public/scenes/software-architecture.isostate.yaml'),
				'utf8'
			)
		).toBe(yaml);
		expect(
			await readFile(
				join(root, 'website/public/scenes/software-architecture.isostate.js'),
				'utf8'
			)
		).toBe(compiled);
		const bundle = compileScene(document);
		expect(bundle.scenes).toHaveLength(3);
		for (const asset of Object.values(bundle.assets ?? {})) {
			if (asset.url) expect(asset.sprite).toBeDefined();
		}
	});

	test('exposes the collection and starter through navigation and editor discovery', async () => {
		const layout = await readFile(
			join(root, 'website/src/layouts/SiteLayout.astro'),
			'utf8'
		);
		const home = await readFile(
			join(root, 'website/src/pages/index.astro'),
			'utf8'
		);
		const editor = await readFile(
			join(root, 'website/src/pages/editor.astro'),
			'utf8'
		);
		const gallery = await readFile(
			join(root, 'website/src/pages/assets.astro'),
			'utf8'
		);
		const docs = await readFile(join(root, 'website/src/docs.ts'), 'utf8');
		expect(layout).toContain("href={href('/assets')}");
		expect(home).toContain("href={href('/assets')}");
		expect(editor).toContain('/assets/software-architecture/manifest.json');
		expect(editor).toContain("example === 'software-architecture'");
		expect(gallery).toContain('mountScene');
		expect(gallery).toContain('software-architecture.isostate.js');
		expect(gallery).toContain('crypto.subtle.digest');
		expect(gallery).not.toContain('/dsl/');
		expect(docs).toContain("'guides/software-architecture-assets.md'");
	});
});
