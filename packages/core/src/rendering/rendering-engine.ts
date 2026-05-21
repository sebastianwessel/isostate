import { resolveTheme } from "../types/asset-registry.ts";
import { RenderError } from "../types/errors.ts";
import type { ConnectorEndpoint, RuntimeConnectorState, RuntimeElementState } from "../types/node.ts";
import type { RuntimeBundle } from "../types/runtime-bundle.ts";
import type { LayerDefinition } from "../types/scene.ts";
import { calculateVisualSize, projectToRaw, projectToScreen } from "../utils/projection.ts";
import { buildKeyframeCSS } from "./animation-css.ts";
import type { AssetResolver } from "./asset-node.ts";
import { createAssetNode, createAssetResolver, createPrimitiveAssetNode, createTextAssetNode } from "./asset-node.ts";
import { applyThemeToElement } from "./theme.ts";

const NS = "http://www.w3.org/2000/svg";
const BUILT_IN_TEXT_ASSET_ID = "text";
const BUILT_IN_PRIMITIVE_ASSET_IDS = new Set(["rectangle", "circle", "polygon", "line"]);
const DEFAULT_CONNECTOR_DASH: Record<"dashed" | "dotted", [number, number]> = {
	dashed: [12, 8],
	dotted: [0, 8],
};
const ENDPOINT_RADIUS_GRID = 0.14;
const ARROW_LENGTH_GRID = 0.35;
const ARROW_WIDTH_GRID = 0.28;
const BAR_WIDTH_GRID = 0.4;

interface Bounds {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

interface ResolvedLayoutState {
	cellSize: number;
	padding: { x: number; y: number };
	contentBounds: Bounds;
	floorBounds: Bounds;
	selectedBounds: Bounds;
	viewBox: { minX: number; minY: number; width: number; height: number };
}

/** Internal state tracked per element node. */
interface ElementState {
	node: SVGGElement;
	isHidden: boolean;
	entryKey?: string;
	exitKey?: string;
	ambient: Set<string>;
}

/** Internal state tracked per connector node. */
interface ConnectorState {
	node: SVGGElement;
	shaft: SVGPathElement;
	isHidden: boolean;
	ambient: Set<string>;
}

/** Extended SVG with engine internals stored on it. */
interface SceneSVG extends SVGSVGElement {
	_layerMap: Map<string, Required<LayerDefinition>>;
	_elementMap: Map<string, ElementState>;
	_connectorMap: Map<string, ConnectorState>;
	_layout: ResolvedLayoutState;
	_viewBoxW: number;
	_viewBoxH: number;
}

export interface RenderConfig {
	label?: string;
	themeVars?: Record<string, string>;
}

// ── Public API ────────────────────────────────────────────────────────────

/** Build the SVG DOM for a compiled runtime bundle and mount it into a container. */
export function buildSceneDOM(container: HTMLElement, bundle: RuntimeBundle, config?: RenderConfig): SVGSVGElement {
	const layout = resolveSceneLayout(bundle);
	const initialStop = bundle.scenes[0];
	const allElements = collectElementDefinitions(bundle);
	const allConnectors = collectConnectorDefinitions(bundle);
	const initialById = new Map((initialStop?.elements ?? []).map((element) => [element.id, element]));
	const initialConnectorsById = new Map((initialStop?.connectors ?? []).map((connector) => [connector.id, connector]));

	const svg = createRootSvg(layout, config?.label, bundle.className);
	const assetResolver = createAssetResolver(bundle);

	svg.appendChild(createCssDefs());

	applyThemeToElement(svg, {
		...(resolveTheme(bundle.theme) ?? {}),
		...(bundle.themeVars ?? {}),
		...(config?.themeVars ?? {}),
	});

	const sortedLayers = sortLayers(bundle.layers);
	const layerMap = createLayerMap(sortedLayers);
	if (bundle.floor.visible) {
		svg.appendChild(createFloorGrid(bundle, layout));
	}

	const connectorMap = new Map<string, ConnectorState>();
	for (const def of allConnectors) {
		const initial = initialConnectorsById.get(def.id) ?? {
			...def,
			presence: "removed",
		};
		const state = createConnectorInstance(initial, layout);
		if (initial.presence === "removed") {
			state.isHidden = true;
			hideElementAfterExit(state.node);
		}
		applyConnectorAmbientClasses(state, initial.ambient ?? []);
		svg.appendChild(state.node);
		connectorMap.set(def.id, state);
	}

	const depthGroup = document.createElementNS(NS, "g") as SVGGElement;
	depthGroup.classList.add("iso-depth-layer");
	depthGroup.setAttribute("data-layer", "depth");
	svg.appendChild(depthGroup);

	const labelGroup = document.createElementNS(NS, "g") as SVGGElement;
	labelGroup.classList.add("iso-layer", "iso-layer-labels");
	labelGroup.setAttribute("data-layer", "labels");
	svg.appendChild(labelGroup);

	const elementMap = new Map<string, ElementState>();
	const sortedElements = sortElementsForPerspective(allElements);
	for (const def of sortedElements) {
		const declaredLayer = layerMap.get(def.layer);
		if (!declaredLayer) {
			throw new RenderError("MISSING_LAYER", `Unknown layer for "${def.id}": ${def.layer}`);
		}

		const initial = initialById.get(def.id) ?? {
			...def,
			presence: "removed",
		};
		const instance = createElementInstance(initial, layout, assetResolver);
		instance.node.classList.add(`iso-layer-${def.layer}`);
		instance.node.setAttribute("data-layer", def.layer);
		if (initial.presence === "removed") {
			instance.isHidden = true;
			hideElementAfterExit(instance.node);
		}
		applyAmbientClasses(instance, initial.ambient ?? []);
		const parent = isTextAsset(def.asset) ? labelGroup : depthGroup;
		parent.appendChild(instance.node);
		elementMap.set(def.id, instance);
	}

	svg._layerMap = layerMap;
	svg._elementMap = elementMap;
	svg._connectorMap = connectorMap;
	container.appendChild(svg);
	return svg;
}

/** Update transforms and ambient classes for a live set of interpolated runtime values. */
export function updateElementTransforms(
	svg: SVGSVGElement & {
		_elementMap?: Map<string, ElementState | unknown>;
		_connectorMap?: Map<string, ConnectorState | unknown>;
		_layout?: ResolvedLayoutState;
	},
	elements: RuntimeElementState[],
	connectors: RuntimeConnectorState[] = [],
): void {
	const layout = svg._layout;
	if (!layout) return;

	const map = svg._elementMap;
	if (map) {
		for (const def of elements) {
			const state = map.get(def.id) as ElementState | undefined;
			if (!state) continue;
			updateGeneratedElementContent(state.node, def, layout);
			applyElementTransform(state.node, def, layout);
			applyAmbientClasses(state, def.ambient ?? []);
		}
	}

	const connectorMap = svg._connectorMap;
	if (!connectorMap) return;
	for (const def of connectors) {
		const state = connectorMap.get(def.id) as ConnectorState | undefined;
		if (!state) continue;
		applyConnectorState(state, def, layout);
	}
}

/** Read the internal ElementState for an element by its id. */
export function getElementState(
	svg: SVGSVGElement & { _elementMap?: Map<string, ElementState | unknown> },
	id: string,
): ElementState | undefined {
	return svg._elementMap?.get(id) as ElementState | undefined;
}

/** Read the internal ConnectorState for a connector by its id. */
export function getConnectorState(
	svg: SVGSVGElement & {
		_connectorMap?: Map<string, ConnectorState | unknown>;
	},
	id: string,
): ConnectorState | undefined {
	return svg._connectorMap?.get(id) as ConnectorState | undefined;
}

export function getResolvedViewBox(bundle: RuntimeBundle): {
	minX: number;
	minY: number;
	width: number;
	height: number;
} {
	return resolveSceneLayout(bundle).viewBox;
}

// ── Lifecycle helpers ─────────────────────────────────────────────────────

/** Hide an element after its exit animation completes. */
export function hideElementAfterExit(node: SVGElement): void {
	node.style.visibility = "hidden";
	node.style.pointerEvents = "none";
}

/** Show an element on re-addition. */
export function unhideElementOnReadd(node: SVGElement): void {
	node.style.visibility = "visible";
	node.style.pointerEvents = "auto";
}

/** Create a new element SVG instance for lifecycle re-instantiation. */
export function createNewElementInstance(def: RuntimeElementState, parent?: SVGGElement | null): SVGGElement {
	const layout: ResolvedLayoutState = {
		cellSize: 64,
		padding: { x: 0, y: 0 },
		contentBounds: emptyBounds(),
		floorBounds: emptyBounds(),
		selectedBounds: { minX: 0, minY: 0, maxX: 64, maxY: 64 },
		viewBox: { minX: 0, minY: 0, width: 64, height: 64 },
	};
	const instance = createElementInstance(def, layout, createAssetResolver());
	parent?.appendChild(instance.node);
	return instance.node;
}

/** Remove an element node from the DOM. */
export function removeElementNode(node: SVGElement): void {
	node.parentElement?.removeChild(node);
}

// ── Layout helpers ────────────────────────────────────────────────────────

function resolveSceneLayout(bundle: RuntimeBundle): ResolvedLayoutState {
	const cellSize = bundle.grid.cellSize;
	const padding = bundle.layout.padding;
	const contentBounds = calculateContentBounds(bundle, cellSize);
	const floorBounds = calculateFloorBounds(bundle, cellSize);
	const selectedBounds = selectBounds(bundle.layout.bounds, contentBounds, floorBounds);
	const width = selectedBounds.maxX - selectedBounds.minX + padding.x * 2;
	const height = selectedBounds.maxY - selectedBounds.minY + padding.y * 2;
	const viewBox = {
		minX: 0,
		minY: 0,
		width: roundDimension(width || cellSize),
		height: roundDimension(height || cellSize),
	};

	return {
		cellSize,
		padding,
		contentBounds,
		floorBounds,
		selectedBounds,
		viewBox,
	};
}

function calculateContentBounds(bundle: RuntimeBundle, cellSize: number): Bounds {
	let bounds = emptyBounds();
	for (const stop of bundle.scenes) {
		for (const element of stop.elements ?? []) {
			if (element.presence === "removed") continue;
			const { rawX, rawY } = projectToRaw(element.pos[0] + element.size, element.pos[1] + element.size, cellSize);
			const visualSize = calculateVisualSize(element.size, cellSize);
			const [anchorX, anchorY] = assetAnchorForBounds(bundle, element);
			bounds = includeBounds(bounds, {
				minX: rawX - visualSize * anchorX,
				minY: rawY - visualSize * anchorY,
				maxX: rawX + visualSize * (1 - anchorX),
				maxY: rawY + visualSize * (1 - anchorY),
			});
		}
		for (const connector of stop.connectors ?? []) {
			if (connector.presence === "removed") continue;
			bounds = includeBounds(bounds, calculateConnectorBounds(connector, cellSize));
		}
	}
	return normalizeBounds(bounds, cellSize);
}

function assetAnchorForBounds(bundle: RuntimeBundle, element: RuntimeElementState): [number, number] {
	return bundle.assets?.[element.asset]?.anchor ?? [0.5, 1];
}

function calculateConnectorBounds(connector: RuntimeConnectorState, cellSize: number): Bounds {
	let bounds = emptyBounds();
	for (const [x, y] of connector.route) {
		const { rawX, rawY } = projectToRaw(x, y, cellSize);
		bounds = includePoint(bounds, rawX, rawY);
	}
	const endpointPadding = Math.max(ARROW_LENGTH_GRID, BAR_WIDTH_GRID, ENDPOINT_RADIUS_GRID * 2) * cellSize;
	const strokePadding = connector.style.strokeWidth / 2 + (connector.style.outlineWidth ?? 0);
	const padding = endpointPadding + strokePadding;
	return {
		minX: bounds.minX - padding,
		minY: bounds.minY - padding,
		maxX: bounds.maxX + padding,
		maxY: bounds.maxY + padding,
	};
}

function calculateFloorBounds(bundle: RuntimeBundle, cellSize: number): Bounds {
	const origin = bundle.floor.origin;
	const [width, height] = bundle.floor.size;
	const points: Array<[number, number]> = [
		origin,
		[origin[0] + width, origin[1]],
		[origin[0], origin[1] + height],
		[origin[0] + width, origin[1] + height],
	];
	let bounds = emptyBounds();
	for (const [x, y] of points) {
		const { rawX, rawY } = projectToRaw(x, y, cellSize);
		bounds = includePoint(bounds, rawX, rawY);
	}
	return normalizeBounds(bounds, cellSize);
}

function selectBounds(mode: RuntimeBundle["layout"]["bounds"], content: Bounds, floor: Bounds): Bounds {
	if (mode === "content") return content;
	if (mode === "floor") return floor;
	return includeBounds(content, floor);
}

function emptyBounds(): Bounds {
	return {
		minX: Number.POSITIVE_INFINITY,
		minY: Number.POSITIVE_INFINITY,
		maxX: Number.NEGATIVE_INFINITY,
		maxY: Number.NEGATIVE_INFINITY,
	};
}

function normalizeBounds(bounds: Bounds, cellSize: number): Bounds {
	if (Number.isFinite(bounds.minX)) return bounds;
	return { minX: 0, minY: 0, maxX: cellSize, maxY: cellSize };
}

function includePoint(bounds: Bounds, x: number, y: number): Bounds {
	return {
		minX: Math.min(bounds.minX, x),
		minY: Math.min(bounds.minY, y),
		maxX: Math.max(bounds.maxX, x),
		maxY: Math.max(bounds.maxY, y),
	};
}

function includeBounds(bounds: Bounds, next: Bounds): Bounds {
	return {
		minX: Math.min(bounds.minX, next.minX),
		minY: Math.min(bounds.minY, next.minY),
		maxX: Math.max(bounds.maxX, next.maxX),
		maxY: Math.max(bounds.maxY, next.maxY),
	};
}

function roundDimension(value: number): number {
	return Math.round(value * 1000) / 1000;
}

// ── Private helpers ───────────────────────────────────────────────────────

function createRootSvg(layout: ResolvedLayoutState, label?: string, className?: string): SceneSVG {
	const svg = document.createElementNS(NS, "svg") as SceneSVG;
	svg.classList.add("iso-scene");
	for (const token of className?.trim().split(/\s+/) ?? []) {
		if (token) svg.classList.add(token);
	}
	svg.setAttribute("width", "100%");
	svg.setAttribute("height", "100%");
	svg.setAttribute(
		"viewBox",
		`${layout.viewBox.minX} ${layout.viewBox.minY} ${layout.viewBox.width} ${layout.viewBox.height}`,
	);
	svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
	svg.style.width = "100%";
	svg.style.height = "100%";
	svg.style.display = "block";
	if (label) {
		svg.setAttribute("role", "img");
		svg.setAttribute("aria-label", label);
	} else {
		svg.setAttribute("aria-hidden", "true");
	}
	svg._layout = layout;
	svg._viewBoxW = layout.viewBox.width;
	svg._viewBoxH = layout.viewBox.height;
	return svg;
}

function createCssDefs(): SVGStyleElement {
	const styleEl = document.createElementNS(NS, "style") as SVGStyleElement;
	styleEl.textContent = buildKeyframeCSS();
	return styleEl;
}

function createFloorGrid(bundle: RuntimeBundle, layout: ResolvedLayoutState): SVGGElement {
	const group = document.createElementNS(NS, "g") as SVGGElement;
	group.classList.add("iso-floor-grid", `iso-layer-${bundle.floor.layer}`);
	group.setAttribute("data-layer", bundle.floor.layer);

	const [originX, originY] = bundle.floor.origin;
	const [columns, rows] = bundle.floor.size;
	const corners = [
		projectGridPoint(originX, originY, layout),
		projectGridPoint(originX + columns, originY, layout),
		projectGridPoint(originX + columns, originY + rows, layout),
		projectGridPoint(originX, originY + rows, layout),
	];

	const slab = document.createElementNS(NS, "polygon");
	slab.classList.add("iso-floor-slab");
	slab.setAttribute("points", corners.map(pointToString).join(" "));
	slab.setAttribute("fill", "#dbe6f4");
	slab.setAttribute("fill-opacity", "0.22");
	slab.setAttribute("stroke", "#b9c9df");
	slab.setAttribute("stroke-width", "1");
	group.appendChild(slab);

	for (let x = 0; x <= columns; x++) {
		group.appendChild(
			createFloorLine(
				projectGridPoint(originX + x, originY, layout),
				projectGridPoint(originX + x, originY + rows, layout),
			),
		);
	}

	for (let y = 0; y <= rows; y++) {
		group.appendChild(
			createFloorLine(
				projectGridPoint(originX, originY + y, layout),
				projectGridPoint(originX + columns, originY + y, layout),
			),
		);
	}

	return group;
}

function createFloorLine(start: { x: number; y: number }, end: { x: number; y: number }): SVGLineElement {
	const line = document.createElementNS(NS, "line") as SVGLineElement;
	line.setAttribute("x1", String(start.x));
	line.setAttribute("y1", String(start.y));
	line.setAttribute("x2", String(end.x));
	line.setAttribute("y2", String(end.y));
	line.setAttribute("stroke", "#2563eb");
	line.setAttribute("stroke-width", "1");
	line.setAttribute("stroke-dasharray", "5 5");
	line.setAttribute("stroke-opacity", "0.2");
	return line;
}

function projectGridPoint(x: number, y: number, layout: ResolvedLayoutState): { x: number; y: number } {
	const screen = projectToScreen(
		x,
		y,
		layout.cellSize,
		layout.selectedBounds.minX,
		layout.selectedBounds.minY,
		layout.padding.x,
		layout.padding.y,
	);
	return { x: screen.screenX, y: screen.screenY };
}

function pointToString(point: { x: number; y: number }): string {
	return `${point.x},${point.y}`;
}

function createLayerMap(layers: Required<LayerDefinition>[]): Map<string, Required<LayerDefinition>> {
	return new Map(layers.map((layer) => [layer.name, layer]));
}

function sortLayers(layers: LayerDefinition[]): Required<LayerDefinition>[] {
	return [...layers]
		.map((layer, index) => ({ name: layer.name, order: layer.order ?? index }))
		.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

function sortElementsForPerspective(elements: RuntimeElementState[]): RuntimeElementState[] {
	return elements.slice().sort((a, b) => {
		const bucket = renderBucket(a) - renderBucket(b);
		if (bucket !== 0) return bucket;
		const depth = a.pos[0] + a.pos[1] - (b.pos[0] + b.pos[1]);
		if (depth !== 0) return depth;
		return a.id.localeCompare(b.id);
	});
}

function renderBucket(element: RuntimeElementState): number {
	if (isPrimitiveAsset(element.asset)) return 0;
	if (isTextAsset(element.asset)) return 2;
	return 1;
}

function collectElementDefinitions(bundle: RuntimeBundle): RuntimeElementState[] {
	const byId = new Map<string, RuntimeElementState>();
	for (const stop of bundle.scenes) {
		for (const element of stop.elements ?? []) {
			if (!byId.has(element.id) || byId.get(element.id)?.presence === "removed") {
				byId.set(element.id, element);
			}
		}
	}
	return [...byId.values()];
}

function collectConnectorDefinitions(bundle: RuntimeBundle): RuntimeConnectorState[] {
	const byId = new Map<string, RuntimeConnectorState>();
	for (const stop of bundle.scenes) {
		for (const connector of stop.connectors ?? []) {
			if (!byId.has(connector.id) || byId.get(connector.id)?.presence === "removed") {
				byId.set(connector.id, connector);
			}
		}
	}
	return [...byId.values()];
}

/** Create a single element SVG instance applying entry animation. */
function createElementInstance(
	def: RuntimeElementState,
	layout: ResolvedLayoutState,
	resolveAsset: AssetResolver,
): ElementState {
	const node =
		def.asset === BUILT_IN_TEXT_ASSET_ID
			? createTextAssetNode(def.text, def.asset, layout.cellSize)
			: isPrimitiveAsset(def.asset)
				? createPrimitiveAssetNode(def.asset, def.primitive, layout.cellSize)
				: createResolvedAssetNode(def, resolveAsset, layout.cellSize);
	node.classList.add("iso-element", `iso-element-${def.id}`);
	node.setAttribute("data-id", def.id);
	node.setAttribute("data-asset", def.asset);
	node.style.overflow = "visible";
	node.style.pointerEvents = "auto";
	applyElementTransform(node, def, layout);

	const entryAnim = def.enter;
	if (entryAnim && entryAnim !== "none" && def.presence !== "removed") {
		const keyName = `iso-anim-${entryAnim}`;
		animateElement(node, keyName, "enter");
		node.addEventListener(
			"animationend",
			() => {
				node.style.animation = "";
			},
			{ once: true },
		);
		return { node, isHidden: false, entryKey: entryAnim, ambient: new Set() };
	}

	return { node, isHidden: false, ambient: new Set() };
}

function isTextAsset(assetId: string): boolean {
	return assetId === BUILT_IN_TEXT_ASSET_ID;
}

function isPrimitiveAsset(assetId: string): boolean {
	return BUILT_IN_PRIMITIVE_ASSET_IDS.has(assetId);
}

function createResolvedAssetNode(def: RuntimeElementState, resolveAsset: AssetResolver, cellSize: number): SVGGElement {
	const asset = resolveAsset(def.asset);
	if (!asset) {
		throw new RenderError("ASSET_NOT_FOUND", `Asset not found: ${def.asset}`, {
			asset: def.asset,
			elementId: def.id,
		});
	}
	return createAssetNode(asset, def.asset, cellSize);
}

function updateGeneratedElementContent(node: SVGGElement, def: RuntimeElementState, layout: ResolvedLayoutState): void {
	if (!isTextAsset(def.asset) && !isPrimitiveAsset(def.asset)) return;
	const replacement = isTextAsset(def.asset)
		? createTextAssetNode(def.text, def.asset, layout.cellSize)
		: createPrimitiveAssetNode(def.asset, def.primitive, layout.cellSize);
	clearChildren(node);
	while (replacement.firstChild) {
		const child = replacement.firstChild;
		replacement.removeChild(child);
		node.appendChild(child);
	}
}

function createConnectorInstance(def: RuntimeConnectorState, layout: ResolvedLayoutState): ConnectorState {
	const node = document.createElementNS(NS, "g") as SVGGElement;
	const shaft = document.createElementNS(NS, "path") as SVGPathElement;
	const state = { node, shaft, isHidden: false, ambient: new Set<string>() };
	applyConnectorState(state, def, layout);

	const entryAnim = def.enter;
	if (entryAnim && entryAnim !== "none" && def.presence !== "removed") {
		animateElement(node, `iso-anim-${entryAnim}`, "enter");
		node.addEventListener(
			"animationend",
			() => {
				node.style.animation = "";
			},
			{ once: true },
		);
	}

	return state;
}

function applyConnectorState(state: ConnectorState, def: RuntimeConnectorState, layout: ResolvedLayoutState): void {
	applyConnectorGroupAttrs(state.node, def);
	clearChildren(state.node);

	const d = routePath(def.route, layout);
	if (shouldRenderOutline(def)) {
		const outline = document.createElementNS(NS, "path") as SVGPathElement;
		outline.classList.add("iso-connector-outline");
		applyConnectorPathAttrs(outline, def, d, {
			stroke: def.style.outline ?? def.style.stroke,
			strokeWidth: def.style.strokeWidth + def.style.outlineWidth * 2,
			includeDash: false,
		});
		state.node.appendChild(outline);
	}

	state.shaft = document.createElementNS(NS, "path") as SVGPathElement;
	state.shaft.classList.add("iso-connector-shaft");
	applyConnectorPathAttrs(state.shaft, def, d, {
		stroke: def.style.stroke,
		strokeWidth: def.style.strokeWidth,
		includeDash: true,
	});
	state.node.appendChild(state.shaft);

	if (def.style.variant === "road" && def.style.lane === "center-dashed") {
		const lane = document.createElementNS(NS, "path") as SVGPathElement;
		lane.classList.add("iso-connector-lane");
		applyConnectorPathAttrs(lane, def, d, {
			stroke: "#ffffff",
			strokeWidth: Math.max(1, def.style.strokeWidth * 0.12),
			includeDash: false,
		});
		lane.setAttribute("stroke-dasharray", "8 8");
		state.node.appendChild(lane);
	}

	appendEndpoint(state.node, def, "start", layout);
	appendEndpoint(state.node, def, "end", layout);
	applyConnectorAmbientClasses(state, def.ambient ?? []);
}

function clearChildren(node: SVGElement): void {
	while (node.firstChild) node.removeChild(node.firstChild);
}

function applyConnectorGroupAttrs(node: SVGGElement, def: RuntimeConnectorState): void {
	node.setAttribute(
		"class",
		[
			"iso-connector",
			`iso-connector-${def.id}`,
			`iso-connector-variant-${def.style.variant}`,
			`iso-connector-pattern-${def.style.pattern}`,
			`iso-connector-direction-${def.direction}`,
			`iso-layer-${def.layer}`,
		].join(" "),
	);
	node.setAttribute("data-id", def.id);
	node.setAttribute("data-layer", def.layer);
	node.style.overflow = "visible";
	node.style.pointerEvents = "auto";
}

function shouldRenderOutline(def: RuntimeConnectorState): boolean {
	return Boolean(def.style.outline && def.style.outlineWidth > 0);
}

function applyConnectorPathAttrs(
	path: SVGPathElement,
	def: RuntimeConnectorState,
	d: string,
	options: { stroke: string; strokeWidth: number; includeDash: boolean },
): void {
	path.setAttribute("d", d);
	path.setAttribute("fill", "none");
	path.setAttribute("stroke", options.stroke);
	path.setAttribute("stroke-width", String(options.strokeWidth));
	path.setAttribute("stroke-linecap", "round");
	path.setAttribute("stroke-linejoin", "round");
	path.setAttribute("opacity", String(def.style.opacity));
	if (options.includeDash && def.style.pattern !== "solid") {
		const dash = def.style.dash ?? DEFAULT_CONNECTOR_DASH[def.style.pattern];
		path.setAttribute("stroke-dasharray", dash.join(" "));
	}
}

function routePath(route: [number, number][], layout: ResolvedLayoutState): string {
	return route
		.map((point, index) => {
			const projected = projectGridPoint(point[0], point[1], layout);
			return `${index === 0 ? "M" : "L"} ${projected.x} ${projected.y}`;
		})
		.join(" ");
}

function appendEndpoint(
	group: SVGGElement,
	def: RuntimeConnectorState,
	kind: "start" | "end",
	layout: ResolvedLayoutState,
): void {
	const endpoint = def[kind];
	if (endpoint === "none" || def.route.length < 2) return;

	const node = createEndpointNode(endpoint, def, kind, layout);
	node.classList.add(`iso-connector-${kind}`);
	group.appendChild(node);
}

function createEndpointNode(
	endpoint: ConnectorEndpoint,
	def: RuntimeConnectorState,
	kind: "start" | "end",
	layout: ResolvedLayoutState,
): SVGElement {
	switch (endpoint) {
		case "arrow":
			return createArrowEndpoint(def, kind, layout);
		case "dot":
			return createCircleEndpoint(def, kind, layout, true);
		case "circle":
			return createCircleEndpoint(def, kind, layout, false);
		case "diamond":
			return createDiamondEndpoint(def, kind, layout);
		case "bar":
			return createBarEndpoint(def, kind, layout);
		case "none":
			throw new RenderError("CONNECTOR_ENDPOINT_NONE", "Cannot create geometry for endpoint none");
	}
}

function createArrowEndpoint(
	def: RuntimeConnectorState,
	kind: "start" | "end",
	layout: ResolvedLayoutState,
): SVGPolygonElement {
	const tip = endpointPoint(def, kind);
	const direction = endpointDirection(def, kind);
	const perpendicular: [number, number] = [-direction[1], direction[0]];
	const base: [number, number] = [tip[0] - direction[0] * ARROW_LENGTH_GRID, tip[1] - direction[1] * ARROW_LENGTH_GRID];
	const halfWidth = ARROW_WIDTH_GRID / 2;
	const points = [
		tip,
		[base[0] + perpendicular[0] * halfWidth, base[1] + perpendicular[1] * halfWidth] as [number, number],
		[base[0] - perpendicular[0] * halfWidth, base[1] - perpendicular[1] * halfWidth] as [number, number],
	].map((point) => projectGridPoint(point[0], point[1], layout));

	const polygon = document.createElementNS(NS, "polygon") as SVGPolygonElement;
	polygon.setAttribute("points", points.map(pointToString).join(" "));
	polygon.setAttribute("fill", def.style.stroke);
	polygon.setAttribute("opacity", String(def.style.opacity));
	return polygon;
}

function createCircleEndpoint(
	def: RuntimeConnectorState,
	kind: "start" | "end",
	layout: ResolvedLayoutState,
	filled: boolean,
): SVGCircleElement {
	const point = endpointPoint(def, kind);
	const projected = projectGridPoint(point[0], point[1], layout);
	const circle = document.createElementNS(NS, "circle") as SVGCircleElement;
	circle.setAttribute("cx", String(projected.x));
	circle.setAttribute("cy", String(projected.y));
	circle.setAttribute("r", String(ENDPOINT_RADIUS_GRID * layout.cellSize));
	circle.setAttribute("stroke", def.style.stroke);
	circle.setAttribute("stroke-width", String(Math.max(1, def.style.strokeWidth)));
	circle.setAttribute("opacity", String(def.style.opacity));
	circle.setAttribute("fill", filled ? def.style.stroke : "none");
	return circle;
}

function createDiamondEndpoint(
	def: RuntimeConnectorState,
	kind: "start" | "end",
	layout: ResolvedLayoutState,
): SVGPolygonElement {
	const center = endpointPoint(def, kind);
	const radius = ENDPOINT_RADIUS_GRID;
	const points: [number, number][] = [
		[center[0], center[1] - radius],
		[center[0] + radius, center[1]],
		[center[0], center[1] + radius],
		[center[0] - radius, center[1]],
	];
	const polygon = document.createElementNS(NS, "polygon") as SVGPolygonElement;
	polygon.setAttribute(
		"points",
		points
			.map((point) => projectGridPoint(point[0], point[1], layout))
			.map(pointToString)
			.join(" "),
	);
	polygon.setAttribute("fill", def.style.stroke);
	polygon.setAttribute("opacity", String(def.style.opacity));
	return polygon;
}

function createBarEndpoint(
	def: RuntimeConnectorState,
	kind: "start" | "end",
	layout: ResolvedLayoutState,
): SVGLineElement {
	const center = endpointPoint(def, kind);
	const direction = endpointDirection(def, kind);
	const perpendicular: [number, number] = [-direction[1], direction[0]];
	const half = BAR_WIDTH_GRID / 2;
	const a = projectGridPoint(center[0] + perpendicular[0] * half, center[1] + perpendicular[1] * half, layout);
	const b = projectGridPoint(center[0] - perpendicular[0] * half, center[1] - perpendicular[1] * half, layout);
	const line = document.createElementNS(NS, "line") as SVGLineElement;
	line.setAttribute("x1", String(a.x));
	line.setAttribute("y1", String(a.y));
	line.setAttribute("x2", String(b.x));
	line.setAttribute("y2", String(b.y));
	line.setAttribute("stroke", def.style.stroke);
	line.setAttribute("stroke-width", String(Math.max(1, def.style.strokeWidth)));
	line.setAttribute("stroke-linecap", "round");
	line.setAttribute("opacity", String(def.style.opacity));
	return line;
}

function endpointPoint(def: RuntimeConnectorState, kind: "start" | "end"): [number, number] {
	return kind === "start" ? def.route[0] : def.route[def.route.length - 1];
}

function endpointDirection(def: RuntimeConnectorState, kind: "start" | "end"): [number, number] {
	const point =
		kind === "start"
			? vectorBetween(def.route[0], def.route[1])
			: vectorBetween(def.route[def.route.length - 2], def.route[def.route.length - 1]);
	const effective = def.direction === "reverse" ? ([-point[0], -point[1]] as [number, number]) : point;
	return normalizeVector(effective);
}

function vectorBetween(start: [number, number], end: [number, number]): [number, number] {
	return [end[0] - start[0], end[1] - start[1]];
}

function normalizeVector(vector: [number, number]): [number, number] {
	const length = Math.hypot(vector[0], vector[1]);
	if (length === 0) return [1, 0];
	return [vector[0] / length, vector[1] / length];
}

function applyElementTransform(node: SVGGElement, def: RuntimeElementState, layout: ResolvedLayoutState): void {
	const screen = projectToScreen(
		def.pos[0] + def.size,
		def.pos[1] + def.size,
		layout.cellSize,
		layout.selectedBounds.minX,
		layout.selectedBounds.minY,
		layout.padding.x,
		layout.padding.y,
	);
	const visualSize = calculateVisualSize(def.size, layout.cellSize);
	const scale = visualSize / layout.cellSize;
	node.setAttribute("transform", `translate(${screen.screenX} ${screen.screenY}) scale(${scale})`);
}

function applyAmbientClasses(state: ElementState, ambient: RuntimeElementState["ambient"]): void {
	const next = new Set((ambient ?? []).map((item) => item.name));
	for (const name of state.ambient) {
		if (!next.has(name)) state.node.classList.remove(`iso-ambient-${name}`);
	}
	for (const name of next) {
		if (!state.ambient.has(name)) state.node.classList.add(`iso-ambient-${name}`);
	}
	state.ambient = next;
}

function applyConnectorAmbientClasses(state: ConnectorState, ambient: RuntimeConnectorState["ambient"]): void {
	const next = new Set((ambient ?? []).map((item) => item.name));
	for (const name of state.ambient) {
		if (!next.has(name)) state.shaft.classList.remove(`iso-ambient-${name}`);
	}
	for (const name of next) {
		if (!state.ambient.has(name)) state.shaft.classList.add(`iso-ambient-${name}`);
	}
	state.ambient = next;
}

/** Apply a CSS keyframe animation to an element. */
export function animateElement(node: SVGElement, keyframeName: string, type: "enter" | "exit" = "enter"): void {
	node.style.opacity = "1";
	node.style.animation = "none";
	node.getBoundingClientRect();
	const duration = type === "exit" ? "var(--iso-anim-duration-exit, 300ms)" : "var(--iso-anim-duration-enter, 400ms)";
	const easing = type === "exit" ? "var(--iso-anim-easing-exit, ease-in)" : "var(--iso-anim-easing-enter, ease-out)";
	node.style.animation = `${keyframeName} ${duration} ${easing} forwards`;
}
