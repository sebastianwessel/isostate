import { getResolvedProjectionLayout } from "../rendering/rendering-engine.ts";
import { RenderError } from "../types/errors.ts";
import type { RuntimeBundle } from "../types/runtime-bundle.ts";

/** Screen-space point in SVG user units. */
export interface EditorScreenPoint {
	x: number;
	y: number;
}

/** Browser client-space pointer coordinates. */
export interface EditorClientPoint {
	clientX: number;
	clientY: number;
}

/**
 * Project an isometric grid point into SVG screen coordinates.
 * Uses the same projection, bounds, and padding as the renderer.
 */
export function projectGridPoint(bundle: RuntimeBundle, point: [number, number]): EditorScreenPoint {
	const layout = getResolvedProjectionLayout(bundle);
	const rawX = layout.cellSize * (point[0] - point[1]) * 0.5;
	const rawY = layout.cellSize * (point[0] + point[1]) * 0.25;
	return {
		x: rawX - layout.selectedBounds.minX + layout.padding.x,
		y: rawY - layout.selectedBounds.minY + layout.padding.y,
	};
}

/**
 * Unproject an SVG screen point back into fractional isometric grid coordinates.
 * The editor owns snap-to-grid rounding.
 */
export function unprojectScreenPoint(bundle: RuntimeBundle, point: EditorScreenPoint): [number, number] {
	const layout = getResolvedProjectionLayout(bundle);
	const rawX = point.x + layout.selectedBounds.minX - layout.padding.x;
	const rawY = point.y + layout.selectedBounds.minY - layout.padding.y;
	const cellSize = layout.cellSize;
	const gridX = rawX / cellSize + (2 * rawY) / cellSize;
	const gridY = (2 * rawY) / cellSize - rawX / cellSize;
	return [gridX, gridY];
}

/**
 * Convert browser pointer coordinates into SVG user units using the root SVG
 * screen CTM inverse.
 * @throws {RenderError} `EDITOR_GEOMETRY_UNAVAILABLE` when the CTM is missing or not invertible.
 */
export function clientPointToSvgPoint(svg: SVGSVGElement, point: EditorClientPoint): EditorScreenPoint {
	const ctm = svg.getScreenCTM();
	if (!ctm) {
		throw new RenderError("EDITOR_GEOMETRY_UNAVAILABLE", "SVG CTM is not available");
	}
	let inverse: DOMMatrix | null = null;
	try {
		inverse = ctm.inverse();
	} catch {
		// non-invertible matrix
	}
	if (!inverse) {
		throw new RenderError("EDITOR_GEOMETRY_UNAVAILABLE", "SVG CTM is not invertible");
	}
	const svgPoint = svg.createSVGPoint();
	svgPoint.x = point.clientX;
	svgPoint.y = point.clientY;
	const result = svgPoint.matrixTransform(inverse);
	return { x: result.x, y: result.y };
}

/**
 * Return the four projected corners of a grid cell in clockwise order.
 */
export function getGridCellPolygon(bundle: RuntimeBundle, cell: [number, number]): EditorScreenPoint[] {
	const [x, y] = cell;
	return [
		projectGridPoint(bundle, [x, y]),
		projectGridPoint(bundle, [x + 1, y]),
		projectGridPoint(bundle, [x + 1, y + 1]),
		projectGridPoint(bundle, [x, y + 1]),
	];
}
