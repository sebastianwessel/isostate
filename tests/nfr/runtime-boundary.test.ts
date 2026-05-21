import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();

const forbiddenRuntimeFragments = [
	"from 'yaml'",
	'from "yaml"',
	"from 'node:crypto'",
	'from "node:crypto"',
	'./dsl/',
	'../dsl/',
	'scene-parser',
	'scene-validator',
	'compileScene',
	'parseScene',
	'validateScene'
] as const;

describe('runtime/dev-time boundary', () => {
	test('runtime source entrypoint does not export DSL APIs', async () => {
		const source = await readFile(
			join(root, 'packages/core/src/index.ts'),
			'utf8'
		);

		for (const fragment of ['parseScene', 'validateScene', 'compileScene']) {
			expect(source).not.toContain(fragment);
		}
	});

	test('built runtime entrypoint excludes YAML and DSL modules', async () => {
		const runtime = await readFile(
			join(root, 'packages/core/dist/runtime/index.js'),
			'utf8'
		);

		for (const fragment of forbiddenRuntimeFragments) {
			expect(runtime).not.toContain(fragment);
		}
	});

	test('dev-time entrypoint is the only public DSL surface', async () => {
		const dsl = await readFile(
			join(root, 'packages/core/src/dsl/index.ts'),
			'utf8'
		);

		for (const symbol of [
			'parseScene',
			'validateScene',
			'compileScene',
			'toJs',
			'toJson',
			'fromJs',
			'fromJson'
		]) {
			expect(dsl).toContain(symbol);
		}
	});
});
