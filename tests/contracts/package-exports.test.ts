import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

describe('package export contract', () => {
	test('@sebastianwessel/isostate publishes runtime, authoring, and static asset entrypoints', async () => {
		const pkg = JSON.parse(
			await readFile(join(process.cwd(), 'packages/core/package.json'), 'utf8')
		) as {
			exports: Record<string, unknown>;
			types?: string;
			main?: string;
		};

		expect(Object.keys(pkg.exports).sort()).toEqual([
			'.',
			'./assets/software-architecture/*',
			'./dsl',
			'./dsl/browser',
			'./editor-support',
			'./runtime'
		]);
		expect(pkg.exports['./assets/software-architecture/*']).toBe(
			'./dist/assets/software-architecture/*'
		);
		expect(pkg.main).toBe('./dist/index.js');
		expect(pkg.types).toBe('./dist/index.d.ts');
	});

	test('@sebastianwessel/isostate-editor publishes required entrypoints', async () => {
		const pkg = JSON.parse(
			await readFile(join(process.cwd(), 'packages/editor/package.json'), 'utf8')
		) as {
			exports: Record<string, unknown>;
			peerDependencies: Record<string, unknown>;
		};

		expect(Object.keys(pkg.exports).sort()).toEqual(['.', './react', './style.css']);
		expect(pkg.peerDependencies.react).toBe('>=19');
		expect(pkg.peerDependencies['react-dom']).toBe('>=19');
	});
});
