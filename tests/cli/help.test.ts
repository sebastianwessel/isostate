import { describe, expect, test } from 'bun:test';

const cli = [process.execPath, 'packages/cli/src/bin.ts'];

describe('isostate help and unknown command handling', () => {
	test('no arguments prints global usage to stdout and exits 0', async () => {
		const result = await runCli([]);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe('');
		expect(result.stdout).toContain('Usage: isostate');
		expect(result.stdout).toContain('validate');
		expect(result.stdout).toContain('compile');
		expect(result.stdout).toContain('bundle');
		expect(result.stdout).toContain('assets manifest');
		expect(result.stdout).toContain('inspect');
		expect(result.stdout).toContain('mermaid2dsl');
	});

	test('--help prints global usage to stdout and exits 0', async () => {
		const result = await runCli(['--help']);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe('');
		expect(result.stdout).toContain('Usage: isostate');
	});

	test('-h prints global usage to stdout and exits 0', async () => {
		const result = await runCli(['-h']);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe('');
		expect(result.stdout).toContain('Usage: isostate');
	});

	test('global usage lists every command once, in contract order', () => {
		return runCli([]).then((result) => {
			const order = [
				'validate',
				'compile',
				'bundle',
				'assets manifest',
				'inspect',
				'mermaid2dsl'
			];
			const indices = order.map((name) => result.stdout.indexOf(name));
			for (const index of indices) {
				expect(index).toBeGreaterThan(-1);
			}
			expect(indices).toEqual([...indices].sort((a, b) => a - b));
		});
	});

	test('validate --help prints usage and exits 0 without executing', async () => {
		const result = await runCli(['validate', '--help']);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe('');
		expect(result.stdout).toContain('Usage: isostate validate');
		expect(result.stdout).not.toContain('OK');
		expect(result.stdout).not.toContain('FAILED');
	});

	test('validate -h prints usage and exits 0 without executing, even with no input file', async () => {
		const result = await runCli(['validate', '-h']);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe('');
		expect(result.stdout).toContain('Usage: isostate validate');
	});

	test('compile --help prints usage, exit 0, without requiring --out or an input file', async () => {
		const result = await runCli(['compile', '--help']);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe('');
		expect(result.stdout).toContain('Usage: isostate compile');
		expect(result.stdout).toContain('--out');
		expect(result.stdout).toContain('--format');
	});

	test('bundle --help prints usage and exits 0 without requiring --out', async () => {
		const result = await runCli(['bundle', '--help']);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe('');
		expect(result.stdout).toContain('Usage: isostate bundle');
		expect(result.stdout).toContain('--asset-dir');
	});

	test('assets manifest --help prints usage and exits 0 without an asset directory', async () => {
		const result = await runCli(['assets', 'manifest', '--help']);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe('');
		expect(result.stdout).toContain('Usage: isostate assets manifest');
	});

	test('inspect --help prints usage and exits 0 without a bundle file', async () => {
		const result = await runCli(['inspect', '--help']);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe('');
		expect(result.stdout).toContain('Usage: isostate inspect');
	});

	test('mermaid2dsl --help prints usage and exits 0 without an input file', async () => {
		const result = await runCli(['mermaid2dsl', '--help']);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe('');
		expect(result.stdout).toContain('Usage: isostate mermaid2dsl');
	});

	test('unknown command prints ERROR CLI_UNKNOWN_COMMAND plus global usage to stderr and exits 1', async () => {
		const result = await runCli(['frobnicate']);

		expect(result.exitCode).toBe(1);
		expect(result.stdout).toBe('');
		expect(result.stderr).toContain('ERROR CLI_UNKNOWN_COMMAND frobnicate');
		expect(result.stderr).toContain('Usage: isostate');
		expect(result.stderr).toContain('validate');
	});
});

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
