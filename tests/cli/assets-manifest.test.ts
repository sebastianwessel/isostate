import { afterEach, describe, expect, test } from 'bun:test';
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const cli = [process.execPath, 'packages/cli/src/bin.ts'];
const tempDirs: string[] = [];
const fixtureDir = resolve('tests/fixtures/assets-manifest');

describe('isostate assets manifest', () => {
	afterEach(async () => {
		await Promise.all(
			tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
		);
	});

	test('happy path with nested groups and ungrouped assets', async () => {
		const out = join(await makeTempDir(), 'manifest.json');
		const result = await runCli([
			'assets',
			'manifest',
			fixtureDir,
			'--out',
			out,
			'--asset-base-url',
			'./assets'
		]);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain(`WROTE ${out}`);

		const manifest = JSON.parse(await readFile(out, 'utf8'));
		expect(manifest.format).toBe('isostate.asset-manifest');
		expect(manifest.version).toBe(1);
		expect(manifest.assetBaseUrl).toBe('./assets');
		expect(manifest.assets).toHaveLength(3);
		expect(manifest.generatedAt).toBeDefined();

		expect(manifest.assets[0].group).toBe('network');
		expect(manifest.assets[0].name).toBe('load-balancer');
		expect(manifest.assets[0].id).toBe('network-load-balancer');
		expect(manifest.assets[0].path).toBe('network/load-balancer.svg');
		expect(manifest.assets[0].digest).toMatch(/^sha256:[a-f0-9]{64}$/);

		expect(manifest.assets[1].group).toBe('servers');
		expect(manifest.assets[1].name).toBe('api');
		expect(manifest.assets[1].id).toBe('servers-api');
		expect(manifest.assets[1].path).toBe('servers/api.svg');
		expect(manifest.assets[1].label).toBe('API Server');
		expect(manifest.assets[1].anchor).toEqual([0.5, 0.92]);
		expect(manifest.assets[1].tags).toEqual(['server', 'backend']);

		expect(manifest.assets[2].group).toBe('ungrouped');
		expect(manifest.assets[2].name).toBe('database');
		expect(manifest.assets[2].id).toBe('database');
		expect(manifest.assets[2].path).toBe('database.svg');
	});

	test('metadata reading from .isostate-assets.yaml', async () => {
		const out = join(await makeTempDir(), 'manifest.json');
		const result = await runCli([
			'assets',
			'manifest',
			fixtureDir,
			'--out',
			out
		]);

		expect(result.exitCode).toBe(0);
		const manifest = JSON.parse(await readFile(out, 'utf8'));
		const api = manifest.assets.find((a: { id: string }) => a.id === 'servers-api');
		expect(api).toBeDefined();
		expect(api.label).toBe('API Server');
		expect(api.anchor).toEqual([0.5, 0.92]);
		expect(api.tags).toEqual(['server', 'backend']);
	});

	test('digest computation', async () => {
		const out = join(await makeTempDir(), 'manifest.json');
		await runCli(['assets', 'manifest', fixtureDir, '--out', out]);
		const manifest = JSON.parse(await readFile(out, 'utf8'));
		for (const asset of manifest.assets) {
			expect(asset.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
		}
	});

	test('sorting by group then name then path', async () => {
		const out = join(await makeTempDir(), 'manifest.json');
		await runCli(['assets', 'manifest', fixtureDir, '--out', out]);
		const manifest = JSON.parse(await readFile(out, 'utf8'));
		const groups = manifest.assets.map((a: { group: string }) => a.group);
		expect(groups).toEqual(['network', 'servers', 'ungrouped']);
	});

	test('rejects duplicate ids', async () => {
		const dir = await makeTempDir();
		await mkdir(join(dir, 'foo'), { recursive: true });
		await writeFile(join(dir, 'foo-bar.svg'), '<svg/>', 'utf8');
		await writeFile(join(dir, 'foo', 'bar.svg'), '<svg/>', 'utf8');

		const result = await runCli([
			'assets',
			'manifest',
			dir,
			'--out',
			join(dir, 'out.json')
		]);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ASSET_MANIFEST_ID_COLLISION');
		expect(await fileExists(join(dir, 'out.json'))).toBe(false);
	});

	test('rejects reserved ids', async () => {
		const dir = await makeTempDir();
		await writeFile(join(dir, 'text.svg'), '<svg/>', 'utf8');
		const result = await runCli([
			'assets',
			'manifest',
			dir,
			'--out',
			join(dir, 'out.json')
		]);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ASSET_MANIFEST_RESERVED_ID');
	});

	test('skips hidden files and dot-directories', async () => {
		const dir = await makeTempDir();
		await mkdir(join(dir, '.hidden'), { recursive: true });
		await writeFile(join(dir, 'visible.svg'), '<svg/>', 'utf8');
		await writeFile(join(dir, '.hidden', 'secret.svg'), '<svg/>', 'utf8');
		await writeFile(join(dir, '.hidden.svg'), '<svg/>', 'utf8');

		const out = join(dir, 'out.json');
		const result = await runCli(['assets', 'manifest', dir, '--out', out]);
		expect(result.exitCode).toBe(0);
		const manifest = JSON.parse(await readFile(out, 'utf8'));
		expect(manifest.assets).toHaveLength(1);
		expect(manifest.assets[0].id).toBe('visible');
	});

	test('skips symlinks', async () => {
		const dir = await makeTempDir();
		await writeFile(join(dir, 'real.svg'), '<svg/>', 'utf8');
		await symlink(join(dir, 'real.svg'), join(dir, 'link.svg'));

		const out = join(dir, 'out.json');
		const result = await runCli(['assets', 'manifest', dir, '--out', out]);
		expect(result.exitCode).toBe(0);
		const manifest = JSON.parse(await readFile(out, 'utf8'));
		expect(manifest.assets).toHaveLength(1);
		expect(manifest.assets[0].id).toBe('real');
	});

	test('rejects unsafe svg with script tag', async () => {
		const dir = await makeTempDir();
		await writeFile(
			join(dir, 'bad.svg'),
			'<svg><script>alert(1)</script></svg>',
			'utf8'
		);
		const result = await runCli([
			'assets',
			'manifest',
			dir,
			'--out',
			join(dir, 'out.json')
		]);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ASSET_MANIFEST_UNSAFE_SVG');
	});

	test('rejects unsafe svg with event handlers', async () => {
		const dir = await makeTempDir();
		await writeFile(
			join(dir, 'bad.svg'),
			'<svg onclick="alert(1)"></svg>',
			'utf8'
		);
		const result = await runCli([
			'assets',
			'manifest',
			dir,
			'--out',
			join(dir, 'out.json')
		]);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ASSET_MANIFEST_UNSAFE_SVG');
	});

	test('rejects external references', async () => {
		const dir = await makeTempDir();
		await writeFile(
			join(dir, 'bad.svg'),
			'<svg><use href="other.svg#icon"/></svg>',
			'utf8'
		);
		const result = await runCli([
			'assets',
			'manifest',
			dir,
			'--out',
			join(dir, 'out.json')
		]);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ASSET_MANIFEST_EXTERNAL_REFERENCE');
	});

	test('rejects oversized files', async () => {
		const dir = await makeTempDir();
		const bigContent = ' '.repeat(512 * 1024 + 1);
		await writeFile(join(dir, 'big.svg'), `<svg>${bigContent}</svg>`, 'utf8');
		const result = await runCli([
			'assets',
			'manifest',
			dir,
			'--out',
			join(dir, 'out.json')
		]);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ASSET_MANIFEST_OVERSIZED');
	});

	test('rejects case-only path collisions', async () => {
		const dir = await makeTempDir();
		await writeFile(join(dir, 'API.svg'), '<svg/>', 'utf8');
		try {
			await writeFile(join(dir, 'api.svg'), '<svg/>', 'utf8');
		} catch {
			// Ignore - case-insensitive filesystems may not allow both files
		}
		const files = await readdir(dir);
		if (files.length < 2) {
			// Case-insensitive filesystem; collision is impossible to test here
			return;
		}
		const result = await runCli([
			'assets',
			'manifest',
			dir,
			'--out',
			join(dir, 'out.json')
		]);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ASSET_MANIFEST_PATH_COLLISION');
	});

	test('rejects invalid metadata', async () => {
		const dir = await makeTempDir();
		await writeFile(join(dir, 'asset.svg'), '<svg/>', 'utf8');
		await writeFile(
			join(dir, '.isostate-assets.yaml'),
			`assets:\n  asset.svg:\n    label: ""\n`,
			'utf8'
		);
		const result = await runCli([
			'assets',
			'manifest',
			dir,
			'--out',
			join(dir, 'out.json')
		]);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ASSET_MANIFEST_INVALID_METADATA');
	});

	test('reads metadata from --metadata path', async () => {
		const dir = await makeTempDir();
		await writeFile(join(dir, 'asset.svg'), '<svg/>', 'utf8');
		const metaPath = join(dir, 'custom-meta.yaml');
		await writeFile(
			metaPath,
			`assets:\n  asset.svg:\n    label: Custom Label\n`,
			'utf8'
		);
		const out = join(dir, 'out.json');
		const result = await runCli([
			'assets',
			'manifest',
			dir,
			'--out',
			out,
			'--metadata',
			metaPath
		]);
		expect(result.exitCode).toBe(0);
		const manifest = JSON.parse(await readFile(out, 'utf8'));
		expect(manifest.assets[0].label).toBe('Custom Label');
	});

	test('rejects unknown metadata paths as orphans', async () => {
		const dir = await makeTempDir();
		await writeFile(join(dir, 'asset.svg'), '<svg/>', 'utf8');
		await writeFile(
			join(dir, '.isostate-assets.yaml'),
			`assets:\n  missing.svg:\n    label: Missing\n`,
			'utf8'
		);
		const result = await runCli([
			'assets',
			'manifest',
			dir,
			'--out',
			join(dir, 'out.json')
		]);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ASSET_MANIFEST_METADATA_ORPHAN');
	});
});

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

async function fileExists(path: string): Promise<boolean> {
	try {
		await lstat(path);
		return true;
	} catch {
		return false;
	}
}
