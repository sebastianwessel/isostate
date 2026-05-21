import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	compileScene,
	parseScene,
	toJs,
	toJson
} from '../../packages/core/src/dsl/index';

const cli = [process.execPath, 'packages/cli/src/bin.ts'];
const tempDirs: string[] = [];

const validYaml = `header:
  version: "0.1"
  assetBaseUrl: ./assets
  assets:
    - id: server
  floor:
    size: [4, 3]
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

describe('isostate inspect', () => {
	afterEach(async () => {
		await Promise.all(
			tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
		);
	});

	test('reports canonical JS runtime bundle details', async () => {
		const dir = await makeTempDir();
		const out = join(dir, 'scene.isostate.js');
		const bundle = compileScene(parseScene(validYaml));
		await writeFile(out, toJs(bundle), 'utf8');

		const result = await runCli(['inspect', out]);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('scenes: 1');
		expect(result.stdout).toContain('assets: 1');
		expect(result.stdout).toContain('layers: 2');
		expect(result.stdout).toContain('floor: 4x3');
		expect(result.stdout).toContain(`digest: ${bundle._digest}`);
		expect(result.stderr).toBe('');
	});

	test('reports canonical JSON runtime bundle details', async () => {
		const dir = await makeTempDir();
		const out = join(dir, 'scene.isostate.json');
		const bundle = compileScene(parseScene(validYaml));
		await writeFile(out, toJson(bundle), 'utf8');

		const result = await runCli(['inspect', out]);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('format: isostate-runtime-bundle');
		expect(result.stdout).toContain(`version: ${bundle._version}`);
	});

	test('fails malformed or non-canonical bundles', async () => {
		const dir = await makeTempDir();
		const out = join(dir, 'scene.isostate.json');
		const bundle = compileScene(parseScene(validYaml));
		await writeFile(
			out,
			toJson({ ...bundle, _digest: '0'.repeat(64) }),
			'utf8'
		);

		const result = await runCli(['inspect', out]);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ERROR INVALID_RUNTIME_BUNDLE_DIGEST');
		expect(result.stdout).toBe('');
	});

	test('rejects extra input paths', async () => {
		const dir = await makeTempDir();
		const first = join(dir, 'first.isostate.js');
		const second = join(dir, 'second.isostate.js');
		const bundle = compileScene(parseScene(validYaml));
		await writeFile(first, toJs(bundle), 'utf8');
		await writeFile(second, toJs(bundle), 'utf8');

		const result = await runCli(['inspect', first, second]);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ERROR EXTRA_INPUT');
		expect(result.stdout).toBe('');
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
