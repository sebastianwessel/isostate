import { defineConfig } from 'rollup';
import type { Plugin } from 'rollup';
import ts from 'typescript';

function typescriptPlugin(): Plugin {
	return {
		name: 'isostate-typescript',
		transform(code, id) {
			if (!id.endsWith('.ts')) return null;

			const result = ts.transpileModule(code, {
				compilerOptions: {
					target: ts.ScriptTarget.ES2022,
					module: ts.ModuleKind.ESNext,
					sourceMap: true
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

export default defineConfig({
	input: {
		index: 'packages/core/src/index.ts',
		'runtime/index': 'packages/core/src/runtime/index.ts',
		'dsl/index': 'packages/core/src/dsl/index.ts'
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
	plugins: [typescriptPlugin()]
});
