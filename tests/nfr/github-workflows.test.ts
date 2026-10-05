import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';

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
		expect(workflow).toContain('bun-version: 1.4.2');
		expect(workflow).toContain('bun ci');
		expect(workflow).toContain('bun scripts/check-release-versions.ts');
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
		expect(workflow).toContain('- packages/editor/package.json');
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
		expect(workflow).toContain('bun-version: 1.4.2');
		expect(workflow).toContain('package-manager: bun@1.4.2');
		expect(workflow).toContain(
			'bun scripts/check-release-versions.ts >> "$GITHUB_ENV"'
		);
		expect(workflow).toContain('bun scripts/check-npm-release.ts "$version"');
		expect(workflow).toContain(
			'npm >=11.5.1 is required for trusted publishing'
		);
		expect(workflow).toContain(
			'git show-ref --verify --quiet "refs/tags/$tag"'
		);
		expect(workflow).toContain(
			'npm publish --access public --provenance ./packages/core'
		);
		expect(workflow).toContain(
			'npm publish --access public --provenance ./packages/cli'
		);
		expect(workflow).not.toContain(
			'npm publish --access public --provenance ./packages/editor'
		);
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
		expect(workflow).toContain('package-manager: bun@1.4.2');
		expect(workflow).toContain('bun-version: 1.4.2');
		expect(workflow).toContain('bun ci');
		expect(workflow).toContain('git diff --exit-code -- bun.lock');
		expect(workflow).toContain(
			'build-cmd: bun run build && bun run site:build'
		);
		expect(workflow).toContain('out-dir: website/dist');
		expect(workflow).toContain('actions/deploy-pages@v5');
		expect(workflow).not.toContain('npm publish');
	});

	test('production workflows serialize deployment without canceling a publish', async () => {
		const workflows = await Promise.all(
			['release.yml', 'deploy-website.yml'].map(
				async (file) =>
					parse(
						await readFile(join(root, '.github/workflows', file), 'utf8')
					) as {
						concurrency: { group: string; 'cancel-in-progress': boolean };
						permissions: Record<string, string>;
						jobs: Record<
							string,
							{
								permissions?: Record<string, string>;
								needs?: string;
								environment?: { name: string; url: string };
								steps: Array<{ name: string; run?: string; uses?: string }>;
							}
						>;
					}
			)
		);
		for (const workflow of workflows) {
			expect(workflow.concurrency).toEqual({
				group: 'isostate-production',
				'cancel-in-progress': false
			});
			expect(workflow.permissions).toEqual({ contents: 'read' });
			expect(workflow.jobs.deploy.permissions).toEqual({
				pages: 'write',
				'id-token': 'write'
			});
			expect(workflow.jobs.deploy.environment).toEqual({
				name: 'github-pages',
				url: `\${{ steps.deployment.outputs.page_url }}`
			});
		}
		const release = workflows[0].jobs.release;
		expect(release.permissions).toEqual({
			contents: 'write',
			'id-token': 'write'
		});
		const names = release.steps.map((step) => step.name);
		for (const check of [
			'Verify package versions',
			'Verify npm versions are new',
			'Build',
			'Test',
			'Coverage',
			'Package lint',
			'Verify lockfile remained unchanged'
		]) {
			expect(names.indexOf(check)).toBeLessThan(
				names.indexOf('Publish core package')
			);
		}
		expect(names.indexOf('Publish core package')).toBeLessThan(
			names.indexOf('Publish CLI package')
		);
		expect(names.indexOf('Publish CLI package')).toBeLessThan(
			names.indexOf('Create git tag')
		);
		expect(workflows[0].jobs.deploy.needs).toBe('release');
		expect(workflows[1].jobs.deploy.needs).toBe('build');
	});
});
