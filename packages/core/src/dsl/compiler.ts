import type {
	CompiledAsset,
	CompiledFloor,
	CompiledLayer,
	CompiledSprite,
	LayerDefinition,
	ResolvedLayoutConfig,
	RuntimeBundle,
	RuntimeSceneStop,
	SceneDocument,
} from "../types/index.ts";
import { ValidationErrorClass } from "../types/index.ts";
import type { SpriteDefinition } from "../types/scene.ts";
import { sha256 } from "../utils/sha256.ts";
import { resolveSceneSnapshots } from "./scene-validator.ts";

export interface CompileOptions {
	minify?: boolean;
	version?: string;
}

const DEFAULT_VERSION = "0.4.0";
const RUNTIME_BUNDLE_FORMAT = "isostate-runtime-bundle";
const BUILT_IN_TEXT_ASSET_ID = "text";
const BUILT_IN_PRIMITIVE_ASSET_IDS = new Set(["rectangle", "circle", "polygon", "line"]);

export function compileScene(document: SceneDocument, options: CompileOptions = {}): RuntimeBundle {
	const { version = DEFAULT_VERSION } = options;
	const scenes = resolveSceneSnapshots(document).map((scene) => normalizeValue(scene)) as RuntimeSceneStop[];

	const bundleWithoutDigest: Omit<RuntimeBundle, "_digest"> = {
		_format: RUNTIME_BUNDLE_FORMAT,
		_version: version,
		grid: { cellSize: document.header.grid?.cellSize ?? 64 },
		floor: compileFloor(document, scenes),
		layout: compileLayout(),
		theme: document.header.theme ?? "light",
		layers: compileLayers(document.header.layers),
		scenes,
	};

	if (document.header.className) {
		bundleWithoutDigest.className = document.header.className;
	}

	const assets = compileExternalAssets(document, scenes);
	if (Object.keys(assets).length > 0) {
		bundleWithoutDigest.assets = assets;
	}

	return {
		...bundleWithoutDigest,
		_digest: digestBundle(bundleWithoutDigest),
	};
}

function compileExternalAssets(document: SceneDocument, scenes: RuntimeSceneStop[]): Record<string, CompiledAsset> {
	const assets: Record<string, CompiledAsset> = {};
	for (const name of uniqueReferencedAssetNames(document, scenes)) {
		const sprite = resolveSpriteAsset(document, name);
		if (sprite) {
			const url = resolveAssetUrl(document, sprite.sheet.id);
			if (!url) {
				throw new ValidationErrorClass(
					"ASSET_URL_REQUIRED",
					`Sprite sheet "${sprite.sheet.id}" must resolve through header.assetBaseUrl`,
					{
						asset: sprite.sheet.id,
					},
				);
			}
			assets[name] = normalizeValue({
				url,
				sprite: sprite.compiled,
				anchor: sprite.anchor,
			});
			continue;
		}
		const url = resolveAssetUrl(document, name);
		if (!url) {
			throw new ValidationErrorClass("ASSET_URL_REQUIRED", `Asset "${name}" must resolve through header.assetBaseUrl`, {
				asset: name,
			});
		}
		const entry = document.header.assets.find((asset) => asset.id === name);
		assets[name] = normalizeValue({
			url,
			...(entry?.anchor ? { anchor: entry.anchor } : {}),
		});
	}
	return assets;
}

export function toJs(bundle: RuntimeBundle, options: { minify?: boolean } = {}): string {
	const { minify = true } = options;
	const json = canonicalStringify(bundle, minify ? undefined : 2);
	return `export default ${json};`;
}

export function toJson(bundle: RuntimeBundle): string {
	return canonicalStringify(bundle, 2);
}

export function fromJs(moduleString: string): RuntimeBundle {
	if (!moduleString.startsWith("export default ") || !moduleString.endsWith(";")) {
		throw new ValidationErrorClass("INVALID_RUNTIME_BUNDLE_MODULE", "Invalid JS module: expected exact default export");
	}

	const jsonString = moduleString.slice("export default ".length, -1);
	const bundle = parseRuntimeBundleJson(jsonString, "INVALID_RUNTIME_BUNDLE_MODULE");
	const minify = !jsonString.includes("\n");
	if (moduleString !== toJs(bundle, { minify })) {
		throw new ValidationErrorClass("INVALID_RUNTIME_BUNDLE_MODULE", "Invalid JS module: non-canonical bundle export");
	}

	return bundle;
}

export function fromJson(jsonString: string): RuntimeBundle {
	const bundle = parseRuntimeBundleJson(jsonString, "INVALID_RUNTIME_BUNDLE_JSON");
	if (jsonString !== toJson(bundle)) {
		throw new ValidationErrorClass("INVALID_RUNTIME_BUNDLE_JSON", "Invalid JSON bundle: non-canonical serialization");
	}

	return bundle;
}

function parseRuntimeBundleJson(
	jsonString: string,
	code: "INVALID_RUNTIME_BUNDLE_MODULE" | "INVALID_RUNTIME_BUNDLE_JSON",
): RuntimeBundle {
	try {
		return JSON.parse(jsonString) as RuntimeBundle;
	} catch {
		throw new ValidationErrorClass(code, "Invalid runtime bundle: expected valid JSON");
	}
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function compileFloor(document: SceneDocument, scenes: RuntimeSceneStop[]): CompiledFloor {
	const floor = document.header.floor ?? {};
	const origin = floor.origin ?? [0, 0];
	const compiled: CompiledFloor = {
		size: floor.size ?? deriveFloorSize(scenes, origin),
		origin,
		visible: floor.visible ?? true,
		layer: floor.layer ?? defaultFloorLayer(document),
	};
	if (floor.asset !== undefined) {
		compiled.asset = floor.asset;
	}
	return normalizeValue(compiled);
}

function deriveFloorSize(scenes: RuntimeSceneStop[], origin: [number, number]): [number, number] {
	let maxX = origin[0] + 1;
	let maxY = origin[1] + 1;
	for (const scene of scenes) {
		for (const element of scene.elements) {
			if (element.presence === "removed") continue;
			maxX = Math.max(maxX, element.pos[0] + element.size);
			maxY = Math.max(maxY, element.pos[1] + element.size);
		}
		for (const connector of scene.connectors) {
			if (connector.presence === "removed") continue;
			for (const point of connector.route) {
				maxX = Math.max(maxX, point[0]);
				maxY = Math.max(maxY, point[1]);
			}
		}
	}
	return [Math.max(1, Math.ceil(maxX - origin[0])), Math.max(1, Math.ceil(maxY - origin[1]))];
}

function compileLayout(): ResolvedLayoutConfig {
	return normalizeValue({
		fit: "contain",
		align: [0.5, 0.5],
		padding: { x: 64, y: 64 },
		bounds: "union",
	});
}

function compileLayers(layers: LayerDefinition[]): CompiledLayer[] {
	return layers
		.map((layer, index) => ({
			name: layer.name,
			order: layer.order ?? index,
		}))
		.sort((a, b) => a.order - b.order || compareCodePointOrder(a.name, b.name));
}

/** Locale-independent string comparator so tie-break order is byte-deterministic across hosts. */
function compareCodePointOrder(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

function resolveAssetUrl(document: SceneDocument, assetId: string): string | undefined {
	const base = document.header.assetBaseUrl;
	const entry = document.header.assets.find((asset) => asset.id === assetId);
	if (!base || !entry) return undefined;

	const path = entry.path ?? entry.id;
	const file = "type" in entry && entry.type === "sprite-sheet" ? path : path.endsWith(".svg") ? path : `${path}.svg`;
	return `${base.replace(/\/+$/, "")}/${file.replace(/^\/+/, "")}`;
}

function resolveSpriteAsset(
	document: SceneDocument,
	spriteId: string,
):
	| {
			sheet: Extract<SceneDocument["header"]["assets"][number], { type: "sprite-sheet" }>;
			compiled: CompiledSprite;
			anchor: [number, number];
	  }
	| undefined {
	for (const asset of document.header.assets) {
		if (!("type" in asset) || asset.type !== "sprite-sheet") continue;
		const definition = asset.sprites[spriteId];
		if (!definition) continue;
		const rect = compileSpriteRect(definition, asset.tileSize);
		if (!rect) {
			throw new ValidationErrorClass("INVALID_SPRITE_DEFINITION", `Sprite "${spriteId}" cannot be compiled`, {
				asset: spriteId,
			});
		}
		const anchor = !Array.isArray(definition) && definition.anchor ? definition.anchor : (asset.anchor ?? [0.5, 1]);
		return {
			sheet: asset,
			compiled: {
				sheetSize: asset.sheetSize,
				rect,
			},
			anchor,
		};
	}
	return undefined;
}

function compileSpriteRect(
	sprite: SpriteDefinition,
	tileSize: [number, number] | undefined,
): [number, number, number, number] | undefined {
	if (Array.isArray(sprite)) {
		if (!tileSize) return undefined;
		return [sprite[0] * tileSize[0], sprite[1] * tileSize[1], tileSize[0], tileSize[1]];
	}
	if (sprite.rect) return sprite.rect;
	if (sprite.at && tileSize) {
		return [sprite.at[0] * tileSize[0], sprite.at[1] * tileSize[1], tileSize[0], tileSize[1]];
	}
	return undefined;
}

function uniqueReferencedAssetNames(document: SceneDocument, scenes: RuntimeSceneStop[]): string[] {
	const names = new Set<string>();
	if (document.header.floor?.asset && document.header.floor.visible !== false) {
		names.add(document.header.floor.asset);
	}
	for (const scene of scenes) {
		for (const element of scene.elements) {
			if (!isBuiltInGeneratedAsset(element.asset)) {
				names.add(element.asset);
			}
		}
	}
	return Array.from(names).sort();
}

function isBuiltInGeneratedAsset(assetId: string): boolean {
	return assetId === BUILT_IN_TEXT_ASSET_ID || BUILT_IN_PRIMITIVE_ASSET_IDS.has(assetId);
}

function defaultFloorLayer(document: SceneDocument): string {
	const ground = document.header.layers.find((layer) => layer.name === "ground");
	return ground?.name ?? document.header.layers[0]?.name ?? "";
}

function digestBundle(bundle: Omit<RuntimeBundle, "_digest">): string {
	return sha256(canonicalStringify(bundle));
}

function canonicalStringify(value: unknown, space?: number): string {
	const normalized = normalizeValue(value);
	return JSON.stringify(normalized, null, space);
}

function normalizeValue<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((item) => (item === undefined ? null : normalizeValue(item))) as T;
	}

	if (!isPlainObject(value)) return value;

	const normalized: Record<string, JsonValue> = {};
	for (const key of Object.keys(value).sort()) {
		const child = (value as Record<string, unknown>)[key];
		if (child !== undefined) {
			normalized[key] = normalizeValue(child) as JsonValue;
		}
	}

	return normalized as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
