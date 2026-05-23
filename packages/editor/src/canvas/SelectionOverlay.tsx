import type { EditorRuntimeAdapter } from '@sebastianwessel/isostate/editor-support';
import type { EditorSelection } from '../types.ts';

interface SelectionOverlayProps {
	adapter: EditorRuntimeAdapter;
	selection: EditorSelection;
}

export function SelectionOverlay({
	adapter,
	selection
}: SelectionOverlayProps) {
	const bounds = adapter.getSelectionBounds(selection.objectIds);
	const selectedCells = selection.objectIds.flatMap((id) => {
		const obj = adapter.getObject(id);
		if (!obj?.present || obj.grid.kind !== 'element') return [];
		return [
			{
				id,
				points: adapter
					.getGridCellPolygon(obj.grid.at)
					.map((p) => `${p.x},${p.y}`)
					.join(' ')
			}
		];
	});
	if (!bounds && selectedCells.length === 0) return null;
	return (
		<g className="isostate-editor-selection">
			{selectedCells.map((cell) => (
				<polygon
					key={cell.id}
					className="isostate-editor-selection-cell"
					points={cell.points}
				/>
			))}
			{bounds && <SelectionBounds bounds={bounds} />}
		</g>
	);
}

function SelectionBounds({
	bounds
}: {
	bounds: { minX: number; minY: number; width: number; height: number };
}) {
	const { minX, minY, width, height } = bounds;
	return (
		<>
			<rect
				className="isostate-editor-selection-bounds"
				x={minX}
				y={minY}
				width={width}
				height={height}
			/>
			<rect
				className="isostate-editor-selection-handle"
				x={minX - 3}
				y={minY - 3}
				width={6}
				height={6}
			/>
			<rect
				className="isostate-editor-selection-handle"
				x={minX + width / 2 - 3}
				y={minY - 3}
				width={6}
				height={6}
			/>
			<rect
				className="isostate-editor-selection-handle"
				x={minX + width - 3}
				y={minY - 3}
				width={6}
				height={6}
			/>
			<rect
				className="isostate-editor-selection-handle"
				x={minX - 3}
				y={minY + height / 2 - 3}
				width={6}
				height={6}
			/>
			<rect
				className="isostate-editor-selection-handle"
				x={minX + width - 3}
				y={minY + height / 2 - 3}
				width={6}
				height={6}
			/>
			<rect
				className="isostate-editor-selection-handle"
				x={minX - 3}
				y={minY + height - 3}
				width={6}
				height={6}
			/>
			<rect
				className="isostate-editor-selection-handle"
				x={minX + width / 2 - 3}
				y={minY + height - 3}
				width={6}
				height={6}
			/>
			<rect
				className="isostate-editor-selection-handle"
				x={minX + width - 3}
				y={minY + height - 3}
				width={6}
				height={6}
			/>
		</>
	);
}
