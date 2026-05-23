import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();

const docs = [
	'README.md',
	'packages/core/README.md',
	'packages/cli/README.md',
	'docs/README.md',
	'docs/getting-started.md',
	'docs/guides/install-authoring-skill.md',
	'docs/guides/author-scene-deltas.md',
	'docs/guides/use-the-cli.md',
	'docs/guides/deploy-static-bundle.md',
	'docs/guides/use-editor-in-astro.md',
	'docs/examples/README.md',
	'docs/examples/runtime-basic.md',
	'docs/examples/controller-scroll.md',
	'docs/examples/compile-yaml.md',
	'docs/examples/low-level-rendering.md',
	'docs/examples/custom-assets.md',
	'docs/examples/custom-theme.md',
	'docs/examples/inspect-bundle.md',
	'docs/examples/editor-basic.md',
	'docs/examples/editor-react.md',
	'docs/examples/editor-export.md',
	'docs/examples/asset-manifest.md',
	'docs/reference/public-api.md',
	'docs/reference/runtime-bundle.md',
	'docs/reference/errors.md',
	'docs/reference/types.md',
	'docs/reference/editor.md'
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
			expect(text).toContain("from '@sebastianwessel/isostate'");
		}
	});

	test('dev-time examples use the DSL entrypoint', async () => {
		for (const path of [
			'docs/examples/compile-yaml.md',
			'docs/examples/inspect-bundle.md'
		]) {
			const text = await readFile(join(root, path), 'utf8');
			expect(text).toContain("from '@sebastianwessel/isostate/dsl'");
		}
	});

	test('static deployment docs describe public output and runtime boundary', async () => {
		const rootReadme = await readFile(join(root, 'README.md'), 'utf8');
		const gettingStarted = await readFile(
			join(root, 'docs/getting-started.md'),
			'utf8'
		);
		const text = await readFile(
			join(root, 'docs/guides/deploy-static-bundle.md'),
			'utf8'
		);
		const docsIndex = await readFile(join(root, 'docs/README.md'), 'utf8');
		const skillsGuide = await readFile(
			join(root, 'docs/guides/install-authoring-skill.md'),
			'utf8'
		);
		const examplesIndex = await readFile(
			join(root, 'docs/examples/README.md'),
			'utf8'
		);

		for (const fragment of [
			'bunx --package @sebastianwessel/isostate-cli isostate bundle',
			'bunx --package @sebastianwessel/isostate-cli isostate inspect',
			'public/isostate/scene/',
			'isostate.runtime.js',
			'scene.isostate.js',
			'manifest.json',
			'assets/',
			'YAML parser, validator, compiler, CLI',
			'--public-asset-base',
			'--asset-dir'
		]) {
			expect(text).toContain(fragment);
		}
		expect(text).toMatch(/does not include\s+authored YAML/);
		expect(rootReadme).toContain('./docs/guides/deploy-static-bundle.md');
		expect(rootReadme).toContain('bun run examples:basic:bundle');
		expect(rootReadme).toContain('bunx --package @sebastianwessel/isostate-cli isostate bundle');
		expect(docsIndex).toContain('./guides/install-authoring-skill.md');
		expect(docsIndex).toContain('./guides/deploy-static-bundle.md');
		expect(gettingStarted).toContain('bunx skills add sebastianwessel/isostate');
		expect(skillsGuide).toContain('bunx skills add sebastianwessel/isostate');
		expect(skillsGuide).toContain('--skill authoring-isostate-scenes');
		expect(skillsGuide).toContain('--agent codex');
		expect(examplesIndex).toContain('../guides/deploy-static-bundle.md');
	});

	test('CLI docs describe validate compile bundle and inspect workflows', async () => {
		const cliGuide = await readFile(
			join(root, 'docs/guides/use-the-cli.md'),
			'utf8'
		);
		const docsIndex = await readFile(join(root, 'docs/README.md'), 'utf8');
		const gettingStarted = await readFile(
			join(root, 'docs/getting-started.md'),
			'utf8'
		);
		const examplesIndex = await readFile(
			join(root, 'docs/examples/README.md'),
			'utf8'
		);
		const rootReadme = await readFile(join(root, 'README.md'), 'utf8');

		for (const fragment of [
			'bunx --package @sebastianwessel/isostate-cli isostate validate',
			'bunx --package @sebastianwessel/isostate-cli isostate compile',
			'bunx --package @sebastianwessel/isostate-cli isostate bundle',
			'bunx --package @sebastianwessel/isostate-cli isostate inspect',
			'npm install --save-dev @sebastianwessel/isostate-cli',
			'--format json'
		]) {
			expect(cliGuide).toContain(fragment);
		}
		expect(docsIndex).toContain('./guides/use-the-cli.md');
		expect(gettingStarted).toContain('./guides/use-the-cli.md');
		expect(examplesIndex).toContain('../guides/use-the-cli.md');
		expect(rootReadme).toContain('./docs/guides/use-the-cli.md');
	});

	test('authoring skill covers CLI and static deployment workflow', async () => {
		const skill = await readFile(
			join(root, 'skills/authoring-isostate-scenes/SKILL.md'),
			'utf8'
		);
		const reference = await readFile(
			join(root, 'skills/authoring-isostate-scenes/references/deployment.md'),
			'utf8'
		);

		expect(skill).toContain('references/deployment.md');
		expect(skill).toContain('isostate validate');
		expect(skill).toContain('isostate compile');
		expect(skill).toContain('isostate bundle');
		expect(skill).toContain('isostate inspect');
		expect(reference).toContain('CLI Command Surface');
		expect(reference).toContain('bunx --package @sebastianwessel/isostate-cli isostate validate');
		expect(reference).toContain('bunx --package @sebastianwessel/isostate-cli isostate compile');
		expect(reference).toContain('bunx --package @sebastianwessel/isostate-cli isostate bundle');
		expect(reference).toContain('bunx --package @sebastianwessel/isostate-cli isostate inspect');
		expect(reference).toContain('isostate.runtime.js');
		expect(reference).toContain('manifest.json');
		expect(reference).toContain('yaml` package');
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
		expect(main).toContain("svg.querySelector('.iso-depth-layer')");
		expect(main).toContain('asset?.anchor ?? [0.5, 1]');
		expect(main).not.toContain('getResolvedConfig().states');
		expect(main).not.toContain('scrollProgress');
		expect(main).not.toContain('sceneBundle.elements');
	});

	test('basic example uses CSS variables with a shadcn-compatible dark class', async () => {
		const source = await readFile(
			join(root, 'examples/basic/source.isostate.yaml'),
			'utf8'
		);
		const bundle = await readFile(
			join(root, 'examples/basic/scene.isostate.js'),
			'utf8'
		);
		const styles = await readFile(
			join(root, 'examples/basic/styles.css'),
			'utf8'
		);

		expect(source).toContain('fill: var(--iso-label)');
		expect(source).toContain('stroke: var(--iso-flow)');
		expect(source).not.toContain('theme: light');
		expect(source).not.toContain('className:');
		expect(source).not.toMatch(/(?:fill|stroke|outline): "#/);
		expect(bundle).not.toMatch(/"#[0-9a-fA-F]{6}"/);
		expect(bundle).not.toContain('"className":');

		expect(styles).toContain(':root {');
		expect(styles).toContain('.dark {');
		expect(styles).toContain('.stage .iso-scene');
		expect(styles).toContain('--iso-label:');
		expect(styles).toContain('--iso-flow:');
		expect(styles).not.toContain('demo-surface');
		expect(styles).not.toContain('[data-theme="dark"]');
	});
});
