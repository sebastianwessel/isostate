import { mkdir, rename, rm } from 'node:fs/promises';

await mkdir('packages/core/dist/browser', { recursive: true });

const result = await Bun.build({
	entrypoints: ['packages/core/src/browser-runtime.ts'],
	outdir: 'packages/core/dist/browser',
	format: 'esm',
	target: 'browser',
	minify: true,
	sourcemap: 'external',
	write: true
});

if (!result.success) {
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}

await rm('packages/core/dist/browser/isostate.runtime.js', { force: true });
await rm('packages/core/dist/browser/isostate.runtime.js.map', { force: true });
await rename('packages/core/dist/browser/browser-runtime.js', 'packages/core/dist/browser/isostate.runtime.js');
await rename('packages/core/dist/browser/browser-runtime.js.map', 'packages/core/dist/browser/isostate.runtime.js.map');
