export interface EditorGridBounds {
	origin: [number, number];
	size: [number, number];
}

export function snapGridCell(
	point: [number, number],
	bounds?: EditorGridBounds
): [number, number] {
	const epsilon = 1e-6;
	const cell: [number, number] = [
		Math.floor(point[0] + epsilon),
		Math.floor(point[1] + epsilon)
	];
	if (!bounds) return cell;
	const [originX, originY] = bounds.origin;
	const [width, height] = bounds.size;
	const maxX = originX + Math.max(0, width - 1);
	const maxY = originY + Math.max(0, height - 1);
	return [
		Math.min(maxX, Math.max(originX, cell[0])),
		Math.min(maxY, Math.max(originY, cell[1]))
	];
}
