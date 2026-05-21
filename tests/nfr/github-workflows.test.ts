import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();

describe('GitHub workflows', () => {
	test('pull requests run lint, typecheck, and tests', async () => {
		const workflow = await readFile(
			join(root, '.github/workflows/pr.yml'),
			'utf8'
		);

		expect(workflow).toContain('pull_request:');
		expect(workflow).toContain('branches:');
		expect(workflow).toContain('- main');
		expect(workflow).toContain('bun install --frozen-lockfile');
		expect(workflow).toContain('bun run lint');
		expect(workflow).toContain('bun run typecheck');
		expect(workflow).toContain('bun test');
		expect(workflow).toContain('bun run site:build');
	});

	test('manual release verifies before publishing and tagging', async () => {
		const workflow = await readFile(
			join(root, '.github/workflows/release.yml'),
			'utf8'
		);

		expect(workflow).toContain('workflow_dispatch:');
		expect(workflow).toContain("github.ref == 'refs/heads/main'");
		expect(workflow).toContain('bun run lint');
		expect(workflow).toContain('bun run typecheck');
		expect(workflow).toContain('bun test');
		expect(workflow).toContain('bun run build');
		expect(workflow).toContain('bun run site:build');
		expect(workflow).toContain('bun run publint');
		expect(workflow).toContain('npm view "@sebastianwessel/isostate@$version"');
		expect(workflow).toContain('npm view "@sebastianwessel/isostate-cli@$version"');
		expect(workflow).toContain('npm publish --access public --provenance packages/core');
		expect(workflow).toContain('npm publish --access public --provenance packages/cli');
		expect(workflow).toContain('secrets.NPM_TOKEN');
		expect(workflow).toContain('git tag -a "$tag"');
		expect(workflow).toContain('softprops/action-gh-release@v2');
		expect(workflow).toContain('actions/upload-pages-artifact@v3');
		expect(workflow).toContain('path: website/dist');
		expect(workflow).toContain('actions/deploy-pages@v4');
		expect(workflow).toContain('id: deployment');
		expect(workflow).toContain('github-pages');
		expect(workflow).toContain('pages: write');
	});
});
