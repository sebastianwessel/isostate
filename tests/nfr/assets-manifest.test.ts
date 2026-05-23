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
});
