import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

describe('package export contract', () => {
	test('@sebastianwessel/isostate publishes only runtime and DSL entrypoints', async () => {
		const pkg = JSON.parse(
			await readFile(join(process.cwd(), 'packages/core/package.json'), 'utf8')
		) as {
			exports: Record<string, unknown>;
			types?: string;
			main?: string;
		};

		expect(Object.keys(pkg.exports).sort()).toEqual([
			'.',
			'./dsl',
			'./runtime'
		]);
		expect(pkg.main).toBe('./dist/index.js');
		expect(pkg.types).toBe('./dist/index.d.ts');
	});
});
