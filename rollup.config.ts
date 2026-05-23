import { builtinModules } from 'node:module';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { defineConfig } from 'rollup';
import type { Plugin } from 'rollup';
import ts from 'typescript';

function typescriptPlugin(): Plugin {
	return {
		name: 'isostate-typescript',
		transform(code, id) {
			if (!id.endsWith('.ts') && !id.endsWith('.tsx')) return null;

			const result = ts.transpileModule(code, {
				compilerOptions: {
					target: ts.ScriptTarget.ES2022,
					module: ts.ModuleKind.ESNext,
					sourceMap: true,
					jsx: ts.JsxEmit.ReactJSX
				},
				fileName: id
			});

			return {
				code: result.outputText,
				map: result.sourceMapText ? JSON.parse(result.sourceMapText) : null
			};
		}
	};
}

const nodeBuiltins = new Set([
	...builtinModules,
	...builtinModules.map((moduleName) => `node:${moduleName}`)
]);

function cliExternal(id: string): boolean {
	return id === '@sebastianwessel/isostate/dsl' || id === '@sebastianwessel/isostate' || nodeBuiltins.has(id);
}

export default defineConfig([
	{
		input: {
			index: 'packages/core/src/index.ts',
			'runtime/index': 'packages/core/src/runtime/index.ts',
			'dsl/index': 'packages/core/src/dsl/index.ts',
			'dsl/browser': 'packages/core/src/dsl/browser.ts',
			'editor-support/index': 'packages/core/src/editor-support/index.ts'
		},
		output: {
			dir: 'packages/core/dist',
			format: 'es',
			entryFileNames: '[name].js',
			chunkFileNames: 'chunks/[name]-[hash].js',
			sourcemap: true
		},
		// yaml is dev-time only and must stay out of runtime browser bundles.
		external: ['yaml'],
		plugins: [nodeResolve({ extensions: ['.ts', '.js'] }), typescriptPlugin()]
	},
	{
		input: {
			index: 'packages/editor/src/index.ts',
			react: 'packages/editor/src/react.ts'
		},
		output: {
			dir: 'packages/editor/dist',
			format: 'es',
			entryFileNames: '[name].js',
			sourcemap: true
		},
		external: (id) => id === 'react' || id === 'react/jsx-runtime' || id === 'react-dom' || id === 'react-dom/client' || id.startsWith('@sebastianwessel/isostate'),
		plugins: [nodeResolve({ extensions: ['.ts', '.tsx', '.js'] }), typescriptPlugin()]
	},
	{
		input: 'packages/cli/src/bin.ts',
		output: {
			file: 'packages/cli/dist/bin.js',
			format: 'es',
			sourcemap: true
		},
		external: cliExternal,
		plugins: [nodeResolve({ extensions: ['.ts', '.js'] }), typescriptPlugin()]
	},
	{
		input: 'packages/cli/src/index.ts',
		output: {
			file: 'packages/cli/dist/index.js',
			format: 'es',
			sourcemap: true
		},
		external: cliExternal,
		plugins: [nodeResolve({ extensions: ['.ts', '.js'] }), typescriptPlugin()]
	}
]);
