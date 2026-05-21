import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

function ensureDistBuilt(): void {
	if (
		existsSync('packages/core/dist/browser/isostate.runtime.js') &&
		existsSync('packages/cli/dist/bin.js') &&
		existsSync('packages/cli/dist/index.js')
	) {
		return;
	}

	const result = spawnSync('bun', ['run', 'build'], {
		cwd: process.cwd(),
		encoding: 'utf8'
	});

	expect(result.stderr).not.toContain('error');
	expect(result.status).toBe(0);
}

describe('built package entrypoints', () => {
	test('runtime and DSL dist entrypoints import cleanly', () => {
		ensureDistBuilt();

		const script = `
			const runtime = await import('./packages/core/dist/runtime/index.js');
			const standalone = await import('./packages/core/dist/browser/isostate.runtime.js');
			const root = await import('./packages/core/dist/index.js');
			const dsl = await import('./packages/core/dist/dsl/index.js');
			if (typeof runtime.mountScene !== 'function') throw new Error('runtime mountScene missing');
			if ('parseScene' in runtime) throw new Error('runtime exposes parseScene');
			if (typeof standalone.mountScene !== 'function') throw new Error('standalone mountScene missing');
			if (typeof standalone.projectToScreen !== 'function') throw new Error('standalone helper missing');
			if ('parseScene' in standalone) throw new Error('standalone exposes parseScene');
			if (typeof root.mountScene !== 'function') throw new Error('root mountScene missing');
			if ('parseScene' in root) throw new Error('root exposes parseScene');
			if (typeof dsl.parseScene !== 'function') throw new Error('dsl parseScene missing');
			if (typeof dsl.compileScene !== 'function') throw new Error('dsl compileScene missing');
		`;
		const result = spawnSync('bun', ['--eval', script], {
			cwd: process.cwd(),
			encoding: 'utf8'
		});

		expect(result.stderr).toBe('');
		expect(result.status).toBe(0);
	});

	test('CLI dist package runs through the published bin artifact', () => {
		ensureDistBuilt();

		const result = spawnSync(
			'node',
			[
				'packages/cli/dist/bin.js',
				'validate',
				'examples/basic/source.isostate.yaml'
			],
			{
				cwd: process.cwd(),
				encoding: 'utf8'
			}
		);

		expect(result.stderr).toBe('');
		expect(result.stdout).toContain('OK examples/basic/source.isostate.yaml');
		expect(result.status).toBe(0);
	});
});
