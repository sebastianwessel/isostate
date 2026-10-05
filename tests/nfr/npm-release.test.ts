import { describe, expect, test } from 'bun:test';
import {
	checkNpmRelease,
	publishedPackages
} from '../../scripts/check-npm-release.ts';

describe('npm release checks', () => {
	test('accepts only confirmed missing versions for both published packages', async () => {
		const urls: string[] = [];
		await checkNpmRelease('0.6.0', async (url) => {
			urls.push(url);
			return new Response('', { status: 404 });
		});
		expect(urls.sort()).toEqual(
			publishedPackages
				.map(
					(name) =>
						`https://registry.npmjs.org/${encodeURIComponent(name)}/0.6.0`
				)
				.sort()
		);
	});

	for (const published of publishedPackages) {
		test(`rejects an existing version of ${published}`, async () => {
			await expect(
				checkNpmRelease('0.6.0', async (url) => {
					return new Response('', {
						status: url.includes(`${encodeURIComponent(published)}/`)
							? 200
							: 404
					});
				})
			).rejects.toThrow(`${published}@0.6.0 is already published`);
		});
	}

	for (const status of [401, 403, 429, 500, 503]) {
		test(`rejects registry HTTP ${status} instead of treating it as an absent version`, async () => {
			await expect(
				checkNpmRelease('0.6.0', async () => new Response('', { status }))
			).rejects.toThrow(`registry returned HTTP ${status}`);
		});
	}

	test('rejects network failures', async () => {
		await expect(
			checkNpmRelease('0.6.0', async () => {
				throw new TypeError('Network unavailable');
			})
		).rejects.toThrow('registry request failed');
	});
});
