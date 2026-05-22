import type {
	AmbientAnimation,
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
	PrimitiveContent,
	PrimitiveContentPatch,
	RuntimeCameraFocus,
	RuntimeConnectorState,
	RuntimeConnectorStyle,
	RuntimeElementState,
	SceneDocument,
	SceneStep,
	TextContent,
	ValidationError,
	ValidationReport,
	ValidationWarning,
} from "../types/index.ts";

const BUILT_IN_TEXT_ASSET_ID = "text";
const BUILT_IN_PRIMITIVE_ASSET_IDS = new Set(["rectangle", "circle", "polygon", "line"]);
const MAX_TEXT_CHARACTERS = 1000;
const MAX_TEXT_LINES = 20;
const MAX_PRIMITIVE_POINTS = 100;

const VALID_ENTRY_ANIMATIONS: ReadonlySet<string> = new Set([
	"fade-in",
	"fade-in-grow",
	"fall-in",
	"rise-from-ground",
	"slide-in-left",
	"slide-in-right",
	"flip-in",
	"none",
]);

const VALID_EXIT_ANIMATIONS: ReadonlySet<string> = new Set([
	"fade-out",
	"fade-out-shrink",
	"fall-through-ground",
	"rise-away",
	"slide-out-left",
	"slide-out-right",
	"flip-out",
	"none",
]);

const VALID_AMBIENT_ANIMATIONS: ReadonlySet<string> = new Set([
	"pulse",
	"float",
	"shake",
	"glow",
	"spin",
	"blink",
	"bounce",
]);
const VALID_CONNECTOR_AMBIENT_ANIMATIONS: ReadonlySet<string> = new Set([...VALID_AMBIENT_ANIMATIONS, "flow"]);

const VALID_CONNECTOR_PATTERNS: ReadonlySet<string> = new Set(["solid", "dashed", "dotted"]);
const VALID_CONNECTOR_VARIANTS: ReadonlySet<string> = new Set(["line", "road"]);
const VALID_CONNECTOR_ENDPOINTS: ReadonlySet<string> = new Set(["none", "arrow", "dot", "circle", "diamond", "bar"]);
const VALID_CONNECTOR_DIRECTIONS: ReadonlySet<string> = new Set(["route", "reverse"]);
const VALID_CONNECTOR_SIDES: ReadonlySet<string> = new Set(["auto", "top", "right", "bottom", "left", "front", "back"]);
const VALID_CONNECTOR_ROUTING_MODES: ReadonlySet<string> = new Set(["straight", "orthogonal", "manual"]);
const VALID_CONNECTOR_ROUTING_PREFERENCES: ReadonlySet<string> = new Set(["direct", "fewest-bends", "shortest"]);
const VALID_CONNECTOR_LANES: ReadonlySet<string> = new Set(["none", "center-dashed"]);
const VALID_CAMERA_EASINGS: ReadonlySet<string> = new Set(["linear", "ease-in-out", "ease-out"]);

const VALID_TEXT_ALIGN: ReadonlySet<string> = new Set(["start", "middle", "end"]);
const VALID_TEXT_WEIGHT: ReadonlySet<string> = new Set(["normal", "bold"]);
const VALID_LINE_CAPS: ReadonlySet<string> = new Set(["butt", "round", "square"]);
const VALID_LINE_JOINS: ReadonlySet<string> = new Set(["miter", "round", "bevel"]);

interface ResolvedElementRecord {
	id: string;
	asset: string;
	at: [number, number];
	size?: number;
	layer?: string;
	enter?: ElementPlacement["enter"];
	exit?: ElementPlacement["exit"];
	ambient?: AmbientAnimation[];
	text?: TextContent;
	primitive?: PrimitiveContent;
}

export interface ResolvedSceneSnapshot {
	id: string;
	progress: number;
	elements: RuntimeElementState[];
	connectors: RuntimeConnectorState[];
	camera?: RuntimeCameraFocus;
}

interface ResolvedConnectorRecord {
	id: string;
	route?: [number, number][];
	from?: ConnectorEndpointRef;
	to?: ConnectorEndpointRef;
	routing?: ConnectionPlacement["routing"];
	layer?: string;
	style?: ConnectorStyle;
	start?: ConnectionPlacement["start"];
	end?: ConnectionPlacement["end"];
	direction?: ConnectionPlacement["direction"];
	enter?: ConnectionPlacement["enter"];
	exit?: ConnectionPlacement["exit"];
	ambient?: AmbientAnimation[];
}

function issue(code: string, message: string, extras: Partial<ValidationError> = {}): ValidationError {
	return { code, message, ...extras };
}

function isValidIdentifier(value: string): boolean {
	return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value);
}

function isValidPosition(value: unknown): value is [number, number] {
	return Array.isArray(value) && value.length === 2 && value.every((part) => Number.isFinite(part) && part >= 0);
}

function isValidPositiveNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function defaultElementLayer(document: SceneDocument): string {
	const structures = document.header.layers.find((layer) => layer.name === "structures");
	return structures?.name ?? document.header.layers[0]?.name ?? "";
}

function defaultFloorLayer(document: SceneDocument): string {
	const ground = document.header.layers.find((layer) => layer.name === "ground");
	return ground?.name ?? document.header.layers[0]?.name ?? "";
}

function defaultConnectorLayer(document: SceneDocument): string {
	const connectors = document.header.layers.find((layer) => layer.name === "connectors");
	const ground = document.header.layers.find((layer) => layer.name === "ground");
	return connectors?.name ?? ground?.name ?? document.header.layers[0]?.name ?? "";
}

function declaredAssetNames(document: SceneDocument): Set<string> {
	return new Set(document.header.assets.map((asset) => asset.id));
}

function hasUrlAssetSource(document: SceneDocument, assetId: string): boolean {
	return Boolean(document.header.assetBaseUrl && document.header.assets.some((asset) => asset.id === assetId));
}

function isBuiltInAsset(assetId: string): boolean {
	return assetId === BUILT_IN_TEXT_ASSET_ID || BUILT_IN_PRIMITIVE_ASSET_IDS.has(assetId);
}

function isPrimitiveAsset(assetId: string): boolean {
	return BUILT_IN_PRIMITIVE_ASSET_IDS.has(assetId);
}

function hasExternalAssetReferences(document: SceneDocument): boolean {
	if (document.header.floor?.asset && !isBuiltInAsset(document.header.floor.asset)) {
		return true;
	}
	for (const scene of document.scenes) {
		for (const element of [...(scene.elements ?? []), ...(scene.add?.elements ?? [])]) {
			if (!isBuiltInAsset(element.asset)) return true;
		}
	}
	return false;
}

function hasBuiltInElements(document: SceneDocument): boolean {
	for (const scene of document.scenes) {
		for (const element of [...(scene.elements ?? []), ...(scene.add?.elements ?? [])]) {
			if (isBuiltInAsset(element.asset)) return true;
		}
	}
	return false;
}

function declaredLayerNames(document: SceneDocument): Set<string> {
	return new Set(document.header.layers.map((layer) => layer.name));
}

function validateHeader(document: SceneDocument, errors: ValidationError[]): void {
	const assets = document.header.assets;
	if (assets.length === 0 && (hasExternalAssetReferences(document) || !hasBuiltInElements(document))) {
		errors.push(issue("NO_ASSETS", "Header must declare at least one asset"));
	}

	const assetNames = new Set<string>();
	for (const asset of assets) {
		if (!isValidIdentifier(asset.id)) {
			errors.push(
				issue("INVALID_IDENTIFIER", `Asset "${asset.id}" must be kebab-case`, {
					assetName: asset.id,
				}),
			);
		}
		if (assetNames.has(asset.id)) {
			errors.push(
				issue("DUPLICATE_ASSET_ID", `Duplicate asset "${asset.id}"`, {
					assetName: asset.id,
				}),
			);
		}
		assetNames.add(asset.id);
		if (isBuiltInAsset(asset.id)) {
			errors.push(
				issue("BUILTIN_ASSET_ID_RESERVED", `Asset "${asset.id}" is reserved for a built-in asset`, {
					assetName: asset.id,
				}),
			);
			continue;
		}
		if (!hasUrlAssetSource(document, asset.id)) {
			errors.push(
				issue("ASSET_URL_REQUIRED", `Asset "${asset.id}" has no URL source`, {
					assetName: asset.id,
				}),
			);
		}
		if (
			asset.anchor !== undefined &&
			(!isValidPosition(asset.anchor) || asset.anchor.some((part) => part < 0 || part > 1))
		) {
			errors.push(
				issue("INVALID_ASSET_ANCHOR", `Asset "${asset.id}" anchor must use normalized values from 0 to 1`, {
					assetName: asset.id,
				}),
			);
		}
	}

	const layers = document.header.layers;
	if (layers.length === 0) {
		errors.push(issue("NO_LAYERS", "Header must declare at least one layer"));
	}

	const layerNames = new Set<string>();
	for (const layer of layers) {
		if (!isValidIdentifier(layer.name)) {
			errors.push(
				issue("INVALID_IDENTIFIER", `Layer "${layer.name}" must be kebab-case`, {
					layerName: layer.name,
				}),
			);
		}
		if (layerNames.has(layer.name)) {
			errors.push(
				issue("DUPLICATE_LAYER_NAME", `Duplicate layer "${layer.name}"`, {
					layerName: layer.name,
				}),
			);
		}
		layerNames.add(layer.name);
		if (layer.order !== undefined && (!Number.isFinite(layer.order) || !Number.isInteger(layer.order))) {
			errors.push(
				issue("INVALID_LAYER_ORDER", "Layer order must be a finite integer", {
					layerName: layer.name,
				}),
			);
		}
	}

	const floor = document.header.floor;
	if (floor) {
		if (floor.size !== undefined && !isValidPositiveTuple(floor.size)) {
			errors.push(issue("INVALID_FLOOR_SIZE", "Floor size must be positive"));
		}
		if (floor.layer !== undefined && !layerNames.has(floor.layer)) {
			errors.push(
				issue("LAYER_NOT_FOUND", `Floor layer "${floor.layer}" is not declared`, {
					layerName: floor.layer,
				}),
			);
		}
		if (floor.asset !== undefined && !assetNames.has(floor.asset)) {
			errors.push(
				issue("ASSET_NOT_DECLARED", `Floor asset "${floor.asset}" is not declared`, {
					assetName: floor.asset,
				}),
			);
		}
		if (floor.asset !== undefined && isBuiltInAsset(floor.asset)) {
			errors.push(
				issue("INVALID_FLOOR_ASSET", "Floor asset cannot use a built-in generated asset", { assetName: floor.asset }),
			);
		}
	}
}

function isValidPositiveTuple(value: unknown): value is [number, number] {
	return Array.isArray(value) && value.length === 2 && value.every((part) => Number.isFinite(part) && part > 0);
}

function validateTimelineShape(document: SceneDocument, errors: ValidationError[]): void {
	if (document.scenes.length === 0) {
		errors.push(issue("NO_SCENES", "Document must contain at least one scene"));
		return;
	}

	const sceneIds = new Set<string>();
	for (const scene of document.scenes) {
		if (!isValidIdentifier(scene.id)) {
			errors.push(
				issue("INVALID_IDENTIFIER", `Scene "${scene.id}" must be kebab-case`, {
					sceneId: scene.id,
				}),
			);
		}
		if (sceneIds.has(scene.id)) {
			errors.push(
				issue("DUPLICATE_SCENE_ID", `Duplicate scene "${scene.id}"`, {
					sceneId: scene.id,
				}),
			);
		}
		sceneIds.add(scene.id);
	}

	const first = document.scenes[0];
	if (
		first.elements === undefined ||
		first.add !== undefined ||
		first.update !== undefined ||
		first.remove !== undefined
	) {
		errors.push(
			issue("INVALID_INITIAL_SCENE", "Initial scene must use elements and no delta operations", { sceneId: first.id }),
		);
	}

	for (const scene of document.scenes.slice(1)) {
		if (scene.elements !== undefined || scene.connections !== undefined) {
			errors.push(
				issue("INVALID_SCENE_DELTA", "Delta scenes may not use top-level elements or connections", {
					sceneId: scene.id,
				}),
			);
		}
	}
}

function validatePlacement(
	placement: ElementPlacement,
	document: SceneDocument,
	errors: ValidationError[],
	sceneId: string,
): void {
	validateElementCommon(placement, document, errors, sceneId);
	validateGeneratedContentForAsset(placement, placement.asset, errors, sceneId);
	if (!isBuiltInAsset(placement.asset) && !declaredAssetNames(document).has(placement.asset)) {
		errors.push(
			issue("ASSET_NOT_DECLARED", `Asset "${placement.asset}" is not declared`, {
				sceneId,
				elementId: placement.id,
				assetName: placement.asset,
			}),
		);
	}
	if (!isValidPosition(placement.at)) {
		errors.push(
			issue("INVALID_POSITION", "Element at must be finite and non-negative", {
				sceneId,
				elementId: placement.id,
			}),
		);
	}
}

function validatePatch(
	patch: ElementPatch,
	document: SceneDocument,
	errors: ValidationError[],
	sceneId: string,
	currentAsset?: string,
): void {
	validateElementCommon(patch, document, errors, sceneId, true);
	if (currentAsset !== undefined) {
		validateGeneratedContentForAsset(patch, currentAsset, errors, sceneId, true);
	}
	if (patch.at !== undefined && !isValidPosition(patch.at)) {
		errors.push(
			issue("INVALID_POSITION", "Element at must be finite and non-negative", {
				sceneId,
				elementId: patch.id,
			}),
		);
	}
}

function validateElementCommon(
	element: ElementPlacement | ElementPatch,
	document: SceneDocument,
	errors: ValidationError[],
	sceneId: string,
	allowZeroSize = false,
): void {
	if (!isValidIdentifier(element.id)) {
		errors.push(
			issue("INVALID_IDENTIFIER", `Element "${element.id}" must be kebab-case`, {
				sceneId,
				elementId: element.id,
			}),
		);
	}
	const minSize = allowZeroSize ? 0 : 1;
	if (element.size !== undefined && (!Number.isFinite(element.size) || element.size < minSize)) {
		errors.push(
			issue(
				"INVALID_SIZE",
				allowZeroSize ? "Element size must be zero or greater" : "Element size must be greater than zero",
				{
					sceneId,
					elementId: element.id,
				},
			),
		);
	}
	if (element.size !== undefined && (!Number.isInteger(element.size) || element.size < minSize)) {
		errors.push(
			issue("INVALID_SIZE", "Element size must be a whole grid cell count", {
				sceneId,
				elementId: element.id,
			}),
		);
	}
	if (element.layer !== undefined && !declaredLayerNames(document).has(element.layer)) {
		errors.push(
			issue("LAYER_NOT_FOUND", `Layer "${element.layer}" is not declared`, {
				sceneId,
				elementId: element.id,
				layerName: element.layer,
			}),
		);
	}
	if (element.enter !== undefined && !VALID_ENTRY_ANIMATIONS.has(element.enter)) {
		errors.push(
			issue("UNKNOWN_ANIMATION", `Unknown entry animation "${element.enter}"`, {
				sceneId,
				elementId: element.id,
			}),
		);
	}
	if (element.exit !== undefined && !VALID_EXIT_ANIMATIONS.has(element.exit)) {
		errors.push(
			issue("UNKNOWN_ANIMATION", `Unknown exit animation "${element.exit}"`, {
				sceneId,
				elementId: element.id,
			}),
		);
	}
	validateAmbient(element.ambient, errors, sceneId, element.id);
}

function validateGeneratedContentForAsset(
	element: ElementPlacement | ElementPatch,
	assetId: string,
	errors: ValidationError[],
	sceneId: string,
	allowSparse = false,
): void {
	if (isBuiltInAsset(assetId)) {
		if (assetId === BUILT_IN_TEXT_ASSET_ID) {
			validateTextForAsset(element, errors, sceneId, allowSparse);
			return;
		}
		validatePrimitiveForAsset(element, assetId, errors, sceneId, allowSparse);
		return;
	}

	if (element.text !== undefined) {
		errors.push(
			issue("TEXT_CONTENT_FOR_NON_TEXT_ASSET", "Only built-in text elements may define text content", {
				sceneId,
				elementId: element.id,
				assetName: assetId,
			}),
		);
	}
	if (element.primitive !== undefined) {
		errors.push(
			issue("GENERATED_CONTENT_FOR_EXTERNAL_ASSET", "Only built-in generated assets may define primitive content", {
				sceneId,
				elementId: element.id,
				assetName: assetId,
			}),
		);
	}
}

function validateTextForAsset(
	element: ElementPlacement | ElementPatch,
	errors: ValidationError[],
	sceneId: string,
	allowSparse: boolean,
): void {
	if (!element.text) {
		if (allowSparse) return;
		errors.push(
			issue("TEXT_CONTENT_REQUIRED", "Built-in text elements require text content", { sceneId, elementId: element.id }),
		);
		return;
	}
	if (element.primitive !== undefined) {
		errors.push(
			issue("PRIMITIVE_CONTENT_FOR_TEXT_ASSET", "Built-in text elements may not define primitive content", {
				sceneId,
				elementId: element.id,
			}),
		);
	}
	validateTextContent(element.text as TextContent, errors, sceneId, element.id, allowSparse);
}

function validatePrimitiveForAsset(
	element: ElementPlacement | ElementPatch,
	assetId: string,
	errors: ValidationError[],
	sceneId: string,
	allowSparse: boolean,
): void {
	if (!isPrimitiveAsset(assetId)) return;
	if (element.text !== undefined) {
		errors.push(
			issue("TEXT_CONTENT_FOR_PRIMITIVE_ASSET", "Primitive elements may not define text content", {
				sceneId,
				elementId: element.id,
			}),
		);
	}
	const primitive = element.primitive;
	if (!primitive) {
		if (allowSparse) return;
		errors.push(
			issue("PRIMITIVE_CONTENT_REQUIRED", "Built-in primitive elements require primitive content", {
				sceneId,
				elementId: element.id,
				assetName: assetId,
			}),
		);
		return;
	}

	const activeKeys = Object.entries(primitive)
		.filter(([, value]) => value !== undefined)
		.map(([key]) => key);
	if (activeKeys.length !== 1 || activeKeys[0] !== assetId) {
		errors.push(
			issue("PRIMITIVE_CONTENT_MISMATCH", "Primitive content must define exactly the payload matching its asset id", {
				sceneId,
				elementId: element.id,
				assetName: assetId,
			}),
		);
		return;
	}

	const payload = primitive[assetId as keyof PrimitiveContent];
	validatePrimitiveStyle(payload, errors, sceneId, element.id);
	if (assetId === "rectangle") {
		const rx = primitive.rectangle?.rx;
		if (rx !== undefined && (!Number.isFinite(rx) || rx < 0 || rx > 0.5)) {
			errors.push(
				issue("INVALID_PRIMITIVE_STYLE", "Rectangle rx must be from 0 to 0.5", {
					sceneId,
					elementId: element.id,
				}),
			);
		}
	}
	if (assetId === "polygon" && (!allowSparse || primitive.polygon?.points !== undefined)) {
		validatePrimitivePoints(primitive.polygon?.points, 3, errors, sceneId, element.id);
	}
	if (assetId === "line") {
		if (!allowSparse || primitive.line?.points !== undefined) {
			validatePrimitivePoints(primitive.line?.points, 2, errors, sceneId, element.id);
		}
		if (primitive.line?.lineCap !== undefined && !VALID_LINE_CAPS.has(primitive.line.lineCap)) {
			errors.push(
				issue("INVALID_PRIMITIVE_STYLE", "Line cap is invalid", {
					sceneId,
					elementId: element.id,
				}),
			);
		}
		if (primitive.line?.lineJoin !== undefined && !VALID_LINE_JOINS.has(primitive.line.lineJoin)) {
			errors.push(
				issue("INVALID_PRIMITIVE_STYLE", "Line join is invalid", {
					sceneId,
					elementId: element.id,
				}),
			);
		}
	}
}

function validatePrimitiveStyle(
	style: PrimitiveContent[keyof PrimitiveContent] | undefined,
	errors: ValidationError[],
	sceneId: string,
	elementId: string,
): void {
	if (!style) return;
	for (const token of [style.stroke, "fill" in style ? style.fill : undefined]) {
		if (token !== undefined && !isSafeTextStyleToken(token)) {
			errors.push(
				issue("INVALID_PRIMITIVE_STYLE", "Primitive color token is unsafe", {
					sceneId,
					elementId,
				}),
			);
		}
	}
	if (style.strokeWidth !== undefined && (!Number.isFinite(style.strokeWidth) || style.strokeWidth < 0)) {
		errors.push(
			issue("INVALID_PRIMITIVE_STYLE", "Primitive strokeWidth is invalid", {
				sceneId,
				elementId,
			}),
		);
	}
	if (style.opacity !== undefined && (!Number.isFinite(style.opacity) || style.opacity < 0 || style.opacity > 1)) {
		errors.push(
			issue("INVALID_PRIMITIVE_STYLE", "Primitive opacity must be 0..1", {
				sceneId,
				elementId,
			}),
		);
	}
	if (
		style.dash !== undefined &&
		(!isValidPositiveTuple(style.dash) || style.dash.some((part) => !Number.isFinite(part)))
	) {
		errors.push(
			issue("INVALID_PRIMITIVE_STYLE", "Primitive dash is invalid", {
				sceneId,
				elementId,
			}),
		);
	}
}

function validatePrimitivePoints(
	points: [number, number][] | undefined,
	minCount: number,
	errors: ValidationError[],
	sceneId: string,
	elementId: string,
): void {
	if (
		!points ||
		points.length < minCount ||
		points.length > MAX_PRIMITIVE_POINTS ||
		points.some((point) => !isValidPosition(point) || point.some((part) => part < 0 || part > 1))
	) {
		errors.push(
			issue("INVALID_PRIMITIVE_POINTS", "Primitive points must use normalized coordinates from 0 to 1", {
				sceneId,
				elementId,
			}),
		);
	}
}

function validateTextContent(
	text: Partial<TextContent>,
	errors: ValidationError[],
	sceneId: string,
	elementId: string,
	allowSparse = false,
): void {
	if (text.value === undefined) {
		if (!allowSparse) {
			errors.push(
				issue("INVALID_TEXT_CONTENT", "Text content must define a value", {
					sceneId,
					elementId,
				}),
			);
		}
	} else {
		const value = normalizeTextValue(text.value);
		const lines = value.split("\n");
		if (
			value.length === 0 ||
			value.length > MAX_TEXT_CHARACTERS ||
			lines.length > MAX_TEXT_LINES ||
			lines.every((line) => line.trim().length === 0)
		) {
			errors.push(
				issue(
					"INVALID_TEXT_CONTENT",
					`Text content must be non-empty, at most ${MAX_TEXT_CHARACTERS} characters, and at most ${MAX_TEXT_LINES} lines`,
					{ sceneId, elementId },
				),
			);
		}
	}

	if (text.align !== undefined && !VALID_TEXT_ALIGN.has(text.align)) {
		errors.push(
			issue("INVALID_TEXT_STYLE", "Text align must be start, middle, or end", {
				sceneId,
				elementId,
			}),
		);
	}
	if (text.fontSize !== undefined && !isValidPositiveNumber(text.fontSize)) {
		errors.push(
			issue("INVALID_TEXT_STYLE", "Text fontSize must be greater than zero", {
				sceneId,
				elementId,
			}),
		);
	}
	if (text.lineHeight !== undefined && !isValidPositiveNumber(text.lineHeight)) {
		errors.push(
			issue("INVALID_TEXT_STYLE", "Text lineHeight must be greater than zero", {
				sceneId,
				elementId,
			}),
		);
	}
	if (text.fontWeight !== undefined && !isValidTextWeight(text.fontWeight)) {
		errors.push(
			issue("INVALID_TEXT_STYLE", "Text fontWeight must be normal, bold, or a positive finite number", {
				sceneId,
				elementId,
			}),
		);
	}
	if (text.fill !== undefined && !isSafeTextStyleToken(text.fill)) {
		errors.push(
			issue("INVALID_TEXT_STYLE", "Text fill contains unsafe CSS syntax", {
				sceneId,
				elementId,
			}),
		);
	}
}

function normalizeTextValue(value: string): string {
	return value.replace(/\r\n?/g, "\n");
}

function isValidTextWeight(value: TextContent["fontWeight"]): boolean {
	if (typeof value === "number") {
		return Number.isFinite(value) && value > 0;
	}
	return typeof value === "string" && VALID_TEXT_WEIGHT.has(value);
}

function isSafeTextStyleToken(value: string): boolean {
	const normalized = value.trim().toLowerCase();
	return (
		normalized.length > 0 &&
		!normalized.includes("url(") &&
		!normalized.includes("javascript:") &&
		!value.includes("<") &&
		!value.includes(">") &&
		!hasControlCharacters(value)
	);
}

function hasControlCharacters(value: string): boolean {
	for (const char of value) {
		const code = char.charCodeAt(0);
		if (code < 32 || code === 127) return true;
	}
	return false;
}

function validateRemoval(removal: ElementRemoval, errors: ValidationError[], sceneId: string): void {
	if (!isValidIdentifier(removal.id)) {
		errors.push(
			issue("INVALID_IDENTIFIER", `Element "${removal.id}" must be kebab-case`, {
				sceneId,
				elementId: removal.id,
			}),
		);
	}
	if (removal.exit !== undefined && !VALID_EXIT_ANIMATIONS.has(removal.exit)) {
		errors.push(
			issue("UNKNOWN_ANIMATION", `Unknown exit animation "${removal.exit}"`, {
				sceneId,
				elementId: removal.id,
			}),
		);
	}
}

function validateAmbient(
	ambient: AmbientAnimation[] | undefined,
	errors: ValidationError[],
	sceneId: string,
	elementId: string,
): void {
	validateAmbientWithSet(ambient, VALID_AMBIENT_ANIMATIONS, errors, sceneId, elementId);
}

function validateAmbientWithSet(
	ambient: AmbientAnimation[] | undefined,
	validAnimations: ReadonlySet<string>,
	errors: ValidationError[],
	sceneId: string,
	elementId: string,
): void {
	for (const animation of ambient ?? []) {
		if (!validAnimations.has(animation.name)) {
			errors.push(
				issue("UNKNOWN_AMBIENT_ANIMATION", `Unknown ambient animation "${animation.name}"`, { sceneId, elementId }),
			);
		}
		if (
			animation.infinite === false &&
			(animation.iterations === undefined || !Number.isInteger(animation.iterations) || animation.iterations <= 0)
		) {
			errors.push(
				issue("INVALID_AMBIENT_ITERATIONS", "Ambient iterations must be positive when infinite is false", {
					sceneId,
					elementId,
				}),
			);
		}
	}
}

function validateSceneObjectDeltas(document: SceneDocument, errors: ValidationError[]): void {
	const elements = new Map<string, ResolvedElementRecord>();
	const connectors = new Map<string, ResolvedConnectorRecord>();
	const documentElementIds = collectDocumentElementIds(document);
	const first = document.scenes[0];
	if (!first?.elements) return;

	for (const element of first.elements) {
		validatePlacement(element, document, errors, first.id);
		if (elements.has(element.id)) {
			errors.push(
				issue("DUPLICATE_ELEMENT_ID", `Duplicate element "${element.id}"`, {
					sceneId: first.id,
					elementId: element.id,
				}),
			);
		}
		elements.set(element.id, normalizePlacement(document, element));
	}

	for (const connection of first.connections ?? []) {
		validateConnectionPlacement(connection, document, errors, first.id, elements, documentElementIds);
		if (connectors.has(connection.id)) {
			errors.push(
				issue("DUPLICATE_CONNECTOR_ID", `Duplicate connection "${connection.id}"`, {
					sceneId: first.id,
					elementId: connection.id,
				}),
			);
		}
		connectors.set(connection.id, normalizeConnectionPlacement(document, connection));
	}

	validateCamera(first.camera, first.id, elements, connectors, errors);

	for (const scene of document.scenes.slice(1)) {
		const updateIds = new Set<string>();
		for (const update of scene.update?.elements ?? []) {
			const existing = elements.get(update.id)?.asset;
			validatePatch(update, document, errors, scene.id, existing);
			updateIds.add(update.id);
			if (!elements.has(update.id)) {
				errors.push(
					issue("ELEMENT_NOT_PRESENT", `Element "${update.id}" is not present`, {
						sceneId: scene.id,
						elementId: update.id,
					}),
				);
			}
		}

		for (const removal of scene.remove?.elements ?? []) {
			validateRemoval(removal, errors, scene.id);
			if (updateIds.has(removal.id)) {
				errors.push(
					issue("ELEMENT_DELTA_CONFLICT", `Element "${removal.id}" cannot be updated and removed in one scene`, {
						sceneId: scene.id,
						elementId: removal.id,
					}),
				);
			}
			if (!elements.has(removal.id)) {
				errors.push(
					issue("ELEMENT_NOT_PRESENT", `Element "${removal.id}" is not present`, {
						sceneId: scene.id,
						elementId: removal.id,
					}),
				);
			}
		}

		for (const add of scene.add?.elements ?? []) {
			validatePlacement(add, document, errors, scene.id);
			if (elements.has(add.id)) {
				errors.push(
					issue("ELEMENT_ALREADY_PRESENT", `Element "${add.id}" is already present`, {
						sceneId: scene.id,
						elementId: add.id,
					}),
				);
			}
		}

		const elementsForConnections = new Map(elements);
		for (const update of scene.update?.elements ?? []) {
			const existing = elementsForConnections.get(update.id);
			if (existing) {
				elementsForConnections.set(update.id, mergeElementPatch(existing, update));
			}
		}
		for (const add of scene.add?.elements ?? []) {
			elementsForConnections.set(add.id, normalizePlacement(document, add));
		}

		validateEndpointRemovalRule(scene, connectors, errors);

		const connectorUpdateIds = new Set<string>();
		for (const update of scene.update?.connections ?? []) {
			validateConnectionRemovalLikeId(update.id, errors, scene.id);
			connectorUpdateIds.add(update.id);
			const existing = connectors.get(update.id);
			if (!existing) {
				errors.push(
					issue("CONNECTOR_NOT_PRESENT", `Connection "${update.id}" is not present`, {
						sceneId: scene.id,
						elementId: update.id,
					}),
				);
				validateConnectionPatch(update, document, errors, scene.id, elementsForConnections, documentElementIds);
				continue;
			}
			validateConnectionPatch(
				{
					...existing,
					...update,
					style: mergeStyle(existing.style, update.style),
				},
				document,
				errors,
				scene.id,
				elementsForConnections,
				documentElementIds,
			);
		}

		for (const removal of scene.remove?.connections ?? []) {
			validateConnectionRemoval(removal, errors, scene.id);
			if (connectorUpdateIds.has(removal.id)) {
				errors.push(
					issue("CONNECTOR_DELTA_CONFLICT", `Connection "${removal.id}" cannot be updated and removed in one scene`, {
						sceneId: scene.id,
						elementId: removal.id,
					}),
				);
			}
			if (!connectors.has(removal.id)) {
				errors.push(
					issue("CONNECTOR_NOT_PRESENT", `Connection "${removal.id}" is not present`, {
						sceneId: scene.id,
						elementId: removal.id,
					}),
				);
			}
		}

		for (const add of scene.add?.connections ?? []) {
			validateConnectionPlacement(add, document, errors, scene.id, elementsForConnections, documentElementIds);
			if (connectors.has(add.id)) {
				errors.push(
					issue("CONNECTOR_ALREADY_PRESENT", `Connection "${add.id}" is already present`, {
						sceneId: scene.id,
						elementId: add.id,
					}),
				);
			}
		}

		validateCamera(scene.camera, scene.id, elementsForConnections, connectors, errors);

		for (const update of scene.update?.elements ?? []) {
			const existing = elements.get(update.id);
			if (existing) {
				elements.set(update.id, mergeElementPatch(existing, update));
			}
		}
		for (const add of scene.add?.elements ?? []) {
			elements.set(add.id, normalizePlacement(document, add));
		}
		for (const update of scene.update?.connections ?? []) {
			const existing = connectors.get(update.id);
			if (existing) {
				connectors.set(update.id, {
					...existing,
					...update,
					style: mergeStyle(existing.style, update.style),
				});
			}
		}
		for (const add of scene.add?.connections ?? []) {
			connectors.set(add.id, normalizeConnectionPlacement(document, add));
		}
		for (const removal of scene.remove?.connections ?? []) {
			connectors.delete(removal.id);
		}
		for (const removal of scene.remove?.elements ?? []) {
			elements.delete(removal.id);
		}
	}
}

function collectDocumentElementIds(document: SceneDocument): Set<string> {
	const ids = new Set<string>();
	for (const scene of document.scenes) {
		for (const element of scene.elements ?? []) ids.add(element.id);
		for (const element of scene.add?.elements ?? []) ids.add(element.id);
	}
	return ids;
}

function validateCamera(
	camera: CameraFocus | undefined,
	sceneId: string,
	elements: Map<string, ResolvedElementRecord>,
	connectors: Map<string, ResolvedConnectorRecord>,
	errors: ValidationError[],
): void {
	if (!camera) return;
	const target = camera.target;
	const hasElement = "element" in target && target.element !== undefined;
	const hasArea = "area" in target && target.area !== undefined;
	const hasReset = "reset" in target && target.reset !== undefined;
	const targetCount = Number(hasElement) + Number(hasArea) + Number(hasReset);
	if (targetCount !== 1) {
		errors.push(issue("INVALID_CAMERA_TARGET", "Camera target must use exactly one target kind", { sceneId }));
	}
	if (hasElement) {
		if (!isValidIdentifier(target.element)) {
			errors.push(issue("INVALID_CAMERA_TARGET", "Camera element target must be kebab-case", { sceneId }));
		} else if (connectors.has(target.element)) {
			errors.push(issue("INVALID_CAMERA_TARGET", "Camera element target cannot reference a connector", { sceneId }));
		} else if (!elements.has(target.element)) {
			errors.push(
				issue("CAMERA_TARGET_NOT_FOUND", `Camera target "${target.element}" was not found`, {
					sceneId,
					elementId: target.element,
				}),
			);
		}
	}
	if (hasArea) {
		if (!isValidPosition(target.area.at) || !isValidPositiveTuple(target.area.size)) {
			errors.push(
				issue("INVALID_CAMERA_OPTIONS", "Camera area must use non-negative at and positive size", { sceneId }),
			);
		}
	}
	if (hasReset && target.reset !== true) {
		errors.push(issue("INVALID_CAMERA_TARGET", "Camera reset target must be true", { sceneId }));
	}
	if (camera.padding !== undefined) {
		if (hasReset) {
			errors.push(issue("INVALID_CAMERA_OPTIONS", "Camera reset must not define padding", { sceneId }));
		}
		if (!Number.isFinite(camera.padding) || camera.padding < 0 || camera.padding > 2048) {
			errors.push(issue("INVALID_CAMERA_OPTIONS", "Camera padding is invalid", { sceneId }));
		}
	}
	if (
		camera.duration !== undefined &&
		(!Number.isInteger(camera.duration) || camera.duration < 0 || camera.duration > 10000)
	) {
		errors.push(issue("INVALID_CAMERA_OPTIONS", "Camera duration is invalid", { sceneId }));
	}
	if (camera.easing !== undefined && !VALID_CAMERA_EASINGS.has(camera.easing)) {
		errors.push(issue("INVALID_CAMERA_OPTIONS", "Camera easing is invalid", { sceneId }));
	}
}

function validateEndpointRemovalRule(
	scene: SceneStep,
	connectors: Map<string, ResolvedConnectorRecord>,
	errors: ValidationError[],
): void {
	const removedElements = new Set((scene.remove?.elements ?? []).map((removal) => removal.id));
	if (removedElements.size === 0) return;
	const removedConnections = new Set((scene.remove?.connections ?? []).map((removal) => removal.id));
	for (const connection of connectors.values()) {
		if (removedConnections.has(connection.id)) continue;
		const endpointIds = [connection.from?.element, connection.to?.element];
		if (endpointIds.some((id) => id !== undefined && removedElements.has(id))) {
			errors.push(
				issue(
					"CONNECTION_ENDPOINT_REMOVED",
					`Connection "${connection.id}" references an element removed in the same scene`,
					{ sceneId: scene.id, elementId: connection.id },
				),
			);
		}
	}
}

function validateConnectionPlacement(
	connection: ConnectionPlacement,
	document: SceneDocument,
	errors: ValidationError[],
	sceneId: string,
	elements: Map<string, ResolvedElementRecord>,
	documentElementIds: Set<string>,
): void {
	validateConnectionCommon(connection, document, errors, sceneId, elements, documentElementIds);
}

function validateConnectionPatch(
	connection: ConnectionPatch | ResolvedConnectorRecord,
	document: SceneDocument,
	errors: ValidationError[],
	sceneId: string,
	elements: Map<string, ResolvedElementRecord>,
	documentElementIds: Set<string>,
): void {
	validateConnectionCommon(connection, document, errors, sceneId, elements, documentElementIds);
}

function validateConnectionCommon(
	connection: ConnectionPatch | ResolvedConnectorRecord,
	document: SceneDocument,
	errors: ValidationError[],
	sceneId: string,
	elements: Map<string, ResolvedElementRecord>,
	documentElementIds: Set<string>,
): void {
	validateConnectionRemovalLikeId(connection.id, errors, sceneId);
	if (documentElementIds.has(connection.id)) {
		errors.push(
			issue("DUPLICATE_SCENE_OBJECT_ID", `Connection "${connection.id}" collides with an element id`, {
				sceneId,
				elementId: connection.id,
			}),
		);
	}
	if (connection.layer !== undefined && !declaredLayerNames(document).has(connection.layer)) {
		errors.push(
			issue("LAYER_NOT_FOUND", `Layer "${connection.layer}" is not declared`, {
				sceneId,
				elementId: connection.id,
				layerName: connection.layer,
			}),
		);
	}
	if (connection.enter !== undefined && !VALID_ENTRY_ANIMATIONS.has(connection.enter)) {
		errors.push(
			issue("UNKNOWN_ANIMATION", `Unknown entry animation "${connection.enter}"`, {
				sceneId,
				elementId: connection.id,
			}),
		);
	}
	if (connection.exit !== undefined && !VALID_EXIT_ANIMATIONS.has(connection.exit)) {
		errors.push(
			issue("UNKNOWN_ANIMATION", `Unknown exit animation "${connection.exit}"`, {
				sceneId,
				elementId: connection.id,
			}),
		);
	}
	validateAmbientWithSet(connection.ambient, VALID_CONNECTOR_AMBIENT_ANIMATIONS, errors, sceneId, connection.id);
	validateConnectionRouteSource(connection, errors, sceneId);
	validateConnectionEndpoints(connection, elements, errors, sceneId);
	validateConnectionRouting(connection, errors, sceneId);
	validateConnectorStyle(connection.style, errors, sceneId, connection.id);
	if (connection.start !== undefined && !VALID_CONNECTOR_ENDPOINTS.has(connection.start)) {
		errors.push(
			issue("INVALID_CONNECTOR_ENDPOINT", "Invalid connector start endpoint", {
				sceneId,
				elementId: connection.id,
			}),
		);
	}
	if (connection.end !== undefined && !VALID_CONNECTOR_ENDPOINTS.has(connection.end)) {
		errors.push(
			issue("INVALID_CONNECTOR_ENDPOINT", "Invalid connector end endpoint", {
				sceneId,
				elementId: connection.id,
			}),
		);
	}
	if (connection.direction !== undefined && !VALID_CONNECTOR_DIRECTIONS.has(connection.direction)) {
		errors.push(
			issue("INVALID_CONNECTOR_DIRECTION", "Invalid connector direction", {
				sceneId,
				elementId: connection.id,
			}),
		);
	}
}

function validateConnectionRouteSource(
	connection: ConnectionPatch | ResolvedConnectorRecord,
	errors: ValidationError[],
	sceneId: string,
): void {
	const hasRoute = connection.route !== undefined;
	const hasEndpointRoute = connection.from !== undefined || connection.to !== undefined;
	if (hasRoute === hasEndpointRoute || (hasEndpointRoute && (!connection.from || !connection.to))) {
		errors.push(
			issue("INVALID_CONNECTOR_ROUTE", "Connection must use either route or both from and to", {
				sceneId,
				elementId: connection.id,
			}),
		);
	}
	if (connection.route !== undefined) {
		if (
			connection.route.length < 2 ||
			connection.route.some(
				(point) => !isValidPosition(point) || point.some((coordinate) => !Number.isInteger(coordinate)),
			)
		) {
			errors.push(
				issue("INVALID_CONNECTOR_ROUTE", "Manual connection route must contain at least two whole-grid points", {
					sceneId,
					elementId: connection.id,
				}),
			);
		} else if (!isGridAxisRoute(connection.route)) {
			errors.push(
				issue("INVALID_CONNECTOR_ROUTE", "Manual connection route segments must follow one grid axis at a time", {
					sceneId,
					elementId: connection.id,
				}),
			);
		}
	}
}

function validateConnectionEndpoints(
	connection: ConnectionPatch | ResolvedConnectorRecord,
	elements: Map<string, ResolvedElementRecord>,
	errors: ValidationError[],
	sceneId: string,
): void {
	for (const key of ["from", "to"] as const) {
		const endpoint = connection[key];
		if (endpoint === undefined) continue;
		const hasElement = endpoint.element !== undefined;
		const hasAt = endpoint.at !== undefined;
		if (hasElement === hasAt) {
			errors.push(
				issue("INVALID_CONNECTOR_ROUTE", "Connection endpoint must use exactly one of element or at", {
					sceneId,
					elementId: connection.id,
				}),
			);
		}
		if (endpoint.element !== undefined && !elements.has(endpoint.element)) {
			errors.push(
				issue("CONNECTOR_ENDPOINT_NOT_FOUND", `Connection endpoint "${endpoint.element}" was not found`, {
					sceneId,
					elementId: connection.id,
				}),
			);
		}
		if (endpoint.at !== undefined && !isValidPosition(endpoint.at)) {
			errors.push(
				issue("INVALID_CONNECTOR_ROUTE", "Endpoint at must be non-negative", {
					sceneId,
					elementId: connection.id,
				}),
			);
		}
		if (endpoint.side !== undefined && !VALID_CONNECTOR_SIDES.has(endpoint.side)) {
			errors.push(
				issue("INVALID_CONNECTOR_ROUTE", "Invalid endpoint side", {
					sceneId,
					elementId: connection.id,
				}),
			);
		}
		if (
			endpoint.offset !== undefined &&
			(!Number.isFinite(endpoint.offset) || endpoint.offset < -0.5 || endpoint.offset > 0.5)
		) {
			errors.push(
				issue("INVALID_CONNECTOR_ROUTE", "Invalid endpoint offset", {
					sceneId,
					elementId: connection.id,
				}),
			);
		}
	}
}

function validateConnectionRouting(
	connection: ConnectionPatch | ResolvedConnectorRecord,
	errors: ValidationError[],
	sceneId: string,
): void {
	const routing = connection.routing;
	if (routing === undefined) return;
	if (connection.route !== undefined) {
		errors.push(
			issue("INVALID_CONNECTOR_ROUTING", "Routing config is valid only with endpoint-routed connections", {
				sceneId,
				elementId: connection.id,
			}),
		);
	}
	if (routing.mode !== undefined && !VALID_CONNECTOR_ROUTING_MODES.has(routing.mode)) {
		errors.push(
			issue("INVALID_CONNECTOR_ROUTING", "Invalid connector routing mode", {
				sceneId,
				elementId: connection.id,
			}),
		);
	}
	if (routing.avoid !== undefined) {
		const avoid = routing.avoid;
		if (!(avoid === "objects" || avoid === "none" || Array.isArray(avoid))) {
			errors.push(
				issue("INVALID_CONNECTOR_ROUTING", "Invalid connector routing avoid", {
					sceneId,
					elementId: connection.id,
				}),
			);
		}
	}
	for (const [name, value] of [
		["clearance", routing.clearance],
		["gridStep", routing.gridStep],
		["maxBends", routing.maxBends],
	] as const) {
		if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
			errors.push(
				issue("INVALID_CONNECTOR_ROUTING", `Invalid connector routing ${name}`, { sceneId, elementId: connection.id }),
			);
		}
	}
	if (routing.prefer !== undefined && !VALID_CONNECTOR_ROUTING_PREFERENCES.has(routing.prefer)) {
		errors.push(
			issue("INVALID_CONNECTOR_ROUTING", "Invalid connector routing preference", {
				sceneId,
				elementId: connection.id,
			}),
		);
	}
}

function validateConnectorStyle(
	style: ConnectorStyle | undefined,
	errors: ValidationError[],
	sceneId: string,
	connectionId: string,
): void {
	if (style === undefined) return;
	if (style.pattern !== undefined && !VALID_CONNECTOR_PATTERNS.has(style.pattern)) {
		errors.push(
			issue("INVALID_CONNECTOR_STYLE", "Invalid connector pattern", {
				sceneId,
				elementId: connectionId,
			}),
		);
	}
	if (style.variant !== undefined && !VALID_CONNECTOR_VARIANTS.has(style.variant)) {
		errors.push(
			issue("INVALID_CONNECTOR_STYLE", "Invalid connector variant", {
				sceneId,
				elementId: connectionId,
			}),
		);
	}
	if (style.lane !== undefined && !VALID_CONNECTOR_LANES.has(style.lane)) {
		errors.push(
			issue("INVALID_CONNECTOR_STYLE", "Invalid connector lane", {
				sceneId,
				elementId: connectionId,
			}),
		);
	}
	for (const [name, value] of [
		["strokeWidth", style.strokeWidth],
		["outlineWidth", style.outlineWidth],
	] as const) {
		if (value !== undefined && !isValidPositiveNumber(value)) {
			errors.push(
				issue("INVALID_CONNECTOR_STYLE", `Invalid connector ${name}`, {
					sceneId,
					elementId: connectionId,
				}),
			);
		}
	}
	if (style.opacity !== undefined && (!Number.isFinite(style.opacity) || style.opacity < 0 || style.opacity > 1)) {
		errors.push(
			issue("INVALID_CONNECTOR_STYLE", "Connector opacity must be 0..1", {
				sceneId,
				elementId: connectionId,
			}),
		);
	}
	if (
		style.dash !== undefined &&
		(!isValidPositiveTuple(style.dash) || style.dash.some((part) => !Number.isFinite(part)))
	) {
		errors.push(
			issue("INVALID_CONNECTOR_STYLE", "Invalid connector dash", {
				sceneId,
				elementId: connectionId,
			}),
		);
	}
	for (const token of [style.stroke, style.outline]) {
		if (token !== undefined && !isSafeTextStyleToken(token)) {
			errors.push(
				issue("INVALID_CONNECTOR_STYLE", "Connector color token is unsafe", {
					sceneId,
					elementId: connectionId,
				}),
			);
		}
	}
}

function validateConnectionRemoval(removal: ConnectionRemoval, errors: ValidationError[], sceneId: string): void {
	validateConnectionRemovalLikeId(removal.id, errors, sceneId);
	if (removal.exit !== undefined && !VALID_EXIT_ANIMATIONS.has(removal.exit)) {
		errors.push(
			issue("UNKNOWN_ANIMATION", `Unknown exit animation "${removal.exit}"`, {
				sceneId,
				elementId: removal.id,
			}),
		);
	}
}

function validateConnectionRemovalLikeId(id: string, errors: ValidationError[], sceneId: string): void {
	if (!isValidIdentifier(id)) {
		errors.push(
			issue("INVALID_IDENTIFIER", `Connection "${id}" must be kebab-case`, {
				sceneId,
				elementId: id,
			}),
		);
	}
}

function mergeStyle(base: ConnectorStyle | undefined, patch: ConnectorStyle | undefined): ConnectorStyle | undefined {
	if (base === undefined) return patch;
	if (patch === undefined) return base;
	return { ...base, ...patch };
}

function mergeText(base: TextContent | undefined, patch: Partial<TextContent> | undefined): TextContent | undefined {
	if (base === undefined) return patch as TextContent | undefined;
	if (patch === undefined) return base;
	return { ...base, ...patch };
}

function mergePrimitive(
	base: PrimitiveContent | undefined,
	patch: PrimitiveContentPatch | undefined,
): PrimitiveContent | undefined {
	if (base === undefined) return patch as PrimitiveContent | undefined;
	if (patch === undefined) return base;
	const merged: PrimitiveContent = {};
	if (base.rectangle || patch.rectangle) merged.rectangle = { ...(base.rectangle ?? {}), ...(patch.rectangle ?? {}) };
	if (base.circle || patch.circle) merged.circle = { ...(base.circle ?? {}), ...(patch.circle ?? {}) };
	if (base.polygon || patch.polygon) merged.polygon = { ...(base.polygon ?? {}), ...(patch.polygon ?? {}) } as never;
	if (base.line || patch.line) merged.line = { ...(base.line ?? {}), ...(patch.line ?? {}) } as never;
	return merged;
}

function mergeElementPatch(existing: ResolvedElementRecord, patch: ElementPatch): ResolvedElementRecord {
	return {
		...existing,
		...patch,
		text: mergeText(existing.text, patch.text),
		primitive: mergePrimitive(existing.primitive, patch.primitive),
	};
}

function validateWarnings(document: SceneDocument, warnings: ValidationWarning[]): void {
	const usedAssets = new Set<string>();
	const usedLayers = new Set<string>();
	const snapshots = resolveSceneSnapshots(document);

	if (document.header.floor?.asset && document.header.floor.visible !== false) {
		usedAssets.add(document.header.floor.asset);
	}

	for (const snapshot of snapshots) {
		for (const element of snapshot.elements) {
			usedAssets.add(element.asset);
			if (isBuiltInAsset(element.asset)) {
				usedAssets.delete(element.asset);
			}
			usedLayers.add(element.layer);
			if (document.header.floor?.size) {
				const [columns, rows] = document.header.floor.size;
				if (element.pos[0] + element.size > columns || element.pos[1] + element.size > rows) {
					warnings.push(
						issue("ELEMENT_OUTSIDE_FLOOR", `Element "${element.id}" is outside floor bounds`, {
							sceneId: snapshot.id,
							elementId: element.id,
						}),
					);
				}
			}
		}
		for (const connector of snapshot.connectors) {
			usedLayers.add(connector.layer);
			if (document.header.floor?.size) {
				const [columns, rows] = document.header.floor.size;
				if (connector.route.some((point) => point[0] > columns || point[1] > rows)) {
					warnings.push(
						issue("CONNECTOR_OUTSIDE_FLOOR", `Connection "${connector.id}" is outside floor bounds`, {
							sceneId: snapshot.id,
							elementId: connector.id,
						}),
					);
				}
			}
		}
	}

	for (const asset of document.header.assets) {
		if (!usedAssets.has(asset.id)) {
			warnings.push(
				issue("UNREFERENCED_ASSET", `Asset "${asset.id}" is not used`, {
					assetName: asset.id,
				}),
			);
		}
	}

	for (const layer of document.header.layers) {
		if (!usedLayers.has(layer.name) && layer.name !== defaultFloorLayer(document)) {
			warnings.push(
				issue("UNREFERENCED_LAYER", `Layer "${layer.name}" is not used`, {
					layerName: layer.name,
				}),
			);
		}
	}
}

export function validateScene(document: SceneDocument): ValidationReport {
	const errors: ValidationError[] = [];
	const warnings: ValidationWarning[] = [];

	validateHeader(document, errors);
	validateTimelineShape(document, errors);
	validateSceneObjectDeltas(document, errors);

	if (errors.length === 0) {
		validateWarnings(document, warnings);
	}

	return {
		errors,
		warnings,
		isValid: errors.length === 0,
	};
}

export function resolveSceneSnapshots(document: SceneDocument): ResolvedSceneSnapshot[] {
	const progress = deriveProgresses(document.scenes);
	const currentElements = new Map<string, ResolvedElementRecord>();
	const currentConnectors = new Map<string, ResolvedConnectorRecord>();
	const snapshots: ResolvedSceneSnapshot[] = [];

	for (const [index, scene] of document.scenes.entries()) {
		const exiting: RuntimeElementState[] = [];
		const exitingConnectors: RuntimeConnectorState[] = [];

		if (index === 0) {
			for (const element of scene.elements ?? []) {
				currentElements.set(element.id, normalizePlacement(document, element));
			}
			for (const connection of scene.connections ?? []) {
				currentConnectors.set(connection.id, normalizeConnectionPlacement(document, connection));
			}
		} else {
			for (const patch of scene.update?.elements ?? []) {
				const existing = currentElements.get(patch.id);
				if (existing) {
					currentElements.set(patch.id, mergeElementPatch(existing, patch));
				}
			}

			for (const element of scene.add?.elements ?? []) {
				currentElements.set(element.id, normalizePlacement(document, element));
			}

			for (const patch of scene.update?.connections ?? []) {
				const existing = currentConnectors.get(patch.id);
				if (existing) {
					currentConnectors.set(patch.id, {
						...existing,
						...patch,
						style: mergeStyle(existing.style, patch.style),
					});
				}
			}

			for (const connection of scene.add?.connections ?? []) {
				currentConnectors.set(connection.id, normalizeConnectionPlacement(document, connection));
			}

			for (const removal of scene.remove?.elements ?? []) {
				const existing = currentElements.get(removal.id);
				if (existing) {
					exiting.push(toRuntimeState(existing, "exiting", removal.exit));
				}
			}

			for (const removal of scene.remove?.connections ?? []) {
				const existing = currentConnectors.get(removal.id);
				if (existing) {
					exitingConnectors.push(toRuntimeConnectorState(document, existing, currentElements, "exiting", removal.exit));
				}
			}
		}

		const addedIds = new Set((scene.add?.elements ?? []).map((element) => element.id));
		const addedConnectorIds = new Set((scene.add?.connections ?? []).map((connection) => connection.id));
		const snapshotElements = Array.from(currentElements.values()).map((element) =>
			toRuntimeState(element, index > 0 && addedIds.has(element.id) ? "entering" : "present"),
		);
		const snapshotConnectors = Array.from(currentConnectors.values()).map((connection) =>
			toRuntimeConnectorState(
				document,
				connection,
				currentElements,
				index > 0 && addedConnectorIds.has(connection.id) ? "entering" : "present",
			),
		);
		for (const removed of exiting) {
			const existingIndex = snapshotElements.findIndex((element) => element.id === removed.id);
			if (existingIndex >= 0) {
				snapshotElements[existingIndex] = removed;
			} else {
				snapshotElements.push(removed);
			}
		}
		for (const removed of exitingConnectors) {
			const existingIndex = snapshotConnectors.findIndex((connector) => connector.id === removed.id);
			if (existingIndex >= 0) {
				snapshotConnectors[existingIndex] = removed;
			} else {
				snapshotConnectors.push(removed);
			}
		}

		snapshots.push({
			id: scene.id,
			progress: progress[index],
			elements: snapshotElements,
			connectors: snapshotConnectors,
			...(scene.camera ? { camera: normalizeCamera(scene.camera) } : {}),
		});

		for (const removal of scene.remove?.connections ?? []) {
			currentConnectors.delete(removal.id);
		}
		for (const removal of scene.remove?.elements ?? []) {
			currentElements.delete(removal.id);
		}
	}

	return snapshots;
}

function normalizeCamera(camera: CameraFocus): RuntimeCameraFocus {
	const normalized: RuntimeCameraFocus =
		"element" in camera.target && camera.target.element !== undefined
			? {
					target: { type: "element", id: camera.target.element },
					padding: camera.padding ?? 32,
				}
			: "area" in camera.target && camera.target.area !== undefined
				? {
						target: { type: "area", at: camera.target.area.at, size: camera.target.area.size },
						padding: camera.padding ?? 32,
					}
				: {
						target: { type: "reset" },
					};
	if (camera.duration !== undefined) normalized.duration = camera.duration;
	if (camera.easing !== undefined) normalized.easing = camera.easing;
	return normalized;
}

export function deriveProgresses(scenes: SceneStep[]): number[] {
	if (scenes.length <= 1) {
		return scenes.map(() => 0);
	}
	return scenes.map((_, index) => index / (scenes.length - 1));
}

function normalizePlacement(document: SceneDocument, element: ElementPlacement): ResolvedElementRecord {
	return {
		id: element.id,
		asset: element.asset,
		at: element.at,
		size: element.size,
		layer: element.layer ?? defaultElementLayer(document),
		enter: element.enter,
		exit: element.exit,
		ambient: element.ambient,
		text: element.text,
		primitive: element.primitive,
	};
}

function normalizeConnectionPlacement(
	document: SceneDocument,
	connection: ConnectionPlacement,
): ResolvedConnectorRecord {
	return {
		id: connection.id,
		route: connection.route,
		from: connection.from,
		to: connection.to,
		routing: connection.routing,
		layer: connection.layer ?? defaultConnectorLayer(document),
		style: connection.style,
		start: connection.start,
		end: connection.end,
		direction: connection.direction,
		enter: connection.enter,
		exit: connection.exit,
		ambient: connection.ambient,
	};
}

function toRuntimeState(
	element: ResolvedElementRecord,
	presence: RuntimeElementState["presence"],
	exit?: ElementRemoval["exit"],
): RuntimeElementState {
	return {
		id: element.id,
		asset: element.asset,
		pos: element.at,
		size: element.size ?? 1,
		layer: element.layer ?? "",
		presence,
		enter: presence === "entering" ? (element.enter ?? "fade-in") : element.enter,
		exit: presence === "exiting" ? (exit ?? element.exit ?? "fade-out") : (exit ?? element.exit),
		ambient: element.ambient,
		text: element.text,
		primitive: element.primitive,
	};
}

function toRuntimeConnectorState(
	document: SceneDocument,
	connection: ResolvedConnectorRecord,
	elements: Map<string, ResolvedElementRecord>,
	presence: RuntimeConnectorState["presence"],
	exit?: ConnectionRemoval["exit"],
): RuntimeConnectorState {
	return {
		id: connection.id,
		route: resolveConnectorRoute(connection, elements),
		layer: connection.layer ?? defaultConnectorLayer(document),
		presence,
		style: resolveConnectorStyle(connection.style),
		start: connection.start ?? "none",
		end: connection.end ?? "arrow",
		direction: connection.direction ?? "route",
		enter: presence === "entering" ? (connection.enter ?? "fade-in") : (connection.enter ?? "fade-in"),
		exit: presence === "exiting" ? (exit ?? connection.exit ?? "fade-out") : (exit ?? connection.exit ?? "fade-out"),
		ambient: connection.ambient,
	};
}

function resolveConnectorStyle(style: ConnectorStyle | undefined): RuntimeConnectorStyle {
	const variant = style?.variant ?? "line";
	const pattern = style?.pattern ?? "solid";
	const resolved: RuntimeConnectorStyle = {
		variant,
		pattern,
		stroke: style?.stroke ?? "#2563eb",
		strokeWidth: style?.strokeWidth ?? (variant === "road" ? 14 : 3),
		opacity: style?.opacity ?? 1,
		outlineWidth: style?.outlineWidth ?? (variant === "road" ? 2 : 0),
		lane: style?.lane ?? "none",
	};
	const dash = style?.dash ?? defaultDash(pattern);
	if (dash) {
		resolved.dash = dash;
	}
	const outline = style?.outline ?? (variant === "road" ? "#ffffff" : undefined);
	if (outline) {
		resolved.outline = outline;
	}
	return resolved;
}

function defaultDash(pattern: RuntimeConnectorStyle["pattern"]): [number, number] | undefined {
	if (pattern === "dashed") return [12, 8];
	if (pattern === "dotted") return [0, 8];
	return undefined;
}

function resolveConnectorRoute(
	connection: ResolvedConnectorRecord,
	elements: Map<string, ResolvedElementRecord>,
): [number, number][] {
	if (connection.route) return connection.route;
	if (!connection.from || !connection.to) return [];

	const routing = connection.routing ?? {};
	const avoid = routing.avoid ?? "objects";
	const clearance = routing.clearance ?? 0.5;
	const obstacles =
		avoid === "none" ? [] : collectObstacles(elements, connection.from, connection.to, avoid, clearance);

	const starts = endpointCandidates(connection.from, elements);
	const ends = endpointCandidates(connection.to, elements);
	let best: [number, number][] | undefined;
	let bestScore = Number.POSITIVE_INFINITY;
	for (const start of starts) {
		for (const end of ends) {
			const route = routeBetween(start, end, obstacles, routing.mode ?? "orthogonal", clearance);
			const score = routeScore(route, obstacles);
			if (score < bestScore) {
				best = route;
				bestScore = score;
			}
		}
	}
	return simplifyRoute(best ?? [starts[0]?.point ?? [0, 0], ends[0]?.point ?? [0, 0]]);
}

interface RouteEndpointCandidate {
	point: [number, number];
	normal?: [number, number];
	sideRank: number;
}

interface ObstacleRect {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

function endpointCandidates(
	endpoint: ConnectorEndpointRef,
	elements: Map<string, ResolvedElementRecord>,
): RouteEndpointCandidate[] {
	if (endpoint.at) return [{ point: endpoint.at, sideRank: 0 }];
	const element = endpoint.element ? elements.get(endpoint.element) : undefined;
	if (!element) return [{ point: [0, 0], sideRank: 0 }];
	const sides =
		endpoint.side && endpoint.side !== "auto"
			? [normalizeSide(endpoint.side)]
			: (["right", "left", "bottom", "top"] as const);
	return sides.map((side, index) => ({
		point: portForSide(element, side, endpoint.offset ?? 0),
		normal: normalForSide(side),
		sideRank: index,
	}));
}

function normalizeSide(side: NonNullable<ConnectorEndpointRef["side"]>): "top" | "right" | "bottom" | "left" {
	if (side === "front") return "bottom";
	if (side === "back") return "top";
	if (side === "auto") return "right";
	return side;
}

function portForSide(
	element: ResolvedElementRecord,
	side: "top" | "right" | "bottom" | "left",
	offset: number,
): [number, number] {
	const x = element.at[0];
	const y = element.at[1];
	const size = element.size ?? 1;
	if (side === "top") return [x + size * (0.5 + offset), y];
	if (side === "right") return [x + size, y + size * (0.5 + offset)];
	if (side === "bottom") return [x + size * (0.5 - offset), y + size];
	return [x, y + size * (0.5 - offset)];
}

function normalForSide(side: "top" | "right" | "bottom" | "left"): [number, number] {
	if (side === "top") return [0, -1];
	if (side === "right") return [1, 0];
	if (side === "bottom") return [0, 1];
	return [-1, 0];
}

function collectObstacles(
	elements: Map<string, ResolvedElementRecord>,
	from: ConnectorEndpointRef,
	to: ConnectorEndpointRef,
	avoid: "objects" | "none" | string[],
	clearance: number,
): ObstacleRect[] {
	const endpointIds = new Set([from.element, to.element].filter(Boolean));
	const avoidIds = Array.isArray(avoid) ? new Set(avoid) : undefined;
	const obstacles: ObstacleRect[] = [];
	for (const element of elements.values()) {
		if (endpointIds.has(element.id) || element.asset === BUILT_IN_TEXT_ASSET_ID) {
			continue;
		}
		if (avoidIds && !avoidIds.has(element.id)) continue;
		const size = element.size ?? 1;
		obstacles.push({
			minX: element.at[0] - clearance,
			minY: element.at[1] - clearance,
			maxX: element.at[0] + size + clearance,
			maxY: element.at[1] + size + clearance,
		});
	}
	return obstacles;
}

function routeBetween(
	start: RouteEndpointCandidate,
	end: RouteEndpointCandidate,
	obstacles: ObstacleRect[],
	mode: NonNullable<ConnectorRouting["mode"]> = "orthogonal",
	clearance = 0.5,
): [number, number][] {
	const startExit = offsetPort(start, clearance);
	const endEntry = offsetPort(end, clearance);
	const direct = [startExit, endEntry] as [number, number][];
	if (mode === "straight") return direct;
	if (isGridAxisRoute(direct) && !routeIntersectsObstacles(direct, obstacles)) {
		return withEndpointPorts(start, end, direct);
	}

	const candidates: [number, number][][] = [
		[startExit, [endEntry[0], startExit[1]], endEntry],
		[startExit, [startExit[0], endEntry[1]], endEntry],
	];
	const blocking = obstacles.find((obstacle) => segmentIntersectsRect(startExit, endEntry, obstacle));
	if (blocking) {
		const leftX = Math.max(0, blocking.minX);
		const rightX = Math.max(0, blocking.maxX);
		const topY = Math.max(0, blocking.minY);
		const bottomY = Math.max(0, blocking.maxY);
		candidates.push(
			[startExit, [leftX, startExit[1]], [leftX, endEntry[1]], endEntry],
			[startExit, [rightX, startExit[1]], [rightX, endEntry[1]], endEntry],
			[startExit, [startExit[0], topY], [endEntry[0], topY], endEntry],
			[startExit, [startExit[0], bottomY], [endEntry[0], bottomY], endEntry],
		);
	}

	const route =
		candidates
			.map((route) => simplifyRoute(route))
			.sort((a, b) => routeScore(a, obstacles) - routeScore(b, obstacles) || routeLength(a) - routeLength(b))[0] ??
		direct;
	return withEndpointPorts(start, end, route);
}

function offsetPort(endpoint: RouteEndpointCandidate, clearance: number): [number, number] {
	if (!endpoint.normal || clearance <= 0) return endpoint.point;
	return [endpoint.point[0] + endpoint.normal[0] * clearance, endpoint.point[1] + endpoint.normal[1] * clearance];
}

function withEndpointPorts(
	start: RouteEndpointCandidate,
	end: RouteEndpointCandidate,
	route: [number, number][],
): [number, number][] {
	return simplifyRoute([start.point, ...route, end.point]);
}

function routeScore(route: [number, number][], obstacles: ObstacleRect[]): number {
	const intersections = routeIntersectsObstacles(route, obstacles) ? 1000 : 0;
	return intersections + bendCount(route) * 10 + routeLength(route);
}

function routeLength(route: [number, number][]): number {
	let length = 0;
	for (let index = 1; index < route.length; index += 1) {
		length += Math.abs(route[index][0] - route[index - 1][0]) + Math.abs(route[index][1] - route[index - 1][1]);
	}
	return length;
}

function bendCount(route: [number, number][]): number {
	let bends = 0;
	for (let index = 2; index < route.length; index += 1) {
		const a = route[index - 2];
		const b = route[index - 1];
		const c = route[index];
		if ((b[0] - a[0]) * (c[1] - b[1]) !== (b[1] - a[1]) * (c[0] - b[0])) {
			bends += 1;
		}
	}
	return bends;
}

function routeIntersectsObstacles(route: [number, number][], obstacles: ObstacleRect[]): boolean {
	for (let index = 1; index < route.length; index += 1) {
		if (obstacles.some((obstacle) => segmentIntersectsRect(route[index - 1], route[index], obstacle))) {
			return true;
		}
	}
	return false;
}

function segmentIntersectsRect(a: [number, number], b: [number, number], rect: ObstacleRect): boolean {
	if (
		(a[0] < rect.minX && b[0] < rect.minX) ||
		(a[0] > rect.maxX && b[0] > rect.maxX) ||
		(a[1] < rect.minY && b[1] < rect.minY) ||
		(a[1] > rect.maxY && b[1] > rect.maxY)
	) {
		return false;
	}
	if (pointInsideRect(a, rect) || pointInsideRect(b, rect)) return true;
	const corners: [number, number][] = [
		[rect.minX, rect.minY],
		[rect.maxX, rect.minY],
		[rect.maxX, rect.maxY],
		[rect.minX, rect.maxY],
	];
	return [
		[corners[0], corners[1]],
		[corners[1], corners[2]],
		[corners[2], corners[3]],
		[corners[3], corners[0]],
	].some(([c, d]) => segmentsIntersect(a, b, c, d));
}

function pointInsideRect(point: [number, number], rect: ObstacleRect): boolean {
	return point[0] > rect.minX && point[0] < rect.maxX && point[1] > rect.minY && point[1] < rect.maxY;
}

function segmentsIntersect(
	a: [number, number],
	b: [number, number],
	c: [number, number],
	d: [number, number],
): boolean {
	const ccw = (p1: [number, number], p2: [number, number], p3: [number, number]) =>
		(p3[1] - p1[1]) * (p2[0] - p1[0]) > (p2[1] - p1[1]) * (p3[0] - p1[0]);
	return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

function simplifyRoute(route: [number, number][]): [number, number][] {
	const simplified: [number, number][] = [];
	for (const point of route) {
		const previous = simplified[simplified.length - 1];
		if (previous && previous[0] === point[0] && previous[1] === point[1]) {
			continue;
		}
		simplified.push(point);
		while (simplified.length >= 3) {
			const a = simplified[simplified.length - 3];
			const b = simplified[simplified.length - 2];
			const c = simplified[simplified.length - 1];
			if ((b[0] - a[0]) * (c[1] - b[1]) === (b[1] - a[1]) * (c[0] - b[0])) {
				simplified.splice(simplified.length - 2, 1);
			} else {
				break;
			}
		}
	}
	return simplified;
}

function isGridAxisRoute(route: [number, number][]): boolean {
	for (let index = 1; index < route.length; index += 1) {
		const previous = route[index - 1];
		const current = route[index];
		if (previous[0] !== current[0] && previous[1] !== current[1]) {
			return false;
		}
	}
	return true;
}
