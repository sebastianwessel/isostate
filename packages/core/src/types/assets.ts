/** Authored asset metadata used by tooling and catalogs. */
export interface AssetDefinition {
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
