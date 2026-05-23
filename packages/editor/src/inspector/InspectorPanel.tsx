import type {
	CameraFocus,
	ConnectionPatch,
	ConnectionPlacement,
	ElementPatch,
	ElementPlacement
} from '@sebastianwessel/isostate/types';
import { useMemo } from 'react';
import {
	createCameraRemoveCommand,
	createCameraUpdateCommand,
	createConnectionAddCommand,
	createConnectionRemoveCommand,
	createConnectionUpdateCommand,
	createObjectAddCommand,
	createObjectRemoveCommand,
	createObjectUpdateCommand
} from '../commands.ts';
import {
	resolveSceneConnections,
	resolveSceneElements
} from '../scene-resolver.ts';
import type { EditorCommand, EditorWorkspace } from '../types.ts';

interface InspectorPanelProps {
	workspace: EditorWorkspace;
	onCommand: (cmd: EditorCommand) => void;
	mode?: 'attributes' | 'general';
}

const BUILT_IN_ASSETS = ['text', 'rectangle', 'circle', 'polygon', 'line'];
const ENTRY_ANIMATIONS = ['fade-in', 'slide-up', 'scale-in', 'pop-in'];
const EXIT_ANIMATIONS = ['fade-out', 'slide-down', 'scale-out', 'pop-out'];
const _AMBIENT_ANIMATIONS = ['pulse', 'float', 'bounce', 'shake', 'flow'];
const ROUTING_MODES = ['straight', 'orthogonal', 'manual'];
const CONNECTOR_PATTERNS = ['solid', 'dashed', 'dotted'];
const ENDPOINT_TYPES = ['none', 'arrow', 'dot', 'circle', 'diamond', 'bar'];
const DIRECTIONS = ['route', 'reverse'];
const SIDES = ['auto', 'top', 'right', 'bottom', 'left', 'front', 'back'];
const EASINGS = ['linear', 'ease-in-out', 'ease-out'];

function getActiveSceneIndex(workspace: EditorWorkspace): number {
	if (!workspace.document || !workspace.activeSceneId) return -1;
	return workspace.document.scenes.findIndex(
		(s) => s.id === workspace.activeSceneId
	);
}

function FormRow({
	label,
	children
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="isostate-inspector-row">
			<span className="isostate-inspector-label">{label}</span>
			<div className="isostate-inspector-control">{children}</div>
		</div>
	);
}

function SectionHeader({ title }: { title: string }) {
	return <div className="isostate-inspector-section">{title}</div>;
}

export function InspectorPanel({
	workspace,
	onCommand,
	mode = 'attributes'
}: InspectorPanelProps) {
	const doc = workspace.document;
	const sceneIndex = getActiveSceneIndex(workspace);
	const selection = workspace.selection;

	const resolvedElements = useMemo(() => {
		if (!doc || sceneIndex < 0) return new Map<string, ElementPlacement>();
		return resolveSceneElements(doc, sceneIndex);
	}, [doc, sceneIndex]);

	const resolvedConnections = useMemo(() => {
		if (!doc || sceneIndex < 0) return new Map<string, ConnectionPlacement>();
		return resolveSceneConnections(doc, sceneIndex);
	}, [doc, sceneIndex]);

	const selectedElementId =
		selection.objectIds.length === 1 ? selection.objectIds[0] : undefined;
	const selectedConnectionId =
		selection.connectionIds.length === 1
			? selection.connectionIds[0]
			: undefined;
	const hasMultiSelection =
		selection.objectIds.length + selection.connectionIds.length > 1;

	const selectedElement = selectedElementId
		? resolvedElements.get(selectedElementId)
		: undefined;
	const selectedConnection = selectedConnectionId
		? resolvedConnections.get(selectedConnectionId)
		: undefined;

	const layerNames = doc?.header.layers.map((l) => l.name) ?? [];
	const assetIds = [
		...BUILT_IN_ASSETS,
		...(doc?.header.assets.map((a) => a.id) ?? [])
	];

	const sceneElementIds = useMemo(() => {
		return Array.from(resolvedElements.keys());
	}, [resolvedElements]);

	const scene = doc && sceneIndex >= 0 ? doc.scenes[sceneIndex] : undefined;
	const camera = scene?.camera;

	const handleElementUpdate = (patch: Omit<ElementPatch, 'id'>) => {
		if (!workspace.activeSceneId || !selectedElementId) return;
		onCommand(
			createObjectUpdateCommand(workspace.activeSceneId, {
				id: selectedElementId,
				...patch
			} as ElementPatch)
		);
	};

	const handleElementRemove = () => {
		if (!workspace.activeSceneId || !selectedElementId) return;
		onCommand(
			createObjectRemoveCommand(workspace.activeSceneId, selectedElementId)
		);
	};

	const handleConnectionUpdate = (patch: Omit<ConnectionPatch, 'id'>) => {
		if (!workspace.activeSceneId || !selectedConnectionId) return;
		onCommand(
			createConnectionUpdateCommand(workspace.activeSceneId, {
				id: selectedConnectionId,
				...patch
			} as ConnectionPatch)
		);
	};

	const handleConnectionAdd = () => {
		if (!workspace.activeSceneId) return;
		const ids = sceneElementIds;
		const connection: ConnectionPlacement =
			ids.length >= 2
				? {
						id: `conn-${Math.random().toString(36).slice(2, 6)}`,
						from: { element: ids[0] },
						to: { element: ids[1] },
						layer: layerNames[0] ?? 'default',
						end: 'arrow'
					}
				: {
						id: `conn-${Math.random().toString(36).slice(2, 6)}`,
						route: [
							[0, 0],
							[2, 0]
						],
						layer: layerNames[0] ?? 'default',
						end: 'arrow'
					};
		onCommand(createConnectionAddCommand(workspace.activeSceneId, connection));
	};

	const handleConnectionRemove = () => {
		if (!workspace.activeSceneId || !selectedConnectionId) return;
		onCommand(
			createConnectionRemoveCommand(
				workspace.activeSceneId,
				selectedConnectionId
			)
		);
	};

	const handleCameraUpdate = (cameraUpdate: CameraFocus) => {
		if (!workspace.activeSceneId) return;
		onCommand(createCameraUpdateCommand(workspace.activeSceneId, cameraUpdate));
	};

	const handleCameraRemove = () => {
		if (!workspace.activeSceneId) return;
		onCommand(createCameraRemoveCommand(workspace.activeSceneId));
	};

	if (mode === 'general') {
		return (
			<div className="isostate-inspector">
				<div className="isostate-inspector-empty">
					<div className="isostate-inspector-section">Scene</div>
					<FormRow label="Scene ID">
						<input
							type="text"
							value={scene?.id ?? ''}
							readOnly
							className="isostate-input isostate-input--readonly"
						/>
					</FormRow>
					<FormRow label="Elements">
						<span className="isostate-readonly-value">
							{resolvedElements.size}
						</span>
					</FormRow>
					<FormRow label="Connections">
						<span className="isostate-readonly-value">
							{resolvedConnections.size}
						</span>
					</FormRow>
				</div>
				<CameraSection
					camera={camera}
					sceneElementIds={sceneElementIds}
					onUpdate={handleCameraUpdate}
					onRemove={handleCameraRemove}
				/>
			</div>
		);
	}

	return (
		<div className="isostate-inspector">
			{selectedElement && (
				<ElementInspector
					element={selectedElement}
					layerNames={layerNames}
					assetIds={assetIds}
					onUpdate={handleElementUpdate}
					onRemove={handleElementRemove}
					onCommand={onCommand}
					workspace={workspace}
				/>
			)}

			{selectedConnection && (
				<ConnectionInspector
					connection={selectedConnection}
					sceneElementIds={sceneElementIds}
					layerNames={layerNames}
					onUpdate={handleConnectionUpdate}
					onRemove={handleConnectionRemove}
				/>
			)}

			{hasMultiSelection && (
				<MultiSelectionControls
					selection={selection}
					layerNames={layerNames}
					onCommand={onCommand}
					workspace={workspace}
				/>
			)}

			{!selectedElement && !selectedConnection && !hasMultiSelection && (
				<div className="isostate-inspector-empty">
					<div className="isostate-inspector-section">Scene</div>
					<FormRow label="Scene ID">
						<input
							type="text"
							value={scene?.id ?? ''}
							readOnly
							className="isostate-input isostate-input--readonly"
						/>
					</FormRow>
					<FormRow label="Elements">
						<span className="isostate-readonly-value">
							{resolvedElements.size}
						</span>
					</FormRow>
					<FormRow label="Connections">
						<span className="isostate-readonly-value">
							{resolvedConnections.size}
						</span>
					</FormRow>
					<div className="isostate-inspector-actions">
						<button
							type="button"
							className="isostate-btn isostate-btn--sm"
							onClick={() => {
								if (!workspace.activeSceneId) return;
								onCommand(
									createObjectAddCommand(workspace.activeSceneId, {
										id: `text-${Math.random().toString(36).slice(2, 6)}`,
										asset: 'text',
										at: [1, 1],
										layer: layerNames[0] ?? 'default',
										size: 1
									})
								);
							}}
						>
							+ Text
						</button>
						<button
							type="button"
							className="isostate-btn isostate-btn--sm"
							onClick={() => {
								if (!workspace.activeSceneId) return;
								onCommand(
									createObjectAddCommand(workspace.activeSceneId, {
										id: `rect-${Math.random().toString(36).slice(2, 6)}`,
										asset: 'rectangle',
										at: [1, 1],
										layer: layerNames[0] ?? 'default',
										size: 1
									})
								);
							}}
						>
							+ Rectangle
						</button>
						<button
							type="button"
							className="isostate-btn isostate-btn--sm"
							onClick={handleConnectionAdd}
						>
							+ Connection
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

function ElementInspector({
	element,
	layerNames,
	assetIds,
	onUpdate,
	onRemove
}: {
	element: ElementPlacement;
	layerNames: string[];
	assetIds: string[];
	onUpdate: (patch: ElementPatch) => void;
	onRemove: () => void;
	onCommand: (cmd: EditorCommand) => void;
	workspace: EditorWorkspace;
}) {
	const isText = element.asset === 'text';
	const isPrimitive =
		element.asset === 'rectangle' ||
		element.asset === 'circle' ||
		element.asset === 'polygon' ||
		element.asset === 'line';

	return (
		<div>
			<SectionHeader title="Element" />
			<FormRow label="ID">
				<input
					type="text"
					value={element.id}
					readOnly
					className="isostate-input isostate-input--readonly"
				/>
			</FormRow>
			<FormRow label="Asset">
				<select
					className="isostate-select"
					value={element.asset}
					onChange={(e) =>
						onUpdate({ id: element.id, asset: e.target.value } as ElementPatch)
					}
				>
					{assetIds.map((id) => (
						<option key={id} value={id}>
							{id}
						</option>
					))}
				</select>
			</FormRow>
			<FormRow label="Position X">
				<input
					type="number"
					min={0}
					step={1}
					value={element.at[0]}
					className="isostate-input"
					onChange={(e) =>
						onUpdate({
							id: element.id,
							at: [Number(e.target.value), element.at[1]]
						})
					}
				/>
			</FormRow>
			<FormRow label="Position Y">
				<input
					type="number"
					min={0}
					step={1}
					value={element.at[1]}
					className="isostate-input"
					onChange={(e) =>
						onUpdate({
							id: element.id,
							at: [element.at[0], Number(e.target.value)]
						})
					}
				/>
			</FormRow>
			<FormRow label="Size">
				<input
					type="number"
					min={1}
					step={1}
					value={element.size ?? 1}
					className="isostate-input"
					onChange={(e) =>
						onUpdate({
							id: element.id,
							size: Number(e.target.value)
						})
					}
				/>
			</FormRow>
			<FormRow label="Layer">
				<select
					className="isostate-select"
					value={element.layer ?? layerNames[0] ?? ''}
					onChange={(e) => onUpdate({ id: element.id, layer: e.target.value })}
				>
					{layerNames.map((name) => (
						<option key={name} value={name}>
							{name}
						</option>
					))}
				</select>
			</FormRow>
			<FormRow label="Enter">
				<select
					className="isostate-select"
					value={element.enter ?? ''}
					onChange={(e) =>
						onUpdate({
							id: element.id,
							enter: (e.target.value || undefined) as ElementPatch['enter']
						})
					}
				>
					<option value="">—</option>
					{ENTRY_ANIMATIONS.map((a) => (
						<option key={a} value={a}>
							{a}
						</option>
					))}
				</select>
			</FormRow>
			<FormRow label="Exit">
				<select
					className="isostate-select"
					value={element.exit ?? ''}
					onChange={(e) =>
						onUpdate({
							id: element.id,
							exit: (e.target.value || undefined) as ElementPatch['exit']
						})
					}
				>
					<option value="">—</option>
					{EXIT_ANIMATIONS.map((a) => (
						<option key={a} value={a}>
							{a}
						</option>
					))}
				</select>
			</FormRow>
			{isText && (
				<div>
					<SectionHeader title="Text" />
					<FormRow label="Content">
						<input
							type="text"
							value={element.text?.value ?? ''}
							className="isostate-input"
							onChange={(e) =>
								onUpdate({
									id: element.id,
									text: { value: e.target.value }
								})
							}
						/>
					</FormRow>
					<FormRow label="Align">
						<select
							className="isostate-select"
							value={element.text?.align ?? 'middle'}
							onChange={(e) =>
								onUpdate({
									id: element.id,
									text: { align: e.target.value as 'start' | 'middle' | 'end' }
								})
							}
						>
							<option value="start">start</option>
							<option value="middle">middle</option>
							<option value="end">end</option>
						</select>
					</FormRow>
					<FormRow label="Font Size">
						<input
							type="number"
							min={1}
							value={element.text?.fontSize ?? 12}
							className="isostate-input"
							onChange={(e) =>
								onUpdate({
									id: element.id,
									text: { fontSize: Number(e.target.value) }
								})
							}
						/>
					</FormRow>
					<FormRow label="Fill">
						<input
							type="text"
							value={element.text?.fill ?? 'currentColor'}
							className="isostate-input"
							onChange={(e) =>
								onUpdate({
									id: element.id,
									text: { fill: e.target.value }
								})
							}
						/>
					</FormRow>
				</div>
			)}
			{isPrimitive && (
				<div>
					<SectionHeader title="Primitive Style" />
					<PrimitiveStyleFields element={element} onUpdate={onUpdate} />
				</div>
			)}
			<div className="isostate-inspector-actions">
				<button
					type="button"
					className="isostate-btn isostate-btn--sm isostate-btn--danger"
					onClick={onRemove}
				>
					Delete Element
				</button>
			</div>
		</div>
	);
}

function PrimitiveStyleFields({
	element,
	onUpdate
}: {
	element: ElementPlacement;
	onUpdate: (patch: ElementPatch) => void;
}) {
	const primitive = element.primitive;
	const shape =
		element.asset === 'rectangle'
			? primitive?.rectangle
			: element.asset === 'circle'
				? primitive?.circle
				: element.asset === 'polygon'
					? primitive?.polygon
					: element.asset === 'line'
						? primitive?.line
						: undefined;

	if (!shape) return null;

	const updateShape = (field: string, value: unknown) => {
		const patch: Record<string, unknown> = {};
		patch[field] = value;
		onUpdate({
			id: element.id,
			primitive: {
				[element.asset]: patch
			} as ElementPatch['primitive']
		});
	};

	return (
		<div>
			{'fill' in shape && (
				<FormRow label="Fill">
					<input
						type="text"
						value={(shape as Record<string, string | undefined>).fill ?? ''}
						className="isostate-input"
						onChange={(e) => updateShape('fill', e.target.value)}
					/>
				</FormRow>
			)}
			<FormRow label="Stroke">
				<input
					type="text"
					value={shape.stroke ?? ''}
					className="isostate-input"
					onChange={(e) => updateShape('stroke', e.target.value)}
				/>
			</FormRow>
			<FormRow label="Stroke Width">
				<input
					type="number"
					min={0}
					step={0.5}
					value={shape.strokeWidth ?? 1}
					className="isostate-input"
					onChange={(e) => updateShape('strokeWidth', Number(e.target.value))}
				/>
			</FormRow>
			<FormRow label="Opacity">
				<input
					type="number"
					min={0}
					max={1}
					step={0.1}
					value={shape.opacity ?? 1}
					className="isostate-input"
					onChange={(e) => updateShape('opacity', Number(e.target.value))}
				/>
			</FormRow>
		</div>
	);
}

function ConnectionInspector({
	connection,
	sceneElementIds,
	layerNames,
	onUpdate,
	onRemove
}: {
	connection: ConnectionPlacement;
	sceneElementIds: string[];
	layerNames: string[];
	onUpdate: (patch: ConnectionPatch) => void;
	onRemove: () => void;
}) {
	const fromMode = connection.from?.element ? 'element' : 'point';
	const toMode = connection.to?.element ? 'element' : 'point';

	return (
		<div>
			<SectionHeader title="Connection" />
			<FormRow label="ID">
				<input
					type="text"
					value={connection.id}
					readOnly
					className="isostate-input isostate-input--readonly"
				/>
			</FormRow>

			<SectionHeader title="From" />
			<FormRow label="Type">
				<select
					className="isostate-select"
					value={fromMode}
					onChange={(e) => {
						if (e.target.value === 'element') {
							onUpdate({
								id: connection.id,
								from: {
									element: sceneElementIds[0] ?? ''
								}
							});
						} else {
							onUpdate({
								id: connection.id,
								from: { at: [0, 0] }
							});
						}
					}}
				>
					<option value="element">Element</option>
					<option value="point">Grid Point</option>
				</select>
			</FormRow>
			{fromMode === 'element' && (
				<FormRow label="Element">
					<select
						className="isostate-select"
						value={connection.from?.element ?? ''}
						onChange={(e) =>
							onUpdate({
								id: connection.id,
								from: {
									element: e.target.value
								}
							})
						}
					>
						{sceneElementIds.map((id) => (
							<option key={id} value={id}>
								{id}
							</option>
						))}
					</select>
				</FormRow>
			)}
			{fromMode === 'point' && (
				<div>
					<FormRow label="X">
						<input
							type="number"
							min={0}
							step={1}
							value={connection.from?.at?.[0] ?? 0}
							className="isostate-input"
							onChange={(e) =>
								onUpdate({
									id: connection.id,
									from: {
										at: [Number(e.target.value), connection.from?.at?.[1] ?? 0]
									}
								})
							}
						/>
					</FormRow>
					<FormRow label="Y">
						<input
							type="number"
							min={0}
							step={1}
							value={connection.from?.at?.[1] ?? 0}
							className="isostate-input"
							onChange={(e) =>
								onUpdate({
									id: connection.id,
									from: {
										at: [connection.from?.at?.[0] ?? 0, Number(e.target.value)]
									}
								})
							}
						/>
					</FormRow>
				</div>
			)}
			<FormRow label="Side">
				<select
					className="isostate-select"
					value={connection.from?.side ?? 'auto'}
					onChange={(e) =>
						onUpdate({
							id: connection.id,
							from: {
								...connection.from,
								side: e.target.value as NonNullable<
									ConnectionPatch['from']
								>['side']
							}
						})
					}
				>
					{SIDES.map((s) => (
						<option key={s} value={s}>
							{s}
						</option>
					))}
				</select>
			</FormRow>
			<FormRow label="Offset">
				<input
					type="number"
					step={1}
					value={connection.from?.offset ?? 0}
					className="isostate-input"
					onChange={(e) =>
						onUpdate({
							id: connection.id,
							from: {
								...connection.from,
								offset: Number(e.target.value)
							}
						})
					}
				/>
			</FormRow>

			<SectionHeader title="To" />
			<FormRow label="Type">
				<select
					className="isostate-select"
					value={toMode}
					onChange={(e) => {
						if (e.target.value === 'element') {
							onUpdate({
								id: connection.id,
								to: {
									element: sceneElementIds[0] ?? ''
								}
							});
						} else {
							onUpdate({
								id: connection.id,
								to: { at: [0, 0] }
							});
						}
					}}
				>
					<option value="element">Element</option>
					<option value="point">Grid Point</option>
				</select>
			</FormRow>
			{toMode === 'element' && (
				<FormRow label="Element">
					<select
						className="isostate-select"
						value={connection.to?.element ?? ''}
						onChange={(e) =>
							onUpdate({
								id: connection.id,
								to: {
									element: e.target.value
								}
							})
						}
					>
						{sceneElementIds.map((id) => (
							<option key={id} value={id}>
								{id}
							</option>
						))}
					</select>
				</FormRow>
			)}
			{toMode === 'point' && (
				<div>
					<FormRow label="X">
						<input
							type="number"
							min={0}
							step={1}
							value={connection.to?.at?.[0] ?? 0}
							className="isostate-input"
							onChange={(e) =>
								onUpdate({
									id: connection.id,
									to: {
										at: [Number(e.target.value), connection.to?.at?.[1] ?? 0]
									}
								})
							}
						/>
					</FormRow>
					<FormRow label="Y">
						<input
							type="number"
							min={0}
							step={1}
							value={connection.to?.at?.[1] ?? 0}
							className="isostate-input"
							onChange={(e) =>
								onUpdate({
									id: connection.id,
									to: {
										at: [connection.to?.at?.[0] ?? 0, Number(e.target.value)]
									}
								})
							}
						/>
					</FormRow>
				</div>
			)}
			<FormRow label="Side">
				<select
					className="isostate-select"
					value={connection.to?.side ?? 'auto'}
					onChange={(e) =>
						onUpdate({
							id: connection.id,
							to: {
								...connection.to,
								side: e.target.value as NonNullable<
									ConnectionPatch['to']
								>['side']
							}
						})
					}
				>
					{SIDES.map((s) => (
						<option key={s} value={s}>
							{s}
						</option>
					))}
				</select>
			</FormRow>
			<FormRow label="Offset">
				<input
					type="number"
					step={1}
					value={connection.to?.offset ?? 0}
					className="isostate-input"
					onChange={(e) =>
						onUpdate({
							id: connection.id,
							to: {
								...connection.to,
								offset: Number(e.target.value)
							}
						})
					}
				/>
			</FormRow>

			<SectionHeader title="Routing" />
			<FormRow label="Mode">
				<select
					className="isostate-select"
					value={connection.routing?.mode ?? 'orthogonal'}
					onChange={(e) =>
						onUpdate({
							id: connection.id,
							routing: {
								...connection.routing,
								mode: e.target.value as NonNullable<
									ConnectionPatch['routing']
								>['mode']
							}
						})
					}
				>
					{ROUTING_MODES.map((m) => (
						<option key={m} value={m}>
							{m}
						</option>
					))}
				</select>
			</FormRow>
			{connection.route && (
				<FormRow label="Route">
					<span className="isostate-readonly-value">
						{connection.route.length} points
					</span>
				</FormRow>
			)}

			<SectionHeader title="Style" />
			<FormRow label="Pattern">
				<select
					className="isostate-select"
					value={connection.style?.pattern ?? 'solid'}
					onChange={(e) =>
						onUpdate({
							id: connection.id,
							style: {
								...connection.style,
								pattern: e.target.value as NonNullable<
									ConnectionPatch['style']
								>['pattern']
							}
						})
					}
				>
					{CONNECTOR_PATTERNS.map((p) => (
						<option key={p} value={p}>
							{p}
						</option>
					))}
				</select>
			</FormRow>
			<FormRow label="Stroke">
				<input
					type="text"
					value={connection.style?.stroke ?? ''}
					className="isostate-input"
					onChange={(e) =>
						onUpdate({
							id: connection.id,
							style: {
								...connection.style,
								stroke: e.target.value
							}
						})
					}
				/>
			</FormRow>
			<FormRow label="Stroke Width">
				<input
					type="number"
					min={0}
					step={0.5}
					value={connection.style?.strokeWidth ?? 1}
					className="isostate-input"
					onChange={(e) =>
						onUpdate({
							id: connection.id,
							style: {
								...connection.style,
								strokeWidth: Number(e.target.value)
							}
						})
					}
				/>
			</FormRow>
			<FormRow label="Opacity">
				<input
					type="number"
					min={0}
					max={1}
					step={0.1}
					value={connection.style?.opacity ?? 1}
					className="isostate-input"
					onChange={(e) =>
						onUpdate({
							id: connection.id,
							style: {
								...connection.style,
								opacity: Number(e.target.value)
							}
						})
					}
				/>
			</FormRow>

			<SectionHeader title="Endpoints" />
			<FormRow label="Start">
				<select
					className="isostate-select"
					value={connection.start ?? 'none'}
					onChange={(e) =>
						onUpdate({
							id: connection.id,
							start: e.target.value as ConnectionPatch['start']
						})
					}
				>
					{ENDPOINT_TYPES.map((t) => (
						<option key={t} value={t}>
							{t}
						</option>
					))}
				</select>
			</FormRow>
			<FormRow label="End">
				<select
					className="isostate-select"
					value={connection.end ?? 'arrow'}
					onChange={(e) =>
						onUpdate({
							id: connection.id,
							end: e.target.value as ConnectionPatch['end']
						})
					}
				>
					{ENDPOINT_TYPES.map((t) => (
						<option key={t} value={t}>
							{t}
						</option>
					))}
				</select>
			</FormRow>
			<FormRow label="Direction">
				<select
					className="isostate-select"
					value={connection.direction ?? 'route'}
					onChange={(e) =>
						onUpdate({
							id: connection.id,
							direction: e.target.value as ConnectionPatch['direction']
						})
					}
				>
					{DIRECTIONS.map((d) => (
						<option key={d} value={d}>
							{d}
						</option>
					))}
				</select>
			</FormRow>

			<FormRow label="Layer">
				<select
					className="isostate-select"
					value={connection.layer ?? layerNames[0] ?? ''}
					onChange={(e) =>
						onUpdate({ id: connection.id, layer: e.target.value })
					}
				>
					{layerNames.map((name) => (
						<option key={name} value={name}>
							{name}
						</option>
					))}
				</select>
			</FormRow>
			<div className="isostate-inspector-actions">
				<button
					type="button"
					className="isostate-btn isostate-btn--sm isostate-btn--danger"
					onClick={onRemove}
				>
					Delete Connection
				</button>
			</div>
		</div>
	);
}

function MultiSelectionControls({
	selection,
	layerNames,
	onCommand,
	workspace
}: {
	selection: { objectIds: string[]; connectionIds: string[] };
	layerNames: string[];
	onCommand: (cmd: EditorCommand) => void;
	workspace: EditorWorkspace;
}) {
	const allIds = [...selection.objectIds, ...selection.connectionIds];

	const nudge = (_dx: number, _dy: number) => {
		if (!workspace.activeSceneId) return;
		for (const id of selection.objectIds) {
			onCommand(
				createObjectUpdateCommand(workspace.activeSceneId, {
					id,
					at: [0, 0] // Will be resolved in a real implementation
				})
			);
		}
	};

	return (
		<div>
			<SectionHeader title={`${allIds.length} Selected`} />
			<div className="isostate-inspector-row isostate-nudge-row">
				<button
					type="button"
					className="isostate-btn isostate-btn--sm"
					onClick={() => nudge(0, -1)}
					title="Nudge up"
				>
					&uarr;
				</button>
				<button
					type="button"
					className="isostate-btn isostate-btn--sm"
					onClick={() => nudge(0, 1)}
					title="Nudge down"
				>
					&darr;
				</button>
				<button
					type="button"
					className="isostate-btn isostate-btn--sm"
					onClick={() => nudge(-1, 0)}
					title="Nudge left"
				>
					&larr;
				</button>
				<button
					type="button"
					className="isostate-btn isostate-btn--sm"
					onClick={() => nudge(1, 0)}
					title="Nudge right"
				>
					&rarr;
				</button>
			</div>
			<FormRow label="Layer">
				<select
					className="isostate-select"
					value=""
					onChange={(e) => {
						if (!workspace.activeSceneId || !e.target.value) return;
						for (const id of selection.objectIds) {
							onCommand(
								createObjectUpdateCommand(workspace.activeSceneId, {
									id,
									layer: e.target.value
								})
							);
						}
					}}
				>
					<option value="">Assign to layer…</option>
					{layerNames.map((name) => (
						<option key={name} value={name}>
							{name}
						</option>
					))}
				</select>
			</FormRow>
		</div>
	);
}

function CameraSection({
	camera,
	sceneElementIds,
	onUpdate,
	onRemove
}: {
	camera?: CameraFocus;
	sceneElementIds: string[];
	onUpdate: (camera: CameraFocus) => void;
	onRemove: () => void;
}) {
	const targetType = camera
		? 'element' in camera.target
			? 'element'
			: 'area' in camera.target
				? 'area'
				: 'reset'
		: 'none';

	return (
		<div>
			<SectionHeader title="Camera" />
			<FormRow label="Target">
				<select
					className="isostate-select"
					value={targetType}
					onChange={(e) => {
						const type = e.target.value as
							| 'none'
							| 'element'
							| 'area'
							| 'reset';
						if (type === 'none') {
							onRemove();
						} else if (type === 'element') {
							onUpdate({
								target: { element: sceneElementIds[0] ?? '' }
							});
						} else if (type === 'area') {
							onUpdate({
								target: {
									area: { at: [0, 0], size: [1, 1] }
								}
							});
						} else if (type === 'reset') {
							onUpdate({ target: { reset: true } });
						}
					}}
				>
					<option value="none">None</option>
					<option value="element">Element</option>
					<option value="area">Area</option>
					<option value="reset">Reset</option>
				</select>
			</FormRow>

			{targetType === 'element' && (
				<FormRow label="Element">
					<select
						className="isostate-select"
						value={
							(camera && 'element' in camera.target
								? camera.target.element
								: '') ?? ''
						}
						onChange={(e) =>
							onUpdate({
								target: { element: e.target.value },
								padding: camera?.padding,
								duration: camera?.duration,
								easing: camera?.easing
							})
						}
					>
						{sceneElementIds.map((id) => (
							<option key={id} value={id}>
								{id}
							</option>
						))}
					</select>
				</FormRow>
			)}

			{targetType === 'area' &&
				camera &&
				'area' in camera.target &&
				(() => {
					const cam = camera as CameraFocus & {
						target: { area: { at: [number, number]; size: [number, number] } };
					};
					return (
						<div>
							<FormRow label="X">
								<input
									type="number"
									min={0}
									step={1}
									value={cam.target.area.at[0]}
									className="isostate-input"
									onChange={(e) =>
										onUpdate({
											target: {
												area: {
													at: [Number(e.target.value), cam.target.area.at[1]],
													size: cam.target.area.size
												}
											},
											padding: cam.padding,
											duration: cam.duration,
											easing: cam.easing
										})
									}
								/>
							</FormRow>
							<FormRow label="Y">
								<input
									type="number"
									min={0}
									step={1}
									value={cam.target.area.at[1]}
									className="isostate-input"
									onChange={(e) =>
										onUpdate({
											target: {
												area: {
													at: [cam.target.area.at[0], Number(e.target.value)],
													size: cam.target.area.size
												}
											},
											padding: cam.padding,
											duration: cam.duration,
											easing: cam.easing
										})
									}
								/>
							</FormRow>
							<FormRow label="Width">
								<input
									type="number"
									min={1}
									step={1}
									value={cam.target.area.size[0]}
									className="isostate-input"
									onChange={(e) =>
										onUpdate({
											target: {
												area: {
													at: cam.target.area.at,
													size: [
														Number(e.target.value),
														cam.target.area.size[1]
													]
												}
											},
											padding: cam.padding,
											duration: cam.duration,
											easing: cam.easing
										})
									}
								/>
							</FormRow>
							<FormRow label="Height">
								<input
									type="number"
									min={1}
									step={1}
									value={cam.target.area.size[1]}
									className="isostate-input"
									onChange={(e) =>
										onUpdate({
											target: {
												area: {
													at: cam.target.area.at,
													size: [
														cam.target.area.size[0],
														Number(e.target.value)
													]
												}
											},
											padding: cam.padding,
											duration: cam.duration,
											easing: cam.easing
										})
									}
								/>
							</FormRow>
						</div>
					);
				})()}

			{targetType !== 'none' && targetType !== 'reset' && camera && (
				<div>
					<FormRow label="Padding">
						<input
							type="number"
							min={0}
							max={2048}
							step={1}
							value={camera.padding ?? 32}
							className="isostate-input"
							onChange={(e) =>
								onUpdate({
									...camera,
									padding: Number(e.target.value)
								})
							}
						/>
					</FormRow>
					<FormRow label="Duration">
						<input
							type="number"
							min={0}
							max={10000}
							step={100}
							value={camera.duration ?? ''}
							className="isostate-input"
							onChange={(e) =>
								onUpdate({
									...camera,
									duration:
										e.target.value === '' ? undefined : Number(e.target.value)
								})
							}
						/>
					</FormRow>
					<FormRow label="Easing">
						<select
							className="isostate-select"
							value={camera.easing ?? ''}
							onChange={(e) =>
								onUpdate({
									...camera,
									easing:
										e.target.value === ''
											? undefined
											: (e.target.value as CameraFocus['easing'])
								})
							}
						>
							<option value="">Default</option>
							{EASINGS.map((e) => (
								<option key={e} value={e}>
									{e}
								</option>
							))}
						</select>
					</FormRow>
				</div>
			)}

			{targetType !== 'none' && (
				<div className="isostate-inspector-row">
					<button
						type="button"
						className="isostate-btn isostate-btn--secondary"
						onClick={onRemove}
					>
						Clear Camera
					</button>
				</div>
			)}
		</div>
	);
}
