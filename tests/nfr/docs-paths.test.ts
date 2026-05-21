import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();

const docs = [
	'docs/README.md',
	'docs/getting-started.md',
	'docs/guides/author-scene-deltas.md',
	'docs/examples/README.md',
	'docs/examples/runtime-basic.md',
	'docs/examples/controller-scroll.md',
	'docs/examples/compile-yaml.md',
	'docs/examples/low-level-rendering.md',
	'docs/examples/custom-assets.md',
	'docs/examples/custom-theme.md',
	'docs/examples/inspect-bundle.md',
	'docs/reference/public-api.md',
	'docs/reference/runtime-bundle.md',
	'docs/reference/errors.md',
	'docs/reference/types.md'
] as const;

describe('public docs inventory', () => {
	for (const path of docs) {
		test(`${path} exists and is implemented`, async () => {
			const text = await readFile(join(root, path), 'utf8');

			expect(text).toContain('# ');
			expect(text).not.toContain('Planned focused example');
			expect(text).not.toContain('Planned reference');
		});
	}

	test('runtime examples start from mountScene', async () => {
		const runtimeDocs = [
			'docs/examples/runtime-basic.md',
			'docs/examples/controller-scroll.md',
			'docs/examples/custom-assets.md',
			'docs/examples/custom-theme.md'
		] as const;

		for (const path of runtimeDocs) {
			const text = await readFile(join(root, path), 'utf8');
			expect(text).toContain('mountScene');
			expect(text).toContain("from '@isostate/core'");
		}
	});

	test('dev-time examples use the DSL entrypoint', async () => {
		for (const path of [
			'docs/examples/compile-yaml.md',
			'docs/examples/inspect-bundle.md'
		]) {
			const text = await readFile(join(root, path), 'utf8');
			expect(text).toContain("from '@isostate/core/dsl'");
		}
	});

	test('docs do not describe the old authored states/keyframes model', async () => {
		const forbidden = [
			'config.states',
			'.states',
			'scene states',
			'scrollProgress',
			'sceneBundle.elements',
			'addConnectors',
			'updateConnectors',
			'removeConnectors'
		] as const;

		for (const path of docs) {
			const text = await readFile(join(root, path), 'utf8');

			for (const fragment of forbidden) {
				expect(text).not.toContain(fragment);
			}
		}
	});

	test('basic example source and bundle use scenes as the canonical timeline', async () => {
		const source = await readFile(
			join(root, 'examples/basic/source.isostate.yaml'),
			'utf8'
		);
		const bundle = await readFile(
			join(root, 'examples/basic/scene.isostate.js'),
			'utf8'
		);
		const main = await readFile(join(root, 'examples/basic/main.js'), 'utf8');

		expect(source).toContain('header:');
		expect(source).toContain('scenes:');
		expect(source).toContain('add:\n      elements:');
		expect(source).toContain('update:\n      elements:');
		expect(source).not.toMatch(/\n\s+add:\n\s+- id:/);
		expect(source).not.toMatch(/\n\s+update:\n\s+- id:/);
		expect(source).not.toMatch(/\n\s+remove:\n\s+- id:/);
		expect(source).not.toContain('connectors:');
		expect(source).not.toContain('states:');
		expect(source).not.toContain('keyframes:');

		expect(bundle).toContain('"_format": "isostate-runtime-bundle"');
		expect(bundle).toContain('"floor":');
		expect(bundle).toContain('"layout":');
		expect(bundle).toContain('"scenes":');
		expect(bundle).not.toContain('"states":');
		expect(bundle).not.toContain('"keyframes":');
		expect(bundle).not.toContain('\n  "elements": [');

		expect(main).toContain('getResolvedConfig().scenes');
		expect(main).not.toContain('getResolvedConfig().states');
		expect(main).not.toContain('scrollProgress');
		expect(main).not.toContain('sceneBundle.elements');
	});
});
