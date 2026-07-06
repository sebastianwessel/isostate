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

export type SpriteDefinition =
	| [number, number]
	| {
			at?: [number, number];
			rect?: [number, number, number, number];
			anchor?: [number, number];
	  };

/** Standalone URL asset declared in an authored scene document header. */
export interface UrlAssetCatalogEntry {
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

/** Sprite sheet declared in an authored scene document header. */
export interface SpriteSheetAssetCatalogEntry {
	/** Namespace id for the sheet; nested sprite ids are used by scene elements. */
	id: string;
	type: "sprite-sheet";
	/** Relative image path with explicit extension. */
	path: string;
	/** Source image size in pixels. */
	sheetSize: [number, number];
	/** Regular tile size in pixels for grid-addressed sprites. */
	tileSize?: [number, number];
	/** Default normalized anchor inherited by sprites. */
	anchor?: [number, number];
	/** Logical placeable asset ids exposed by this sheet. */
	sprites: Record<string, SpriteDefinition>;
}

/** Asset declared in an authored scene document header. */
export type AssetCatalogEntry = UrlAssetCatalogEntry | SpriteSheetAssetCatalogEntry;

/** Logical ground plane and stable layout bounds. */
export interface FloorConfig {
	size?: [number, number];
	origin?: [number, number];
	layer?: string;
	visible?: boolean;
	asset?: string;
}

/** Scaling behavior: `contain` fits content in the viewport, `none` uses the compiled viewBox as-is. */
export type LayoutFit = "contain" | "none";
/** Source used to compute the viewBox bounds. */
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
