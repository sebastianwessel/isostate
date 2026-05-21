import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fromJs, fromJson } from '../../packages/core/src/dsl/compiler';

const cli = [process.execPath, 'packages/cli/src/bin.ts'];
const tempDirs: string[] = [];

const validYaml = `header:
  version: "0.1"
  assetBaseUrl: ./assets
  assets:
    - id: server
  layers:
    - name: ground
    - name: structures
scenes:
  - id: initial
    elements:
      - id: server-1
        asset: server
        at: [1, 1]
        layer: structures
`;

describe('isostate compile', () => {
	afterEach(async () => {
		await Promise.all(
			tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
		);
	});

	test('writes canonical JS default export output', async () => {
		const dir = await makeTempDir();
		const input = join(dir, 'scene.isostate.yaml');
		const out = join(dir, 'public', 'scene.isostate.js');
		await writeFile(input, validYaml, 'utf8');

		const result = await runCli([
			'compile',
			input,
			'--out',
			out,
			'--format',
			'js'
		]);
		const output = await readFile(out, 'utf8');
		const bundle = fromJs(output);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain(`WROTE ${out}`);
		expect(bundle._format).toBe('isostate-runtime-bundle');
		expect(bundle.scenes).toHaveLength(1);
	});

	test('writes canonical JSON output when format is inferred from out path', async () => {
		const dir = await makeTempDir();
		const input = join(dir, 'scene.isostate.yaml');
		const out = join(dir, 'public', 'scene.isostate.json');
		await writeFile(input, validYaml, 'utf8');

		const result = await runCli(['compile', input, '--out', out]);
		const output = await readFile(out, 'utf8');
		const bundle = fromJson(output);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain(`WROTE ${out}`);
		expect(bundle.assets?.server).toEqual({ url: './assets/server.svg' });
	});

	test('fails unsupported formats without writing output', async () => {
		const dir = await makeTempDir();
		const input = join(dir, 'scene.isostate.yaml');
		const out = join(dir, 'scene.isostate.txt');
		await writeFile(input, validYaml, 'utf8');

		const result = await runCli([
			'compile',
			input,
			'--out',
			out,
			'--format',
			'txt'
		]);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ERROR UNSUPPORTED_FORMAT');
		expect(existsSync(out)).toBe(false);
	});

	test('validates before writing output', async () => {
		const dir = await makeTempDir();
		const input = join(dir, 'scene.isostate.yaml');
		const out = join(dir, 'scene.isostate.js');
		await writeFile(
			input,
			validYaml.replace('asset: server', 'asset: missing-server'),
			'utf8'
		);

		const result = await runCli(['compile', input, '--out', out]);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ERROR ASSET_NOT_DECLARED');
		expect(existsSync(out)).toBe(false);
	});

	test('exits 1 when input is missing', async () => {
		const result = await runCli(['compile']);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ERROR MISSING_INPUT');
		expect(result.stdout).toBe('');
	});

	test('rejects extra input paths', async () => {
		const dir = await makeTempDir();
		const input = join(dir, 'scene.isostate.yaml');
		const extra = join(dir, 'extra.isostate.yaml');
		const out = join(dir, 'scene.isostate.js');
		await writeFile(input, validYaml, 'utf8');
		await writeFile(extra, validYaml, 'utf8');

		const result = await runCli(['compile', input, extra, '--out', out]);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ERROR EXTRA_INPUT');
		expect(existsSync(out)).toBe(false);
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
