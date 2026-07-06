import { parse as parseYaml } from "yaml";
import { ParseError } from "../types/errors.ts";
import type {
	AmbientAnimation,
	AssetCatalogEntry,
	CameraFocus,
	ConnectionPatch,
	ConnectionPlacement,
	ConnectionRemoval,
	ConnectorEndpointRef,
	ConnectorRouting,
	ConnectorStyle,
	ElementPatch,
	ElementPlacement,
	ElementRemoval,
	FloorConfig,
	GridConfig,
	LayerDefinition,
	LinePrimitive,
	PrimitiveContent,
	PrimitiveContentPatch,
	SceneDocument,
	SceneHeader,
	SceneStep,
	TextContent,
} from "../types/index.ts";
import type { SpriteDefinition } from "../types/scene.ts";

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ASSET_PATH_PATTERN = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*(?:\.svg)?$/;
const SPRITE_SHEET_PATH_PATTERN = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*\.(?:png|webp|jpe?g|svg)$/;

function fail(code: string, message: string): never {
	throw new ParseError(code, message, { line: 0, column: 0 });
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertKnownFields(obj: Record<string, unknown>, allowed: ReadonlySet<string>, context: string): void {
	for (const field of Object.keys(obj)) {
		if (!allowed.has(field)) {
			fail("UNKNOWN_FIELD", `Unknown field "${field}" in ${context}`);
		}
	}
}

function requireObject(value: unknown, context: string): Record<string, unknown> {
	if (!isObject(value)) {
		fail("DSL_SCHEMA_TYPE_ERROR", `${context} must be a mapping object`);
	}
	return value;
}

function requireArray(value: unknown, context: string): unknown[] {
	if (!Array.isArray(value)) {
		fail("DSL_SCHEMA_TYPE_ERROR", `${context} must be an array`);
	}
	return value;
}

function requireString(value: unknown, context: string): string {
	if (typeof value !== "string") {
		fail("DSL_SCHEMA_TYPE_ERROR", `${context} must be a string`);
	}
	return value;
}

function requireNumber(value: unknown, context: string): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		fail("DSL_SCHEMA_TYPE_ERROR", `${context} must be a finite number`);
	}
	return value;
}

function requireBoolean(value: unknown, context: string): boolean {
	if (typeof value !== "boolean") {
		fail("DSL_SCHEMA_TYPE_ERROR", `${context} must be a boolean`);
	}
	return value;
}

function requireIdentifier(value: unknown, context: string): string {
	const identifier = requireString(value, context);
	if (!IDENTIFIER_PATTERN.test(identifier)) {
		fail("INVALID_IDENTIFIER", `${context} must be kebab-case`);
	}
	return identifier;
}

function parseTuple2(value: unknown, context: string): [number, number] {
	if (!Array.isArray(value) || value.length !== 2) {
		fail("DSL_SCHEMA_TYPE_ERROR", `${context} must be a two-number tuple`);
	}
	return [requireNumber(value[0], `${context}[0]`), requireNumber(value[1], `${context}[1]`)];
}

function parseTuple4(value: unknown, context: string): [number, number, number, number] {
	if (!Array.isArray(value) || value.length !== 4) {
		fail("DSL_SCHEMA_TYPE_ERROR", `${context} must be a four-number tuple`);
	}
	return [
		requireNumber(value[0], `${context}[0]`),
		requireNumber(value[1], `${context}[1]`),
		requireNumber(value[2], `${context}[2]`),
		requireNumber(value[3], `${context}[3]`),
	];
}

function parseSpriteDefinition(value: unknown, context: string): SpriteDefinition {
	if (Array.isArray(value)) {
		return parseTuple2(value, context);
	}
	const sprite = requireObject(value, context);
	assertKnownFields(sprite, new Set(["at", "rect", "anchor"]), context);
	const parsed: {
		at?: [number, number];
		rect?: [number, number, number, number];
		anchor?: [number, number];
	} = {};
	if (sprite.at !== undefined) parsed.at = parseTuple2(sprite.at, `${context}.at`);
	if (sprite.rect !== undefined) parsed.rect = parseTuple4(sprite.rect, `${context}.rect`);
	if (sprite.anchor !== undefined) parsed.anchor = parseTuple2(sprite.anchor, `${context}.anchor`);
	return parsed;
}

function parseAssets(raw: unknown): AssetCatalogEntry[] {
	return requireArray(raw, "header.assets").map((item, index) => {
		const asset = requireObject(item, `header.assets[${index}]`);
		const assetType = asset.type === undefined ? undefined : requireString(asset.type, `header.assets[${index}].type`);
		if (assetType !== undefined && assetType !== "sprite-sheet") {
			fail("ASSET_TYPE_UNSUPPORTED", `Unsupported asset type "${assetType}" in header.assets[${index}]`);
		}
		const id = requireIdentifier(asset.id, `header.assets[${index}].id`);
		if (assetType === "sprite-sheet") {
			assertKnownFields(
				asset,
				new Set(["id", "type", "path", "sheetSize", "tileSize", "anchor", "sprites"]),
				`header.assets[${index}]`,
			);
			const path = requireString(asset.path, `header.assets[${index}].path`);
			if (!SPRITE_SHEET_PATH_PATTERN.test(path)) {
				fail("INVALID_SPRITE_SHEET_PATH", `header.assets[${index}].path must include a supported image extension`);
			}
			const sprites = requireObject(asset.sprites, `header.assets[${index}].sprites`);
			const parsedSprites: Record<string, SpriteDefinition> = {};
			for (const [spriteId, spriteValue] of Object.entries(sprites)) {
				if (!IDENTIFIER_PATTERN.test(spriteId)) {
					fail("INVALID_SPRITE_ID", `Sprite id "${spriteId}" must be kebab-case`);
				}
				parsedSprites[spriteId] = parseSpriteDefinition(spriteValue, `header.assets[${index}].sprites.${spriteId}`);
			}
			const parsed: AssetCatalogEntry = {
				id,
				type: "sprite-sheet",
				path,
				sheetSize: parseTuple2(asset.sheetSize, `header.assets[${index}].sheetSize`),
				sprites: parsedSprites,
			};
			if (asset.tileSize !== undefined)
				parsed.tileSize = parseTuple2(asset.tileSize, `header.assets[${index}].tileSize`);
			if (asset.anchor !== undefined) parsed.anchor = parseTuple2(asset.anchor, `header.assets[${index}].anchor`);
			return parsed;
		}
		assertKnownFields(asset, new Set(["id", "path", "anchor"]), `header.assets[${index}]`);
		const parsed: AssetCatalogEntry = { id };
		if (asset.path !== undefined) {
			const path = requireString(asset.path, `header.assets[${index}].path`);
			if (!ASSET_PATH_PATTERN.test(path)) {
				fail("INVALID_ASSET_PATH", `header.assets[${index}].path must be a relative SVG asset path`);
			}
			parsed.path = path;
		}
		if (asset.anchor !== undefined) {
			parsed.anchor = parseTuple2(asset.anchor, `header.assets[${index}].anchor`);
		}
		return parsed;
	});
}

function parseGrid(raw: unknown): GridConfig | undefined {
	if (raw === undefined) return undefined;
	const grid = requireObject(raw, "header.grid");
	assertKnownFields(grid, new Set(["cellSize"]), "header.grid");
	return {
		cellSize: grid.cellSize === undefined ? undefined : requireNumber(grid.cellSize, "header.grid.cellSize"),
	};
}

function parseFloor(raw: unknown): FloorConfig | undefined {
	if (raw === undefined) return undefined;
	const floor = requireObject(raw, "header.floor");
	assertKnownFields(floor, new Set(["size", "origin", "layer", "visible", "asset"]), "header.floor");
	const parsed: FloorConfig = {};
	if (floor.size !== undefined) {
		parsed.size = parseTuple2(floor.size, "header.floor.size");
	}
	if (floor.origin !== undefined) {
		parsed.origin = parseTuple2(floor.origin, "header.floor.origin");
	}
	if (floor.layer !== undefined) {
		parsed.layer = requireIdentifier(floor.layer, "header.floor.layer");
	}
	if (floor.visible !== undefined) {
		parsed.visible = requireBoolean(floor.visible, "header.floor.visible");
	}
	if (floor.asset !== undefined) {
		parsed.asset = requireIdentifier(floor.asset, "header.floor.asset");
	}
	return parsed;
}

function parseLayers(raw: unknown): LayerDefinition[] {
	return requireArray(raw, "header.layers").map((item, index) => {
		const layer = requireObject(item, `header.layers[${index}]`);
		assertKnownFields(layer, new Set(["name", "order"]), `header.layers[${index}]`);
		const parsed: LayerDefinition = {
			name: requireIdentifier(layer.name, `header.layers[${index}].name`),
		};
		if (layer.order !== undefined) {
			parsed.order = requireNumber(layer.order, `header.layers[${index}].order`);
		}
		return parsed;
	});
}

function parseHeader(raw: unknown): SceneHeader {
	const header = requireObject(raw, "header");
	assertKnownFields(
		header,
		new Set(["version", "name", "className", "assetBaseUrl", "assets", "grid", "floor", "theme", "layers"]),
		"header",
	);

	const parsed: SceneHeader = {
		assets: parseAssets(header.assets),
		layers: parseLayers(header.layers),
	};
	const floor = parseFloor(header.floor);
	if (floor !== undefined) {
		parsed.floor = floor;
	}
	if (header.version !== undefined) {
		parsed.version = requireString(header.version, "header.version");
	}
	if (header.name !== undefined) {
		parsed.name = requireString(header.name, "header.name");
	}
	if (header.className !== undefined) {
		parsed.className = requireString(header.className, "header.className");
	}
	if (header.assetBaseUrl !== undefined) {
		parsed.assetBaseUrl = requireString(header.assetBaseUrl, "header.assetBaseUrl");
	}
	if (header.grid !== undefined) {
		parsed.grid = parseGrid(header.grid);
	}
	if (header.theme !== undefined) {
		parsed.theme = requireString(header.theme, "header.theme");
	}
	return parsed;
}

function parseAmbient(raw: unknown, context: string): AmbientAnimation[] {
	return requireArray(raw, context).map((item, index) => {
		const ambient = requireObject(item, `${context}[${index}]`);
		assertKnownFields(ambient, new Set(["name", "infinite", "iterations"]), `${context}[${index}]`);
		const parsed: AmbientAnimation = {
			name: requireIdentifier(ambient.name, `${context}[${index}].name`),
		};
		if (ambient.infinite !== undefined) {
			parsed.infinite = requireBoolean(ambient.infinite, `${context}[${index}].infinite`);
		}
		if (ambient.iterations !== undefined) {
			parsed.iterations = requireNumber(ambient.iterations, `${context}[${index}].iterations`);
		}
		return parsed;
	});
}

function parsePointArray(raw: unknown, context: string): [number, number][] {
	return requireArray(raw, context).map((point, index) => parseTuple2(point, `${context}[${index}]`));
}

function parseTextContent(raw: unknown, context: string, requireValue = true): TextContent {
	const text = requireObject(raw, context);
	assertKnownFields(
		text,
		new Set(["value", "align", "placement", "fontSize", "fontWeight", "lineHeight", "fill"]),
		context,
	);
	const parsed: Partial<TextContent> = {};
	if (requireValue || text.value !== undefined) {
		parsed.value = requireString(text.value, `${context}.value`);
	}
	if (text.align !== undefined) {
		parsed.align = requireString(text.align, `${context}.align`) as never;
	}
	if (text.placement !== undefined) {
		parsed.placement = requireString(text.placement, `${context}.placement`) as never;
	}
	if (text.fontSize !== undefined) {
		parsed.fontSize = requireNumber(text.fontSize, `${context}.fontSize`);
	}
	if (text.fontWeight !== undefined) {
		if (typeof text.fontWeight === "number") {
			parsed.fontWeight = requireNumber(text.fontWeight, `${context}.fontWeight`);
		} else {
			parsed.fontWeight = requireString(text.fontWeight, `${context}.fontWeight`) as never;
		}
	}
	if (text.lineHeight !== undefined) {
		parsed.lineHeight = requireNumber(text.lineHeight, `${context}.lineHeight`);
	}
	if (text.fill !== undefined) {
		parsed.fill = requireString(text.fill, `${context}.fill`);
	}
	return parsed as TextContent;
}

function parsePrimitiveStyle(
	raw: Record<string, unknown>,
	context: string,
	allowed: string[],
): Record<string, unknown> {
	assertKnownFields(raw, new Set(allowed), context);
	const parsed: Record<string, unknown> = {};
	if (raw.fill !== undefined) parsed.fill = requireString(raw.fill, `${context}.fill`);
	if (raw.stroke !== undefined) parsed.stroke = requireString(raw.stroke, `${context}.stroke`);
	if (raw.strokeWidth !== undefined) {
		parsed.strokeWidth = requireNumber(raw.strokeWidth, `${context}.strokeWidth`);
	}
	if (raw.opacity !== undefined) {
		parsed.opacity = requireNumber(raw.opacity, `${context}.opacity`);
	}
	if (raw.dash !== undefined) parsed.dash = parseTuple2(raw.dash, `${context}.dash`);
	return parsed;
}

function parsePrimitiveContent(raw: unknown, context: string, requireGeometry = true): PrimitiveContent {
	const primitive = requireObject(raw, context);
	assertKnownFields(primitive, new Set(["rectangle", "circle", "polygon", "line"]), context);
	const parsed: PrimitiveContentPatch = {};
	if (primitive.rectangle !== undefined) {
		const rectangle = requireObject(primitive.rectangle, `${context}.rectangle`);
		parsed.rectangle = parsePrimitiveStyle(rectangle, `${context}.rectangle`, [
			"fill",
			"stroke",
			"strokeWidth",
			"opacity",
			"dash",
			"rx",
		]);
		if (rectangle.rx !== undefined) {
			parsed.rectangle.rx = requireNumber(rectangle.rx, `${context}.rectangle.rx`);
		}
	}
	if (primitive.circle !== undefined) {
		parsed.circle = parsePrimitiveStyle(requireObject(primitive.circle, `${context}.circle`), `${context}.circle`, [
			"fill",
			"stroke",
			"strokeWidth",
			"opacity",
			"dash",
		]);
	}
	if (primitive.polygon !== undefined) {
		const polygon = requireObject(primitive.polygon, `${context}.polygon`);
		parsed.polygon = {
			...parsePrimitiveStyle(polygon, `${context}.polygon`, [
				"points",
				"fill",
				"stroke",
				"strokeWidth",
				"opacity",
				"dash",
			]),
		};
		if (requireGeometry || polygon.points !== undefined) {
			parsed.polygon.points = parsePointArray(polygon.points, `${context}.polygon.points`);
		}
	}
	if (primitive.line !== undefined) {
		const line = requireObject(primitive.line, `${context}.line`);
		const parsedLine: Partial<LinePrimitive> = {
			...parsePrimitiveStyle(line, `${context}.line`, [
				"points",
				"stroke",
				"strokeWidth",
				"opacity",
				"dash",
				"lineCap",
				"lineJoin",
			]),
		};
		if (requireGeometry || line.points !== undefined) {
			parsedLine.points = parsePointArray(line.points, `${context}.line.points`);
		}
		if (line.lineCap !== undefined) {
			parsedLine.lineCap = requireString(line.lineCap, `${context}.line.lineCap`) as never;
		}
		if (line.lineJoin !== undefined) {
			parsedLine.lineJoin = requireString(line.lineJoin, `${context}.line.lineJoin`) as never;
		}
		parsed.line = parsedLine as LinePrimitive;
	}
	return parsed as PrimitiveContent;
}

function parsePlacement(raw: unknown, context: string): ElementPlacement {
	const element = requireObject(raw, context);
	assertKnownFields(
		element,
		new Set(["id", "asset", "at", "size", "layer", "enter", "exit", "ambient", "text", "primitive"]),
		context,
	);
	const parsed: ElementPlacement = {
		id: requireIdentifier(element.id, `${context}.id`),
		asset: requireIdentifier(element.asset, `${context}.asset`),
		at: parseTuple2(element.at, `${context}.at`),
	};
	if (element.size !== undefined) {
		parsed.size = requireNumber(element.size, `${context}.size`);
	}
	if (element.layer !== undefined) {
		parsed.layer = requireIdentifier(element.layer, `${context}.layer`);
	}
	if (element.enter !== undefined) {
		parsed.enter = requireString(element.enter, `${context}.enter`) as never;
	}
	if (element.exit !== undefined) {
		parsed.exit = requireString(element.exit, `${context}.exit`) as never;
	}
	if (element.ambient !== undefined) {
		parsed.ambient = parseAmbient(element.ambient, `${context}.ambient`);
	}
	if (element.text !== undefined) {
		parsed.text = parseTextContent(element.text, `${context}.text`);
	}
	if (element.primitive !== undefined) {
		parsed.primitive = parsePrimitiveContent(element.primitive, `${context}.primitive`);
	}
	return parsed;
}

function parsePatch(raw: unknown, context: string): ElementPatch {
	const patch = requireObject(raw, context);
	assertKnownFields(
		patch,
		new Set(["id", "at", "size", "layer", "enter", "exit", "ambient", "text", "primitive"]),
		context,
	);
	const parsed: ElementPatch = {
		id: requireIdentifier(patch.id, `${context}.id`),
	};
	if (patch.at !== undefined) {
		parsed.at = parseTuple2(patch.at, `${context}.at`);
	}
	if (patch.size !== undefined) {
		parsed.size = requireNumber(patch.size, `${context}.size`);
	}
	if (patch.layer !== undefined) {
		parsed.layer = requireIdentifier(patch.layer, `${context}.layer`);
	}
	if (patch.enter !== undefined) {
		parsed.enter = requireString(patch.enter, `${context}.enter`) as never;
	}
	if (patch.exit !== undefined) {
		parsed.exit = requireString(patch.exit, `${context}.exit`) as never;
	}
	if (patch.ambient !== undefined) {
		parsed.ambient = parseAmbient(patch.ambient, `${context}.ambient`);
	}
	if (patch.text !== undefined) {
		parsed.text = parseTextContent(patch.text, `${context}.text`, false);
	}
	if (patch.primitive !== undefined) {
		parsed.primitive = parsePrimitiveContent(patch.primitive, `${context}.primitive`, false);
	}
	return parsed;
}

function parseRemoval(raw: unknown, context: string): ElementRemoval {
	const removal = requireObject(raw, context);
	assertKnownFields(removal, new Set(["id", "exit"]), context);
	const parsed: ElementRemoval = {
		id: requireIdentifier(removal.id, `${context}.id`),
	};
	if (removal.exit !== undefined) {
		parsed.exit = requireString(removal.exit, `${context}.exit`) as never;
	}
	return parsed;
}

function parseRoute(raw: unknown, context: string): [number, number][] {
	return requireArray(raw, context).map((point, index) => parseTuple2(point, `${context}[${index}]`));
}

function parseEndpointRef(raw: unknown, context: string): ConnectorEndpointRef {
	const endpoint = requireObject(raw, context);
	assertKnownFields(endpoint, new Set(["element", "at", "side", "offset"]), context);
	const parsed: ConnectorEndpointRef = {};
	if (endpoint.element !== undefined) {
		parsed.element = requireIdentifier(endpoint.element, `${context}.element`);
	}
	if (endpoint.at !== undefined) {
		parsed.at = parseTuple2(endpoint.at, `${context}.at`);
	}
	if (endpoint.side !== undefined) {
		parsed.side = requireString(endpoint.side, `${context}.side`) as never;
	}
	if (endpoint.offset !== undefined) {
		parsed.offset = requireNumber(endpoint.offset, `${context}.offset`);
	}
	return parsed;
}

function parseRouting(raw: unknown, context: string): ConnectorRouting {
	const routing = requireObject(raw, context);
	assertKnownFields(routing, new Set(["mode", "avoid", "clearance", "gridStep", "maxBends", "prefer"]), context);
	const parsed: ConnectorRouting = {};
	if (routing.mode !== undefined) {
		parsed.mode = requireString(routing.mode, `${context}.mode`) as never;
	}
	if (routing.avoid !== undefined) {
		if (Array.isArray(routing.avoid)) {
			parsed.avoid = requireArray(routing.avoid, `${context}.avoid`).map((item, index) =>
				requireIdentifier(item, `${context}.avoid[${index}]`),
			);
		} else {
			parsed.avoid = requireString(routing.avoid, `${context}.avoid`) as never;
		}
	}
	if (routing.clearance !== undefined) {
		parsed.clearance = requireNumber(routing.clearance, `${context}.clearance`);
	}
	if (routing.gridStep !== undefined) {
		parsed.gridStep = requireNumber(routing.gridStep, `${context}.gridStep`);
	}
	if (routing.maxBends !== undefined) {
		parsed.maxBends = requireNumber(routing.maxBends, `${context}.maxBends`);
	}
	if (routing.prefer !== undefined) {
		parsed.prefer = requireString(routing.prefer, `${context}.prefer`) as never;
	}
	return parsed;
}

function parseConnectorStyle(raw: unknown, context: string): ConnectorStyle {
	const style = requireObject(raw, context);
	assertKnownFields(
		style,
		new Set(["variant", "pattern", "stroke", "strokeWidth", "opacity", "dash", "outline", "outlineWidth", "lane"]),
		context,
	);
	const parsed: ConnectorStyle = {};
	if (style.variant !== undefined) {
		parsed.variant = requireString(style.variant, `${context}.variant`) as never;
	}
	if (style.pattern !== undefined) {
		parsed.pattern = requireString(style.pattern, `${context}.pattern`) as never;
	}
	if (style.stroke !== undefined) {
		parsed.stroke = requireString(style.stroke, `${context}.stroke`);
	}
	if (style.strokeWidth !== undefined) {
		parsed.strokeWidth = requireNumber(style.strokeWidth, `${context}.strokeWidth`);
	}
	if (style.opacity !== undefined) {
		parsed.opacity = requireNumber(style.opacity, `${context}.opacity`);
	}
	if (style.dash !== undefined) {
		parsed.dash = parseTuple2(style.dash, `${context}.dash`);
	}
	if (style.outline !== undefined) {
		parsed.outline = requireString(style.outline, `${context}.outline`);
	}
	if (style.outlineWidth !== undefined) {
		parsed.outlineWidth = requireNumber(style.outlineWidth, `${context}.outlineWidth`);
	}
	if (style.lane !== undefined) {
		parsed.lane = requireString(style.lane, `${context}.lane`) as never;
	}
	return parsed;
}

function parseConnectionCommon(raw: unknown, context: string): ConnectionPlacement | ConnectionPatch {
	const connection = requireObject(raw, context);
	assertKnownFields(
		connection,
		new Set([
			"id",
			"route",
			"from",
			"to",
			"routing",
			"layer",
			"style",
			"start",
			"end",
			"direction",
			"enter",
			"exit",
			"ambient",
		]),
		context,
	);
	const parsed: ConnectionPlacement | ConnectionPatch = {
		id: requireIdentifier(connection.id, `${context}.id`),
	};
	if (connection.route !== undefined) {
		parsed.route = parseRoute(connection.route, `${context}.route`);
	}
	if (connection.from !== undefined) {
		parsed.from = parseEndpointRef(connection.from, `${context}.from`);
	}
	if (connection.to !== undefined) {
		parsed.to = parseEndpointRef(connection.to, `${context}.to`);
	}
	if (connection.routing !== undefined) {
		parsed.routing = parseRouting(connection.routing, `${context}.routing`);
	}
	if (connection.layer !== undefined) {
		parsed.layer = requireIdentifier(connection.layer, `${context}.layer`);
	}
	if (connection.style !== undefined) {
		parsed.style = parseConnectorStyle(connection.style, `${context}.style`);
	}
	if (connection.start !== undefined) {
		parsed.start = requireString(connection.start, `${context}.start`) as never;
	}
	if (connection.end !== undefined) {
		parsed.end = requireString(connection.end, `${context}.end`) as never;
	}
	if (connection.direction !== undefined) {
		parsed.direction = requireString(connection.direction, `${context}.direction`) as never;
	}
	if (connection.enter !== undefined) {
		parsed.enter = requireString(connection.enter, `${context}.enter`) as never;
	}
	if (connection.exit !== undefined) {
		parsed.exit = requireString(connection.exit, `${context}.exit`) as never;
	}
	if (connection.ambient !== undefined) {
		parsed.ambient = parseAmbient(connection.ambient, `${context}.ambient`);
	}
	return parsed;
}

function parseConnectionPlacement(raw: unknown, context: string): ConnectionPlacement {
	return parseConnectionCommon(raw, context) as ConnectionPlacement;
}

function parseConnectionPatch(raw: unknown, context: string): ConnectionPatch {
	return parseConnectionCommon(raw, context) as ConnectionPatch;
}

function parseConnectionRemoval(raw: unknown, context: string): ConnectionRemoval {
	const removal = requireObject(raw, context);
	assertKnownFields(removal, new Set(["id", "exit"]), context);
	const parsed: ConnectionRemoval = {
		id: requireIdentifier(removal.id, `${context}.id`),
	};
	if (removal.exit !== undefined) {
		parsed.exit = requireString(removal.exit, `${context}.exit`) as never;
	}
	return parsed;
}

function parseCamera(raw: unknown, context: string): CameraFocus {
	const camera = requireObject(raw, context);
	assertKnownFields(camera, new Set(["target", "padding", "duration", "easing"]), context);
	const target = requireObject(camera.target, `${context}.target`);
	assertKnownFields(target, new Set(["element", "area", "reset"]), `${context}.target`);
	// Collect every authored target kind so the validator can reject documents
	// that declare more than one of element/area/reset.
	const parsedTarget: Record<string, unknown> = {};
	if (target.element !== undefined) {
		parsedTarget.element = requireIdentifier(target.element, `${context}.target.element`);
	}
	if (target.area !== undefined) {
		const area = requireObject(target.area, `${context}.target.area`);
		assertKnownFields(area, new Set(["at", "size"]), `${context}.target.area`);
		parsedTarget.area = {
			at: parseTuple2(area.at, `${context}.target.area.at`),
			size: parseTuple2(area.size, `${context}.target.area.size`),
		};
	}
	if (target.reset !== undefined) {
		parsedTarget.reset = requireBoolean(target.reset, `${context}.target.reset`) as true;
	}
	const parsed: CameraFocus = { target: parsedTarget as CameraFocus["target"] };
	if (camera.padding !== undefined) {
		parsed.padding = requireNumber(camera.padding, `${context}.padding`);
	}
	if (camera.duration !== undefined) {
		parsed.duration = requireNumber(camera.duration, `${context}.duration`);
	}
	if (camera.easing !== undefined) {
		parsed.easing = requireString(camera.easing, `${context}.easing`) as never;
	}
	return parsed;
}

function parseScenes(raw: unknown): SceneStep[] {
	return requireArray(raw, "scenes").map((item, index) => {
		const scene = requireObject(item, `scenes[${index}]`);
		assertKnownFields(
			scene,
			new Set(["id", "elements", "connections", "add", "update", "remove", "camera"]),
			`scenes[${index}]`,
		);
		const parsed: SceneStep = {
			id: requireIdentifier(scene.id, `scenes[${index}].id`),
		};
		if (scene.elements !== undefined) {
			parsed.elements = requireArray(scene.elements, `scenes[${index}].elements`).map((element, elementIndex) =>
				parsePlacement(element, `scenes[${index}].elements[${elementIndex}]`),
			);
		}
		if (scene.connections !== undefined) {
			parsed.connections = requireArray(scene.connections, `scenes[${index}].connections`).map(
				(connection, connectionIndex) =>
					parseConnectionPlacement(connection, `scenes[${index}].connections[${connectionIndex}]`),
			);
		}
		if (scene.add !== undefined) {
			const add = requireObject(scene.add, `scenes[${index}].add`);
			assertKnownFields(add, new Set(["elements", "connections"]), `scenes[${index}].add`);
			parsed.add = {};
			if (add.elements !== undefined) {
				parsed.add.elements = requireArray(add.elements, `scenes[${index}].add.elements`).map((element, elementIndex) =>
					parsePlacement(element, `scenes[${index}].add.elements[${elementIndex}]`),
				);
			}
			if (add.connections !== undefined) {
				parsed.add.connections = requireArray(add.connections, `scenes[${index}].add.connections`).map(
					(connection, connectionIndex) =>
						parseConnectionPlacement(connection, `scenes[${index}].add.connections[${connectionIndex}]`),
				);
			}
		}
		if (scene.update !== undefined) {
			const update = requireObject(scene.update, `scenes[${index}].update`);
			assertKnownFields(update, new Set(["elements", "connections"]), `scenes[${index}].update`);
			parsed.update = {};
			if (update.elements !== undefined) {
				parsed.update.elements = requireArray(update.elements, `scenes[${index}].update.elements`).map(
					(patch, patchIndex) => parsePatch(patch, `scenes[${index}].update.elements[${patchIndex}]`),
				);
			}
			if (update.connections !== undefined) {
				parsed.update.connections = requireArray(update.connections, `scenes[${index}].update.connections`).map(
					(patch, patchIndex) => parseConnectionPatch(patch, `scenes[${index}].update.connections[${patchIndex}]`),
				);
			}
		}
		if (scene.remove !== undefined) {
			const remove = requireObject(scene.remove, `scenes[${index}].remove`);
			assertKnownFields(remove, new Set(["elements", "connections"]), `scenes[${index}].remove`);
			parsed.remove = {};
			if (remove.elements !== undefined) {
				parsed.remove.elements = requireArray(remove.elements, `scenes[${index}].remove.elements`).map(
					(removal, removalIndex) => parseRemoval(removal, `scenes[${index}].remove.elements[${removalIndex}]`),
				);
			}
			if (remove.connections !== undefined) {
				parsed.remove.connections = requireArray(remove.connections, `scenes[${index}].remove.connections`).map(
					(removal, removalIndex) =>
						parseConnectionRemoval(removal, `scenes[${index}].remove.connections[${removalIndex}]`),
				);
			}
		}
		if (scene.camera !== undefined) {
			parsed.camera = parseCamera(scene.camera, `scenes[${index}].camera`);
		}
		return parsed;
	});
}

/**
 * Parse authored YAML into the v1 header + scene-delta document contract.
 */
export function parseScene(dsl: string): SceneDocument {
	let raw: unknown;
	try {
		raw = parseYaml(dsl);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new ParseError("DSL_PARSE_SYNTAX_ERROR", `YAML syntax error: ${message}`, { line: 0, column: 0 });
	}

	if (!isObject(raw)) {
		fail("DSL_PARSE_SYNTAX_ERROR", "DSL must be a YAML mapping at the top level");
	}
	assertKnownFields(raw, new Set(["header", "scenes"]), "top level");

	return {
		header: parseHeader(raw.header),
		scenes: parseScenes(raw.scenes),
	};
}
