import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();

const forbiddenRuntimeFragments = [
	"from 'yaml'",
	'from "yaml"',
	"from 'node:crypto'",
	'from "node:crypto"',
	"from 'node:fs'",
	'from "node:fs"',
	"from 'node:fs/promises'",
	'from "node:fs/promises"',
	'./dsl/',
	'../dsl/',
	'scene-parser',
	'scene-validator',
	'compiler.ts',
	'compileScene',
	'parseScene',
	'validateScene',
	'@sebastianwessel/isostate-editor',
	"from 'react'",
	'from "react"',
	"from 'react-dom'",
	'from "react-dom"',
	"from 'react-dom/client'",
	'from "react-dom/client"',
	'@codemirror/',
	'@lezer/',
	'editor-support'
] as const;

function ensureDistBuilt(): void {
	if (
		existsSync(join(root, 'packages/core/dist/browser/isostate.runtime.js'))
	) {
		return;
	}

	const result = spawnSync('bun', ['run', 'build'], {
		cwd: root,
		encoding: 'utf8'
	});

	expect(result.stderr).not.toContain('error');
	expect(result.status).toBe(0);
}

describe('runtime/dev-time boundary', () => {
	test('runtime source entrypoint does not export DSL APIs', async () => {
		const source = await readFile(
			join(root, 'packages/core/src/index.ts'),
			'utf8'
		);

		for (const fragment of ['parseScene', 'validateScene', 'compileScene']) {
			expect(source).not.toContain(fragment);
		}
	});

	test('standalone browser runtime excludes YAML and DSL modules', async () => {
		ensureDistBuilt();

		const runtime = await readFile(
			join(root, 'packages/core/dist/browser/isostate.runtime.js'),
			'utf8'
		);

		for (const fragment of forbiddenRuntimeFragments) {
			expect(runtime).not.toContain(fragment);
		}
	});

	test('dev-time entrypoint is the only public DSL surface', async () => {
		const dsl = await readFile(
			join(root, 'packages/core/src/dsl/index.ts'),
			'utf8'
		);

		for (const symbol of [
			'parseScene',
			'validateScene',
			'compileScene',
			'toJs',
			'toJson',
			'fromJs',
			'fromJson'
		]) {
			expect(dsl).toContain(symbol);
		}
	});

	test('standalone browser runtime excludes editor-only dependencies', async () => {
		ensureDistBuilt();

		const runtime = await readFile(
			join(root, 'packages/core/dist/browser/isostate.runtime.js'),
			'utf8'
		);

		for (const fragment of [
			'@sebastianwessel/isostate-editor',
			"from 'react'",
			'from "react"',
			"from 'react-dom'",
			'from "react-dom"',
			"from 'react-dom/client'",
			'from "react-dom/client"',
			'@codemirror/',
			'@lezer/',
			'editor-support'
		]) {
			expect(runtime).not.toContain(fragment);
		}
	});

	test('editor-support source does not import YAML or DSL modules', async () => {
		const editorSupport = await readFile(
			join(root, 'packages/core/src/editor-support/index.ts'),
			'utf8'
		);

		for (const fragment of [
			"from 'yaml'",
			'from "yaml"',
			'./dsl/',
			'../dsl/',
			'scene-parser',
			'scene-validator',
			'compiler.ts',
			'compileScene',
			'parseScene',
			'validateScene'
		]) {
			expect(editorSupport).not.toContain(fragment);
		}
	});
});
