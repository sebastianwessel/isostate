import type { AssetCategory } from "./assets.ts";
import type { RuntimeSceneStop } from "./scene.ts";

export interface CompiledAsset {
	url?: string;
	category?: AssetCategory;
	anchor?: [number, number];
}

export interface CompiledFloor {
	size: [number, number];
	origin: [number, number];
	visible: boolean;
	layer: string;
	asset?: string;
}

export interface CompiledLayer {
	name: string;
	order: number;
}

export interface CompiledLayout {
	fit: "contain" | "none";
	align: [number, number];
	padding: { x: number; y: number };
	bounds: "floor" | "content" | "union";
}

export interface RuntimeBundle {
	_format: "isostate-runtime-bundle";
	_version: string;
	_digest: string;
	grid: { cellSize: number };
	floor: CompiledFloor;
	layout: CompiledLayout;
	theme: string;
	className?: string;
	themeVars?: Record<string, string>;
	scenes: RuntimeSceneStop[];
	layers: CompiledLayer[];
	assets?: Record<string, CompiledAsset>;
}
