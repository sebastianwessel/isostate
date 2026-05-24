import type { EditorRuntimeAdapter } from '@sebastianwessel/isostate/editor-support';
import { useCallback, useRef, useState } from 'react';
import {
	createObjectAddCommand,
	createObjectUpdateCommand
} from '../commands.ts';
import type {
	EditorCommand,
	EditorSelection,
	EditorWorkspace
} from '../types.ts';
import { createPlacedElement } from './elementFactory.ts';
import type { EditorGridBounds } from './gridSnapping.ts';
import { snapGridCell } from './gridSnapping.ts';

interface UseCanvasPointerOptions {
	adapterRef: React.RefObject<EditorRuntimeAdapter | null>;
	workspace: EditorWorkspace;
	onCommand: (cmd: EditorCommand) => void;
	onSelect?: (selection: Partial<EditorSelection>) => void;
	onClearDragPayload?: () => void;
	gridBounds?: EditorGridBounds;
}

interface DragState {
	mode: 'none' | 'move' | 'place';
	id?: string;
	startAt?: [number, number];
	startClient?: { x: number; y: number };
	hasMoved?: boolean;
}

const MOVE_THRESHOLD_PX = 4;

export function useCanvasPointer({
	adapterRef,
	workspace,
	onCommand,
	onSelect,
	onClearDragPayload,
	gridBounds
}: UseCanvasPointerOptions) {
	const [ghostCell, setGhostCell] = useState<[number, number] | null>(null);
	const dragRef = useRef<DragState>({ mode: 'none' });

	const getEventGrid = useCallback(
		(e: React.PointerEvent) => {
			const adapter = adapterRef.current;
			if (!adapter) return null;
			try {
				const svgPoint = adapter.clientPointToSvgPoint({
					clientX: e.clientX,
					clientY: e.clientY
				});
				const gridPoint = adapter.unprojectScreenPoint(svgPoint);
				return {
					svgPoint,
					gridPoint,
					snapped: snapGridCell(gridPoint, gridBounds, { clamp: false })
				};
			} catch {
				return null;
			}
		},
		[adapterRef, gridBounds]
	);

	const onPointerDown = useCallback(
		(e: React.PointerEvent) => {
			if (!adapterRef.current) return;
			const pt = getEventGrid(e);
			if (!pt) return;

			const payload = workspace.editState.dragPayload;
			if (payload?.kind === 'asset') {
				dragRef.current = {
					mode: 'place',
					startAt: pt.snapped,
					startClient: { x: e.clientX, y: e.clientY }
				};
				setGhostCell(pt.snapped);
				return;
			}

			const hit = adapterRef.current.getObjectAtPoint(pt.svgPoint, {
				kinds: ['element', 'connection']
			});
			if (hit) {
				const obj = adapterRef.current.getObject(hit.id);
				if (obj?.kind === 'connection') {
					onSelect?.({
						sceneId: workspace.activeSceneId,
						objectIds: [],
						connectionIds: [hit.id],
						layerNames: []
					});
					return;
				}
				if (obj && obj.kind === 'element' && obj.grid.kind === 'element') {
					if (workspace.lockedLayers?.includes(obj.layer)) {
						onCommand({
							id: 'editor.locked',
							label: 'Locked Layer Edit',
							apply(ws) {
								return {
									workspace: ws,
									changed: false,
									diagnostics: [
										{
											code: 'EDITOR_LOCKED_TARGET',
											message: `Edit rejected: layer ${obj.layer} is locked`,
											severity: 'warning'
										}
									]
								};
							}
						});
						return;
					}
					dragRef.current = {
						mode: 'move',
						id: hit.id,
						startAt: obj.grid.at,
						startClient: { x: e.clientX, y: e.clientY },
						hasMoved: false
					};
					onSelect?.({
						sceneId: workspace.activeSceneId,
						objectIds: [hit.id],
						connectionIds: [],
						layerNames: []
					});
					setGhostCell(pt.snapped);
					return;
				}
			}

			onSelect?.({
				sceneId: workspace.activeSceneId,
				objectIds: [],
				connectionIds: [],
				layerNames: []
			});
		},
		[
			adapterRef,
			getEventGrid,
			workspace.activeSceneId,
			workspace.editState.dragPayload,
			workspace.lockedLayers,
			onCommand,
			onSelect
		]
	);

	const onPointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (dragRef.current.mode === 'none') return;
			const pt = getEventGrid(e);
			if (!pt) return;
			const start = dragRef.current.startClient;
			if (start) {
				const distance = Math.hypot(e.clientX - start.x, e.clientY - start.y);
				if (distance >= MOVE_THRESHOLD_PX) {
					dragRef.current = { ...dragRef.current, hasMoved: true };
				}
			}
			setGhostCell(pt.snapped);
		},
		[getEventGrid]
	);

	const onPointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (dragRef.current.mode === 'none') return;
			const pt = getEventGrid(e);
			const drag = dragRef.current;
			dragRef.current = { mode: 'none' };
			setGhostCell(null);
			if (!pt) return;

			if (drag.mode === 'place') {
				const payload = workspace.editState.dragPayload;
				if (!payload || payload.kind !== 'asset') return;
				const element = createPlacedElement(
					payload.assetId,
					pt.snapped,
					workspace.document?.header.layers[0]?.name ?? 'default'
				);
				const sceneId = workspace.activeSceneId;
				if (!sceneId) return;
				onCommand(createObjectAddCommand(sceneId, element));
				onClearDragPayload?.();
				return;
			}

			if (drag.mode === 'move' && drag.id) {
				if (!drag.hasMoved) return;
				if (!drag.startAt) return;
				if (
					pt.snapped[0] === drag.startAt[0] &&
					pt.snapped[1] === drag.startAt[1]
				) {
					return;
				}
				const sceneId = workspace.activeSceneId;
				if (!sceneId) return;
				onCommand(
					createObjectUpdateCommand(sceneId, {
						id: drag.id,
						at: pt.snapped
					})
				);
			}
		},
		[
			getEventGrid,
			workspace.editState.dragPayload,
			workspace.document,
			workspace.activeSceneId,
			onCommand
		]
	);

	return { ghostCell, onPointerDown, onPointerMove, onPointerUp };
}
