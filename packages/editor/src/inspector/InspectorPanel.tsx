import type {
	CameraFocus,
	ConnectionPatch,
	ConnectionPlacement,
	ConnectorRouting,
	ElementPatch,
	ElementPlacement
} from '@sebastianwessel/isostate/types';
import { useEffect, useMemo, useState } from 'react';
import {
	createCameraRemoveCommand,
	createCameraUpdateCommand,
	createConnectionRemoveCommand,
	createConnectionRenameCommand,
	createConnectionUpdateCommand,
	createLayerUpdateCommand,
	createObjectRemoveCommand,
	createObjectRenameCommand,
	createObjectUpdateCommand,
	createSceneUpdateCommand
} from '../commands.ts';
import {
	resolveSceneConnections,
	resolveSceneElements
} from '../scene-resolver.ts';
import type { EditorCommand, EditorWorkspace } from '../types.ts';
import { Button } from '../ui/button.tsx';
import { Input } from '../ui/input.tsx';
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '../ui/select.tsx';
import { Textarea } from '../ui/textarea.tsx';

interface InspectorPanelProps {
	workspace: EditorWorkspace;
	onCommand: (cmd: EditorCommand) => void;
	mode?: 'attributes' | 'general';
}

const ENTRY_ANIMATIONS = [
	'fade-in',
	'fade-in-grow',
	'fall-in',
	'rise-from-ground',
	'slide-in-left',
	'slide-in-right',
	'flip-in',
	'none'
];
const EXIT_ANIMATIONS = [
	'fade-out',
	'fade-out-shrink',
	'fall-through-ground',
	'rise-away',
	'slide-out-left',
	'slide-out-right',
	'flip-out',
	'none'
];
const AMBIENT_ANIMATIONS = ['pulse', 'float', 'bounce', 'shake'];
const ROUTING_MODES = ['straight', 'orthogonal', 'manual'];
const ROUTING_AVOID = ['objects', 'none'];
const ROUTING_PREFER = ['direct', 'fewest-bends', 'shortest'];
const CONNECTOR_VARIANTS = ['line', 'road'];
const CONNECTOR_PATTERNS = ['solid', 'dashed', 'dotted'];
const CONNECTOR_LANES = ['none', 'center-dashed'];
const ENDPOINT_TYPES = ['none', 'arrow', 'dot', 'circle', 'diamond', 'bar'];
const DIRECTIONS = ['route', 'reverse'];
const SIDES = ['auto', 'top', 'right', 'bottom', 'left', 'front', 'back'];
const EASINGS = ['linear', 'ease-in-out', 'ease-out'];
const SELECT_NONE_VALUE = '__none';

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

function EditableIdInput({
	value,
	ariaLabel,
	onCommit
}: {
	value: string;
	ariaLabel: string;
	onCommit: (value: string) => void;
}) {
	const [draft, setDraft] = useState(value);
	useEffect(() => setDraft(value), [value]);
	const commit = (rawValue = draft) => {
		const next = rawValue.trim();
		if (next && next !== value) {
			onCommit(next);
			return;
		}
		setDraft(value);
	};
	return (
		<Input
			type="text"
			value={draft}
			aria-label={ariaLabel}
			className="isostate-input"
			onChange={(event) => setDraft(event.currentTarget.value)}
			onBlur={(event) => commit(event.currentTarget.value)}
			onKeyDown={(event) => {
				if (event.key === 'Enter') {
					event.currentTarget.blur();
				}
				if (event.key === 'Escape') {
					setDraft(value);
					event.currentTarget.blur();
				}
			}}
		/>
	);
}

function InspectorSelect({
	value,
	options,
	placeholder,
	onChange
}: {
	value: string | undefined;
	options: Array<{ value: string; label: string }>;
	placeholder?: string;
	onChange: (value: string) => void;
}) {
	const selectValue =
		value === undefined || value === '' ? SELECT_NONE_VALUE : value;

	return (
		<Select
			value={selectValue}
			onValueChange={(nextValue) =>
				onChange(nextValue === SELECT_NONE_VALUE ? '' : nextValue)
			}
		>
			<SelectTrigger className="isostate-select">
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent position="popper">
				<SelectGroup>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}

function selectOptions(values: string[]) {
	return values.map((value) => ({ value, label: value }));
}

function formatRoute(route: [number, number][] | undefined): string {
	return (route ?? []).map((point) => `${point[0]}, ${point[1]}`).join('\n');
}

function parseRoute(value: string): [number, number][] | undefined {
	const route: [number, number][] = [];
	for (const line of value.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const match = trimmed.match(
			/^\[?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]?$/
		);
		if (!match) return undefined;
		route.push([Number(match[1]), Number(match[2])]);
	}
	return route.length >= 2 ? route : undefined;
}

function updateAmbient(
	ambient: ConnectionPlacement['ambient'] | ElementPlacement['ambient'],
	name: string,
	enabled: boolean
) {
	const next = (ambient ?? []).filter((item) => item.name !== name);
	if (enabled) {
		next.push({ name });
	}
	return next;
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
	const selectedLayerName =
		selection.layerNames.length === 1 &&
		selection.objectIds.length === 0 &&
		selection.connectionIds.length === 0
			? selection.layerNames[0]
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
	const selectedLayer = selectedLayerName
		? (doc?.header.layers.find((layer) => layer.name === selectedLayerName) ??
			undefined)
		: undefined;
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
						<Input
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
					onUpdate={handleElementUpdate}
					onRemove={handleElementRemove}
					onCommand={onCommand}
					workspace={workspace}
					onRename={(nextId) =>
						onCommand(createObjectRenameCommand(selectedElement.id, nextId))
					}
				/>
			)}

			{selectedConnection && (
				<ConnectionInspector
					connection={selectedConnection}
					sceneElementIds={sceneElementIds}
					layerNames={layerNames}
					onUpdate={handleConnectionUpdate}
					onRemove={handleConnectionRemove}
					onRename={(nextId) =>
						onCommand(
							createConnectionRenameCommand(selectedConnection.id, nextId)
						)
					}
				/>
			)}

			{selectedLayer && (
				<LayerInspector
					layerName={selectedLayer.name}
					order={selectedLayer.order}
					onRename={(nextName) =>
						onCommand(
							createLayerUpdateCommand(selectedLayer.name, { name: nextName })
						)
					}
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

			{!selectedElement &&
				!selectedConnection &&
				!selectedLayer &&
				!hasMultiSelection && (
					<div className="isostate-inspector-empty">
						<div className="isostate-inspector-section">Scene</div>
						<FormRow label="Scene ID">
							<EditableIdInput
								value={scene?.id ?? ''}
								ariaLabel="Rename scene"
								onCommit={(nextId) => {
									if (!scene) return;
									onCommand(createSceneUpdateCommand(scene.id, { id: nextId }));
								}}
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
				)}
		</div>
	);
}

function ElementInspector({
	element,
	layerNames,
	onUpdate,
	onRemove,
	onRename
}: {
	element: ElementPlacement;
	layerNames: string[];
	onUpdate: (patch: ElementPatch) => void;
	onRemove: () => void;
	onCommand: (cmd: EditorCommand) => void;
	workspace: EditorWorkspace;
	onRename: (value: string) => void;
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
				<EditableIdInput
					value={element.id}
					ariaLabel={`Rename element ${element.id}`}
					onCommit={onRename}
				/>
			</FormRow>
			<FormRow label="Asset">
				<Input
					type="text"
					value={element.asset}
					readOnly
					className="isostate-input isostate-input--readonly"
				/>
			</FormRow>
			<FormRow label="Position X">
				<Input
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
				<Input
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
				<Input
					type="number"
					min={0}
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
				<InspectorSelect
					value={element.layer ?? layerNames[0] ?? ''}
					options={selectOptions(layerNames)}
					onChange={(value) => onUpdate({ id: element.id, layer: value })}
				/>
			</FormRow>
			<FormRow label="Enter">
				<InspectorSelect
					value={element.enter ?? ''}
					options={[
						{ value: SELECT_NONE_VALUE, label: '—' },
						...selectOptions(ENTRY_ANIMATIONS)
					]}
					onChange={(value) =>
						onUpdate({
							id: element.id,
							enter: (value || undefined) as ElementPatch['enter']
						})
					}
				/>
			</FormRow>
			<FormRow label="Exit">
				<InspectorSelect
					value={element.exit ?? ''}
					options={[
						{ value: SELECT_NONE_VALUE, label: '—' },
						...selectOptions(EXIT_ANIMATIONS)
					]}
					onChange={(value) =>
						onUpdate({
							id: element.id,
							exit: (value || undefined) as ElementPatch['exit']
						})
					}
				/>
			</FormRow>
			<FormRow label="Ambient">
				<div className="isostate-toggle-row">
					{AMBIENT_ANIMATIONS.map((name) => {
						const enabled =
							element.ambient?.some((item) => item.name === name) ?? false;
						return (
							<Button
								key={name}
								type="button"
								size="sm"
								variant={enabled ? 'default' : 'secondary'}
								onClick={() =>
									onUpdate({
										id: element.id,
										ambient: updateAmbient(element.ambient, name, !enabled)
									})
								}
							>
								{name}
							</Button>
						);
					})}
				</div>
			</FormRow>
			{isText && (
				<div>
					<SectionHeader title="Text" />
					<FormRow label="Content">
						<Input
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
						<InspectorSelect
							value={element.text?.align ?? 'middle'}
							options={selectOptions(['start', 'middle', 'end'])}
							onChange={(value) =>
								onUpdate({
									id: element.id,
									text: { align: value as 'start' | 'middle' | 'end' }
								})
							}
						/>
					</FormRow>
					<FormRow label="Placement">
						<InspectorSelect
							value={element.text?.placement ?? 'cell'}
							options={selectOptions(['cell', 'caption'])}
							onChange={(value) =>
								onUpdate({
									id: element.id,
									text: { placement: value as 'cell' | 'caption' }
								})
							}
						/>
					</FormRow>
					<FormRow label="Font Size">
						<Input
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
						<Input
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
				<Button
					type="button"
					size="sm"
					variant="destructive"
					onClick={onRemove}
				>
					Delete Element
				</Button>
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
					<Input
						type="text"
						value={(shape as Record<string, string | undefined>).fill ?? ''}
						className="isostate-input"
						onChange={(e) => updateShape('fill', e.target.value)}
					/>
				</FormRow>
			)}
			<FormRow label="Stroke">
				<Input
					type="text"
					value={shape.stroke ?? ''}
					className="isostate-input"
					onChange={(e) => updateShape('stroke', e.target.value)}
				/>
			</FormRow>
			<FormRow label="Stroke Width">
				<Input
					type="number"
					min={0}
					step={0.5}
					value={shape.strokeWidth ?? 1}
					className="isostate-input"
					onChange={(e) => updateShape('strokeWidth', Number(e.target.value))}
				/>
			</FormRow>
			<FormRow label="Opacity">
				<Input
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

function LayerInspector({
	layerName,
	order,
	onRename
}: {
	layerName: string;
	order?: number;
	onRename: (value: string) => void;
}) {
	return (
		<div>
			<SectionHeader title="Layer" />
			<FormRow label="ID">
				<EditableIdInput
					value={layerName}
					ariaLabel={`Rename layer ${layerName}`}
					onCommit={onRename}
				/>
			</FormRow>
			<FormRow label="Order">
				<span className="isostate-readonly-value">{order ?? 'auto'}</span>
			</FormRow>
		</div>
	);
}

function ConnectionInspector({
	connection,
	sceneElementIds,
	layerNames,
	onUpdate,
	onRemove,
	onRename
}: {
	connection: ConnectionPlacement;
	sceneElementIds: string[];
	layerNames: string[];
	onUpdate: (patch: ConnectionPatch) => void;
	onRemove: () => void;
	onRename: (value: string) => void;
}) {
	const routeSourceMode = connection.route ? 'manual' : 'endpoints';
	const fromMode = connection.from?.element ? 'element' : 'point';
	const toMode = connection.to?.element ? 'element' : 'point';
	const hasFlow =
		connection.ambient?.some((item) => item.name === 'flow') ?? false;

	return (
		<div>
			<SectionHeader title="Connection" />
			<FormRow label="ID">
				<EditableIdInput
					value={connection.id}
					ariaLabel={`Rename connection ${connection.id}`}
					onCommit={onRename}
				/>
			</FormRow>
			<FormRow label="Route Source">
				<InspectorSelect
					value={routeSourceMode}
					options={[
						{ value: 'endpoints', label: 'Endpoints' },
						{ value: 'manual', label: 'Manual Route' }
					]}
					onChange={(value) => {
						if (value === 'manual') {
							onUpdate({
								id: connection.id,
								route: connection.route ?? [
									connection.from?.at ?? [0, 0],
									connection.to?.at ?? [2, 0]
								],
								from: undefined,
								to: undefined
							});
						} else {
							onUpdate({
								id: connection.id,
								route: undefined,
								from: connection.from ?? { element: sceneElementIds[0] ?? '' },
								to: connection.to ?? {
									element: sceneElementIds[1] ?? sceneElementIds[0] ?? ''
								}
							});
						}
					}}
				/>
			</FormRow>

			{routeSourceMode === 'manual' && (
				<FormRow label="Route">
					<Textarea
						value={formatRoute(connection.route)}
						className="isostate-textarea"
						placeholder={'0, 0\n2, 0'}
						onChange={(event) => {
							const route = parseRoute(event.target.value);
							if (!route) return;
							onUpdate({
								id: connection.id,
								route,
								from: undefined,
								to: undefined
							});
						}}
					/>
				</FormRow>
			)}

			{routeSourceMode === 'endpoints' && (
				<>
					<SectionHeader title="From" />
					<FormRow label="Type">
						<InspectorSelect
							value={fromMode}
							options={[
								{ value: 'element', label: 'Element' },
								{ value: 'point', label: 'Grid Point' }
							]}
							onChange={(value) => {
								if (value === 'element') {
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
						/>
					</FormRow>
					{fromMode === 'element' && (
						<FormRow label="Element">
							<InspectorSelect
								value={connection.from?.element ?? ''}
								options={selectOptions(sceneElementIds)}
								onChange={(value) =>
									onUpdate({
										id: connection.id,
										from: {
											element: value
										}
									})
								}
							/>
						</FormRow>
					)}
					{fromMode === 'point' && (
						<div>
							<FormRow label="X">
								<Input
									type="number"
									min={0}
									step={1}
									value={connection.from?.at?.[0] ?? 0}
									className="isostate-input"
									onChange={(e) =>
										onUpdate({
											id: connection.id,
											from: {
												at: [
													Number(e.target.value),
													connection.from?.at?.[1] ?? 0
												]
											}
										})
									}
								/>
							</FormRow>
							<FormRow label="Y">
								<Input
									type="number"
									min={0}
									step={1}
									value={connection.from?.at?.[1] ?? 0}
									className="isostate-input"
									onChange={(e) =>
										onUpdate({
											id: connection.id,
											from: {
												at: [
													connection.from?.at?.[0] ?? 0,
													Number(e.target.value)
												]
											}
										})
									}
								/>
							</FormRow>
						</div>
					)}
					<FormRow label="Side">
						<InspectorSelect
							value={connection.from?.side ?? 'auto'}
							options={selectOptions(SIDES)}
							onChange={(value) =>
								onUpdate({
									id: connection.id,
									from: {
										...connection.from,
										side: value as NonNullable<ConnectionPatch['from']>['side']
									}
								})
							}
						/>
					</FormRow>
					<FormRow label="Offset">
						<Input
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
						<InspectorSelect
							value={toMode}
							options={[
								{ value: 'element', label: 'Element' },
								{ value: 'point', label: 'Grid Point' }
							]}
							onChange={(value) => {
								if (value === 'element') {
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
						/>
					</FormRow>
					{toMode === 'element' && (
						<FormRow label="Element">
							<InspectorSelect
								value={connection.to?.element ?? ''}
								options={selectOptions(sceneElementIds)}
								onChange={(value) =>
									onUpdate({
										id: connection.id,
										to: {
											element: value
										}
									})
								}
							/>
						</FormRow>
					)}
					{toMode === 'point' && (
						<div>
							<FormRow label="X">
								<Input
									type="number"
									min={0}
									step={1}
									value={connection.to?.at?.[0] ?? 0}
									className="isostate-input"
									onChange={(e) =>
										onUpdate({
											id: connection.id,
											to: {
												at: [
													Number(e.target.value),
													connection.to?.at?.[1] ?? 0
												]
											}
										})
									}
								/>
							</FormRow>
							<FormRow label="Y">
								<Input
									type="number"
									min={0}
									step={1}
									value={connection.to?.at?.[1] ?? 0}
									className="isostate-input"
									onChange={(e) =>
										onUpdate({
											id: connection.id,
											to: {
												at: [
													connection.to?.at?.[0] ?? 0,
													Number(e.target.value)
												]
											}
										})
									}
								/>
							</FormRow>
						</div>
					)}
					<FormRow label="Side">
						<InspectorSelect
							value={connection.to?.side ?? 'auto'}
							options={selectOptions(SIDES)}
							onChange={(value) =>
								onUpdate({
									id: connection.id,
									to: {
										...connection.to,
										side: value as NonNullable<ConnectionPatch['to']>['side']
									}
								})
							}
						/>
					</FormRow>
					<FormRow label="Offset">
						<Input
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
				</>
			)}

			<SectionHeader title="Routing" />
			<FormRow label="Mode">
				<InspectorSelect
					value={connection.routing?.mode ?? 'orthogonal'}
					options={selectOptions(ROUTING_MODES)}
					onChange={(value) =>
						onUpdate({
							id: connection.id,
							routing: {
								...connection.routing,
								mode: value as NonNullable<ConnectionPatch['routing']>['mode']
							}
						})
					}
				/>
			</FormRow>
			<FormRow label="Avoid">
				<InspectorSelect
					value={
						Array.isArray(connection.routing?.avoid)
							? connection.routing.avoid.join(',')
							: (connection.routing?.avoid ?? 'objects')
					}
					options={selectOptions(ROUTING_AVOID)}
					onChange={(value) =>
						onUpdate({
							id: connection.id,
							routing: {
								...connection.routing,
								avoid: value as ConnectorRouting['avoid']
							}
						})
					}
				/>
			</FormRow>
			<FormRow label="Clearance">
				<Input
					type="number"
					min={0}
					step={0.25}
					value={connection.routing?.clearance ?? ''}
					className="isostate-input"
					onChange={(e) =>
						onUpdate({
							id: connection.id,
							routing: {
								...connection.routing,
								clearance:
									e.target.value === '' ? undefined : Number(e.target.value)
							}
						})
					}
				/>
			</FormRow>
			<FormRow label="Grid Step">
				<Input
					type="number"
					min={0.25}
					step={0.25}
					value={connection.routing?.gridStep ?? ''}
					className="isostate-input"
					onChange={(e) =>
						onUpdate({
							id: connection.id,
							routing: {
								...connection.routing,
								gridStep:
									e.target.value === '' ? undefined : Number(e.target.value)
							}
						})
					}
				/>
			</FormRow>
			<FormRow label="Max Bends">
				<Input
					type="number"
					min={0}
					step={1}
					value={connection.routing?.maxBends ?? ''}
					className="isostate-input"
					onChange={(e) =>
						onUpdate({
							id: connection.id,
							routing: {
								...connection.routing,
								maxBends:
									e.target.value === '' ? undefined : Number(e.target.value)
							}
						})
					}
				/>
			</FormRow>
			<FormRow label="Prefer">
				<InspectorSelect
					value={connection.routing?.prefer ?? ''}
					options={[
						{ value: SELECT_NONE_VALUE, label: 'Default' },
						...selectOptions(ROUTING_PREFER)
					]}
					onChange={(value) =>
						onUpdate({
							id: connection.id,
							routing: {
								...connection.routing,
								prefer:
									value === ''
										? undefined
										: (value as ConnectorRouting['prefer'])
							}
						})
					}
				/>
			</FormRow>

			<SectionHeader title="Style" />
			<FormRow label="Variant">
				<InspectorSelect
					value={connection.style?.variant ?? 'line'}
					options={selectOptions(CONNECTOR_VARIANTS)}
					onChange={(value) =>
						onUpdate({
							id: connection.id,
							style: {
								...connection.style,
								variant: value as NonNullable<
									ConnectionPatch['style']
								>['variant']
							}
						})
					}
				/>
			</FormRow>
			<FormRow label="Pattern">
				<InspectorSelect
					value={connection.style?.pattern ?? 'solid'}
					options={selectOptions(CONNECTOR_PATTERNS)}
					onChange={(value) =>
						onUpdate({
							id: connection.id,
							style: {
								...connection.style,
								pattern: value as NonNullable<
									ConnectionPatch['style']
								>['pattern']
							}
						})
					}
				/>
			</FormRow>
			<FormRow label="Stroke">
				<Input
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
				<Input
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
				<Input
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
			<FormRow label="Dash">
				<div className="isostate-grid-pair">
					<Input
						type="number"
						min={0}
						step={1}
						value={connection.style?.dash?.[0] ?? ''}
						className="isostate-input"
						placeholder="dash"
						onChange={(e) =>
							onUpdate({
								id: connection.id,
								style: {
									...connection.style,
									dash: [
										Number(e.target.value || 0),
										connection.style?.dash?.[1] ?? 4
									]
								}
							})
						}
					/>
					<Input
						type="number"
						min={0}
						step={1}
						value={connection.style?.dash?.[1] ?? ''}
						className="isostate-input"
						placeholder="gap"
						onChange={(e) =>
							onUpdate({
								id: connection.id,
								style: {
									...connection.style,
									dash: [
										connection.style?.dash?.[0] ?? 4,
										Number(e.target.value || 0)
									]
								}
							})
						}
					/>
				</div>
			</FormRow>
			<FormRow label="Outline">
				<Input
					type="text"
					value={connection.style?.outline ?? ''}
					className="isostate-input"
					onChange={(e) =>
						onUpdate({
							id: connection.id,
							style: {
								...connection.style,
								outline: e.target.value || undefined
							}
						})
					}
				/>
			</FormRow>
			<FormRow label="Outline Width">
				<Input
					type="number"
					min={0}
					step={0.5}
					value={connection.style?.outlineWidth ?? ''}
					className="isostate-input"
					onChange={(e) =>
						onUpdate({
							id: connection.id,
							style: {
								...connection.style,
								outlineWidth:
									e.target.value === '' ? undefined : Number(e.target.value)
							}
						})
					}
				/>
			</FormRow>
			<FormRow label="Lane">
				<InspectorSelect
					value={connection.style?.lane ?? 'none'}
					options={selectOptions(CONNECTOR_LANES)}
					onChange={(value) =>
						onUpdate({
							id: connection.id,
							style: {
								...connection.style,
								lane: value as NonNullable<ConnectionPatch['style']>['lane']
							}
						})
					}
				/>
			</FormRow>
			<FormRow label="Flow">
				<Button
					type="button"
					size="sm"
					variant={hasFlow ? 'default' : 'secondary'}
					onClick={() =>
						onUpdate({
							id: connection.id,
							ambient: updateAmbient(connection.ambient, 'flow', !hasFlow),
							style: {
								...connection.style,
								pattern:
									!hasFlow && (connection.style?.pattern ?? 'solid') === 'solid'
										? 'dashed'
										: connection.style?.pattern
							}
						})
					}
				>
					{hasFlow ? 'Flow on' : 'Flow off'}
				</Button>
			</FormRow>

			<SectionHeader title="Endpoints" />
			<FormRow label="Start">
				<InspectorSelect
					value={connection.start ?? 'none'}
					options={selectOptions(ENDPOINT_TYPES)}
					onChange={(value) =>
						onUpdate({
							id: connection.id,
							start: value as ConnectionPatch['start']
						})
					}
				/>
			</FormRow>
			<FormRow label="End">
				<InspectorSelect
					value={connection.end ?? 'arrow'}
					options={selectOptions(ENDPOINT_TYPES)}
					onChange={(value) =>
						onUpdate({
							id: connection.id,
							end: value as ConnectionPatch['end']
						})
					}
				/>
			</FormRow>
			<FormRow label="Direction">
				<InspectorSelect
					value={connection.direction ?? 'route'}
					options={selectOptions(DIRECTIONS)}
					onChange={(value) =>
						onUpdate({
							id: connection.id,
							direction: value as ConnectionPatch['direction']
						})
					}
				/>
			</FormRow>
			<FormRow label="Enter">
				<InspectorSelect
					value={connection.enter ?? ''}
					options={[
						{ value: SELECT_NONE_VALUE, label: '—' },
						...selectOptions(ENTRY_ANIMATIONS)
					]}
					onChange={(value) =>
						onUpdate({
							id: connection.id,
							enter: (value || undefined) as ConnectionPatch['enter']
						})
					}
				/>
			</FormRow>
			<FormRow label="Exit">
				<InspectorSelect
					value={connection.exit ?? ''}
					options={[
						{ value: SELECT_NONE_VALUE, label: '—' },
						...selectOptions(EXIT_ANIMATIONS)
					]}
					onChange={(value) =>
						onUpdate({
							id: connection.id,
							exit: (value || undefined) as ConnectionPatch['exit']
						})
					}
				/>
			</FormRow>

			<FormRow label="Layer">
				<InspectorSelect
					value={connection.layer ?? layerNames[0] ?? ''}
					options={selectOptions(layerNames)}
					onChange={(value) => onUpdate({ id: connection.id, layer: value })}
				/>
			</FormRow>
			<div className="isostate-inspector-actions">
				<Button
					type="button"
					size="sm"
					variant="destructive"
					onClick={onRemove}
				>
					Delete Connection
				</Button>
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
				<Button
					type="button"
					size="sm"
					onClick={() => nudge(0, -1)}
					title="Nudge up"
				>
					&uarr;
				</Button>
				<Button
					type="button"
					size="sm"
					onClick={() => nudge(0, 1)}
					title="Nudge down"
				>
					&darr;
				</Button>
				<Button
					type="button"
					size="sm"
					onClick={() => nudge(-1, 0)}
					title="Nudge left"
				>
					&larr;
				</Button>
				<Button
					type="button"
					size="sm"
					onClick={() => nudge(1, 0)}
					title="Nudge right"
				>
					&rarr;
				</Button>
			</div>
			<FormRow label="Layer">
				<InspectorSelect
					value=""
					options={[
						{ value: SELECT_NONE_VALUE, label: 'Assign to layer…' },
						...selectOptions(layerNames)
					]}
					onChange={(value) => {
						if (!workspace.activeSceneId || !value) return;
						for (const id of selection.objectIds) {
							onCommand(
								createObjectUpdateCommand(workspace.activeSceneId, {
									id,
									layer: value
								})
							);
						}
					}}
				/>
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
				<InspectorSelect
					value={targetType}
					options={[
						{ value: 'none', label: 'None' },
						{ value: 'element', label: 'Element' },
						{ value: 'area', label: 'Area' },
						{ value: 'reset', label: 'Reset' }
					]}
					onChange={(value) => {
						const type = value as 'none' | 'element' | 'area' | 'reset';
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
				/>
			</FormRow>

			{targetType === 'element' && (
				<FormRow label="Element">
					<InspectorSelect
						value={
							(camera && 'element' in camera.target
								? camera.target.element
								: '') ?? ''
						}
						options={selectOptions(sceneElementIds)}
						onChange={(value) =>
							onUpdate({
								target: { element: value },
								padding: camera?.padding,
								duration: camera?.duration,
								easing: camera?.easing
							})
						}
					/>
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
								<Input
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
								<Input
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
								<Input
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
								<Input
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
						<Input
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
						<Input
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
						<InspectorSelect
							value={camera.easing ?? ''}
							options={[
								{ value: SELECT_NONE_VALUE, label: 'Default' },
								...selectOptions(EASINGS)
							]}
							onChange={(value) =>
								onUpdate({
									...camera,
									easing:
										value === '' ? undefined : (value as CameraFocus['easing'])
								})
							}
						/>
					</FormRow>
				</div>
			)}

			{targetType !== 'none' && (
				<div className="isostate-inspector-row">
					<Button type="button" variant="secondary" onClick={onRemove}>
						Clear Camera
					</Button>
				</div>
			)}
		</div>
	);
}
