import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const optInEnvPattern = /ISOSTATE_(?:BROWSER_TESTS|SIZE_TESTS|NETWORK_TESTS)=1/;

describe('NFR package scripts', () => {
	test('size and publint scripts are exposed', async () => {
		const packageJson = JSON.parse(
			await readFile(join(process.cwd(), 'package.json'), 'utf8')
		) as { scripts?: Record<string, string> };

		expect(packageJson.scripts?.size).toBe('tsx scripts/check-size.ts');
		expect(packageJson.scripts?.publint).toBe('publint run packages/core');
		expect(packageJson.scripts?.coverage).toContain('bun test --coverage');
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
