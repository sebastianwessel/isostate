import { mountScene, resolveTheme } from '@sebastianwessel/isostate';
import { compileScene } from '@sebastianwessel/isostate/dsl/browser';
import type { EditorRuntimeAdapter } from '@sebastianwessel/isostate/editor-support';
import { createEditorRuntimeAdapter } from '@sebastianwessel/isostate/editor-support';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAssetPlacementCommand } from '../assets.ts';
import { createObjectAddCommand } from '../commands.ts';
import type {
	EditorCommand,
	EditorSelection,
	EditorWorkspace
} from '../types.ts';
import { CanvasControls } from './CanvasControls.tsx';
import { createPlacedElement } from './elementFactory.ts';
import type { EditorGridBounds } from './gridSnapping.ts';
import { snapGridCell } from './gridSnapping.ts';
import { parseManifestDrop } from './manifestDrop.ts';
import { SelectionOverlay } from './SelectionOverlay.tsx';
import { useCanvasPointer } from './useCanvasPointer.ts';

interface CanvasViewProps {
	workspace: EditorWorkspace;
	onCommand: (cmd: EditorCommand) => void;
	onSelect?: (selection: Partial<EditorSelection>) => void;
	onClearDragPayload?: () => void;
	onViewportChange?: (viewport: EditorWorkspace['viewport']) => void;
	theme: string;
	previewMode?: EditorWorkspace['uiState']['previewMode'];
	previewProgress?: number;
}

const EDITOR_MIN_FLOOR_SIZE: [number, number] = [20, 20];

function escapeCssAttribute(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function createEditorPreviewDocument(
	document: EditorWorkspace['document'],
	showFloor: boolean
) {
	if (!document) return undefined;
	const floor = document.header.floor;
	const size = floor?.size ?? [1, 1];
	return {
		...document,
		header: {
			...document.header,
			floor: {
				...floor,
				size: [
					Math.max(EDITOR_MIN_FLOOR_SIZE[0], size[0]),
					Math.max(EDITOR_MIN_FLOOR_SIZE[1], size[1])
				] as [number, number],
				visible: showFloor
			}
		}
	};
}

function getEditorGridBounds(
	document: EditorWorkspace['document']
): EditorGridBounds {
	const floor = document?.header.floor;
	const origin = floor?.origin ?? [0, 0];
	const size = floor?.size ?? [1, 1];
	return {
		origin,
		size: [
			Math.max(EDITOR_MIN_FLOOR_SIZE[0], size[0]),
			Math.max(EDITOR_MIN_FLOOR_SIZE[1], size[1])
		]
	};
}

export function CanvasView({
	workspace,
	onCommand,
	onSelect,
	onClearDragPayload,
	onViewportChange,
	theme,
	previewMode = 'edit',
	previewProgress = 0
}: CanvasViewProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [adapter, setAdapter] = useState<EditorRuntimeAdapter | null>(null);
	const [isPanning, setIsPanning] = useState(false);
	const spaceHeldRef = useRef(false);
	const panRef = useRef<{
		startClient: { x: number; y: number };
		startPan: { x: number; y: number };
		scale: { x: number; y: number };
	} | null>(null);
	const adapterRef = useRef(adapter);
	adapterRef.current = adapter;

	const previewTheme = theme === 'dark' ? 'dark' : 'light';
	const isRuntimePreview = previewMode === 'runtime';
	const themeVars = useMemo(
		() => resolveTheme(previewTheme) ?? {},
		[previewTheme]
	);
	const previewDocument = useMemo(
		() =>
			isRuntimePreview
				? workspace.document
				: createEditorPreviewDocument(
						workspace.document,
						workspace.viewport.showFloor
					),
		[workspace.document, workspace.viewport.showFloor, isRuntimePreview]
	);
	const gridBounds = useMemo(
		() => getEditorGridBounds(workspace.document),
		[workspace.document]
	);

	useEffect(() => {
		const container = containerRef.current;
		if (!container || !previewDocument) {
			setAdapter(null);
			return;
		}
		let mounted: import('@sebastianwessel/isostate').MountedScene | null = null;
		let adpt: EditorRuntimeAdapter | null = null;
		try {
			const bundle = compileScene(previewDocument);
			mounted = mountScene(container, bundle, {
				controller: isRuntimePreview ? { transitionDuration: 0 } : false,
				themeVars
			});
			adpt = createEditorRuntimeAdapter(mounted);
			if (isRuntimePreview) {
				adpt.setProgress(previewProgress);
			} else if (workspace.activeSceneId) {
				adpt.setActiveScene(workspace.activeSceneId);
			}
			adapterRef.current = adpt;
			setAdapter(adpt);
		} catch {
			setAdapter(null);
		}
		return () => {
			adapterRef.current = null;
			adpt?.destroy();
			mounted?.destroy();
			setAdapter(null);
		};
	}, [previewDocument, workspace.sourceYaml, themeVars]);

	useEffect(() => {
		if (
			!adapter ||
			adapter !== adapterRef.current ||
			isRuntimePreview ||
			!workspace.activeSceneId
		)
			return;
		adapter.setActiveScene(workspace.activeSceneId);
	}, [adapter, isRuntimePreview, workspace.activeSceneId]);

	useEffect(() => {
		if (!adapter || adapter !== adapterRef.current || !isRuntimePreview) return;
		adapter.setProgress(previewProgress);
	}, [adapter, isRuntimePreview, previewProgress]);

	const {
		ghostCell,
		onPointerDown,
		onPointerMove,
		onPointerUp,
		onPointerCancel
	} = useCanvasPointer({
		adapterRef,
		workspace,
		onCommand,
		onSelect,
		onClearDragPayload,
		gridBounds
	});

	const baseViewBox = adapter?.getResolvedViewBox();
	const zoom = workspace.viewport.zoom || 1;
	const vb = baseViewBox
		? {
				minX:
					baseViewBox.minX +
					(baseViewBox.width - baseViewBox.width / zoom) / 2 +
					workspace.viewport.pan.x,
				minY:
					baseViewBox.minY +
					(baseViewBox.height - baseViewBox.height / zoom) / 2 +
					workspace.viewport.pan.y,
				width: baseViewBox.width / zoom,
				height: baseViewBox.height / zoom
			}
		: undefined;
	const viewBoxStr = vb
		? `${vb.minX} ${vb.minY} ${vb.width} ${vb.height}`
		: undefined;

	useEffect(() => {
		if (!adapter?.mounted.svg || !viewBoxStr || isRuntimePreview) return;
		adapter.mounted.svg.setAttribute('viewBox', viewBoxStr);
	}, [adapter, viewBoxStr, isRuntimePreview]);

	useEffect(() => {
		const svg = adapter?.mounted.svg;
		if (!svg) return;
		for (const node of svg.querySelectorAll<SVGElement>('[data-layer]')) {
			node.style.display = '';
		}
		for (const layerName of isRuntimePreview
			? []
			: (workspace.uiState.hiddenLayers ?? [])) {
			for (const node of svg.querySelectorAll<SVGElement>(
				`[data-layer="${escapeCssAttribute(layerName)}"]`
			)) {
				node.style.display = 'none';
			}
		}
	}, [adapter, workspace.uiState.hiddenLayers, isRuntimePreview]);

	const updateViewport = useCallback(
		(patch: Partial<EditorWorkspace['viewport']>) => {
			onViewportChange?.({
				...workspace.viewport,
				...patch,
				pan: patch.pan ?? workspace.viewport.pan
			});
		},
		[onViewportChange, workspace.viewport]
	);

	const zoomBy = (factor: number) => {
		updateViewport({
			zoom: Math.min(4, Math.max(0.35, zoom * factor))
		});
	};

	useEffect(() => {
		const container = containerRef.current;
		if (!container || isRuntimePreview) return;
		const onWheel = (event: WheelEvent) => {
			if (
				event.target instanceof Element &&
				event.target.closest('.isostate-canvas-controls')
			)
				return;
			event.preventDefault();
			if (event.ctrlKey || event.metaKey) {
				updateViewport({
					zoom: Math.min(
						4,
						Math.max(0.35, zoom * Math.exp(-event.deltaY * 0.01))
					)
				});
			} else if (adapterRef.current) {
				const origin = adapterRef.current.clientPointToSvgPoint({
					clientX: 0,
					clientY: 0
				});
				const offset = adapterRef.current.clientPointToSvgPoint({
					clientX: event.deltaX,
					clientY: event.deltaY
				});
				updateViewport({
					pan: {
						x: workspace.viewport.pan.x + offset.x - origin.x,
						y: workspace.viewport.pan.y + offset.y - origin.y
					}
				});
			}
		};
		container.addEventListener('wheel', onWheel, { passive: false });
		return () => container.removeEventListener('wheel', onWheel);
	}, [isRuntimePreview, updateViewport, workspace.viewport.pan, zoom]);

	const resetView = () => {
		updateViewport({ zoom: 1, pan: { x: 0, y: 0 } });
	};

	const gridOpacity = workspace.viewport.gridOpacity ?? 0.7;
	const effectiveGridOpacity = workspace.viewport.showGrid ? gridOpacity : 0;
	const updateGridOpacity = (value: number) => {
		updateViewport({
			gridOpacity: Math.min(1, Math.max(0, value))
		});
	};

	const isCanvasControlEvent = (event: React.PointerEvent) =>
		event.target instanceof Element &&
		event.target.closest('.isostate-canvas-controls');

	const startPan = (event: React.PointerEvent) => {
		const current = adapterRef.current;
		if (!current) return;
		const origin = current.clientPointToSvgPoint({
			clientX: event.clientX,
			clientY: event.clientY
		});
		const unit = current.clientPointToSvgPoint({
			clientX: event.clientX + 1,
			clientY: event.clientY + 1
		});
		event.preventDefault();
		panRef.current = {
			scale: { x: unit.x - origin.x, y: unit.y - origin.y },
			startClient: { x: event.clientX, y: event.clientY },
			startPan: workspace.viewport.pan
		};
		try {
			event.currentTarget.setPointerCapture(event.pointerId);
		} catch {
			// Some test and browser edge paths do not expose pointer capture.
		}
		setIsPanning(true);
	};

	const shouldStartPan = (event: React.PointerEvent) => {
		if (!adapterRef.current || !baseViewBox) return false;
		if (
			event.button === 1 ||
			event.altKey ||
			event.metaKey ||
			spaceHeldRef.current
		)
			return true;
		if (event.button !== 0) return false;
		if (workspace.editState.dragPayload?.kind === 'asset') return false;
		try {
			const svgPoint = adapterRef.current.clientPointToSvgPoint({
				clientX: event.clientX,
				clientY: event.clientY
			});
			return !adapterRef.current.getObjectAtPoint(svgPoint, {
				kinds: ['element', 'connection']
			});
		} catch {
			return false;
		}
	};

	return (
		<div
			ref={containerRef}
			className={`isostate-editor-canvas-view ${isPanning ? 'isostate-editor-canvas-view--panning' : ''}`}
			data-preview-mode={previewMode}
			style={
				{
					'--isostate-editor-grid-opacity': String(effectiveGridOpacity)
				} as CSSProperties
			}
			// biome-ignore lint/a11y/noNoninteractiveTabindex: The interactive SVG canvas supports keyboard panning.
			tabIndex={0}
			onKeyDown={(event) => {
				if (event.code === 'Space' && event.target === event.currentTarget) {
					event.preventDefault();
					spaceHeldRef.current = true;
				}
			}}
			onKeyUp={(event) => {
				if (event.code === 'Space') spaceHeldRef.current = false;
			}}
			onBlur={() => {
				spaceHeldRef.current = false;
			}}
			role="application"
			aria-label="Scene canvas"
			onPointerDown={(e) => {
				if (isCanvasControlEvent(e)) return;
				e.currentTarget.focus({ preventScroll: true });
				if (isRuntimePreview) return;
				if (shouldStartPan(e)) {
					startPan(e);
					return;
				}
				onPointerDown(e);
			}}
			onPointerMove={(e) => {
				if (isRuntimePreview) return;
				const pan = panRef.current;
				if (pan && baseViewBox) {
					const dx = (pan.startClient.x - e.clientX) * pan.scale.x;
					const dy = (pan.startClient.y - e.clientY) * pan.scale.y;
					updateViewport({
						pan: {
							x: pan.startPan.x + dx,
							y: pan.startPan.y + dy
						}
					});
					return;
				}
				onPointerMove(e);
			}}
			onPointerUp={(e) => {
				if (isRuntimePreview) return;
				if (panRef.current) {
					panRef.current = null;
					setIsPanning(false);
					try {
						e.currentTarget.releasePointerCapture(e.pointerId);
					} catch {
						// Pointer capture may already be released by the browser.
					}
					return;
				}
				onPointerUp(e);
			}}
			onPointerCancel={() => {
				panRef.current = null;
				setIsPanning(false);
				onPointerCancel();
			}}
			onDragOver={(e) => {
				if (isRuntimePreview) return;
				e.preventDefault();
			}}
			onDrop={(e) => {
				if (isRuntimePreview) return;
				e.preventDefault();
				const adapter = adapterRef.current;
				const manifestDrop = parseManifestDrop(e.dataTransfer);
				const assetId =
					manifestDrop?.entry.id ||
					e.dataTransfer.getData('application/x-isostate-asset') ||
					(workspace.editState.dragPayload?.kind === 'asset'
						? workspace.editState.dragPayload.assetId
						: '');
				if (!adapter || !assetId) return;
				try {
					const svgPoint = adapter.clientPointToSvgPoint({
						clientX: e.clientX,
						clientY: e.clientY
					});
					const gridPoint = adapter.unprojectScreenPoint(svgPoint);
					const snapped = snapGridCell(gridPoint, gridBounds, { clamp: false });
					const sceneId = workspace.activeSceneId;
					if (!sceneId) return;
					if (manifestDrop) {
						onCommand(
							createAssetPlacementCommand(
								sceneId,
								manifestDrop.entry,
								snapped,
								manifestDrop.assetBaseUrl
							)
						);
						onClearDragPayload?.();
						return;
					}
					const element = createPlacedElement(
						assetId,
						snapped,
						workspace.document?.header.layers[0]?.name ?? 'default'
					);
					onCommand(createObjectAddCommand(sceneId, element));
					onClearDragPayload?.();
				} catch {
					// ignore geometry errors during drop
				}
			}}
		>
			{!isRuntimePreview && (
				<CanvasControls
					zoom={zoom}
					gridOpacity={gridOpacity}
					zoomBy={zoomBy}
					resetView={resetView}
					updateGridOpacity={updateGridOpacity}
				/>
			)}
			{adapter && vb && viewBoxStr && !isRuntimePreview && (
				<svg
					aria-label="Editor overlay"
					className="isostate-editor-overlay"
					viewBox={viewBoxStr}
					width="100%"
					height="100%"
				>
					<SelectionOverlay adapter={adapter} selection={workspace.selection} />
					{ghostCell && (
						<polygon
							className="isostate-editor-drag-ghost"
							points={adapter
								.getGridCellPolygon(ghostCell)
								.map((p) => `${p.x},${p.y}`)
								.join(' ')}
						/>
					)}
				</svg>
			)}
		</div>
	);
}
