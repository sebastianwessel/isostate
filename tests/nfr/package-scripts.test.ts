import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const optInEnvPattern = /ISOSTATE_(?:BROWSER_TESTS|SIZE_TESTS|NETWORK_TESTS)=1/;

describe('NFR package scripts', () => {
	test('size and publint scripts are exposed', async () => {
		const packageJson = JSON.parse(
			await readFile(join(process.cwd(), 'package.json'), 'utf8')
		) as {
			devDependencies?: Record<string, string>;
			scripts?: Record<string, string>;
		};

		expect(packageJson.scripts?.size).toBe('tsx scripts/check-size.ts');
		expect(packageJson.scripts?.publint).toBe(
			'publint run packages/core && publint run packages/cli && publint run packages/editor'
		);
		expect(packageJson.scripts?.['site:build']).toBe(
			'bun --bun node_modules/.bin/astro build --root website'
		);
		expect(packageJson.scripts?.coverage).toContain('bun test --coverage');
		expect(packageJson.devDependencies?.['@astrojs/sitemap']).toBe('^3.7.2');
		expect(packageJson.devDependencies?.['astro-og-canvas']).toBe('^0.11.1');
		expect(packageJson.devDependencies?.['canvaskit-wasm']).toBe('^0.41.1');
	});

	test('publishable packages declare dist-only artifacts', async () => {
		const rootPackage = JSON.parse(
			await readFile(join(process.cwd(), 'package.json'), 'utf8')
		) as {
			author?: string;
			license?: string;
			homepage?: string;
			bugs?: { url?: string };
			name?: string;
			private?: boolean;
			repository?: { type?: string; url?: string };
		};
		const corePackage = JSON.parse(
			await readFile(join(process.cwd(), 'packages/core/package.json'), 'utf8')
		) as {
			author?: string;
			files?: string[];
			homepage?: string;
			bugs?: { url?: string };
			keywords?: string[];
			license?: string;
			name?: string;
			publishConfig?: { access?: string; registry?: string };
			repository?: { directory?: string; type?: string; url?: string };
			scripts?: Record<string, string>;
			version?: string;
		};
		const cliPackage = JSON.parse(
			await readFile(join(process.cwd(), 'packages/cli/package.json'), 'utf8')
		) as {
			author?: string;
			bin?: Record<string, string>;
			dependencies?: Record<string, string>;
			exports?: { '.'?: { import?: string; types?: string } };
			files?: string[];
			homepage?: string;
			bugs?: { url?: string };
			keywords?: string[];
			license?: string;
			version?: string;
			name?: string;
			publishConfig?: { access?: string; registry?: string };
			repository?: { directory?: string; type?: string; url?: string };
			scripts?: Record<string, string>;
			types?: string;
		};
		const editorPackage = JSON.parse(
			await readFile(join(process.cwd(), 'packages/editor/package.json'), 'utf8')
		) as {
			author?: string;
			exports?: Record<string, { import?: string; types?: string } | string>;
			files?: string[];
			homepage?: string;
			bugs?: { url?: string };
			keywords?: string[];
			license?: string;
			version?: string;
			name?: string;
			publishConfig?: { access?: string; registry?: string };
			repository?: { directory?: string; type?: string; url?: string };
			scripts?: Record<string, string>;
			types?: string;
			sideEffects?: string[];
		};

		expect(rootPackage.name).toBe('@sebastianwessel/isostate-workspace');
		expect(rootPackage.private).toBe(true);
		expect(rootPackage.author).toBe('Sebastian Wessel');
		expect(rootPackage.license).toBe('MIT');
		expect(rootPackage.homepage).toBe(
			'https://sebastianwessel.github.io/isostate'
		);
		expect(rootPackage.bugs?.url).toBe(
			'https://github.com/sebastianwessel/isostate/issues'
		);
		expect(rootPackage.repository).toEqual({
			type: 'git',
			url: 'git+ssh://git@github.com/sebastianwessel/isostate.git'
		});
		expect(corePackage.name).toBe('@sebastianwessel/isostate');
		expect(cliPackage.name).toBe('@sebastianwessel/isostate-cli');
		expect(editorPackage.name).toBe('@sebastianwessel/isostate-editor');
		expect(corePackage.version).toBe(cliPackage.version);
		expect(editorPackage.version).toBe(corePackage.version);
		expect(cliPackage.dependencies?.['@sebastianwessel/isostate']).toBe(
			corePackage.version
		);
		expect(editorPackage.dependencies?.['@sebastianwessel/isostate']).toBe(
			corePackage.version
		);
		expect(cliPackage.version).toBeDefined();
		expect(corePackage.files).toEqual(['dist']);
		expect(cliPackage.files).toEqual(['dist']);
		expect(editorPackage.files).toEqual(['dist']);
		for (const pkg of [corePackage, cliPackage, editorPackage]) {
			expect(pkg.author).toBe('Sebastian Wessel');
			expect(pkg.license).toBe('MIT');
			expect(pkg.homepage).toBe(
				'https://sebastianwessel.github.io/isostate'
			);
			expect(pkg.bugs?.url).toBe(
				'https://github.com/sebastianwessel/isostate/issues'
			);
			expect(pkg.keywords).toContain('isostate');
			expect(pkg.publishConfig).toEqual({
				access: 'public',
				registry: 'https://registry.npmjs.org/'
			});
			expect(pkg.repository?.type).toBe('git');
			expect(pkg.repository?.url).toBe(
				'git+ssh://git@github.com/sebastianwessel/isostate.git'
			);
		}
		expect(corePackage.repository?.directory).toBe('packages/core');
		expect(cliPackage.repository?.directory).toBe('packages/cli');
		expect(editorPackage.repository?.directory).toBe('packages/editor');
		expect(corePackage.scripts?.build).toBe('cd ../.. && bun run build');
		expect(corePackage.scripts?.prepublishOnly).toBe(
			'cd ../.. && bun run build && bun run lint'
		);
		expect(cliPackage.scripts?.build).toBe('cd ../.. && bun run build');
		expect(cliPackage.scripts?.prepublishOnly).toBe(
			'cd ../.. && bun run build && bun run lint'
		);
		expect(editorPackage.scripts?.build).toBe('cd ../.. && bun run build');
		expect(editorPackage.scripts?.prepublishOnly).toBe(
			'cd ../.. && bun run build && bun run lint'
		);
		expect(cliPackage.bin?.isostate).toBe('./dist/bin.js');
		expect(cliPackage.exports?.['.']?.import).toBe('./dist/index.js');
		expect(cliPackage.exports?.['.']?.types).toBe('./dist/index.d.ts');
		expect(cliPackage.types).toBe('./dist/index.d.ts');
		expect(editorPackage.exports?.['.']?.import).toBe('./dist/index.js');
		expect(editorPackage.exports?.['.']?.types).toBe('./dist/index.d.ts');
		expect(editorPackage.exports?.['./react']?.import).toBe('./dist/react.js');
		expect(editorPackage.exports?.['./react']?.types).toBe('./dist/react.d.ts');
		expect(editorPackage.exports?.['./style.css']).toBe('./dist/style.css');
		expect(editorPackage.types).toBe('./dist/index.d.ts');
		expect(editorPackage.sideEffects).toContain('*.css');
	});

	test('basic static bundle generation script is exposed', async () => {
		const packageJson = JSON.parse(
			await readFile(join(process.cwd(), 'package.json'), 'utf8')
		) as { scripts?: Record<string, string> };

		expect(packageJson.scripts?.isostate).toBe('bun packages/cli/src/bin.ts');
		expect(packageJson.scripts?.['examples:basic:bundle']).toBe(
			'bun examples/basic/generate-static-bundle.ts'
		);
	});

	test('default verification scripts do not enable opt-in gates', async () => {
		const packageJson = JSON.parse(
			await readFile(join(process.cwd(), 'package.json'), 'utf8')
		) as { scripts?: Record<string, string> };

		for (const name of ['test', 'typecheck', 'lint', 'build']) {
			const command = packageJson.scripts?.[name] ?? '';
			expect(command).not.toMatch(optInEnvPattern);
		}
	});
});
