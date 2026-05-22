import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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

describe('isostate validate', () => {
	afterEach(async () => {
		await Promise.all(
			tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
		);
	});

	test('exits 0 and prints a compact success summary for valid input', async () => {
		const dir = await makeTempDir();
		const input = join(dir, 'scene.isostate.yaml');
		await writeFile(input, validYaml, 'utf8');

		const result = await runCli(['validate', input]);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain(`OK ${input}`);
		expect(result.stderr).toBe('');
	});

	test('exits 1 and preserves validation error codes for invalid input', async () => {
		const dir = await makeTempDir();
		const input = join(dir, 'scene.isostate.yaml');
		await writeFile(
			input,
			validYaml.replace('asset: server', 'asset: missing-server'),
			'utf8'
		);

		const result = await runCli(['validate', input]);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ERROR ASSET_NOT_DECLARED');
		expect(result.stderr).not.toContain('header:');
		expect(result.stdout).toBe('');
	});

	test('prints scene object field and value context for validation findings', async () => {
		const dir = await makeTempDir();
		const input = join(dir, 'scene.isostate.yaml');
		await writeFile(
			input,
			`header:
  assets: []
  layers:
    - name: labels
scenes:
  - id: initial
    elements:
      - id: title
        asset: text
        at: [0, 0]
        layer: labels
        text:
          value: ""
          fontSize: 0
`,
			'utf8'
		);

		const result = await runCli(['validate', input]);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain(
			'WARN EMPTY_TEXT_CONTENT scene=initial element=title field=text.value value=""'
		);
		expect(result.stderr).toContain(
			'ERROR INVALID_TEXT_STYLE scene=initial element=title field=text.fontSize value=0'
		);
		expect(result.stdout).toBe('');
	});

	test('exits 1 when input is missing', async () => {
		const result = await runCli(['validate']);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ERROR MISSING_INPUT');
		expect(result.stdout).toBe('');
	});

	test('rejects unknown options and extra inputs', async () => {
		const dir = await makeTempDir();
		const input = join(dir, 'scene.isostate.yaml');
		const extra = join(dir, 'extra.isostate.yaml');
		await writeFile(input, validYaml, 'utf8');
		await writeFile(extra, validYaml, 'utf8');

		const unknown = await runCli(['validate', '--bogus', input]);
		const extraInput = await runCli(['validate', input, extra]);

		expect(unknown.exitCode).toBe(1);
		expect(unknown.stderr).toContain('ERROR UNKNOWN_OPTION');
		expect(extraInput.exitCode).toBe(1);
		expect(extraInput.stderr).toContain('ERROR EXTRA_INPUT');
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
