import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import {
	compileScene,
	parseScene,
	toJs,
	toJson,
	validateScene
} from '@sebastianwessel/isostate/dsl';
import { assetsManifestCommand } from './assets-manifest.js';
import {
	formatThrownError,
	formatValidationError,
	formatValidationWarning
} from './diagnostics.js';
import { inspectCommand } from './inspect.js';
import { convertMermaidToDsl } from './mermaid2dsl.js';
import { bundleCommand } from './static-bundle.js';

export interface CliIo {
	stdout: Pick<typeof console, 'log'>;
	stderr: Pick<typeof console, 'error'>;
}

export interface CliResult {
	exitCode: number;
}

type BundleFormat = 'js' | 'json';

const DEFAULT_OUT = 'build/scene.isostate.js';

export async function runCli(
	args: string[],
	io: CliIo = { stdout: console, stderr: console }
): Promise<CliResult> {
	const [command, ...rest] = args;

	try {
		switch (command) {
			case 'validate':
				return await validateCommand(rest, io);
			case 'compile':
				return await compileCommand(rest, io);
			case 'bundle':
				return await bundleCommand(rest, io);
			case 'inspect':
				return await inspectCommand(rest, io);
			case 'assets':
				return await assetsCommand(rest, io);
			case 'mermaid2dsl':
				return await mermaid2dslCommand(rest, io);
			case undefined:
				io.stderr.error('ERROR MISSING_COMMAND Expected a command');
				return { exitCode: 1 };
			default:
				io.stderr.error(`ERROR UNKNOWN_COMMAND Unknown command "${command}"`);
				return { exitCode: 1 };
		}
	} catch (error) {
		io.stderr.error(formatThrownError(error));
		return { exitCode: 1 };
	}
}

async function assetsCommand(args: string[], io: CliIo): Promise<CliResult> {
	const [subcommand, ...rest] = args;
	switch (subcommand) {
		case 'manifest':
			return await assetsManifestCommand(rest, io);
		case undefined:
			io.stderr.error(
				'ERROR MISSING_SUBCOMMAND Expected a subcommand for assets'
			);
			return { exitCode: 1 };
		default:
			io.stderr.error(
				`ERROR UNKNOWN_SUBCOMMAND Unknown subcommand "${subcommand}" for assets`
			);
			return { exitCode: 1 };
	}
}

async function validateCommand(args: string[], io: CliIo): Promise<CliResult> {
	const parsed = parseInputArgs(args);
	if (!parsed.ok) {
		io.stderr.error(parsed.error);
		return { exitCode: 1 };
	}

	const source = await readInput(parsed.input);
	const document = parseScene(source);
	const report = validateScene(document);

	for (const warning of report.warnings) {
		io.stderr.error(formatValidationWarning(warning));
	}

	if (!report.isValid) {
		for (const error of report.errors) {
			io.stderr.error(formatValidationError(error));
		}
		return { exitCode: 1 };
	}

	io.stdout.log(
		`OK ${parsed.input} (${report.errors.length} errors, ${report.warnings.length} warnings)`
	);
	return { exitCode: 0 };
}

async function compileCommand(args: string[], io: CliIo): Promise<CliResult> {
	const parsed = parseCompileArgs(args);
	if (!parsed.ok) {
		io.stderr.error(parsed.error);
		return { exitCode: 1 };
	}

	const source = await readInput(parsed.input);
	const document = parseScene(source);
	const report = validateScene(document);

	for (const warning of report.warnings) {
		io.stderr.error(formatValidationWarning(warning));
	}

	if (!report.isValid) {
		for (const error of report.errors) {
			io.stderr.error(formatValidationError(error));
		}
		return { exitCode: 1 };
	}

	const bundle = compileScene(document);
	const output =
		parsed.format === 'js'
			? toJs(bundle, { minify: !parsed.pretty })
			: toJson(bundle);

	await writeAtomic(parsed.out, output);
	io.stdout.log(`WROTE ${parsed.out}`);
	return { exitCode: 0 };
}

async function mermaid2dslCommand(
	args: string[],
	io: CliIo
): Promise<CliResult> {
	const parsed = parseMermaid2DslArgs(args);
	if (!parsed.ok) {
		io.stderr.error(parsed.error);
		return { exitCode: 1 };
	}

	const source = await readInput(parsed.input);
	const { yaml, warnings } = convertMermaidToDsl(source, {
		name: mermaidSceneName(parsed.input)
	});

	for (const warning of warnings) {
		io.stderr.error(
			formatValidationWarning({
				code: warning.code,
				message: warning.message,
				location: { line: warning.line }
			})
		);
	}

	await writeAtomic(parsed.out, yaml);
	io.stdout.log(`WROTE ${parsed.out}`);
	return { exitCode: 0 };
}

function parseMermaid2DslArgs(
	args: string[]
): { ok: true; input: string; out: string } | { ok: false; error: string } {
	const positionals = positionalArgs(args, new Set(['--out']));
	const input = positionals.at(0);
	if (!input) {
		return {
			ok: false,
			error: 'ERROR MISSING_INPUT Expected a Mermaid flowchart source file'
		};
	}
	if (positionals.length > 1) {
		return {
			ok: false,
			error: 'ERROR EXTRA_INPUT Expected exactly one input Mermaid file'
		};
	}

	let out = defaultMermaidOut(input);

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === '--out') {
			const value = args[index + 1];
			if (!value || value.startsWith('-')) {
				return {
					ok: false,
					error: 'ERROR MISSING_OPTION --out requires a path'
				};
			}
			out = value;
			index += 1;
			continue;
		}
		if (arg.startsWith('-')) {
			return { ok: false, error: `ERROR UNKNOWN_OPTION Unknown option ${arg}` };
		}
	}

	return { ok: true, input, out };
}

function defaultMermaidOut(input: string): string {
	const extension = extname(input);
	const stem = extension ? input.slice(0, -extension.length) : input;
	return `${stem}.isostate.yaml`;
}

function mermaidSceneName(input: string): string {
	const extension = extname(input);
	const stem = extension
		? basename(input).slice(0, -extension.length)
		: basename(input);
	return stem;
}

function parseInputArgs(
	args: string[]
): { ok: true; input: string } | { ok: false; error: string } {
	const unknown = args.find((arg) => arg.startsWith('-'));
	if (unknown) {
		return {
			ok: false,
			error: `ERROR UNKNOWN_OPTION Unknown option ${unknown}`
		};
	}

	const positionals = positionalArgs(args, new Set());
	const input = positionals.at(0);
	if (!input) {
		return {
			ok: false,
			error: 'ERROR MISSING_INPUT Expected an input .isostate.yaml file'
		};
	}
	if (positionals.length > 1) {
		return {
			ok: false,
			error: 'ERROR EXTRA_INPUT Expected exactly one input .isostate.yaml file'
		};
	}

	return { ok: true, input };
}

function parseCompileArgs(args: string[]):
	| {
			ok: true;
			input: string;
			out: string;
			format: BundleFormat;
			pretty: boolean;
	  }
	| { ok: false; error: string } {
	const input = positionalArgs(args, new Set(['--out', '--format'])).at(0);
	const positionals = positionalArgs(args, new Set(['--out', '--format']));
	if (!input) {
		return {
			ok: false,
			error: 'ERROR MISSING_INPUT Expected an input .isostate.yaml file'
		};
	}
	if (positionals.length > 1) {
		return {
			ok: false,
			error: 'ERROR EXTRA_INPUT Expected exactly one input .isostate.yaml file'
		};
	}

	let out = DEFAULT_OUT;
	let format: string | undefined;
	let pretty = false;

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === '--pretty') {
			pretty = true;
			continue;
		}
		if (arg === '--out') {
			const value = args[index + 1];
			if (!value || value.startsWith('-')) {
				return {
					ok: false,
					error: 'ERROR MISSING_OPTION --out requires a path'
				};
			}
			out = value;
			index += 1;
			continue;
		}
		if (arg === '--format') {
			const value = args[index + 1];
			if (!value || value.startsWith('-')) {
				return {
					ok: false,
					error: 'ERROR MISSING_OPTION --format requires js or json'
				};
			}
			format = value;
			index += 1;
			continue;
		}
		if (arg.startsWith('-')) {
			return { ok: false, error: `ERROR UNKNOWN_OPTION Unknown option ${arg}` };
		}
	}

	const inferredFormat = format ?? inferFormat(out);
	if (inferredFormat !== 'js' && inferredFormat !== 'json') {
		return {
			ok: false,
			error: `ERROR UNSUPPORTED_FORMAT Unsupported format "${inferredFormat}"`
		};
	}

	return { ok: true, input, out, format: inferredFormat, pretty };
}

function positionalArgs(
	args: string[],
	optionsWithValues: Set<string>
): string[] {
	const positionals: string[] = [];
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === undefined) continue;
		if (optionsWithValues.has(arg)) {
			index += 1;
			continue;
		}
		if (!arg.startsWith('-')) {
			positionals.push(arg);
		}
	}
	return positionals;
}

function inferFormat(out: string): string {
	const extension = extname(out).toLowerCase();
	if (extension === '.json') return 'json';
	return 'js';
}

async function readInput(path: string): Promise<string> {
	try {
		return await readFile(path, 'utf8');
	} catch (error) {
		throw wrapFsError('FILE_READ_FAILED', `Unable to read ${path}`, error);
	}
}

async function writeAtomic(path: string, contents: string): Promise<void> {
	const absolute = resolve(path);
	const directory = dirname(absolute);
	const temporary = `${absolute}.tmp-${process.pid}-${Date.now()}`;

	try {
		await mkdir(directory, { recursive: true });
		await writeFile(temporary, contents, 'utf8');
		await rename(temporary, absolute);
	} catch (error) {
		await rm(temporary, { force: true });
		throw wrapFsError('FILE_WRITE_FAILED', `Unable to write ${path}`, error);
	}
}

function wrapFsError(code: string, message: string, cause: unknown): Error {
	const error = new Error(message);
	Object.defineProperty(error, 'code', { value: code, enumerable: true });
	Object.defineProperty(error, 'cause', { value: cause });
	return error;
}
