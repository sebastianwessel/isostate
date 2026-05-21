import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';

describe('built package entrypoints', () => {
	test('runtime and DSL dist entrypoints import cleanly', () => {
		const script = `
			const runtime = await import('./packages/core/dist/runtime/index.js');
			const root = await import('./packages/core/dist/index.js');
			const dsl = await import('./packages/core/dist/dsl/index.js');
			if (typeof runtime.mountScene !== 'function') throw new Error('runtime mountScene missing');
			if ('parseScene' in runtime) throw new Error('runtime exposes parseScene');
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
});
