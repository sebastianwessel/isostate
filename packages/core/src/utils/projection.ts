/** Default cell size in pixels */
export const DEFAULT_CELL_SIZE = 64;

/**
 * Calculate raw scene-space coordinates from isometric grid position.
 * Layout is applied separately by subtracting resolved bounds and adding padding.
 */
export function projectToRaw(gridX: number, gridY: number, cellSize: number): { rawX: number; rawY: number } {
	return {
		rawX: cellSize * (gridX - gridY) * 0.5,
		rawY: cellSize * (gridX + gridY) * 0.25,
	};
}

/**
 * Calculate screen coordinates from raw isometric projection and resolved bounds.
 */
export function projectToScreen(
	gridX: number,
	gridY: number,
	cellSize: number,
	boundsMinX = 0,
	boundsMinY = 0,
	paddingX = 0,
	paddingY = 0,
): { screenX: number; screenY: number } {
	const { rawX, rawY } = projectToRaw(gridX, gridY, cellSize);
	return {
		screenX: rawX - boundsMinX + paddingX,
		screenY: rawY - boundsMinY + paddingY,
	};
}

/** Calculate the screen size for an element based on its grid size. */
export function calculateVisualSize(gridSize: number, cellSize: number): number {
	return cellSize * gridSize;
}

/** Calculate the element transform string for positioning and scaling. */
export function calculateTransform(screenX: number, screenY: number, visualSize: number, cellSize: number): string {
	const scale = visualSize / cellSize;
	return `translate(${screenX}px, ${screenY}px) scale(${scale})`;
}
