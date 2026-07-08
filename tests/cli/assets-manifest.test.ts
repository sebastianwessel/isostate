import { afterEach, describe, expect, test } from 'bun:test';
import {
	lstat,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	symlink,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
		const api = manifest.assets.find(
			(a: { id: string }) => a.id === 'servers-api'
		);
		expect(api).toBeDefined();
		expect(api.label).toBe('API Server');
		expect(api.anchor).toEqual([0.5, 0.92]);
		expect(api.tags).toEqual(['server', 'backend']);
	});

	test('generates sprite sheet manifest entries from metadata', async () => {
		const dir = await makeTempDir();
		await mkdir(join(dir, 'sprites'), { recursive: true });
		await writeFile(join(dir, 'sprites', 'app-icons.png'), fakePng(128, 64));
		await writeFile(
			join(dir, '.isostate-assets.yaml'),
			`assets:
  sprites/app-icons.png:
    type: sprite-sheet
    label: App Icons
    tileSize: [32, 32]
    anchor: [0.5, 0.9]
    sprites:
      app-home: [0, 0]
      app-alert:
        rect: [32, 0, 32, 32]
        label: Alert
        tags: [warning]
`,
			'utf8'
		);
		const out = join(dir, 'out.json');

		const result = await runCli(['assets', 'manifest', dir, '--out', out]);

		expect(result.exitCode).toBe(0);
		const manifest = JSON.parse(await readFile(out, 'utf8'));
		expect(manifest.assets).toHaveLength(1);
		expect(manifest.assets[0]).toMatchObject({
			id: 'sprites-app-icons',
			type: 'sprite-sheet',
			path: 'sprites/app-icons.png',
			group: 'sprites',
			name: 'app-icons',
			label: 'App Icons',
			sheetSize: [128, 64],
			tileSize: [32, 32],
			anchor: [0.5, 0.9]
		});
		expect(manifest.assets[0].sprites).toEqual({
			'app-home': [0, 0],
			'app-alert': {
				rect: [32, 0, 32, 32],
				label: 'Alert',
				tags: ['warning']
			}
		});
	});

	test('rejects invalid sprite manifest rectangles', async () => {
		const dir = await makeTempDir();
		await writeFile(join(dir, 'icons.png'), fakePng(64, 64));
		await writeFile(
			join(dir, '.isostate-assets.yaml'),
			`assets:
  icons.png:
    type: sprite-sheet
    tileSize: [32, 32]
    sprites:
      outside: { rect: [48, 0, 32, 32] }
`,
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

	test('rejects explicit --metadata path that does not exist', async () => {
		const dir = await makeTempDir();
		await writeFile(join(dir, 'asset.svg'), '<svg/>', 'utf8');
		const out = join(dir, 'out.json');

		const result = await runCli([
			'assets',
			'manifest',
			dir,
			'--out',
			out,
			'--metadata',
			join(dir, 'does-not-exist.yaml')
		]);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ASSET_MANIFEST_METADATA_NOT_FOUND');
		expect(await fileExists(out)).toBe(false);
	});

	test('decodes VP8L (lossless) WebP height correctly beyond 8 bits', async () => {
		const dir = await makeTempDir();
		// 300x1200: pre-fix code mis-decoded height as 240 instead of 1200.
		await writeFile(join(dir, 'sheet.webp'), fakeVp8lWebp(300, 1200));
		await writeFile(
			join(dir, '.isostate-assets.yaml'),
			`assets:
  sheet.webp:
    type: sprite-sheet
    tileSize: [300, 1200]
    sprites:
      whole: [0, 0]
`,
			'utf8'
		);
		const out = join(dir, 'out.json');

		const result = await runCli(['assets', 'manifest', dir, '--out', out]);

		expect(result.exitCode).toBe(0);
		const manifest = JSON.parse(await readFile(out, 'utf8'));
		expect(manifest.assets[0].sheetSize).toEqual([300, 1200]);
		expect(manifest.assets[0].width).toBe(300);
		expect(manifest.assets[0].height).toBe(1200);
	});

	test('reads root <svg> dimensions, not a nested child element', async () => {
		const dir = await makeTempDir();
		await writeFile(
			join(dir, 'icons.svg'),
			'<svg width="64" height="64" viewBox="0 0 64 64"><rect width="512" height="512"/></svg>',
			'utf8'
		);
		await writeFile(
			join(dir, '.isostate-assets.yaml'),
			`assets:
  icons.svg:
    type: sprite-sheet
    tileSize: [64, 64]
    sprites:
      whole: [0, 0]
`,
			'utf8'
		);
		const out = join(dir, 'out.json');

		const result = await runCli(['assets', 'manifest', dir, '--out', out]);

		expect(result.exitCode).toBe(0);
		const manifest = JSON.parse(await readFile(out, 'utf8'));
		expect(manifest.assets[0].sheetSize).toEqual([64, 64]);
	});

	test('rejects sprite sheet sheetSize metadata that mismatches actual image dimensions', async () => {
		const dir = await makeTempDir();
		await writeFile(join(dir, 'sheet.png'), fakePng(64, 64));
		await writeFile(
			join(dir, '.isostate-assets.yaml'),
			`assets:
  sheet.png:
    type: sprite-sheet
    sheetSize: [4096, 4096]
    tileSize: [512, 512]
    sprites:
      far-tile: [7, 7]
`,
			'utf8'
		);
		const out = join(dir, 'out.json');

		const result = await runCli(['assets', 'manifest', dir, '--out', out]);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ASSET_MANIFEST_INVALID_METADATA');
		expect(await fileExists(out)).toBe(false);
	});

	test('sprite sheet manifest entries include width and height fields', async () => {
		const dir = await makeTempDir();
		await writeFile(join(dir, 'sheet.png'), fakePng(128, 64));
		await writeFile(
			join(dir, '.isostate-assets.yaml'),
			`assets:
  sheet.png:
    type: sprite-sheet
    tileSize: [64, 64]
    sprites:
      left: [0, 0]
      right: [1, 0]
`,
			'utf8'
		);
		const out = join(dir, 'out.json');

		const result = await runCli(['assets', 'manifest', dir, '--out', out]);

		expect(result.exitCode).toBe(0);
		const manifest = JSON.parse(await readFile(out, 'utf8'));
		expect(manifest.assets[0].width).toBe(128);
		expect(manifest.assets[0].height).toBe(64);
		expect(manifest.assets[0].sheetSize).toEqual([128, 64]);
	});

	test('rejects derived ids that would start with a digit', async () => {
		const dir = await makeTempDir();
		await writeFile(join(dir, '2d-icon.svg'), '<svg/>', 'utf8');

		const result = await runCli([
			'assets',
			'manifest',
			dir,
			'--out',
			join(dir, 'out.json')
		]);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ASSET_MANIFEST_INVALID_FILENAME');
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

function fakePng(width: number, height: number): Buffer {
	const bytes = Buffer.alloc(24);
	bytes.set(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 0);
	bytes.writeUInt32BE(width, 16);
	bytes.writeUInt32BE(height, 20);
	return bytes;
}

/**
 * Builds a minimal valid lossless (VP8L) WebP header. The 32-bit
 * little-endian field starting at byte 21 packs 14 bits width-1, then 14
 * bits height-1, per the VP8L bitstream spec.
 */
function fakeVp8lWebp(width: number, height: number): Buffer {
	const widthMinusOne = width - 1;
	const heightMinusOne = height - 1;
	const bits = (widthMinusOne & 0x3fff) | ((heightMinusOne & 0x3fff) << 14);

	const bytes = Buffer.alloc(25);
	bytes.write('RIFF', 0, 'ascii');
	bytes.writeUInt32LE(17, 4);
	bytes.write('WEBP', 8, 'ascii');
	bytes.write('VP8L', 12, 'ascii');
	bytes.writeUInt32LE(5, 16);
	bytes[20] = 0x2f;
	bytes.writeUInt32LE(bits, 21);
	return bytes;
}
