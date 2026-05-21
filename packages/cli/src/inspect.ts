import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import {
	fromJs,
	fromJson,
	type RuntimeBundle
} from '@sebastianwessel/isostate/dsl';
import type { CliIo, CliResult } from './commands.js';
import { runtimeDigest } from './runtime-digest.js';

export async function inspectCommand(
	args: string[],
	io: CliIo
): Promise<CliResult> {
	const parsed = parseInspectArgs(args);
	if (!parsed.ok) {
		io.stderr.error(parsed.error);
		return { exitCode: 1 };
	}

	const source = await readFile(parsed.input, 'utf8');
	const bundle = parseBundle(parsed.input, source);
	validateDigest(bundle);

	const assetCount = Object.keys(bundle.assets ?? {}).length;
	const floorSize = bundle.floor.size.join('x');
	io.stdout.log(`format: ${bundle._format}`);
	io.stdout.log(`version: ${bundle._version}`);
	io.stdout.log(`scenes: ${bundle.scenes.length}`);
	io.stdout.log(`assets: ${assetCount}`);
	io.stdout.log(`layers: ${bundle.layers.length}`);
	io.stdout.log(`floor: ${floorSize}`);
	io.stdout.log(`digest: ${bundle._digest}`);
	return { exitCode: 0 };
}

function parseInspectArgs(
	args: string[]
): { ok: true; input: string } | { ok: false; error: string } {
	const positionals = args.filter((arg) => !arg.startsWith('-'));
	const input = positionals.at(0);
	if (!input) {
		return {
			ok: false,
			error: 'ERROR MISSING_INPUT Expected a runtime bundle file'
		};
	}
	if (positionals.length > 1) {
		return {
			ok: false,
			error: 'ERROR EXTRA_INPUT Expected exactly one runtime bundle file'
		};
	}

	const unknown = args.find((arg) => arg.startsWith('-'));
	if (unknown) {
		return {
			ok: false,
			error: `ERROR UNKNOWN_OPTION Unknown option ${unknown}`
		};
	}

	return { ok: true, input };
}

function parseBundle(path: string, source: string): RuntimeBundle {
	const extension = extname(path).toLowerCase();
	if (extension === '.json') return fromJson(source);
	if (extension === '.js') return fromJs(source);

	const error = new Error(`Unsupported runtime bundle extension for ${path}`);
	Object.defineProperty(error, 'code', {
		value: 'UNSUPPORTED_BUNDLE_FORMAT',
		enumerable: true
	});
	throw error;
}

function validateDigest(bundle: RuntimeBundle): void {
	if (bundle._format !== 'isostate-runtime-bundle' || !bundle._version) {
		const error = new Error('Invalid runtime bundle identity fields');
		Object.defineProperty(error, 'code', {
			value: 'INVALID_RUNTIME_BUNDLE',
			enumerable: true
		});
		throw error;
	}

	if (runtimeDigest(bundle) !== bundle._digest) {
		const error = new Error('Invalid runtime bundle digest');
		Object.defineProperty(error, 'code', {
			value: 'INVALID_RUNTIME_BUNDLE_DIGEST',
			enumerable: true
		});
		throw error;
	}
}
