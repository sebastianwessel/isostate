import { mountScene } from "./runtime/mount-scene.ts";
import { projectToScreen as projectGridToScreen } from "./utils/projection.ts";

export { mountScene };

export function projectToScreen(
	x: number,
	y: number,
	cellSize: number,
	offsetX?: number,
	offsetY?: number,
	paddingX?: number,
	paddingY?: number,
): ReturnType<typeof projectGridToScreen> {
	return projectGridToScreen(x, y, cellSize, offsetX, offsetY, paddingX, paddingY);
}
