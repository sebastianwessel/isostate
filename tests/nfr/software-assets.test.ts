import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';

type Sprite = {
	rect: [number, number, number, number];
	anchor: [number, number];
	label: string;
	tags: string[];
};
type CatalogEntry = {
	id: string;
	type: string;
	path: string;
	sheetSize: [number, number];
	width: number;
	height: number;
	digest: string;
	sprites: Record<string, Sprite>;
};
type Catalog = {
	format: string;
	version: number;
	assetBaseUrl: string;
	generatedAt: string;
	assets: CatalogEntry[];
};
const root = 'assets/software-architecture';
const catalog = JSON.parse(
	await readFile(join(root, 'manifest.json'), 'utf8')
) as Catalog;

describe('software architecture catalog', () => {
	test('covers all thirteen source images and ninety-four labeled logical sprites', async () => {
		const sourceFiles = (await readdir(root, { recursive: true }))
			.filter((path) => /\.(png|svg|webp)$/.test(path))
			.sort();
		const metadata = parse(
			await readFile(join(root, '.isostate-assets.yaml'), 'utf8')
		) as {
			assets: Record<string, Partial<CatalogEntry>>;
		};
		expect(catalog.format).toBe('isostate.asset-manifest');
		expect(catalog.version).toBe(1);
		expect(catalog.assetBaseUrl).toBe('./');
		expect(catalog.assets).toHaveLength(13);
		expect(catalog.assets.map((entry) => entry.path).sort()).toEqual(
			sourceFiles
		);
		expect(Object.keys(metadata.assets).sort()).toEqual(sourceFiles);
		const ids = catalog.assets.flatMap((entry) => Object.keys(entry.sprites));
		expect(new Set(ids).size).toBe(94);
		expect(ids.filter((id) => id.startsWith('architecture-'))).toHaveLength(12);
		expect(ids.filter((id) => id.startsWith('workflow-'))).toHaveLength(5);
		expect(ids.filter((id) => id.startsWith('process-'))).toHaveLength(3);
		for (const prefix of ['channel', 'servicenow', 'provider', 'infra']) {
			expect(
				ids.filter((id) => id.startsWith(`${prefix}-`)),
				prefix
			).toHaveLength(8);
		}
		expect(ids.filter((id) => id.startsWith('ai-'))).toHaveLength(17);
		expect(ids.filter((id) => id.startsWith('human-'))).toHaveLength(9);
		expect(ids).toContain('human-to-ai-handoff');
		expect(ids).toContain('ai-to-human-handoff');
		expect(ids.filter((id) => id.startsWith('agent-'))).toHaveLength(16);

		for (const entry of catalog.assets)
			expect(entry).toMatchObject(metadata.assets[entry.path]);
	});

	test('records actual RGBA PNG dimensions and original source-byte digests', async () => {
		for (const entry of catalog.assets) {
			const bytes = await readFile(join(root, entry.path));
			expect(entry.type).toBe('sprite-sheet');
			expect(bytes.subarray(0, 8)).toEqual(
				Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
			);
			expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
			expect(bytes[25], 'RGBA PNG alpha channel').toBe(6);
			const dimensions: [number, number] = [
				bytes.readUInt32BE(16),
				bytes.readUInt32BE(20)
			];
			expect(entry.sheetSize).toEqual(dimensions);
			expect([entry.width, entry.height]).toEqual(dimensions);
			expect(entry.digest).toBe(
				`sha256:${createHash('sha256').update(bytes).digest('hex')}`
			);
		}
	});

	test('uses bounded whole-pixel crops and explicit normalized ground anchors', () => {
		for (const sheet of catalog.assets) {
			for (const [id, sprite] of Object.entries(sheet.sprites)) {
				const [x, y, width, height] = sprite.rect;
				expect(sprite.rect.every(Number.isInteger), id).toBe(true);
				expect(x).toBeGreaterThanOrEqual(0);
				expect(y).toBeGreaterThanOrEqual(0);
				expect(width).toBeGreaterThan(0);
				expect(height).toBeGreaterThan(0);
				expect(x + width).toBeLessThanOrEqual(sheet.width);
				expect(y + height).toBeLessThanOrEqual(sheet.height);
				expect(sprite.anchor).toHaveLength(2);
				expect(
					sprite.anchor.every((value) => value >= 0 && value <= 1),
					id
				).toBe(true);
				expect(sprite.label.length).toBeGreaterThan(0);
				expect(sprite.tags.length).toBeGreaterThan(0);
			}
		}
	});

	test('regenerates the checked manifest through the public CLI', async () => {
		const directory = await mkdtemp(
			join(tmpdir(), 'isostate-software-assets-')
		);
		try {
			const out = join(directory, 'manifest.json');
			const proc = Bun.spawn(
				[
					process.execPath,
					'packages/cli/src/bin.ts',
					'assets',
					'manifest',
					root,
					'--out',
					out,
					'--asset-base-url',
					'./'
				],
				{ stdout: 'pipe', stderr: 'pipe' }
			);
			const [exitCode, stderr] = await Promise.all([
				proc.exited,
				new Response(proc.stderr).text()
			]);
			expect(exitCode, stderr).toBe(0);
			const regenerated = JSON.parse(await readFile(out, 'utf8')) as Catalog;
			expect({ ...regenerated, generatedAt: '' }).toEqual({
				...catalog,
				generatedAt: ''
			});
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
