import type { ViewBoxRect } from "../rendering/rendering-engine.ts";
import type { RuntimeBundle } from "../types/runtime-bundle.ts";
import { projectToRaw } from "../utils/projection.ts";
import type { EditorRuntimeAdapter } from "./adapter.ts";
import type { EditorScreenPoint } from "./geometry.ts";

export interface HitTestOptions {
	includeHidden?: boolean;
	includeLocked?: boolean;
	kinds?: Array<"element" | "connection">;
}

export interface RuntimeObjectHit {
	id: string;
	kind: "element" | "connection";
	layer: string;
	bounds: ViewBoxRect;
}

/**
 * Find the topmost runtime object at a screen point.
 * Hit testing follows the current rendered depth order so the visually
 * topmost object wins.
 */
export function getRuntimeObjectAtPoint(
	adapter: EditorRuntimeAdapter,
	point: EditorScreenPoint,
	options: HitTestOptions = {},
): RuntimeObjectHit | undefined {
	const kinds = options.kinds ?? ["element", "connection"];
	const currentScene = adapter.mounted.engine.getCurrentState();
	if (!currentScene) return undefined;

	const objects = adapter.getObjects(currentScene.id);
	const layerOrder = adapter.getLayerOrder();
	const layerRank = new Map(layerOrder.map((l, i) => [l.name, i]));

	const candidates = objects
		.filter((obj) => kinds.includes(obj.kind))
		.filter((obj) => options.includeHidden || obj.present)
		.sort((a, b) => {
			const rankA = layerRank.get(a.layer) ?? -1;
			const rankB = layerRank.get(b.layer) ?? -1;
			return rankA - rankB;
		});

	// Check topmost (highest layer rank) first
	for (let i = candidates.length - 1; i >= 0; i--) {
		const obj = candidates[i];
		if (pointInBounds(point, obj.bounds)) {
			return {
				id: obj.id,
				kind: obj.kind,
				layer: obj.layer,
				bounds: obj.bounds,
			};
		}
	}
	return undefined;
}

/**
 * Compute the union bounds of a selection of runtime objects.
 * Missing ids are ignored. Returns `undefined` if no ids resolve.
 */
export function getRuntimeSelectionBounds(adapter: EditorRuntimeAdapter, ids: string[]): ViewBoxRect | undefined {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	for (const id of ids) {
		const obj = adapter.getObject(id);
		if (!obj?.present) continue;
		const b = obj.bounds;
		minX = Math.min(minX, b.minX);
		minY = Math.min(minY, b.minY);
		maxX = Math.max(maxX, b.minX + b.width);
		maxY = Math.max(maxY, b.minY + b.height);
	}

	if (!Number.isFinite(minX)) return undefined;

	return {
		minX,
		minY,
		width: maxX - minX,
		height: maxY - minY,
	};
}

function pointInBounds(
	point: EditorScreenPoint,
	bounds: { minX: number; minY: number; width: number; height: number },
): boolean {
	return (
		point.x >= bounds.minX &&
		point.x <= bounds.minX + bounds.width &&
		point.y >= bounds.minY &&
		point.y <= bounds.minY + bounds.height
	);
}

/** Compute screen-space bounds for a connector route. */
export function getConnectionBounds(route: [number, number][], bundle: RuntimeBundle): ViewBoxRect {
	const layout = resolveLayoutForBounds(bundle);
	let minRawX = Number.POSITIVE_INFINITY;
	let minRawY = Number.POSITIVE_INFINITY;
	let maxRawX = Number.NEGATIVE_INFINITY;
	let maxRawY = Number.NEGATIVE_INFINITY;

	for (const [x, y] of route) {
		const { rawX, rawY } = projectToRaw(x, y, layout.cellSize);
		minRawX = Math.min(minRawX, rawX);
		minRawY = Math.min(minRawY, rawY);
		maxRawX = Math.max(maxRawX, rawX);
		maxRawY = Math.max(maxRawY, rawY);
	}

	const offsetX = -layout.selectedBounds.minX + layout.padding.x;
	const offsetY = -layout.selectedBounds.minY + layout.padding.y;

	return {
		minX: minRawX + offsetX,
		minY: minRawY + offsetY,
		width: maxRawX - minRawX,
		height: maxRawY - minRawY,
	};
}

// Lightweight re-computation of the layout values needed for bounds projection.
function resolveLayoutForBounds(bundle: RuntimeBundle): {
	cellSize: number;
	padding: { x: number; y: number };
	selectedBounds: { minX: number; minY: number; maxX: number; maxY: number };
} {
	const cellSize = bundle.grid.cellSize;
	const padding = bundle.layout.padding;

	// Reproduce content bounds calculation
	let cMinX = Number.POSITIVE_INFINITY;
	let cMinY = Number.POSITIVE_INFINITY;
	let cMaxX = Number.NEGATIVE_INFINITY;
	let cMaxY = Number.NEGATIVE_INFINITY;

	for (const stop of bundle.scenes) {
		for (const el of stop.elements ?? []) {
			if (el.presence === "removed") continue;
			const { rawX, rawY } = projectToRaw(el.pos[0] + el.size, el.pos[1] + el.size, cellSize);
			const visualSize = cellSize * el.size;
			const anchor = bundle.assets?.[el.asset]?.anchor ?? [0.5, 1];
			cMinX = Math.min(cMinX, rawX - visualSize * anchor[0]);
			cMinY = Math.min(cMinY, rawY - visualSize * anchor[1]);
			cMaxX = Math.max(cMaxX, rawX + visualSize * (1 - anchor[0]));
			cMaxY = Math.max(cMaxY, rawY + visualSize * (1 - anchor[1]));
		}
		for (const conn of stop.connectors ?? []) {
			if (conn.presence === "removed") continue;
			for (const [x, y] of conn.route) {
				const { rawX, rawY } = projectToRaw(x, y, cellSize);
				cMinX = Math.min(cMinX, rawX);
				cMinY = Math.min(cMinY, rawY);
				cMaxX = Math.max(cMaxX, rawX);
				cMaxY = Math.max(cMaxY, rawY);
			}
		}
	}

	if (!Number.isFinite(cMinX)) {
		cMinX = 0;
		cMinY = 0;
		cMaxX = cellSize;
		cMaxY = cellSize;
	}

	// Floor bounds
	const [ox, oy] = bundle.floor.origin;
	const [fw, fh] = bundle.floor.size;
	const floorPoints: Array<[number, number]> = [
		[ox, oy],
		[ox + fw, oy],
		[ox, oy + fh],
		[ox + fw, oy + fh],
	];
	let fMinX = Number.POSITIVE_INFINITY;
	let fMinY = Number.POSITIVE_INFINITY;
	let fMaxX = Number.NEGATIVE_INFINITY;
	let fMaxY = Number.NEGATIVE_INFINITY;
	for (const [x, y] of floorPoints) {
		const { rawX, rawY } = projectToRaw(x, y, cellSize);
		fMinX = Math.min(fMinX, rawX);
		fMinY = Math.min(fMinY, rawY);
		fMaxX = Math.max(fMaxX, rawX);
		fMaxY = Math.max(fMaxY, rawY);
	}

	// Select bounds
	let sMinX: number;
	let sMinY: number;
	let sMaxX: number;
	let sMaxY: number;
	const mode = bundle.layout.bounds;
	if (mode === "content") {
		sMinX = cMinX;
		sMinY = cMinY;
		sMaxX = cMaxX;
		sMaxY = cMaxY;
	} else if (mode === "floor") {
		sMinX = fMinX;
		sMinY = fMinY;
		sMaxX = fMaxX;
		sMaxY = fMaxY;
	} else {
		sMinX = Math.min(cMinX, fMinX);
		sMinY = Math.min(cMinY, fMinY);
		sMaxX = Math.max(cMaxX, fMaxX);
		sMaxY = Math.max(cMaxY, fMaxY);
	}

	return {
		cellSize,
		padding,
		selectedBounds: { minX: sMinX, minY: sMinY, maxX: sMaxX, maxY: sMaxY },
	};
}
