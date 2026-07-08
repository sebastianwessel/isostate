import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const buildTimeoutMs = 60_000;

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
		encoding: 'utf8',
		timeout: buildTimeoutMs
	});

	expect(result.stderr, result.stderr).not.toContain('error');
	expect(result.status, result.stderr || result.stdout).toBe(0);
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
	}, buildTimeoutMs);

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
		expect(result.stdout.trim().split('\n').at(-1)).toBe('OK');
		expect(result.status).toBe(0);
	}, buildTimeoutMs);

	test('browser DSL and editor-support dist entrypoints import cleanly', () => {
		ensureDistBuilt();

		const script = `
			const browserDsl = await import('./packages/core/dist/dsl/browser.js');
			const editorSupport = await import('./packages/core/dist/editor-support/index.js');
			if (typeof browserDsl.parseScene !== 'function') throw new Error('browserDsl parseScene missing');
			if (typeof browserDsl.validateScene !== 'function') throw new Error('browserDsl validateScene missing');
			if (typeof browserDsl.compileScene !== 'function') throw new Error('browserDsl compileScene missing');
			if (typeof editorSupport.projectGridPoint !== 'function') throw new Error('editorSupport projectGridPoint missing');
			if (typeof editorSupport.createEditorRuntimeAdapter !== 'function') throw new Error('editorSupport createEditorRuntimeAdapter missing');
		`;
		const result = spawnSync('bun', ['--eval', script], {
			cwd: process.cwd(),
			encoding: 'utf8'
		});

		expect(result.stderr).toBe('');
		expect(result.status).toBe(0);
	}, buildTimeoutMs);

	test('editor package dist entrypoint imports cleanly', () => {
		ensureDistBuilt();

		const script = `
			const editor = await import('./packages/editor/dist/index.js');
			if (typeof editor.mountEditor !== 'function') throw new Error('editor mountEditor missing');
			if (typeof editor.IsostateEditor !== 'function') throw new Error('editor IsostateEditor missing');
			if (typeof editor.createEditorWorkspace !== 'function') throw new Error('editor createEditorWorkspace missing');
		`;
		const result = spawnSync('bun', ['--eval', script], {
			cwd: process.cwd(),
			encoding: 'utf8'
		});

		expect(result.stderr).toBe('');
		expect(result.status).toBe(0);
	}, buildTimeoutMs);
});
