import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const maxRuntimeGzipBytes = 20 * 1024;
const runtimePath = join(
	root,
	'packages/core/dist/browser/isostate.runtime.js'
);
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
	'validateScene'
] as const;

const build = spawnSync('bun', ['run', 'build'], {
	cwd: root,
	stdio: 'inherit'
});

if (build.status !== 0) {
	process.exit(build.status ?? 1);
}

const runtime = await readRuntimeGraph(runtimePath);
const gzipBytes = gzipSync(runtime).byteLength;

if (gzipBytes >= maxRuntimeGzipBytes) {
	console.error(
		`Runtime entrypoint is ${gzipBytes} bytes gzipped; budget is <${maxRuntimeGzipBytes} bytes.`
	);
	process.exit(1);
}

const forbidden = forbiddenRuntimeFragments.filter((fragment) =>
	runtime.includes(fragment)
);

if (forbidden.length > 0) {
	console.error(
		`Runtime entrypoint contains dev-time fragments: ${forbidden.join(', ')}`
	);
	process.exit(1);
}

console.log(
	`Standalone browser runtime: ${gzipBytes} bytes gzipped (<${maxRuntimeGzipBytes}).`
);

async function readRuntimeGraph(
	entryPath: string,
	seen = new Set<string>()
): Promise<string> {
	const absolutePath = resolve(entryPath);
	if (seen.has(absolutePath)) return '';
	seen.add(absolutePath);

	const source = await readFile(absolutePath, 'utf8');
	const imports = [...source.matchAll(/\b(?:import|export)\b[^'"]*['"]([^'"]+)['"]/g)]
		.map((match) => match[1])
		.filter((specifier) => specifier.startsWith('.'))
		.map((specifier) => resolve(dirname(absolutePath), specifier));

	const dependencies = await Promise.all(
		imports.map((path) => readRuntimeGraph(path, seen))
	);
	return [source, ...dependencies].join('\n');
}
