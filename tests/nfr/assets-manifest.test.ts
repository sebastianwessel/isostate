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
});
