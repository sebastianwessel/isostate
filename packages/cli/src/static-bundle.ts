import {
	copyFile,
	mkdir,
	readFile,
	rename,
	rm,
	stat,
	writeFile
} from 'node:fs/promises';
import {
	basename,
	dirname,
	extname,
	isAbsolute,
	join,
	resolve,
	sep
} from 'node:path';
import {
	compileScene,
	parseScene,
	type RuntimeBundle,
	toJs,
	validateScene
} from '@sebastianwessel/isostate/dsl';
import type { CliIo, CliResult } from './commands.js';
import {
	formatValidationError,
	formatValidationWarning
} from './diagnostics.js';
import { runtimeDigest, sha256Hex } from './runtime-digest.js';

type RuntimeMode = 'copy' | 'external' | 'none';
type SceneDocument = ReturnType<typeof parseScene>;

interface BundleArgs {
	input: string;
	out: string;
	assetDir: string;
	publicAssetBase: string;
	sceneName: string;
	runtime: RuntimeMode;
}

interface AssetPlan {
	id: string;
	source: string;
	file: string;
	url: string;
}

type SceneAsset = SceneDocument['header']['assets'][number];

interface StaticBundleManifest {
	format: 'isostate-static-bundle';
	version: string;
	generatedAt: string;
	source: { file: string };
	runtime: { file?: string; mode: RuntimeMode };
	scene: { file: string; format: 'js'; digest: string };
	assets: Array<{
		id: string;
		source: string;
		file: string;
		url: string;
		digest: string;
	}>;
}

const DEFAULT_PUBLIC_ASSET_BASE = './assets';
const DEFAULT_SCENE_NAME = 'scene';
const RUNTIME_FILE = 'isostate.runtime.js';
const RUNTIME_SOURCE = new URL(
	'../../core/dist/browser/isostate.runtime.js',
	import.meta.url
);
const PACKAGE_JSON = new URL('../package.json', import.meta.url);

export async function bundleCommand(
	args: string[],
	io: CliIo
): Promise<CliResult> {
	const parsed = parseBundleArgs(args);
	if (!parsed.ok) {
		io.stderr.error(parsed.error);
		return { exitCode: 1 };
	}

	const source = await readFile(parsed.input, 'utf8');
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
	const assetPlan = await planAssets(document, bundle, parsed);
	const rewrittenBundle = rewriteAssetUrls(bundle, assetPlan);
	const manifest = await createManifest(parsed, rewrittenBundle, assetPlan);

	await writeBundleDirectory(parsed, rewrittenBundle, assetPlan, manifest);
	io.stdout.log(`BUNDLED ${parsed.out}`);
	return { exitCode: 0 };
}

function parseBundleArgs(
	args: string[]
): ({ ok: true } & BundleArgs) | { ok: false; error: string } {
	const inputs = positionalArgs(
		args,
		new Set([
			'--out',
			'--asset-dir',
			'--public-asset-base',
			'--scene-name',
			'--runtime'
		])
	);
	const firstInput = inputs.at(0);
	if (!firstInput) {
		return {
			ok: false,
			error: 'ERROR MISSING_INPUT Expected an input .isostate.yaml file'
		};
	}
	if (inputs.length > 1) {
		return {
			ok: false,
			error: 'ERROR EXTRA_INPUT Expected exactly one input .isostate.yaml file'
		};
	}

	const parsed: BundleArgs = {
		input: firstInput,
		out: '',
		assetDir: dirname(firstInput),
		publicAssetBase: DEFAULT_PUBLIC_ASSET_BASE,
		sceneName: DEFAULT_SCENE_NAME,
		runtime: 'copy'
	};

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (!arg.startsWith('-')) continue;
		const value = args[index + 1];
		if (!value || value.startsWith('-')) {
			return {
				ok: false,
				error: `ERROR MISSING_OPTION ${arg} requires a value`
			};
		}
		if (!applyBundleOption(parsed, arg, value)) {
			return { ok: false, error: `ERROR UNKNOWN_OPTION Unknown option ${arg}` };
		}
		index += 1;
	}

	if (!parsed.out) {
		return { ok: false, error: 'ERROR MISSING_OPTION --out requires a path' };
	}

	return { ok: true, ...parsed };
}

function applyBundleOption(
	args: BundleArgs,
	option: string,
	value: string
): boolean {
	switch (option) {
		case '--out':
			args.out = value;
			return true;
		case '--asset-dir':
			args.assetDir = value;
			return true;
		case '--public-asset-base':
			args.publicAssetBase = value;
			return true;
		case '--scene-name':
			args.sceneName = value;
			return true;
		case '--runtime':
			if (value !== 'copy' && value !== 'external' && value !== 'none') {
				throw codedError(
					'UNSUPPORTED_RUNTIME_MODE',
					`Unsupported runtime mode "${value}"`
				);
			}
			args.runtime = value;
			return true;
		default:
			return false;
	}
}

async function planAssets(
	document: SceneDocument,
	bundle: RuntimeBundle,
	args: BundleArgs
): Promise<AssetPlan[]> {
	const assetIds = Object.keys(bundle.assets ?? {}).sort();
	const usedFiles = new Set<string>();
	const sourceFiles = new Map<string, string>();
	const plans: AssetPlan[] = [];

	for (const id of assetIds) {
		const source = resolveAssetSource(document, id, args.assetDir);
		await assertAssetFile(id, source);
		let file = sourceFiles.get(source);
		if (!file) {
			file = uniqueAssetFile(id, basename(source), usedFiles);
			sourceFiles.set(source, file);
		}
		plans.push({
			id,
			source,
			file,
			url: publicAssetUrl(args.publicAssetBase, file)
		});
	}

	return plans;
}

function resolveAssetSource(
	document: SceneDocument,
	id: string,
	assetDir: string
): string {
	const entry = resolveAssetEntry(document, id);
	if (!entry) {
		throw codedError('ASSET_SOURCE_MISSING', `Asset "${id}" is not declared`);
	}

	const rawPath = isSpriteSheetAsset(entry)
		? entry.path
		: (entry.path ?? entry.id);
	const withExtension = extname(rawPath) ? rawPath : `${rawPath}.svg`;
	return isAbsolute(withExtension)
		? withExtension
		: resolve(assetDir, withExtension);
}

function resolveAssetEntry(
	document: SceneDocument,
	id: string
): SceneAsset | undefined {
	const direct = document.header.assets.find((asset) => asset.id === id);
	if (direct) return direct;
	return document.header.assets.find(
		(asset) => isSpriteSheetAsset(asset) && id in asset.sprites
	);
}

function isSpriteSheetAsset(
	asset: SceneAsset
): asset is Extract<SceneAsset, { type: 'sprite-sheet' }> {
	return 'type' in asset && asset.type === 'sprite-sheet';
}

async function assertAssetFile(id: string, source: string): Promise<void> {
	const extension = extname(source).toLowerCase();
	if (
		extension !== '.svg' &&
		extension !== '.png' &&
		extension !== '.webp' &&
		extension !== '.jpg' &&
		extension !== '.jpeg'
	) {
		throw codedError(
			'ASSET_UNSUPPORTED_FILE',
			`Asset "${id}" must resolve to an SVG, PNG, WebP, or JPEG file: ${source}`
		);
	}

	try {
		const stats = await stat(source);
		if (stats.isFile()) return;
	} catch {
		throw codedError(
			'ASSET_RESOLUTION_FAILED',
			`Unable to resolve asset "${id}" at ${source}`
		);
	}

	throw codedError('ASSET_NOT_FILE', `Asset "${id}" is not a file: ${source}`);
}

function uniqueAssetFile(
	id: string,
	sourceBasename: string,
	usedFiles: Set<string>
): string {
	if (!usedFiles.has(sourceBasename)) {
		usedFiles.add(sourceBasename);
		return sourceBasename;
	}

	const candidate = `${id}-${sourceBasename}`;
	usedFiles.add(candidate);
	return candidate;
}

function rewriteAssetUrls(
	bundle: RuntimeBundle,
	assetPlan: AssetPlan[]
): RuntimeBundle {
	if (assetPlan.length === 0) return bundle;

	const assets = { ...(bundle.assets ?? {}) };
	for (const asset of assetPlan) {
		assets[asset.id] = { ...assets[asset.id], url: asset.url };
	}

	const rewritten: RuntimeBundle = { ...bundle, assets };
	return { ...rewritten, _digest: runtimeDigest(rewritten) };
}

async function createManifest(
	args: BundleArgs,
	bundle: RuntimeBundle,
	assetPlan: AssetPlan[]
): Promise<StaticBundleManifest> {
	const assets = [];
	for (const asset of assetPlan) {
		const bytes = await readFile(asset.source);
		assets.push({
			id: asset.id,
			source: slashPath(asset.source),
			file: slashPath(join('assets', asset.file)),
			url: asset.url,
			digest: sha256Hex(bytes)
		});
	}

	const runtime =
		args.runtime === 'copy'
			? { mode: args.runtime, file: RUNTIME_FILE }
			: { mode: args.runtime };

	return {
		format: 'isostate-static-bundle',
		version: await packageVersion(),
		generatedAt: new Date().toISOString(),
		source: { file: slashPath(args.input) },
		runtime,
		scene: {
			file: `${args.sceneName}.isostate.js`,
			format: 'js',
			digest: bundle._digest
		},
		assets
	};
}

async function writeBundleDirectory(
	args: BundleArgs,
	bundle: RuntimeBundle,
	assetPlan: AssetPlan[],
	manifest: StaticBundleManifest
): Promise<void> {
	const out = resolve(args.out);
	const temporary = `${out}.tmp-${process.pid}-${Date.now()}`;
	const backup = `${out}.bak-${process.pid}-${Date.now()}`;

	try {
		await rm(temporary, { recursive: true, force: true });
		await rm(backup, { recursive: true, force: true });
		await mkdir(join(temporary, 'assets'), { recursive: true });
		await writeFile(
			join(temporary, `${args.sceneName}.isostate.js`),
			toJs(bundle),
			'utf8'
		);
		await writeRuntimeArtifact(args.runtime, temporary);
		await copyAssets(assetPlan, temporary);
		await writeFile(
			join(temporary, 'manifest.json'),
			`${JSON.stringify(manifest, null, 2)}\n`,
			'utf8'
		);
		let hasExistingOutput = false;
		try {
			await rename(out, backup);
			hasExistingOutput = true;
		} catch (error) {
			if (!isMissingPathError(error)) throw error;
		}

		try {
			await rename(temporary, out);
		} catch (error) {
			if (hasExistingOutput) {
				await rename(backup, out);
			}
			throw error;
		}

		if (hasExistingOutput) {
			await rm(backup, { recursive: true, force: true });
		}
	} catch (error) {
		await rm(temporary, { recursive: true, force: true });
		await rm(backup, { recursive: true, force: true });
		throw error;
	}
}

async function writeRuntimeArtifact(
	mode: RuntimeMode,
	outDir: string
): Promise<void> {
	if (mode !== 'copy') return;
	await copyFile(RUNTIME_SOURCE, join(outDir, RUNTIME_FILE));
}

async function copyAssets(
	assetPlan: AssetPlan[],
	outDir: string
): Promise<void> {
	const copied = new Set<string>();
	for (const asset of assetPlan) {
		const target = join(outDir, 'assets', asset.file);
		if (copied.has(target)) continue;
		await copyFile(asset.source, target);
		copied.add(target);
	}
}

async function packageVersion(): Promise<string> {
	const json = JSON.parse(await readFile(PACKAGE_JSON, 'utf8')) as {
		version?: unknown;
	};
	return typeof json.version === 'string' ? json.version : '0.0.0';
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

function publicAssetUrl(base: string, file: string): string {
	const trimmed = base.replace(/\/+$/, '');
	return trimmed ? `${trimmed}/${file}` : file;
}

function slashPath(path: string): string {
	return path.split(sep).join('/');
}

function codedError(code: string, message: string): Error {
	const error = new Error(message);
	Object.defineProperty(error, 'code', { value: code, enumerable: true });
	return error;
}

function isMissingPathError(error: unknown): boolean {
	return (
		error instanceof Error &&
		'code' in error &&
		(error as NodeJS.ErrnoException).code === 'ENOENT'
	);
}
