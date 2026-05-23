import { mountScene, resolveTheme } from '@sebastianwessel/isostate';
import { compileScene } from '@sebastianwessel/isostate/dsl/browser';
import type { EditorRuntimeAdapter } from '@sebastianwessel/isostate/editor-support';
import { createEditorRuntimeAdapter } from '@sebastianwessel/isostate/editor-support';
import type { ElementPlacement } from '@sebastianwessel/isostate/types';
import { Grid2X2, Minus, Plus, RotateCcw } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAssetPlacementCommand } from '../assets.ts';
import { createObjectAddCommand } from '../commands.ts';
import type {
	EditorCommand,
	EditorSelection,
	EditorWorkspace
} from '../types.ts';
import { Button } from '../ui/button.tsx';
import { Slider } from '../ui/slider.tsx';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from '../ui/tooltip.tsx';
import type { EditorGridBounds } from './gridSnapping.ts';
import { snapGridCell } from './gridSnapping.ts';
import { SelectionOverlay } from './SelectionOverlay.tsx';
import { useCanvasPointer } from './useCanvasPointer.ts';

interface CanvasViewProps {
	workspace: EditorWorkspace;
	onCommand: (cmd: EditorCommand) => void;
	onSelect?: (selection: Partial<EditorSelection>) => void;
	onClearDragPayload?: () => void;
	onViewportChange?: (viewport: EditorWorkspace['viewport']) => void;
	theme: string;
}

const EDITOR_MIN_FLOOR_SIZE: [number, number] = [20, 20];

function escapeCssAttribute(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function createPlacedElement(
	assetId: string,
	at: [number, number],
	layer: string
): ElementPlacement {
	const base: ElementPlacement = {
		id: `el-${Math.random().toString(36).slice(2, 7)}`,
		asset: assetId,
		at,
		layer,
		size: 1
	};
	switch (assetId) {
		case 'text':
			return {
				...base,
				text: {
					value: 'Text',
					align: 'middle',
					fontSize: 12
				}
			};
		case 'rectangle':
			return {
				...base,
				primitive: {
					rectangle: {
						fill: 'var(--color-top)',
						stroke: 'var(--color-back)',
						strokeWidth: 1
					}
				}
			};
		case 'circle':
			return {
				...base,
				primitive: {
					circle: {
						fill: 'var(--color-top)',
						stroke: 'var(--color-back)',
						strokeWidth: 1
					}
				}
			};
		case 'polygon':
			return {
				...base,
				primitive: {
					polygon: {
						points: [
							[0.5, 0],
							[1, 0.5],
							[0.5, 1],
							[0, 0.5]
						],
						fill: 'var(--color-top)',
						stroke: 'var(--color-back)',
						strokeWidth: 1
					}
				}
			};
		case 'line':
			return {
				...base,
				primitive: {
					line: {
						points: [
							[0, 0],
							[1, 1]
						],
						stroke: 'var(--color-back)',
						strokeWidth: 1
					}
				}
			};
		default:
			return base;
	}
}

function createEditorPreviewDocument(
	document: EditorWorkspace['document'],
	showGrid: boolean
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
				visible: showGrid
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

function parseManifestDrop(dataTransfer: DataTransfer):
	| {
			entry: import('../types.ts').AssetManifestEntry;
			assetBaseUrl: string;
	  }
	| undefined {
	const raw = dataTransfer.getData('application/x-isostate-manifest-asset');
	if (!raw) return undefined;
	try {
		const parsed = JSON.parse(raw) as {
			entry?: import('../types.ts').AssetManifestEntry;
			assetBaseUrl?: string;
		};
		if (
			parsed.entry &&
			typeof parsed.entry.id === 'string' &&
			typeof parsed.entry.path === 'string' &&
			typeof parsed.assetBaseUrl === 'string'
		) {
			return { entry: parsed.entry, assetBaseUrl: parsed.assetBaseUrl };
		}
	} catch {
		return undefined;
	}
	return undefined;
}

export function CanvasView({
	workspace,
	onCommand,
	onSelect,
	onClearDragPayload,
	onViewportChange,
	theme
}: CanvasViewProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [adapter, setAdapter] = useState<EditorRuntimeAdapter | null>(null);
	const [isPanning, setIsPanning] = useState(false);
	const panRef = useRef<{
		startClient: { x: number; y: number };
		startPan: { x: number; y: number };
	} | null>(null);
	const adapterRef = useRef(adapter);
	adapterRef.current = adapter;

	const previewTheme = theme === 'dark' ? 'dark' : 'light';
	const themeVars = useMemo(
		() => resolveTheme(previewTheme) ?? {},
		[previewTheme]
	);
	const previewDocument = useMemo(
		() =>
			createEditorPreviewDocument(
				workspace.document,
				workspace.viewport.showGrid
			),
		[workspace.document, workspace.viewport.showGrid]
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
				controller: false,
				themeVars
			});
			adpt = createEditorRuntimeAdapter(mounted);
			if (workspace.activeSceneId) {
				adpt.setActiveScene(workspace.activeSceneId);
			}
			setAdapter(adpt);
		} catch {
			setAdapter(null);
		}
		return () => {
			adpt?.destroy();
			mounted?.destroy();
			setAdapter(null);
		};
	}, [previewDocument, workspace.sourceYaml, themeVars]);

	useEffect(() => {
		if (!adapter || !workspace.activeSceneId) return;
		adapter.setActiveScene(workspace.activeSceneId);
	}, [adapter, workspace.activeSceneId]);

	const { ghostCell, onPointerDown, onPointerMove, onPointerUp } =
		useCanvasPointer({
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
				minX: baseViewBox.minX + workspace.viewport.pan.x,
				minY: baseViewBox.minY + workspace.viewport.pan.y,
				width: baseViewBox.width / zoom,
				height: baseViewBox.height / zoom
			}
		: undefined;
	const viewBoxStr = vb
		? `${vb.minX} ${vb.minY} ${vb.width} ${vb.height}`
		: undefined;

	useEffect(() => {
		if (!adapter?.mounted.svg || !viewBoxStr) return;
		adapter.mounted.svg.setAttribute('viewBox', viewBoxStr);
	}, [adapter, viewBoxStr]);

	useEffect(() => {
		const svg = adapter?.mounted.svg;
		if (!svg) return;
		for (const node of svg.querySelectorAll<SVGElement>('[data-layer]')) {
			node.style.display = '';
		}
		for (const layerName of workspace.uiState.hiddenLayers ?? []) {
			for (const node of svg.querySelectorAll<SVGElement>(
				`[data-layer="${escapeCssAttribute(layerName)}"]`
			)) {
				node.style.display = 'none';
			}
		}
	}, [adapter, workspace.uiState.hiddenLayers]);

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

	const resetView = () => {
		updateViewport({ zoom: 1, pan: { x: 0, y: 0 } });
	};

	const gridOpacity = workspace.viewport.gridOpacity ?? 0.35;
	const updateGridOpacity = (value: number) => {
		updateViewport({
			gridOpacity: value
		});
	};

	const isCanvasControlEvent = (event: React.PointerEvent) =>
		event.target instanceof Element &&
		event.target.closest('.isostate-canvas-controls');

	const startPan = (event: React.PointerEvent) => {
		panRef.current = {
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
		if (event.button === 1 || event.altKey || event.metaKey) return true;
		if (event.button !== 0 || zoom <= 1) return false;
		if (workspace.editState.dragPayload?.kind === 'asset') return false;
		try {
			const svgPoint = adapterRef.current.clientPointToSvgPoint({
				clientX: event.clientX,
				clientY: event.clientY
			});
			return !adapterRef.current.getObjectAtPoint(svgPoint, {
				kinds: ['element']
			});
		} catch {
			return false;
		}
	};

	return (
		<div
			ref={containerRef}
			className={`isostate-editor-canvas-view ${isPanning ? 'isostate-editor-canvas-view--panning' : ''}`}
			style={
				{
					'--isostate-editor-grid-opacity': String(gridOpacity)
				} as CSSProperties
			}
			role="application"
			aria-label="Scene canvas"
			onPointerDown={(e) => {
				if (isCanvasControlEvent(e)) return;
				if (shouldStartPan(e)) {
					startPan(e);
					return;
				}
				onPointerDown(e);
			}}
			onPointerMove={(e) => {
				const pan = panRef.current;
				if (pan && baseViewBox) {
					const rect = e.currentTarget.getBoundingClientRect();
					if (rect.width === 0 || rect.height === 0) return;
					const dx =
						((pan.startClient.x - e.clientX) / rect.width) *
						(baseViewBox.width / zoom);
					const dy =
						((pan.startClient.y - e.clientY) / rect.height) *
						(baseViewBox.height / zoom);
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
			onWheel={(e) => {
				if (!e.ctrlKey && !e.metaKey) return;
				e.preventDefault();
				zoomBy(e.deltaY > 0 ? 0.9 : 1.1);
			}}
			onDragOver={(e) => {
				e.preventDefault();
			}}
			onDrop={(e) => {
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
					const snapped = snapGridCell(gridPoint, gridBounds);
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
			<div
				className="isostate-canvas-controls"
				role="toolbar"
				aria-label="Canvas controls"
			>
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								variant="secondary"
								size="icon-sm"
								onClick={() => zoomBy(1.15)}
								aria-label="Zoom in"
							>
								<Plus aria-hidden="true" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Zoom in</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								variant="secondary"
								size="icon-sm"
								onClick={() => zoomBy(0.85)}
								aria-label="Zoom out"
							>
								<Minus aria-hidden="true" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Zoom out</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								variant="secondary"
								size="icon-sm"
								onClick={resetView}
								aria-label="Reset view"
							>
								<RotateCcw aria-hidden="true" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Reset view</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				<span className="isostate-canvas-zoom">{Math.round(zoom * 100)}%</span>
				<div className="isostate-grid-opacity-control">
					<Grid2X2 aria-hidden="true" />
					<input
						type="range"
						className="isostate-grid-opacity isostate-grid-opacity-native"
						min="0"
						max="1"
						step="0.05"
						value={gridOpacity}
						onInput={(event) =>
							updateGridOpacity(Number(event.currentTarget.value))
						}
						onPointerUp={(event) =>
							updateGridOpacity(Number(event.currentTarget.value))
						}
						onKeyUp={(event) =>
							updateGridOpacity(Number(event.currentTarget.value))
						}
						aria-label="Grid opacity"
					/>
					<Slider
						className="isostate-grid-opacity-slider"
						min={0}
						max={1}
						step={0.05}
						value={[gridOpacity]}
						onValueChange={([value]) => updateGridOpacity(value ?? gridOpacity)}
						aria-label="Grid opacity"
					/>
				</div>
			</div>
			{adapter && vb && viewBoxStr && (
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
