import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

describe('asset manifests', () => {
	test('aws 3d assets declare normalized anchors', async () => {
		const manifest = JSON.parse(
			await readFile('assets/aws-3d/manifest.json', 'utf8')
		) as {
			assets: Array<{ id: string; anchor?: unknown }>;
		};

		expect(manifest.assets.length).toBeGreaterThan(0);
		for (const asset of manifest.assets) {
			expect(asset.anchor, asset.id).toEqual([
				expect.any(Number),
				expect.any(Number)
			]);
			const [x, y] = asset.anchor as [number, number];
			expect(x, `${asset.id} anchor x`).toBeGreaterThanOrEqual(0);
			expect(x, `${asset.id} anchor x`).toBeLessThanOrEqual(1);
			expect(y, `${asset.id} anchor y`).toBeGreaterThanOrEqual(0);
			expect(y, `${asset.id} anchor y`).toBeLessThanOrEqual(1);
		}
	});

	test('website aws 3d manifest groups assets for editor browsing', async () => {
		const manifest = JSON.parse(
			await readFile('website/public/assets/aws-3d.manifest.json', 'utf8')
		) as {
			assetBaseUrl: string;
			assets: Array<{ id: string; group?: unknown; anchor?: unknown }>;
		};

		expect(manifest.assetBaseUrl).toBe('./aws-3d');
		expect(manifest.assets.length).toBeGreaterThan(0);
		for (const asset of manifest.assets) {
			expect(asset.group, asset.id).toBe('AWS 3D');
			expect(asset.anchor, asset.id).toEqual([0.5, 0.75]);
		}
	});

	test('website traffic sprite sheet stays in its own manifest', async () => {
		const manifest = JSON.parse(
			await readFile('website/public/assets/traffic.manifest.json', 'utf8')
		) as {
			assetBaseUrl: string;
			assets: Array<{
				id: string;
				type?: string;
				group?: unknown;
				sheetSize?: unknown;
				tileSize?: unknown;
				sprites?: Record<string, unknown>;
			}>;
		};

		expect(manifest.assetBaseUrl).toBe('./traffic');
		expect(manifest.assets).toHaveLength(1);
		expect(manifest.assets[0]).toMatchObject({
			id: 'traffic-sprites',
			type: 'sprite-sheet',
			group: 'Traffic',
			sheetSize: [1024, 1024],
			tileSize: [256, 256]
		});
		expect(Object.keys(manifest.assets[0].sprites ?? {})).toHaveLength(16);
	});

	test('website traffic sprite sheet uses an alpha channel', async () => {
		const bytes = await readFile(
			'website/public/assets/traffic/traffic-sprites.png'
		);

		expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
		expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
		expect(bytes[25]).toBe(6);
	});
});
