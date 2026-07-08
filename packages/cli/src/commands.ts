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
	formatValidationWarning,
	printGroupedWarnings,
	printValidationReport
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

/**
 * One entry per command listed in the Help contract
 * (`specs/03-contracts/cli.md`), in the exact required listing order:
 * `validate`, `compile`, `bundle`, `assets manifest`, `inspect`,
 * `mermaid2dsl`.
 */
interface CommandHelp {
	/** Command name as it appears in the global usage listing. */
	name: string;
	/** One-sentence description shown next to the command in global usage. */
	summary: string;
	/** Full per-command usage text for `<command> --help`/`-h`. */
	usage: string;
}

const COMMAND_HELP: CommandHelp[] = [
	{
		name: 'validate',
		summary: 'Parse and validate a .isostate.yaml scene file.',
		usage: `Usage: isostate validate <input.isostate.yaml>

Parses and validates a .isostate.yaml scene file, printing a grouped
diagnostics report of errors and warnings.

Arguments:
  <input.isostate.yaml>  Path to the scene file to validate

Options:
  -h, --help  Show this help message and exit`
	},
	{
		name: 'compile',
		summary: 'Compile a .isostate.yaml scene into a runtime bundle.',
		usage: `Usage: isostate compile <input.isostate.yaml> [options]

Validates a .isostate.yaml scene file and compiles it into a canonical
runtime bundle (JS default export or JSON).

Arguments:
  <input.isostate.yaml>  Path to the scene file to compile

Options:
  --out <path>       Output file path (default: build/scene.isostate.js)
  --format <format>  Output format: js or json (default: inferred from --out, otherwise js)
  --pretty           Use pretty serialization where supported
  -h, --help         Show this help message and exit`
	},
	{
		name: 'bundle',
		summary: 'Produce a deployable static bundle directory.',
		usage: `Usage: isostate bundle <input.isostate.yaml> --out <dir> [options]

Validates and compiles a .isostate.yaml scene file, then writes a
deployable static bundle directory: the compiled scene, the standalone
browser runtime, copied referenced assets, and a deployment manifest.

Arguments:
  <input.isostate.yaml>  Path to the scene file to bundle

Options:
  --out <dir>                  Deployment directory to create (required)
  --asset-dir <dir>             Source root for local external assets (default: directory containing the input file)
  --public-asset-base <url>     URL prefix written into compiled scene data (default: ./assets)
  --scene-name <name>            Output scene bundle basename (default: scene)
  --runtime <copy|external|none> Runtime artifact output mode (default: copy)
  -h, --help                     Show this help message and exit`
	},
	{
		name: 'assets manifest',
		summary: 'Generate an asset manifest from a directory of assets.',
		usage: `Usage: isostate assets manifest <asset-dir> [options]

Recursively scans a directory for SVG and sprite sheet assets and writes an
isostate.asset-manifest JSON file.

Arguments:
  <asset-dir>  Root directory to scan recursively

Options:
  --out <path>              Output manifest path (default: isostate-assets.manifest.json)
  --asset-base-url <url>    URL/path written to manifest assetBaseUrl (default: ./assets)
  --metadata <path>         Optional manifest metadata path (default: <asset-dir>/.isostate-assets.yaml when present)
  --pretty                  Write indented JSON (default: on)
  -h, --help                Show this help message and exit`
	},
	{
		name: 'inspect',
		summary: 'Print metadata about a compiled runtime bundle.',
		usage: `Usage: isostate inspect <bundle.isostate.js|bundle.isostate.json>

Parses a compiled runtime bundle, verifies its format/version/digest, and
prints scene count, asset count, layer count, floor size, and digest.

Arguments:
  <bundle>  Path to a compiled .isostate.js or .isostate.json runtime bundle

Options:
  -h, --help  Show this help message and exit`
	},
	{
		name: 'mermaid2dsl',
		summary:
			'Convert a Mermaid flowchart into an authored .isostate.yaml scene.',
		usage: `Usage: isostate mermaid2dsl <flowchart.mmd> [options]

Converts the supported Mermaid flowchart subset into authored
.isostate.yaml scene YAML, validating the generated document before
writing it.

Arguments:
  <flowchart.mmd>  Mermaid flowchart source file

Options:
  --out <path>  Output path (default: input path with its extension replaced by .isostate.yaml)
  -h, --help    Show this help message and exit`
	}
];

function globalUsageText(): string {
	const lines = [
		'Usage: isostate <command> [options]',
		'',
		'Commands:',
		...COMMAND_HELP.map(
			({ name, summary }) => `  ${name.padEnd(16)}${summary}`
		),
		'',
		'Run `isostate <command> --help` for command-specific usage.'
	];
	return lines.join('\n');
}

function isHelpFlag(arg: string | undefined): boolean {
	return arg === '--help' || arg === '-h';
}

function hasHelpFlag(args: string[]): boolean {
	return args.some(isHelpFlag);
}

export async function runCli(
	args: string[],
	io: CliIo = { stdout: console, stderr: console }
): Promise<CliResult> {
	const [command, ...rest] = args;

	if (command === undefined || isHelpFlag(command)) {
		io.stdout.log(globalUsageText());
		return { exitCode: 0 };
	}

	try {
		switch (command) {
			case 'validate':
				if (hasHelpFlag(rest)) return printCommandHelp('validate', io);
				return await validateCommand(rest, io);
			case 'compile':
				if (hasHelpFlag(rest)) return printCommandHelp('compile', io);
				return await compileCommand(rest, io);
			case 'bundle':
				if (hasHelpFlag(rest)) return printCommandHelp('bundle', io);
				return await bundleCommand(rest, io);
			case 'inspect':
				if (hasHelpFlag(rest)) return printCommandHelp('inspect', io);
				return await inspectCommand(rest, io);
			case 'assets':
				return await assetsCommand(rest, io);
			case 'mermaid2dsl':
				if (hasHelpFlag(rest)) return printCommandHelp('mermaid2dsl', io);
				return await mermaid2dslCommand(rest, io);
			default:
				io.stderr.error(`ERROR CLI_UNKNOWN_COMMAND ${command}`);
				io.stderr.error(globalUsageText());
				return { exitCode: 1 };
		}
	} catch (error) {
		io.stderr.error(formatThrownError(error));
		return { exitCode: 1 };
	}
}

function printCommandHelp(name: string, io: CliIo): CliResult {
	const help = COMMAND_HELP.find((entry) => entry.name === name);
	/* istanbul ignore next -- every dispatched command has a COMMAND_HELP entry */
	if (!help) throw new Error(`Missing help text for command "${name}"`);
	io.stdout.log(help.usage);
	return { exitCode: 0 };
}

async function assetsCommand(args: string[], io: CliIo): Promise<CliResult> {
	const [subcommand, ...rest] = args;
	if (
		isHelpFlag(subcommand) ||
		(subcommand === 'manifest' && hasHelpFlag(rest))
	) {
		return printCommandHelp('assets manifest', io);
	}
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

	return { exitCode: printValidationReport(report, io) };
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

	if (!report.isValid) {
		printValidationReport(report, io);
		return { exitCode: 1 };
	}
	printGroupedWarnings(report.warnings, io);

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
