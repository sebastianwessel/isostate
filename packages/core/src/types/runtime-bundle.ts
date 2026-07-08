import type { AssetCategory } from "./assets.ts";
import type { RuntimeSceneStop } from "./scene.ts";

/** Compiled URL or sprite-sheet asset entry emitted to a runtime bundle. */
export interface CompiledAsset {
	/** Browser-loadable asset URL. Omitted for reserved built-in generated assets. */
	url?: string;
	/** Asset category, used for editor/tooling grouping. */
	category?: AssetCategory;
	/** Normalized viewport anchor aligning the asset's visual ground contact to the grid. */
	anchor?: [number, number];
	/** Sprite sheet tile metadata, present when this asset id resolves to a sprite. */
	sprite?: CompiledSprite;
}

/** Compiled sprite sheet tile location within a shared sprite image. */
export interface CompiledSprite {
	/** Full sprite sheet image size in pixels. */
	sheetSize: [number, number];
	/** Tile rectangle within the sheet: `[x, y, width, height]` in pixels. */
	rect: [number, number, number, number];
}

/** Compiled scene floor placement and visibility. */
export interface CompiledFloor {
	/** Floor size in whole grid cells. */
	size: [number, number];
	/** Floor origin in grid coordinates. */
	origin: [number, number];
	/** Whether the floor is rendered. */
	visible: boolean;
	/** Render layer name the floor is placed on. */
	layer: string;
	/** Optional floor asset id. */
	asset?: string;
}

/** Compiled render layer with resolved draw order. */
export interface CompiledLayer {
	/** Layer name. */
	name: string;
	/** Resolved draw order; lower renders first. */
	order: number;
}

/** Compiled viewBox fit and alignment behavior. */
export interface CompiledLayout {
	/** Scaling behavior: `contain` fits content in the viewport, `none` uses the compiled viewBox as-is. */
	fit: "contain" | "none";
	/** Normalized alignment of content within the viewport, from `0` to `1` on each axis. */
	align: [number, number];
	/** Extra viewBox padding in pixels on each axis. */
	padding: { x: number; y: number };
	/** Source used to compute the viewBox bounds. */
	bounds: "floor" | "content" | "union";
}

/** Compiled browser runtime artifact accepted by `mountScene()`. */
export interface RuntimeBundle {
	/** Bundle format discriminator. */
	_format: "isostate-runtime-bundle";
	/** Compiler version that produced this bundle. */
	_version: string;
	/** Content digest used to detect bundle corruption or mismatch. */
	_digest: string;
	/** Grid cell size in pixels. */
	grid: { cellSize: number };
	/** Compiled floor placement. */
	floor: CompiledFloor;
	/** Compiled viewBox fit and alignment behavior. */
	layout: CompiledLayout;
	/** Built-in theme name or custom theme identifier. */
	theme: string;
	/** Optional CSS class applied to the mounted SVG root. */
	className?: string;
	/** CSS custom properties applied on top of the resolved theme. */
	themeVars?: Record<string, string>;
	/** Ordered compiled scene stops. */
	scenes: RuntimeSceneStop[];
	/** Compiled render layers with resolved draw order. */
	layers: CompiledLayer[];
	/** Compiled asset catalog keyed by asset id. */
	assets?: Record<string, CompiledAsset>;
}
