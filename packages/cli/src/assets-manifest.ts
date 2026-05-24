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
const MAX_SPRITE_SHEET_SIZE = 2 * 1024 * 1024;
const SPRITE_SHEET_EXTENSIONS = new Set([
	'.png',
	'.webp',
	'.jpg',
	'.jpeg',
	'.svg'
]);
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

interface UrlAssetManifestEntry {
	id: string;
	type?: 'url';
	path: string;
	group: string;
	name: string;
	label?: string;
	anchor?: [number, number];
	tags?: string[];
	digest: string;
}

type SpriteManifestDefinition =
	| [number, number]
	| {
			at?: [number, number];
			rect?: [number, number, number, number];
			anchor?: [number, number];
			label?: string;
			tags?: string[];
	  };

interface SpriteSheetManifestEntry extends Omit<UrlAssetManifestEntry, 'type'> {
	type: 'sprite-sheet';
	sheetSize: [number, number];
	tileSize?: [number, number];
	sprites: Record<string, SpriteManifestDefinition>;
}

type AssetManifestEntry = UrlAssetManifestEntry | SpriteSheetManifestEntry;

interface AssetManifest {
	format: 'isostate.asset-manifest';
	version: 1;
	generatedAt: string;
	assetBaseUrl: string;
	assets: AssetManifestEntry[];
}

interface MetadataEntry {
	type?: 'sprite-sheet';
	label?: string;
	anchor?: [number, number];
	tags?: string[];
	sheetSize?: [number, number];
	tileSize?: [number, number];
	sprites?: Record<string, SpriteManifestDefinition>;
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
	const assetFiles = await scanAssetFiles(assetDir);
	const metadata = await readMetadata(args, assetDir);
	const seenIds = new Map<string, string>();
	const seenPaths = new Set<string>();
	const seenLowerPaths = new Set<string>();
	const entries: AssetManifestEntry[] = [];

	for (const fullPath of assetFiles) {
		const relativePath = slashPath(relative(assetDir, fullPath));
		const lowerPath = relativePath.toLowerCase();
		const extension = extensionOf(relativePath);
		const meta = metadata[relativePath];
		const isSpriteSheet = meta?.type === 'sprite-sheet';

		if (seenLowerPaths.has(lowerPath)) {
			throw codedError(
				'ASSET_MANIFEST_PATH_COLLISION',
				`Case-only path collision for "${relativePath}"`
			);
		}
		seenLowerPaths.add(lowerPath);

		const stats = await lstat(fullPath);
		if (extension === '.svg' && stats.size > MAX_SVG_SIZE) {
			throw codedError(
				'ASSET_MANIFEST_OVERSIZED',
				`SVG file "${relativePath}" exceeds 512KB limit`
			);
		}
		if (
			isSpriteSheet &&
			extension !== '.svg' &&
			stats.size > MAX_SPRITE_SHEET_SIZE
		) {
			throw codedError(
				'ASSET_MANIFEST_OVERSIZED',
				`Sprite sheet "${relativePath}" exceeds 2MB limit`
			);
		}
		if (extension !== '.svg' && !isSpriteSheet) {
			throw codedError(
				'ASSET_MANIFEST_INVALID_METADATA',
				`Raster asset "${relativePath}" must be declared as a sprite-sheet in metadata`
			);
		}
		if (isSpriteSheet && !SPRITE_SHEET_EXTENSIONS.has(extension)) {
			throw codedError(
				'ASSET_MANIFEST_INVALID_METADATA',
				`Sprite sheet "${relativePath}" must use .png, .webp, .jpg, .jpeg, or .svg`
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
		if (extension === '.svg') {
			const content = Buffer.from(bytes).toString('utf-8');
			checkSvgSafety(relativePath, content);
		}

		const { group, name } = deriveGroupAndName(relativePath);
		const common = {
			id,
			path: relativePath,
			group,
			name,
			digest: `sha256:${sha256Hex(bytes)}`
		};

		const entry: AssetManifestEntry = isSpriteSheet
			? await createSpriteSheetEntry(common, meta, relativePath, bytes, seenIds)
			: common;

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

async function scanAssetFiles(dir: string): Promise<string[]> {
	const results: string[] = [];
	const entries = await readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.name.startsWith('.')) continue;
		const fullPath = join(dir, entry.name);
		const stats = await lstat(fullPath);
		if (stats.isSymbolicLink()) continue;
		if (stats.isDirectory()) {
			results.push(...(await scanAssetFiles(fullPath)));
		} else if (stats.isFile() && isManifestAssetFile(entry.name)) {
			results.push(fullPath);
		}
	}
	return results;
}

function isManifestAssetFile(path: string): boolean {
	const extension = extensionOf(path);
	return extension === '.svg' || SPRITE_SHEET_EXTENSIONS.has(extension);
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

async function createSpriteSheetEntry(
	common: Omit<SpriteSheetManifestEntry, 'type' | 'sheetSize' | 'sprites'>,
	meta: MetadataEntry,
	relativePath: string,
	bytes: Buffer,
	seenIds: Map<string, string>
): Promise<SpriteSheetManifestEntry> {
	if (!meta.sprites || Object.keys(meta.sprites).length === 0) {
		throw codedError(
			'ASSET_MANIFEST_INVALID_METADATA',
			`Sprite sheet "${relativePath}" must declare at least one sprite`
		);
	}

	const sheetSize =
		meta.sheetSize ?? (await readImageSize(relativePath, bytes));
	if (!isPositiveIntegerTuple(sheetSize)) {
		throw codedError(
			'ASSET_MANIFEST_INVALID_METADATA',
			`Sprite sheet "${relativePath}" must declare a valid sheetSize`
		);
	}
	if (meta.tileSize && !isPositiveIntegerTuple(meta.tileSize)) {
		throw codedError(
			'ASSET_MANIFEST_INVALID_METADATA',
			`Sprite sheet "${relativePath}" must declare a valid tileSize`
		);
	}

	const sprites: Record<string, SpriteManifestDefinition> = {};
	for (const [spriteId, sprite] of Object.entries(meta.sprites)) {
		if (!IDENTIFIER_PATTERN.test(spriteId) || RESERVED_IDS.has(spriteId)) {
			throw codedError(
				'ASSET_MANIFEST_INVALID_METADATA',
				`Invalid sprite id "${spriteId}" in "${relativePath}"`
			);
		}
		if (seenIds.has(spriteId)) {
			throw codedError(
				'ASSET_MANIFEST_ID_COLLISION',
				`Sprite id "${spriteId}" from "${relativePath}" collides with "${seenIds.get(spriteId)}"`
			);
		}
		const validated = validateSpriteDefinition(
			relativePath,
			spriteId,
			sprite,
			sheetSize,
			meta.tileSize
		);
		seenIds.set(spriteId, relativePath);
		sprites[spriteId] = validated;
	}

	const entry: SpriteSheetManifestEntry = {
		...common,
		type: 'sprite-sheet',
		sheetSize,
		sprites
	};
	if (meta.tileSize) entry.tileSize = meta.tileSize;
	return entry;
}

function validateMetadataEntry(
	path: string,
	entry: Record<string, unknown>
): MetadataEntry {
	const result: MetadataEntry = {};

	if ('type' in entry) {
		if (entry.type !== 'sprite-sheet') {
			throw codedError(
				'ASSET_MANIFEST_INVALID_METADATA',
				`Metadata type for "${path}" must be "sprite-sheet"`
			);
		}
		result.type = 'sprite-sheet';
	}

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

	if ('sheetSize' in entry) {
		result.sheetSize = validateTuple2(path, 'sheetSize', entry.sheetSize);
	}
	if ('tileSize' in entry) {
		result.tileSize = validateTuple2(path, 'tileSize', entry.tileSize);
	}
	if ('sprites' in entry) {
		const sprites = entry.sprites;
		if (!sprites || typeof sprites !== 'object' || Array.isArray(sprites)) {
			throw codedError(
				'ASSET_MANIFEST_INVALID_METADATA',
				`Metadata sprites for "${path}" must be an object`
			);
		}
		result.sprites = {};
		for (const [id, sprite] of Object.entries(sprites)) {
			result.sprites[id] = parseSpriteMetadata(path, id, sprite);
		}
	}

	return result;
}

function parseSpriteMetadata(
	path: string,
	id: string,
	value: unknown
): SpriteManifestDefinition {
	if (Array.isArray(value)) {
		return validateTuple2(path, `sprite ${id}`, value);
	}
	if (!value || typeof value !== 'object') {
		throw codedError(
			'ASSET_MANIFEST_INVALID_METADATA',
			`Sprite "${id}" in "${path}" must be a tuple or object`
		);
	}
	const raw = value as Record<string, unknown>;
	const allowed = new Set(['at', 'rect', 'anchor', 'label', 'tags']);
	for (const key of Object.keys(raw)) {
		if (!allowed.has(key)) {
			throw codedError(
				'ASSET_MANIFEST_INVALID_METADATA',
				`Unknown sprite metadata field "${key}" for "${id}" in "${path}"`
			);
		}
	}
	const result: Exclude<SpriteManifestDefinition, [number, number]> = {};
	if ('at' in raw) result.at = validateTuple2(path, `sprite ${id}.at`, raw.at);
	if ('rect' in raw)
		result.rect = validateTuple4(path, `sprite ${id}.rect`, raw.rect);
	if ('anchor' in raw)
		result.anchor = validateAnchor(path, `sprite ${id}.anchor`, raw.anchor);
	if ('label' in raw) {
		if (
			typeof raw.label !== 'string' ||
			raw.label.length === 0 ||
			raw.label.length > 80
		) {
			throw codedError(
				'ASSET_MANIFEST_INVALID_METADATA',
				`Sprite label for "${id}" in "${path}" must be a non-empty string at most 80 characters`
			);
		}
		result.label = raw.label;
	}
	if ('tags' in raw)
		result.tags = validateTags(path, `sprite ${id}.tags`, raw.tags);
	return result;
}

function validateSpriteDefinition(
	path: string,
	id: string,
	sprite: SpriteManifestDefinition,
	sheetSize: [number, number],
	tileSize: [number, number] | undefined
): SpriteManifestDefinition {
	if (Array.isArray(sprite)) {
		if (!tileSize) {
			throw codedError(
				'ASSET_MANIFEST_INVALID_METADATA',
				`Sprite "${id}" in "${path}" uses grid coordinates without tileSize`
			);
		}
		assertSpriteRect(
			path,
			id,
			[
				sprite[0] * tileSize[0],
				sprite[1] * tileSize[1],
				tileSize[0],
				tileSize[1]
			],
			sheetSize
		);
		return sprite;
	}
	const hasAt = sprite.at !== undefined;
	const hasRect = sprite.rect !== undefined;
	if (hasAt === hasRect) {
		throw codedError(
			'ASSET_MANIFEST_INVALID_METADATA',
			`Sprite "${id}" in "${path}" must declare exactly one of at or rect`
		);
	}
	if (sprite.at) {
		if (!tileSize) {
			throw codedError(
				'ASSET_MANIFEST_INVALID_METADATA',
				`Sprite "${id}" in "${path}" uses grid coordinates without tileSize`
			);
		}
		assertSpriteRect(
			path,
			id,
			[
				sprite.at[0] * tileSize[0],
				sprite.at[1] * tileSize[1],
				tileSize[0],
				tileSize[1]
			],
			sheetSize
		);
	}
	if (sprite.rect) assertSpriteRect(path, id, sprite.rect, sheetSize);
	return sprite;
}

function assertSpriteRect(
	path: string,
	id: string,
	rect: [number, number, number, number],
	sheetSize: [number, number]
): void {
	const [x, y, width, height] = rect;
	if (
		x < 0 ||
		y < 0 ||
		width <= 0 ||
		height <= 0 ||
		x + width > sheetSize[0] ||
		y + height > sheetSize[1]
	) {
		throw codedError(
			'ASSET_MANIFEST_INVALID_METADATA',
			`Sprite "${id}" in "${path}" must stay inside sheetSize`
		);
	}
}

function validateTuple2(
	path: string,
	field: string,
	value: unknown
): [number, number] {
	if (
		!Array.isArray(value) ||
		value.length !== 2 ||
		!value.every((v): v is number => Number.isInteger(v) && v >= 0)
	) {
		throw codedError(
			'ASSET_MANIFEST_INVALID_METADATA',
			`Metadata ${field} for "${path}" must be a non-negative integer tuple`
		);
	}
	return value as [number, number];
}

function validateTuple4(
	path: string,
	field: string,
	value: unknown
): [number, number, number, number] {
	if (
		!Array.isArray(value) ||
		value.length !== 4 ||
		!value.every((v): v is number => Number.isInteger(v) && v >= 0) ||
		value[2] <= 0 ||
		value[3] <= 0
	) {
		throw codedError(
			'ASSET_MANIFEST_INVALID_METADATA',
			`Metadata ${field} for "${path}" must be a non-negative integer rect with positive size`
		);
	}
	return value as [number, number, number, number];
}

function validateAnchor(
	path: string,
	field: string,
	value: unknown
): [number, number] {
	if (
		!Array.isArray(value) ||
		value.length !== 2 ||
		!value.every(
			(v): v is number =>
				typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1
		)
	) {
		throw codedError(
			'ASSET_MANIFEST_INVALID_METADATA',
			`Metadata ${field} for "${path}" must be a [0..1] tuple`
		);
	}
	return value as [number, number];
}

function validateTags(path: string, field: string, value: unknown): string[] {
	if (
		!Array.isArray(value) ||
		!value.every(
			(t): t is string => typeof t === 'string' && IDENTIFIER_PATTERN.test(t)
		)
	) {
		throw codedError(
			'ASSET_MANIFEST_INVALID_METADATA',
			`Metadata ${field} for "${path}" must be unique kebab-case strings`
		);
	}
	if (new Set(value).size !== value.length) {
		throw codedError(
			'ASSET_MANIFEST_INVALID_METADATA',
			`Metadata ${field} for "${path}" must be unique`
		);
	}
	return value;
}

function isPositiveIntegerTuple(value: unknown): value is [number, number] {
	return (
		Array.isArray(value) &&
		value.length === 2 &&
		value.every((v) => Number.isInteger(v) && v > 0)
	);
}

async function readImageSize(
	path: string,
	bytes: Buffer
): Promise<[number, number]> {
	const extension = extensionOf(path);
	if (extension === '.png') return readPngSize(path, bytes);
	if (extension === '.jpg' || extension === '.jpeg')
		return readJpegSize(path, bytes);
	if (extension === '.webp') return readWebpSize(path, bytes);
	if (extension === '.svg') return readSvgSize(path, bytes.toString('utf8'));
	throw codedError(
		'ASSET_MANIFEST_INVALID_METADATA',
		`Unsupported sprite sheet extension for "${path}"`
	);
}

function readPngSize(path: string, bytes: Buffer): [number, number] {
	if (bytes.length < 24 || bytes.toString('ascii', 1, 4) !== 'PNG') {
		throw codedError(
			'ASSET_MANIFEST_INVALID_METADATA',
			`Unable to read PNG dimensions for "${path}"`
		);
	}
	return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

function readJpegSize(path: string, bytes: Buffer): [number, number] {
	let offset = 2;
	while (offset + 9 < bytes.length) {
		if (bytes[offset] !== 0xff) break;
		const marker = bytes[offset + 1];
		const length = bytes.readUInt16BE(offset + 2);
		if (
			marker >= 0xc0 &&
			marker <= 0xcf &&
			![0xc4, 0xc8, 0xcc].includes(marker)
		) {
			return [bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5)];
		}
		offset += 2 + length;
	}
	throw codedError(
		'ASSET_MANIFEST_INVALID_METADATA',
		`Unable to read JPEG dimensions for "${path}"`
	);
}

function readWebpSize(path: string, bytes: Buffer): [number, number] {
	if (
		bytes.toString('ascii', 0, 4) !== 'RIFF' ||
		bytes.toString('ascii', 8, 12) !== 'WEBP'
	) {
		throw codedError(
			'ASSET_MANIFEST_INVALID_METADATA',
			`Unable to read WebP dimensions for "${path}"`
		);
	}
	const chunk = bytes.toString('ascii', 12, 16);
	if (chunk === 'VP8X' && bytes.length >= 30) {
		return [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)];
	}
	if (chunk === 'VP8L' && bytes.length >= 25) {
		const b0 = bytes[21];
		const b1 = bytes[22];
		const b2 = bytes[23];
		const b3 = bytes[24];
		return [
			1 + (((b1 & 0x3f) << 8) | b0),
			1 + ((b3 << 6) | (b2 << 2) | ((b1 & 0xc0) >> 6))
		];
	}
	if (chunk === 'VP8 ' && bytes.length >= 30) {
		return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
	}
	throw codedError(
		'ASSET_MANIFEST_INVALID_METADATA',
		`Unable to read WebP dimensions for "${path}"`
	);
}

function readSvgSize(path: string, content: string): [number, number] {
	const width = content.match(/\bwidth=["']([0-9]+(?:\.[0-9]+)?)["']/i)?.[1];
	const height = content.match(/\bheight=["']([0-9]+(?:\.[0-9]+)?)["']/i)?.[1];
	if (width && height)
		return [Math.round(Number(width)), Math.round(Number(height))];
	const viewBox = content.match(
		/\bviewBox=["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["']/i
	);
	if (viewBox)
		return [Math.round(Number(viewBox[1])), Math.round(Number(viewBox[2]))];
	throw codedError(
		'ASSET_MANIFEST_INVALID_METADATA',
		`Unable to read SVG dimensions for "${path}"`
	);
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
	const extension = extensionOf(relativePath);
	const withoutExt = extension
		? relativePath.slice(0, -extension.length)
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

function extensionOf(path: string): string {
	const name = path.toLowerCase();
	const slash = name.lastIndexOf('/');
	const dot = name.lastIndexOf('.');
	return dot > slash ? name.slice(dot) : '';
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
