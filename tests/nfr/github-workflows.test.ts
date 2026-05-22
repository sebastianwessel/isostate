import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();

describe('GitHub workflows', () => {
	test('pull requests run the default verification gates', async () => {
		const workflow = await readFile(
			join(root, '.github/workflows/pr.yml'),
			'utf8'
		);

		expect(workflow).toContain('pull_request:');
		expect(workflow).toContain('branches:');
		expect(workflow).toContain('- main');
		expect(workflow).toContain('actions/setup-node@v6');
		expect(workflow).toContain('node-version: 24');
		expect(workflow).toContain('bun ci');
		expect(workflow).toContain('bun run format');
		expect(workflow).toContain('git diff --exit-code');
		expect(workflow).toContain('bun run lint');
		expect(workflow).toContain('bun run typecheck');
		expect(workflow).toContain('bun run test');
		expect(workflow).toContain('bun run build');
		expect(workflow).toContain('bun run size');
		expect(workflow).toContain('bun run publint');
		expect(workflow).toContain('bun run examples:basic:bundle');
		expect(workflow).toContain('bun run site:build');
	});

	test('manual release verifies before publishing and tagging', async () => {
		const workflow = await readFile(
			join(root, '.github/workflows/release.yml'),
			'utf8'
		);

		expect(workflow).toContain('workflow_dispatch:');
		expect(workflow).toContain('push:');
		expect(workflow).toContain('- package.json');
		expect(workflow).toContain('- packages/core/package.json');
		expect(workflow).toContain('- packages/cli/package.json');
		expect(workflow).toContain("github.ref == 'refs/heads/main'");
		expect(workflow).toContain('bun ci');
		expect(workflow).toContain('bun run format');
		expect(workflow).toContain('git diff --exit-code');
		expect(workflow).toContain('bun run lint');
		expect(workflow).toContain('bun run typecheck');
		expect(workflow).toContain('bun run test');
		expect(workflow).toContain('bun run build');
		expect(workflow).toContain('bun run size');
		expect(workflow).toContain('bun run publint');
		expect(workflow).toContain('bun run examples:basic:bundle');
		expect(workflow).toContain('withastro/action@v6');
		expect(workflow).toContain('build-cmd: bun run site:build');
		expect(workflow).toContain('out-dir: website/dist');
		expect(workflow).toContain('npm view "@sebastianwessel/isostate@$version"');
		expect(workflow).toContain('npm view "@sebastianwessel/isostate-cli@$version"');
		expect(workflow).toContain('npm publish --access public --provenance ./packages/core');
		expect(workflow).toContain('npm publish --access public --provenance ./packages/cli');
		expect(workflow).toContain('secrets.NPM_TOKEN');
		expect(workflow).toContain('git tag -a "$tag"');
		expect(workflow).toContain('softprops/action-gh-release@v2');
		expect(workflow).toContain('Deploy website to GitHub Pages');
		expect(workflow).toContain('needs: release');
		expect(workflow).toContain('actions/deploy-pages@v5');
		expect(workflow).toContain('id: deployment');
		expect(workflow).toContain('github-pages');
		expect(workflow).toContain('pages: write');
	});

	test('manual website deploy builds and publishes Pages without npm release', async () => {
		const workflow = await readFile(
			join(root, '.github/workflows/deploy-website.yml'),
			'utf8'
		);

		expect(workflow).toContain('workflow_dispatch:');
		expect(workflow).toContain('contents: read');
		expect(workflow).toContain('pages: write');
		expect(workflow).toContain('id-token: write');
		expect(workflow).toContain('actions/checkout@v6');
		expect(workflow).toContain('withastro/action@v6');
		expect(workflow).toContain('node-version: 24');
		expect(workflow).toContain('package-manager: bun@latest');
		expect(workflow).toContain('build-cmd: bun run site:build');
		expect(workflow).toContain('out-dir: website/dist');
		expect(workflow).toContain('actions/deploy-pages@v5');
		expect(workflow).not.toContain('npm publish');
	});
});
