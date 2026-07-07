import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import {
	cp,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256Hex } from '../../packages/cli/src/runtime-digest';
import { fromJs } from '../../packages/core/src/dsl/compiler';

const cli = [process.execPath, 'packages/cli/src/bin.ts'];
const tempDirs: string[] = [];
const runtimeArtifact = 'packages/core/dist/browser/isostate.runtime.js';

const sceneYaml = `header:
  version: "0.1"
  assetBaseUrl: ./source-assets
  assets:
    - id: server
      path: server
    - id: gateway
      path: gateway.svg
  layers:
    - name: ground
    - name: structures
    - name: labels
scenes:
  - id: initial
    elements:
      - id: server-1
        asset: server
        at: [1, 1]
        layer: structures
      - id: gateway-1
        asset: gateway
        at: [2, 1]
        layer: structures
      - id: label-1
        asset: text
        at: [1, 0]
        layer: labels
        text:
          value: Server
      - id: zone
        asset: rectangle
        at: [1, 1]
        size: 2
        layer: ground
        primitive:
          rectangle:
            fill: "#ffffff"
`;

describe('isostate bundle', () => {
	beforeAll(async () => {
		if (existsSync(runtimeArtifact)) return;
		const proc = Bun.spawn([process.execPath, 'run', 'build'], {
			cwd: process.cwd(),
			stdout: 'pipe',
			stderr: 'pipe'
		});
		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited
		]);
		if (exitCode !== 0) {
			throw new Error(`Unable to build runtime artifact\n${stdout}\n${stderr}`);
		}
	});

	afterEach(async () => {
		await Promise.all(
			tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
		);
	});

	test('writes bundle files, copied assets, rewritten URLs, and manifest digests', async () => {
		const dir = await makeTempDir();
		const input = join(dir, 'scene.isostate.yaml');
		const assetDir = join(dir, 'source-assets');
		const out = join(dir, 'public', 'isostate');
		await writeSceneWithAssets(input, assetDir);

		const result = await runCli([
			'bundle',
			input,
			'--out',
			out,
			'--asset-dir',
			assetDir,
			'--public-asset-base',
			'/cdn/assets'
		]);

		const scene = fromJs(
			await readFile(join(out, 'scene.isostate.js'), 'utf8')
		);
		const manifest = JSON.parse(
			await readFile(join(out, 'manifest.json'), 'utf8')
		) as {
			format: string;
			version: string;
			runtime: { mode: string; file?: string };
			scene: { digest: string };
			assets: Array<{ id: string; file: string; url: string; digest: string }>;
		};

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain(`BUNDLED ${out}`);
		expect(existsSync(join(out, 'isostate.runtime.js'))).toBe(true);
		expect((await readdir(join(out, 'assets'))).sort()).toEqual([
			'gateway.svg',
			'server.svg'
		]);
		expect(scene.assets?.server?.url).toBe('/cdn/assets/server.svg');
		expect(scene.assets?.gateway?.url).toBe('/cdn/assets/gateway.svg');
		expect(scene.assets?.text).toBeUndefined();
		expect(scene.assets?.rectangle).toBeUndefined();
		expect(manifest.format).toBe('isostate-static-bundle');
		expect(manifest.version).toBe('0.5.0');
		expect(manifest.runtime).toEqual({
			mode: 'copy',
			file: 'isostate.runtime.js'
		});
		expect(manifest.scene.digest).toBe(scene._digest);
		expect(manifest.assets.map((asset) => asset.id)).toEqual([
			'gateway',
			'server'
		]);
		expect(manifest.assets.map((asset) => asset.file)).toEqual([
			'assets/gateway.svg',
			'assets/server.svg'
		]);
		expect(manifest.assets.find((asset) => asset.id === 'server')?.digest).toBe(
			sha256Hex(await readFile(join(assetDir, 'server.svg')))
		);
	});

	test('fails missing asset resolution without publishing partial output', async () => {
		const dir = await makeTempDir();
		const input = join(dir, 'scene.isostate.yaml');
		const assetDir = join(dir, 'source-assets');
		const out = join(dir, 'public', 'isostate');
		await writeSceneWithAssets(input, assetDir);
		await mkdir(out, { recursive: true });
		await writeFile(join(out, 'existing.txt'), 'keep me', 'utf8');
		await rm(join(assetDir, 'gateway.svg'));

		const result = await runCli([
			'bundle',
			input,
			'--out',
			out,
			'--asset-dir',
			assetDir
		]);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ERROR ASSET_RESOLUTION_FAILED');
		expect(await readFile(join(out, 'existing.txt'), 'utf8')).toBe('keep me');
	});

	test('copies sprite sheet sources once and rewrites logical sprite URLs', async () => {
		const dir = await makeTempDir();
		const input = join(dir, 'scene.isostate.yaml');
		const assetDir = join(dir, 'source-assets');
		const out = join(dir, 'public', 'isostate');
		await mkdir(assetDir, { recursive: true });
		await writeFile(
			input,
			`header:
  version: "0.1"
  assetBaseUrl: ./source-assets
  assets:
    - id: app-icons
      type: sprite-sheet
      path: app-icons.png
      sheetSize: [128, 64]
      tileSize: [32, 32]
      sprites:
        app-home: [0, 0]
        app-alert: [1, 0]
  layers:
    - name: default
scenes:
  - id: initial
    elements:
      - id: home
        asset: app-home
        at: [0, 0]
      - id: alert
        asset: app-alert
        at: [1, 0]
`,
			'utf8'
		);
		await writeFile(join(assetDir, 'app-icons.png'), fakePng(128, 64));

		const result = await runCli([
			'bundle',
			input,
			'--out',
			out,
			'--asset-dir',
			assetDir,
			'--public-asset-base',
			'/cdn/assets'
		]);

		expect(result.exitCode).toBe(0);
		expect((await readdir(join(out, 'assets'))).sort()).toEqual([
			'app-icons.png'
		]);
		const scene = fromJs(
			await readFile(join(out, 'scene.isostate.js'), 'utf8')
		);
		expect(scene.assets?.['app-home']?.url).toBe('/cdn/assets/app-icons.png');
		expect(scene.assets?.['app-alert']?.url).toBe('/cdn/assets/app-icons.png');
		expect(scene.assets?.['app-home']?.sprite?.rect).toEqual([0, 0, 32, 32]);
		expect(scene.assets?.['app-alert']?.sprite?.rect).toEqual([32, 0, 32, 32]);
		const manifest = JSON.parse(
			await readFile(join(out, 'manifest.json'), 'utf8')
		);
		expect(manifest.assets.map((asset: { id: string }) => asset.id)).toEqual([
			'app-alert',
			'app-home'
		]);
		expect(
			new Set(manifest.assets.map((asset: { file: string }) => asset.file))
		).toEqual(new Set(['assets/app-icons.png']));
	});

	test('resolves second-order filename collisions to distinct files with correct content', async () => {
		// Regression test: uniqueAssetFile() used to compute `${id}-${basename}`
		// once and add it to usedFiles without checking whether that prefixed
		// name was already claimed by another asset. Here, asset "server"'s
		// prefixed candidate "server-icon.svg" collides with an asset that
		// already claimed that exact filename plainly, which previously caused
		// copyAssets() to silently skip copying "server"'s real source file and
		// serve "aab-server-icon"'s bytes under both ids' URLs.
		const dir = await makeTempDir();
		const input = join(dir, 'scene.isostate.yaml');
		const assetDir = join(dir, 'source-assets');
		const out = join(dir, 'public', 'isostate');
		await mkdir(join(assetDir, 'dir-x'), { recursive: true });
		await mkdir(join(assetDir, 'dir-y'), { recursive: true });
		await writeFile(
			input,
			`header:
  version: "0.1"
  assetBaseUrl: ./source-assets
  assets:
    - id: aab-server-icon
      path: dir-y/server-icon.svg
    - id: server
      path: dir-x/icon.svg
    - id: icon
      path: dir-y/icon.svg
  layers:
    - name: default
scenes:
  - id: initial
    elements:
      - id: a
        asset: aab-server-icon
        at: [0, 0]
      - id: b
        asset: server
        at: [1, 0]
      - id: c
        asset: icon
        at: [2, 0]
`,
			'utf8'
		);
		await writeFile(
			join(assetDir, 'dir-y', 'server-icon.svg'),
			'<svg id="aab-server-icon-source"></svg>',
			'utf8'
		);
		await writeFile(
			join(assetDir, 'dir-x', 'icon.svg'),
			'<svg id="server-source"></svg>',
			'utf8'
		);
		await writeFile(
			join(assetDir, 'dir-y', 'icon.svg'),
			'<svg id="icon-source"></svg>',
			'utf8'
		);

		const result = await runCli([
			'bundle',
			input,
			'--out',
			out,
			'--asset-dir',
			assetDir
		]);

		expect(result.exitCode).toBe(0);

		const outputFiles = await readdir(join(out, 'assets'));
		expect(new Set(outputFiles).size).toBe(outputFiles.length);
		expect(outputFiles.length).toBe(3);

		const manifest = JSON.parse(
			await readFile(join(out, 'manifest.json'), 'utf8')
		) as {
			assets: Array<{ id: string; file: string; digest: string }>;
		};
		const byId = new Map(manifest.assets.map((asset) => [asset.id, asset]));
		const files = manifest.assets.map((asset) => asset.file);
		expect(new Set(files).size).toBe(files.length);

		// Every asset must be served from a file containing its own source
		// bytes, not another asset's.
		for (const [id, sourceMarker] of [
			['aab-server-icon', 'aab-server-icon-source'],
			['server', 'server-source'],
			['icon', 'icon-source']
		] as const) {
			const entry = byId.get(id);
			expect(entry).toBeDefined();
			const contents = await readFile(join(out, entry?.file ?? ''), 'utf8');
			expect(contents).toContain(sourceMarker);
		}
	});

	test('rejects extra input paths', async () => {
		const dir = await makeTempDir();
		const input = join(dir, 'scene.isostate.yaml');
		const extra = join(dir, 'extra.isostate.yaml');
		const assetDir = join(dir, 'source-assets');
		const out = join(dir, 'public', 'isostate');
		await writeSceneWithAssets(input, assetDir);
		await writeFile(extra, sceneYaml, 'utf8');

		const result = await runCli([
			'bundle',
			input,
			extra,
			'--out',
			out,
			'--asset-dir',
			assetDir
		]);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ERROR EXTRA_INPUT');
		expect(existsSync(out)).toBe(false);
	});

	test('resolves default --runtime copy from an installed (non-monorepo) package layout', async () => {
		// Regression test for the hardcoded monorepo-relative RUNTIME_SOURCE path:
		// simulates a real `npm install` layout where the CLI's compiled dist/bin.js
		// resolves `@sebastianwessel/isostate` from its own node_modules, entirely
		// outside this repository's packages/core <-> packages/cli sibling layout.
		const dir = await makeTempDir();
		const installRoot = join(dir, 'install');
		await installIsolatedPackages(installRoot);

		const input = join(installRoot, 'scene.isostate.yaml');
		const assetDir = join(installRoot, 'source-assets');
		const out = join(installRoot, 'public', 'isostate');
		await writeSceneWithAssets(input, assetDir);

		const proc = Bun.spawn(
			[
				process.execPath,
				join(
					installRoot,
					'node_modules',
					'@sebastianwessel',
					'isostate-cli',
					'dist',
					'bin.js'
				),
				'bundle',
				input,
				'--out',
				out,
				'--asset-dir',
				assetDir
			],
			{ cwd: installRoot, stdout: 'pipe', stderr: 'pipe' }
		);
		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited
		]);

		expect({ exitCode, stdout, stderr }).toMatchObject({
			exitCode: 0,
			stdout: `BUNDLED ${out}\n`
		});
		expect(existsSync(join(out, 'isostate.runtime.js'))).toBe(true);
		const runtimeContents = await readFile(
			join(out, 'isostate.runtime.js'),
			'utf8'
		);
		expect(runtimeContents.length).toBeGreaterThan(0);
		expect(runtimeContents).not.toContain('node:fs');
	});
});

async function writeSceneWithAssets(input: string, assetDir: string) {
	await mkdir(assetDir, { recursive: true });
	await writeFile(input, sceneYaml, 'utf8');
	await writeFile(
		join(assetDir, 'server.svg'),
		'<svg id="server"></svg>',
		'utf8'
	);
	await writeFile(
		join(assetDir, 'gateway.svg'),
		'<svg id="gateway"></svg>',
		'utf8'
	);
}

async function makeTempDir(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), 'isostate-cli-'));
	tempDirs.push(dir);
	return dir;
}

/**
 * Builds an isolated `node_modules` layout (real file copies, not monorepo
 * symlinks) that mirrors what `npm install @sebastianwessel/isostate-cli
 * @sebastianwessel/isostate` produces, so bundle tests can exercise runtime
 * artifact resolution the way a real end user would encounter it.
 */
async function installIsolatedPackages(installRoot: string): Promise<void> {
	const scopeDir = join(installRoot, 'node_modules', '@sebastianwessel');
	await mkdir(scopeDir, { recursive: true });

	await cp(
		'packages/core/package.json',
		join(scopeDir, 'isostate', 'package.json')
	);
	await cp('packages/core/dist', join(scopeDir, 'isostate', 'dist'), {
		recursive: true
	});
	await cp(
		'packages/cli/package.json',
		join(scopeDir, 'isostate-cli', 'package.json')
	);
	await cp('packages/cli/dist', join(scopeDir, 'isostate-cli', 'dist'), {
		recursive: true
	});

	// `yaml` is a peer dependency of both packages and must be resolvable from
	// the isolated node_modules root for the DSL parser to load.
	await cp('node_modules/yaml', join(installRoot, 'node_modules', 'yaml'), {
		recursive: true,
		dereference: true
	});
}

async function runCli(args: string[]) {
	const proc = Bun.spawn([...cli, ...args], {
		cwd: process.cwd(),
		stdout: 'pipe',
		stderr: 'pipe'
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited
	]);

	return { stdout, stderr, exitCode };
}

function fakePng(width: number, height: number): Buffer {
	const bytes = Buffer.alloc(24);
	bytes.set(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 0);
	bytes.writeUInt32BE(width, 16);
	bytes.writeUInt32BE(height, 20);
	return bytes;
}
