import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

test('published software assets resolve independently of the runtime and match their sources', async () => {
	const result = spawnSync(
		process.execPath,
		['scripts/build-software-assets.ts'],
		{
			encoding: 'utf8'
		}
	);
	expect(result.status, result.stderr).toBe(0);
	const source = resolve('assets/software-architecture');
	const manifest = JSON.parse(
		await readFile(`${source}/manifest.json`, 'utf8')
	) as {
		assets: Array<{ path: string }>;
	};
	const require = createRequire(resolve('packages/core/package.json'));
	for (const file of [
		'manifest.json',
		'README.md',
		'LICENSE',
		'IMAGEGEN-PROMPTS.md',
		...manifest.assets.map((asset) => asset.path)
	]) {
		const installed = require.resolve(
			`@sebastianwessel/isostate/assets/software-architecture/${file}`
		);
		expect(await readFile(installed)).toEqual(
			await readFile(`${source}/${file}`)
		);
	}
});
