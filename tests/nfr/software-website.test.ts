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
import {
	matchesSoftwareAsset,
	SOFTWARE_CATALOG_GROUPS,
	softwareCatalogPreviews
} from '../../website/src/lib/software-catalog.ts';

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
		expect(previews).toHaveLength(94);
		for (const group of SOFTWARE_CATALOG_GROUPS.slice(0, 9)) {
			expect(previews.filter((asset) => asset.group === group.id)).toHaveLength(
				group.id === 'human' ? 10 : 8
			);
		}
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
			'NOTICE.md',
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
		const examples = await readFile(
			join(root, 'website/src/lib/software-examples.ts'),
			'utf8'
		);
		expect(examples).toContain('mountScene');
		expect(examples).toContain('software-architecture.isostate.js');
		expect(examples).toContain('crypto.subtle.digest');
		expect(examples).not.toContain('/dsl/');
		expect(gallery).toContain('id="asset-search"');
		expect(gallery).toContain('id="asset-category"');
		expect(gallery).toContain('aria-live="polite"');
		expect(gallery).not.toContain('All 20');
		for (const name of ['agentic-workflow', 'provider-routing']) {
			expect(editor).toContain(`${name}.isostate.yaml?raw`);
			expect(examples).toContain(`${name}.isostate.js`);
		}
		expect(docs).toContain("'guides/agentic-workflows.md'");
		expect(gallery).not.toContain('/dsl/');
		expect(docs).toContain("'guides/software-architecture-assets.md'");
	});
	test('discovers products and record aliases while respecting category filters', async () => {
		const previews = softwareCatalogPreviews((await readManifest()).assets);
		const search = (query: string, group = 'all') =>
			previews
				.filter((asset) => matchesSoftwareAsset(asset, query, group))
				.map((asset) => asset.id);
		expect(search('Azure AI Foundry')).toEqual(['provider-azure-foundry']);
		expect(search('Claude', 'provider')).toEqual(['provider-anthropic']);
		expect(search('AWS Bedrock')).toEqual(['provider-aws-bedrock']);
		expect(search('Gemini Enterprise Agent Platform')).toEqual([
			'provider-google-vertex'
		]);
		expect(search('RITM')).toEqual(['servicenow-requested-item']);
		expect(search('sc_task')).toEqual(['servicenow-request-task']);
		expect(search('Claude', 'human')).toEqual([]);
		expect(search('no-such-catalog-object')).toEqual([]);
		expect(search('  ')).toHaveLength(previews.length);
	});

	for (const name of ['agentic-workflow', 'provider-routing']) {
		test(`validates ${name} deltas and synchronizes runtime and download artifacts`, async () => {
			const sourceRoot = join(root, `website/src/scenes/${name}.isostate`);
			const yaml = await readFile(`${sourceRoot}.yaml`, 'utf8');
			const document = parseScene(yaml);
			expect(validateScene(document).errors).toEqual([]);
			expect(document.scenes).toHaveLength(4);
			for (const scene of document.scenes) {
				for (const element of [
					...(scene.elements ?? []),
					...(scene.add?.elements ?? [])
				]) {
					expect(element.at.every(Number.isInteger)).toBe(true);
					expect(element.size ?? 1).toBe(1);
					if (element.asset === 'text')
						expect(element.text?.value.trim().length).toBeGreaterThan(0);
				}
			}
			const bundle = compileScene(document);
			for (const scene of bundle.scenes)
				expect(
					scene.elements.length + scene.connectors.length
				).toBeLessThanOrEqual(50);
			const compiled = toJs(bundle, { minify: true });
			expect(await readFile(`${sourceRoot}.js`, 'utf8')).toBe(compiled);
			for (const extension of ['yaml', 'js']) {
				expect(
					await readFile(
						join(root, `website/public/scenes/${name}.isostate.${extension}`),
						'utf8'
					)
				).toBe(extension === 'yaml' ? yaml : compiled);
			}
		});
	}
});
