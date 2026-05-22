import type {
	CameraFocus,
	ConnectionPatch,
	ConnectionPlacement,
	ConnectionRemoval,
	ElementPatch,
	ElementPlacement,
	ElementRemoval,
	RuntimeCameraFocus,
	RuntimeConnectorState,
	RuntimeElementState,
} from "./node.ts";

/** Scene grid configuration */
export interface GridConfig {
	/** Cell size in projected units (default: 64) */
	cellSize?: number;
}

/** Asset declared in an authored scene document header. */
export interface AssetCatalogEntry {
	/** Unique asset id used by scene elements. */
	id: string;
	/** Optional relative SVG path. Defaults to `id` when omitted. */
	path?: string;
	/**
	 * Normalized point inside the asset viewport that sits on the element's
	 * projected footprint anchor. Defaults to bottom-center `[0.5, 1]`.
	 */
	anchor?: [number, number];
}

/** Logical ground plane and stable layout bounds. */
export interface FloorConfig {
	size?: [number, number];
	origin?: [number, number];
	layer?: string;
	visible?: boolean;
	asset?: string;
}

export type LayoutFit = "contain" | "none";
export type LayoutBounds = "floor" | "content" | "union";

/** Resolved layout emitted to runtime bundles. */
export interface ResolvedLayoutConfig {
	fit: LayoutFit;
	align: [number, number];
	padding: { x: number; y: number };
	bounds: LayoutBounds;
}

/** Layer definition for render order and grouping */
export interface LayerDefinition {
	/** Unique layer name (kebab-case) */
	name: string;
	/** Render order (lower = behind). Defaults to declaration order. */
	order?: number;
}

/** Scene document header. */
export interface SceneHeader {
	version?: string;
	name?: string;
	className?: string;
	assetBaseUrl?: string;
	assets: AssetCatalogEntry[];
	grid?: GridConfig;
	floor?: FloorConfig;
	theme?: string;
	layers: LayerDefinition[];
}

/** Authored scene timeline stop. */
export interface SceneAddDelta {
	elements?: ElementPlacement[];
	connections?: ConnectionPlacement[];
}

/** Authored scene update operation section. */
export interface SceneUpdateDelta {
	elements?: ElementPatch[];
	connections?: ConnectionPatch[];
}

/** Authored scene remove operation section. */
export interface SceneRemoveDelta {
	elements?: ElementRemoval[];
	connections?: ConnectionRemoval[];
}

/** Authored scene timeline stop. */
export interface SceneStep {
	id: string;
	elements?: ElementPlacement[];
	connections?: ConnectionPlacement[];
	add?: SceneAddDelta;
	update?: SceneUpdateDelta;
	remove?: SceneRemoveDelta;
	camera?: CameraFocus;
}

/** Full authored scene document parsed from YAML. */
export interface SceneDocument {
	header: SceneHeader;
	scenes: SceneStep[];
}

/** Compiled runtime scene stop. */
export interface RuntimeSceneStop {
	id: string;
	progress: number;
	elements: RuntimeElementState[];
	connectors: RuntimeConnectorState[];
	camera?: RuntimeCameraFocus;
}
