import {
	lstat,
	mkdir,
	readdir,
	readFile,
	rename,
	rm,
	writeFile
} from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { CliIo, CliResult } from './commands.js';
import { formatThrownError } from './diagnostics.js';
import { sha256Hex } from './runtime-digest.js';

const MAX_SVG_SIZE = 512 * 1024;
const RESERVED_IDS = new Set([
	'text',
	'rectangle',
	'circle',
	'polygon',
	'line'
]);
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

interface AssetManifestArgs {
	assetDir: string;
	out: string;
	assetBaseUrl: string;
	metadataPath: string | undefined;
	pretty: boolean;
}

interface AssetManifestEntry {
	id: string;
	path: string;
	group: string;
	name: string;
	label?: string;
	anchor?: [number, number];
	tags?: string[];
	digest: string;
}

interface AssetManifest {
	format: 'isostate.asset-manifest';
	version: 1;
	generatedAt: string;
	assetBaseUrl: string;
	assets: AssetManifestEntry[];
}

interface MetadataEntry {
	label?: string;
	anchor?: [number, number];
	tags?: string[];
}

export async function assetsManifestCommand(
	args: string[],
	io: CliIo
): Promise<CliResult> {
	const parsed = parseAssetsManifestArgs(args);
	if (!parsed.ok) {
		io.stderr.error(parsed.error);
		return { exitCode: 1 };
	}

	try {
		const manifest = await generateManifest(parsed);
		const json = parsed.pretty
			? `${JSON.stringify(manifest, null, 2)}\n`
			: `${JSON.stringify(manifest)}\n`;
		await writeAtomic(parsed.out, json);
		io.stdout.log(`WROTE ${parsed.out}`);
		return { exitCode: 0 };
	} catch (error) {
		io.stderr.error(formatThrownError(error));
		return { exitCode: 1 };
	}
}

function parseAssetsManifestArgs(
	args: string[]
): ({ ok: true } & AssetManifestArgs) | { ok: false; error: string } {
	const positionals = positionalArgs(
		args,
		new Set(['--out', '--asset-base-url', '--metadata'])
	);
	const assetDir = positionals[0];
	if (!assetDir) {
		return {
			ok: false,
			error: 'ERROR MISSING_INPUT Expected an asset directory'
		};
	}
	if (positionals.length > 1) {
		return {
			ok: false,
			error: 'ERROR EXTRA_INPUT Expected exactly one asset directory'
		};
	}

	let out = 'isostate-assets.manifest.json';
	let assetBaseUrl = './assets';
	let metadataPath: string | undefined;
	let pretty = true;

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
		if (arg === '--asset-base-url') {
			const value = args[index + 1];
			if (!value || value.startsWith('-')) {
				return {
					ok: false,
					error: 'ERROR MISSING_OPTION --asset-base-url requires a URL'
				};
			}
			assetBaseUrl = value;
			index += 1;
			continue;
		}
		if (arg === '--metadata') {
			const value = args[index + 1];
			if (!value || value.startsWith('-')) {
				return {
					ok: false,
					error: 'ERROR MISSING_OPTION --metadata requires a path'
				};
			}
			metadataPath = value;
			index += 1;
			continue;
		}
		if (arg.startsWith('-')) {
			return {
				ok: false,
				error: `ERROR UNKNOWN_OPTION Unknown option ${arg}`
			};
		}
	}

	return { ok: true, assetDir, out, assetBaseUrl, metadataPath, pretty };
}

async function generateManifest(
	args: AssetManifestArgs
): Promise<AssetManifest> {
	const assetDir = resolve(args.assetDir);
	const svgFiles = await scanSvgFiles(assetDir);
	const metadata = await readMetadata(args, assetDir);
	const seenIds = new Map<string, string>();
	const seenPaths = new Set<string>();
	const seenLowerPaths = new Set<string>();
	const entries: AssetManifestEntry[] = [];

	for (const fullPath of svgFiles) {
		const relativePath = slashPath(relative(assetDir, fullPath));
		const lowerPath = relativePath.toLowerCase();

		if (seenLowerPaths.has(lowerPath)) {
			throw codedError(
				'ASSET_MANIFEST_PATH_COLLISION',
				`Case-only path collision for "${relativePath}"`
			);
		}
		seenLowerPaths.add(lowerPath);

		const stats = await lstat(fullPath);
		if (stats.size > MAX_SVG_SIZE) {
			throw codedError(
				'ASSET_MANIFEST_OVERSIZED',
				`SVG file "${relativePath}" exceeds 512KB limit`
			);
		}

		const id = deriveId(relativePath);
		if (RESERVED_IDS.has(id)) {
			throw codedError(
				'ASSET_MANIFEST_RESERVED_ID',
				`Reserved asset id "${id}" from "${relativePath}"`
			);
		}
		if (seenIds.has(id)) {
			const otherPath = seenIds.get(id) ?? '';
			throw codedError(
				'ASSET_MANIFEST_ID_COLLISION',
				`Duplicate asset id "${id}" from "${relativePath}" and "${otherPath}"`
			);
		}
		seenIds.set(id, relativePath);

		const bytes = await readFile(fullPath);
		const content = Buffer.from(bytes).toString('utf-8');
		checkSvgSafety(relativePath, content);

		const { group, name } = deriveGroupAndName(relativePath);
		const meta = metadata[relativePath];
		const entry: AssetManifestEntry = {
			id,
			path: relativePath,
			group,
			name,
			digest: `sha256:${sha256Hex(bytes)}`
		};

		if (meta?.label !== undefined) entry.label = meta.label;
		if (meta?.anchor !== undefined) entry.anchor = meta.anchor;
		if (meta?.tags !== undefined) entry.tags = meta.tags;

		entries.push(entry);
		seenPaths.add(relativePath);
	}

	for (const metaPath of Object.keys(metadata)) {
		if (!seenPaths.has(metaPath)) {
			throw codedError(
				'ASSET_MANIFEST_METADATA_ORPHAN',
				`Unknown metadata path "${metaPath}"`
			);
		}
	}

	entries.sort((a, b) => {
		if (a.group !== b.group) return a.group.localeCompare(b.group);
		if (a.name !== b.name) return a.name.localeCompare(b.name);
		return a.path.localeCompare(b.path);
	});

	return {
		format: 'isostate.asset-manifest',
		version: 1,
		generatedAt: new Date().toISOString(),
		assetBaseUrl: args.assetBaseUrl,
		assets: entries
	};
}

async function scanSvgFiles(dir: string): Promise<string[]> {
	const results: string[] = [];
	const entries = await readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.name.startsWith('.')) continue;
		const fullPath = join(dir, entry.name);
		const stats = await lstat(fullPath);
		if (stats.isSymbolicLink()) continue;
		if (stats.isDirectory()) {
			results.push(...(await scanSvgFiles(fullPath)));
		} else if (stats.isFile() && entry.name.toLowerCase().endsWith('.svg')) {
			results.push(fullPath);
		}
	}
	return results;
}

async function readMetadata(
	args: AssetManifestArgs,
	assetDir: string
): Promise<Record<string, MetadataEntry>> {
	const metaPath = args.metadataPath ?? join(assetDir, '.isostate-assets.yaml');

	try {
		const stats = await lstat(metaPath);
		if (!stats.isFile()) return {};
	} catch (error) {
		if (isMissingPathError(error)) return {};
		throw wrapFsError(
			'FILE_READ_FAILED',
			`Unable to read metadata ${metaPath}`,
			error
		);
	}

	const content = await readFile(metaPath, 'utf8');
	let parsed: unknown;
	try {
		parsed = parseYaml(content);
	} catch (error) {
		throw codedError(
			'ASSET_MANIFEST_INVALID_METADATA',
			`Unable to parse metadata file: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}

	if (!parsed || typeof parsed !== 'object' || !('assets' in parsed)) {
		return {};
	}

	const rawAssets = (parsed as Record<string, unknown>).assets;
	if (!rawAssets || typeof rawAssets !== 'object') {
		return {};
	}

	const result: Record<string, MetadataEntry> = {};
	for (const [path, entry] of Object.entries(rawAssets)) {
		if (!entry || typeof entry !== 'object') continue;
		const validated = validateMetadataEntry(
			path,
			entry as Record<string, unknown>
		);
		result[path] = validated;
	}

	return result;
}

function validateMetadataEntry(
	path: string,
	entry: Record<string, unknown>
): MetadataEntry {
	const result: MetadataEntry = {};

	if ('label' in entry) {
		const label = entry.label;
		if (typeof label !== 'string' || label.length === 0 || label.length > 80) {
			throw codedError(
				'ASSET_MANIFEST_INVALID_METADATA',
				`Metadata label for "${path}" must be a non-empty string at most 80 characters`
			);
		}
		result.label = label;
	}

	if ('anchor' in entry) {
		const anchor = entry.anchor;
		if (
			!Array.isArray(anchor) ||
			anchor.length !== 2 ||
			!anchor.every(
				(v): v is number =>
					typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1
			)
		) {
			throw codedError(
				'ASSET_MANIFEST_INVALID_METADATA',
				`Metadata anchor for "${path}" must be a [0..1] tuple`
			);
		}
		result.anchor = anchor as [number, number];
	}

	if ('tags' in entry) {
		const tags = entry.tags;
		if (
			!Array.isArray(tags) ||
			!tags.every(
				(t): t is string => typeof t === 'string' && IDENTIFIER_PATTERN.test(t)
			)
		) {
			throw codedError(
				'ASSET_MANIFEST_INVALID_METADATA',
				`Metadata tags for "${path}" must be unique kebab-case strings`
			);
		}
		if (new Set(tags).size !== tags.length) {
			throw codedError(
				'ASSET_MANIFEST_INVALID_METADATA',
				`Metadata tags for "${path}" must be unique`
			);
		}
		result.tags = tags;
	}

	return result;
}

function checkSvgSafety(path: string, content: string): void {
	if (/<\s*script\b/i.test(content) || /<\/\s*script\s*>/i.test(content)) {
		throw codedError(
			'ASSET_MANIFEST_UNSAFE_SVG',
			`SVG file "${path}" contains script elements`
		);
	}

	const eventHandlerPattern =
		/\s(on(?:click|dblclick|mousedown|mouseup|mouseover|mousemove|mouseout|keydown|keypress|keyup|focus|blur|change|submit|reset|select|load|unload|error|resize|scroll|focusin|focusout|contextmenu|mouseenter|mouseleave|wheel|animationstart|animationend|animationiteration|transitionstart|transitionend|transitionrun|abort|beforeinput|beforeunload|hashchange|input|invalid|pageshow|pagehide|popstate|readystatechange|storage|toggle|beforeprint|afterprint|canplay|canplaythrough|durationchange|emptied|ended|loadeddata|loadedmetadata|loadstart|pause|play|playing|progress|ratechange|seeked|seeking|stalled|suspend|timeupdate|volumechange|waiting|copy|cut|paste|drag|dragend|dragenter|dragleave|dragover|dragstart|drop|touchstart|touchmove|touchend|touchcancel))\s*=/i;
	if (eventHandlerPattern.test(content)) {
		throw codedError(
			'ASSET_MANIFEST_UNSAFE_SVG',
			`SVG file "${path}" contains event handler attributes`
		);
	}

	const externalHrefPattern =
		/\s(?:href|xlink:href)\s*=\s*["'](?!#|data:)[^"']+["']/gi;
	if (externalHrefPattern.test(content)) {
		throw codedError(
			'ASSET_MANIFEST_EXTERNAL_REFERENCE',
			`SVG file "${path}" contains external references`
		);
	}

	const externalUrlPattern = /url\s*\(\s*["']?(?!#|data:)[^"')]+["']?\)/gi;
	if (externalUrlPattern.test(content)) {
		throw codedError(
			'ASSET_MANIFEST_EXTERNAL_REFERENCE',
			`SVG file "${path}" contains external references`
		);
	}
}

function deriveId(relativePath: string): string {
	const normalized = normalizePathSegments(relativePath);
	return normalized.join('-');
}

function deriveGroupAndName(relativePath: string): {
	group: string;
	name: string;
} {
	const normalized = normalizePathSegments(relativePath);
	const group = normalized.length > 1 ? normalized[0] : 'ungrouped';
	const name = normalized[normalized.length - 1];
	return { group, name };
}

function normalizePathSegments(relativePath: string): string[] {
	const withoutExt = relativePath.toLowerCase().endsWith('.svg')
		? relativePath.slice(0, -4)
		: relativePath;
	const segments = withoutExt.split('/');
	const normalized = segments.map(normalizeIdentifier);
	if (normalized.some((s) => s === '')) {
		throw codedError(
			'ASSET_MANIFEST_INVALID_FILENAME',
			`Invalid filename in path "${relativePath}"`
		);
	}
	return normalized;
}

function normalizeIdentifier(input: string): string {
	const ascii = input
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-zA-Z0-9]/g, '-');
	const collapsed = ascii
		.toLowerCase()
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
	return collapsed;
}

function codedError(code: string, message: string): Error {
	const error = new Error(message);
	Object.defineProperty(error, 'code', { value: code, enumerable: true });
	return error;
}

function wrapFsError(code: string, message: string, cause: unknown): Error {
	const error = new Error(message);
	Object.defineProperty(error, 'code', { value: code, enumerable: true });
	Object.defineProperty(error, 'cause', { value: cause });
	return error;
}

function slashPath(path: string): string {
	return path.split(sep).join('/');
}

function isMissingPathError(error: unknown): boolean {
	return (
		error instanceof Error &&
		'code' in error &&
		(error as NodeJS.ErrnoException).code === 'ENOENT'
	);
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
