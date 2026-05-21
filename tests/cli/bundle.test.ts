import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import {
	mkdir,
	mkdtemp,
	readFile,
	readdir,
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
		expect(manifest.version).toBe('0.1.1');
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
