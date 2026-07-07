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
	const requiredOutputs = [
		join(root, 'website/dist/index.html'),
		join(root, 'website/dist/apple-touch-icon.png'),
		join(root, 'website/dist/icon-192.png'),
		join(root, 'website/dist/icon-512.png'),
		join(root, 'website/dist/site.webmanifest'),
		join(root, 'website/dist/docs/concepts/how-isostate-works.md/index.html'),
		join(root, 'website/dist/docs/guides/plan-a-scene.md/index.html')
	];
	try {
		await Promise.all(requiredOutputs.map((path) => stat(path)));
		return;
	} catch {
		const result = spawnSync(process.execPath, ['run', 'site:build'], {
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
		) as {
			devDependencies?: Record<string, string>;
			scripts?: Record<string, string>;
		};
		const config = await readFile(
			join(root, 'website/astro.config.mjs'),
			'utf8'
		);
		const docs = await readFile(join(root, 'website/src/docs.ts'), 'utf8');
		const index = await readFile(
			join(root, 'website/src/pages/index.astro'),
			'utf8'
		);
		const layout = await readFile(
			join(root, 'website/src/layouts/SiteLayout.astro'),
			'utf8'
		);
		const mermaidPage = await readFile(
			join(root, 'website/src/pages/mermaid.astro'),
			'utf8'
		);
		const editorPage = await readFile(
			join(root, 'website/src/pages/editor.astro'),
			'utf8'
		);
		const ogRoute = await readFile(
			join(root, 'website/src/pages/og/[...route].ts'),
			'utf8'
		);
		const webManifest = JSON.parse(
			await readFile(join(root, 'website/public/site.webmanifest'), 'utf8')
		) as {
			name?: string;
			start_url?: string;
			icons?: Array<{ src: string; sizes: string; type: string }>;
		};
		const route = await readFile(
			join(root, 'website/src/pages/docs/[...slug].astro'),
			'utf8'
		);

		expect(packageJson.devDependencies?.astro).toMatch(/^7\.\d+\.\d+$/);
		expect(packageJson.devDependencies?.['@astrojs/sitemap']).toBe('^3.7.3');
		expect(packageJson.devDependencies?.['astro-og-canvas']).toBe('^0.13.0');
		expect(packageJson.devDependencies?.['beautiful-mermaid']).toBe('1.1.3');
		expect(packageJson.scripts?.['site:build']).toBe(
			'bun --bun node_modules/.bin/astro build --root website'
		);
		expect(config).toContain("output: 'static'");
		expect(config).toContain("base: '/isostate'");
		expect(config).toContain("import sitemap from '@astrojs/sitemap'");
		expect(config).toContain('integrations: [sitemap()]');
		expect(docs).toContain("from '../../docs/concepts/how-isostate-works.md'");
		expect(docs).toContain("from '../../docs/getting-started.md'");
		expect(docs).toContain("from '../../docs/guides/plan-a-scene.md'");
		expect(docs).toContain(
			"from '../../docs/guides/install-authoring-skill.md'"
		);
		expect(docs).toContain("from '../../docs/guides/use-the-cli.md'");
		expect(docs).toContain("from '../../docs/guides/deploy-static-bundle.md'");
		expect(docs).toContain("from '../../docs/reference/public-api.md'");
		expect(docs).toContain('docNav');
		expect(docs).toContain("title: 'Visual Language'");
		expect(docs).toContain("title: 'Ship'");
		expect(index).toContain('Isometric scenes from YAML');
		expect(index).toContain('id="isostate-demo"');
		expect(index).toContain('mountScene');
		expect(index).toContain("import { Code } from 'astro:components'");
		expect(index).toContain('sceneSnippets');
		expect(index).toContain('route-car');
		expect(index).toContain('Scroll to watch a route come to life');
		expect(index).not.toContain('PUBLIC_ISOSTATE_VERSION');
		expect(layout).toContain(
			"import { renderMermaidSVGAsync } from 'beautiful-mermaid'"
		);
		expect(layout).not.toContain('Rendered with');
		expect(layout).not.toContain('Beautiful Mermaid by Craft');
		expect(layout).toContain('requestFullscreen');
		expect(layout).toContain('Copy Mermaid source');
		expect(layout).toContain('pre[data-language="mermaid"] code');
		expect(layout).toContain('rel="apple-touch-icon"');
		expect(layout).toContain('rel="manifest"');
		expect(layout).toContain('class="topbar-project"');
		expect(layout).toContain(
			'class="topbar-project" href="https://sebastianwessel.de/projects/" target="_blank" rel="noopener noreferrer"'
		);
		expect(layout).toContain("href={href('/mermaid')}");
		expect(layout).not.toContain("href={href('/city-growth')}");
		expect(layout).not.toContain('City Scene');
		expect(mermaidPage).toContain('mermaid-workflow.isostate.js');
		expect(mermaidPage).toContain('mountScene');
		expect(mermaidPage).not.toContain('pre data-language="mermaid"');
		expect(mermaidPage).toContain('converting-mermaid-to-isostate-stories');
		expect(mermaidPage).toContain('npm install @sebastianwessel/isostate');
		expect(mermaidPage).toContain(
			'npm install --save-dev @sebastianwessel/isostate-cli yaml'
		);
		expect(mermaidPage).toContain(
			'design a small enterprise-grade 3D isometric SVG asset set'
		);
		expect(mermaidPage).toContain(
			'use camera focus for each story beat so the active region fills the preview'
		);
		expect(mermaidPage).toContain('keep canvas labels short');
		expect(mermaidPage).toContain('Open the editor');
		expect(editorPage).toContain('hideFooter');
		expect(editorPage).not.toContain('Text labels:');
		expect(editorPage).not.toContain('Use <code>cell</code> placement');
		expect(ogRoute).toContain('./assets/isostate-story/editor-overview.png');
		expect(ogRoute).toContain(
			'./assets/isostate-story/hero-tilt-shift-city.png'
		);
		expect(webManifest.name).toBe('isostate');
		expect(webManifest.start_url).toBe('/isostate/');
		expect(webManifest.icons).toContainEqual({
			src: '/isostate/icon-192.png',
			sizes: '192x192',
			type: 'image/png'
		});
		expect(webManifest.icons).toContainEqual({
			src: '/isostate/icon-512.png',
			sizes: '512x512',
			type: 'image/png'
		});
		expect(route).toContain('getStaticPaths');
		expect(route).toContain('ogImage');
		expect(route).toContain('<Content />');
	});

	test(
		'built website contains home and docs pages',
		async () => {
			await ensureWebsiteBuilt();

			const dist = join(root, 'website/dist');
			await expect(stat(dist)).resolves.toBeDefined();

			const files = await listFiles(dist);
			const relativeFiles = files.map((file) => file.slice(dist.length + 1));

			expect(relativeFiles).toContain('index.html');
			expect(relativeFiles).toContain('sitemap-index.xml');
			expect(relativeFiles).toContain('sitemap-0.xml');
			expect(relativeFiles).toContain('apple-touch-icon.png');
			expect(relativeFiles).toContain('icon-192.png');
			expect(relativeFiles).toContain('icon-512.png');
			expect(relativeFiles).toContain('site.webmanifest');
			expect(relativeFiles).toContain('og/index.png');
			expect(relativeFiles).toContain('mermaid/index.html');
			expect(relativeFiles).not.toContain('city-growth/index.html');
			expect(relativeFiles).toContain('docs/README.md/index.html');
			expect(relativeFiles).toContain(
				'docs/concepts/how-isostate-works.md/index.html'
			);
			expect(relativeFiles).toContain('og/docs/getting-started.png');
			expect(relativeFiles).toContain('docs/getting-started.md/index.html');
			expect(relativeFiles).toContain('docs/guides/plan-a-scene.md/index.html');
			expect(relativeFiles).toContain(
				'docs/guides/install-authoring-skill.md/index.html'
			);
			expect(relativeFiles).toContain('docs/guides/use-the-cli.md/index.html');
			expect(relativeFiles).toContain('og/docs/guides/use-the-cli.png');
			expect(relativeFiles).toContain(
				'docs/guides/deploy-static-bundle.md/index.html'
			);
			expect(relativeFiles).toContain(
				'docs/reference/public-api.md/index.html'
			);

			const home = await readFile(join(dist, 'index.html'), 'utf8');
			expect(home).toContain('property="og:image"');
			expect(home).toContain(
				'https://sebastianwessel.github.io/isostate/og/index.png'
			);
			expect(home).toContain(
				'name="twitter:card" content="summary_large_image"'
			);
			expect(home).toContain('rel="manifest"');
			expect(home).toContain('class="topbar-project"');
			expect(home).toContain('Project page');
			expect(home).toContain('More projects');
			expect(home).toContain('sebastianwessel.de/projects/');
			expect(home).not.toContain('City Scene');
			expect(home).not.toContain('View city scene');
			const mermaid = await readFile(join(dist, 'mermaid/index.html'), 'utf8');
			expect(mermaid).toContain('Turn existing Mermaid diagrams');
			expect(mermaid).toContain('mermaid-workflow-scene');
			expect(mermaid).not.toContain('data-language="mermaid"');
			expect(mermaid).not.toContain('data-language=mermaid');
			expect(mermaid).toContain('converting-mermaid-to-isostate-stories');
			expect(mermaid).toContain('@sebastianwessel/isostate');
			expect(mermaid).toContain('@sebastianwessel/isostate-cli');
			expect(mermaid).toContain('yaml');
			expect(mermaid).toContain('enterprise-grade 3D isometric SVG asset set');
			const editor = await readFile(join(dist, 'editor/index.html'), 'utf8');
			expect(editor).not.toContain('Text labels:');
			expect(editor).not.toContain('Use cell placement');
			expect(editor).not.toContain('site-footer');
			const docsIndex = await readFile(
				join(dist, 'docs/README.md/index.html'),
				'utf8'
			);
			expect(docsIndex).toContain('Plan A Scene');
			expect(docsIndex).toContain('understand the boundary');
			expect(docsIndex).toContain('data-language="mermaid"');
		},
		websiteBuildTimeoutMs
	);
});
