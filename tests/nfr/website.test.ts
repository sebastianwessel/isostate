import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const websiteBuildTimeoutMs = 60_000;

async function listFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) return listFiles(path);
			return [path];
		})
	);
	return files.flat();
}

async function ensureWebsiteBuilt(): Promise<void> {
	const index = join(root, 'website/dist/index.html');
	try {
		await stat(index);
		return;
	} catch {
		const result = spawnSync('bun', ['run', 'site:build'], {
			cwd: root,
			encoding: 'utf8',
			timeout: websiteBuildTimeoutMs
		});

		expect(result.stderr, result.stderr).not.toContain('[ERROR]');
		expect(result.status, result.stderr || result.stdout).toBe(0);
	}
}

describe('Astro website', () => {
	test('uses existing markdown docs and publishes static Pages output', async () => {
		const packageJson = JSON.parse(
			await readFile(join(root, 'package.json'), 'utf8')
		) as { devDependencies?: Record<string, string>; scripts?: Record<string, string> };
		const config = await readFile(join(root, 'website/astro.config.mjs'), 'utf8');
		const docs = await readFile(join(root, 'website/src/docs.ts'), 'utf8');
		const index = await readFile(
			join(root, 'website/src/pages/index.astro'),
			'utf8'
		);
		const route = await readFile(
			join(root, 'website/src/pages/docs/[...slug].astro'),
			'utf8'
		);

		expect(packageJson.devDependencies?.astro).toBe('6.3.7');
		expect(packageJson.devDependencies?.['@astrojs/sitemap']).toBe('^3.7.2');
		expect(packageJson.devDependencies?.['astro-og-canvas']).toBe('^0.11.1');
		expect(packageJson.scripts?.['site:build']).toBe(
			'astro build --root website'
		);
		expect(config).toContain("output: 'static'");
		expect(config).toContain("base: '/isostate'");
		expect(config).toContain("import sitemap from '@astrojs/sitemap'");
		expect(config).toContain('integrations: [sitemap()]');
		expect(docs).toContain("from '../../docs/getting-started.md'");
		expect(docs).toContain(
			"from '../../docs/guides/install-authoring-skill.md'"
		);
		expect(docs).toContain("from '../../docs/guides/use-the-cli.md'");
		expect(docs).toContain("from '../../docs/guides/deploy-static-bundle.md'");
		expect(docs).toContain("from '../../docs/reference/public-api.md'");
		expect(index).toContain('Isometric 3D scenes from YAML');
		expect(index).toContain('id="isostate-demo"');
		expect(index).toContain('mountScene');
		expect(index).toContain("import { Code } from 'astro:components'");
		expect(index).toContain('sceneSnippets');
		expect(index).toContain('route-car');
		expect(index).toContain('Scroll to watch a route come to life');
		expect(index).not.toContain('PUBLIC_ISOSTATE_VERSION');
		expect(route).toContain('getStaticPaths');
		expect(route).toContain('ogImage');
		expect(route).toContain('<Content />');
	});

	test('built website contains home and docs pages', async () => {
		await ensureWebsiteBuilt();

		const dist = join(root, 'website/dist');
		await expect(stat(dist)).resolves.toBeDefined();

		const files = await listFiles(dist);
		const relativeFiles = files.map((file) => file.slice(dist.length + 1));

		expect(relativeFiles).toContain('index.html');
		expect(relativeFiles).toContain('sitemap-index.xml');
		expect(relativeFiles).toContain('sitemap-0.xml');
		expect(relativeFiles).toContain('og/index.png');
		expect(relativeFiles).toContain('og/docs/getting-started.png');
		expect(relativeFiles).toContain('docs/getting-started.md/index.html');
		expect(relativeFiles).toContain(
			'docs/guides/install-authoring-skill.md/index.html'
		);
		expect(relativeFiles).toContain('docs/guides/use-the-cli.md/index.html');
		expect(relativeFiles).toContain('og/docs/guides/use-the-cli.png');
		expect(relativeFiles).toContain(
			'docs/guides/deploy-static-bundle.md/index.html'
		);
		expect(relativeFiles).toContain('docs/reference/public-api.md/index.html');

		const home = await readFile(join(dist, 'index.html'), 'utf8');
		expect(home).toContain('property="og:image"');
		expect(home).toContain(
			'https://sebastianwessel.github.io/isostate/og/index.png'
		);
		expect(home).toContain('name="twitter:card" content="summary_large_image"');
	}, websiteBuildTimeoutMs);
});
