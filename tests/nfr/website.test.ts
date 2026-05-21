import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();

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
			encoding: 'utf8'
		});

		expect(result.stderr).not.toContain('[ERROR]');
		expect(result.status).toBe(0);
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
		expect(packageJson.scripts?.['site:build']).toBe(
			'astro build --root website'
		);
		expect(config).toContain("output: 'static'");
		expect(config).toContain("base: '/isostate'");
		expect(docs).toContain("from '../../docs/getting-started.md'");
		expect(docs).toContain("from '../../docs/guides/deploy-static-bundle.md'");
		expect(docs).toContain("from '../../docs/reference/public-api.md'");
		expect(index).toContain('Isometric visual storytelling');
		expect(index).toContain('PUBLIC_ISOSTATE_VERSION');
		expect(route).toContain('getStaticPaths');
		expect(route).toContain('<Content />');
	});

	test('built website contains home and docs pages', async () => {
		await ensureWebsiteBuilt();

		const dist = join(root, 'website/dist');
		await expect(stat(dist)).resolves.toBeDefined();

		const files = await listFiles(dist);
		const relativeFiles = files.map((file) => file.slice(dist.length + 1));

		expect(relativeFiles).toContain('index.html');
		expect(relativeFiles).toContain('docs/getting-started.md/index.html');
		expect(relativeFiles).toContain(
			'docs/guides/deploy-static-bundle.md/index.html'
		);
		expect(relativeFiles).toContain('docs/reference/public-api.md/index.html');
	});
});
