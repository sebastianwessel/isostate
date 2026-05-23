export type SpriteDefinition =
	| [number, number]
	| {
			at?: [number, number];
			rect?: [number, number, number, number];
			anchor?: [number, number];
	  };

/** Authored standalone URL asset metadata used by tooling and catalogs. */
export interface UrlAssetDefinition {
	/** Unique asset id used by authored YAML and runtime elements. */
	id: string;
	/** Optional relative SVG path. Defaults to `id` when omitted. */
	path?: string;
	/**
	 * Normalized point inside the asset viewport that sits on the element's
	 * projected footprint anchor. Defaults to bottom-center `[0.5, 1]`.
	 */
	anchor?: [number, number];
	/** Optional category for authoring tooling. */
	category?: AssetCategory;
}

/** Authored sprite sheet metadata used by tooling and catalogs. */
export interface SpriteSheetAssetDefinition {
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
	/** Optional category for authoring tooling. */
	category?: AssetCategory;
}

/** Authored asset metadata used by tooling and catalogs. */
export type AssetDefinition = UrlAssetDefinition | SpriteSheetAssetDefinition;

/** Asset categories for filtering and authoring tooling. */
export type AssetCategory = "building" | "nature" | "infrastructure" | "equipment" | "decoration" | "custom";

/** Mutable metadata registry used by authoring tooling, not browser rendering. */
export interface AssetRegistry {
	/** Register or replace an asset definition by `asset.id`. */
	register(asset: AssetDefinition): void;
	/** Get a single asset by id. */
	get(id: string): AssetDefinition | undefined;
	/** Get all assets, optionally filtered by category. */
	getAll(category?: AssetCategory): AssetDefinition[];
	/** Check if an asset id exists. */
	has(id: string): boolean;
	/** Remove an asset by id. */
	remove(id: string): void;
}

/** Theme definition mapping CSS custom property names to values. */
export interface Theme {
	/** Theme id used in scene headers and runtime bundles. */
	name: string;
	/** CSS custom property name to value mapping. */
	vars: Record<string, string>;
}
