import type {
	ConnectionPlacement,
	ElementPlacement,
	SceneStep
} from '@sebastianwessel/isostate/types';
import { useMemo, useRef, useState } from 'react';
import {
	createConnectionUpdateCommand,
	createLayerAddCommand,
	createLayerReorderCommand,
	createObjectReorderCommand,
	createObjectUpdateCommand,
	createSceneAddCommand,
	createSceneReorderCommand
} from '../commands.ts';
import {
	resolveSceneConnections,
	resolveSceneElements
} from '../scene-resolver.ts';
import type {
	EditorCommand,
	EditorSelection,
	EditorWorkspace
} from '../types.ts';

interface SceneTreePanelProps {
	workspace: EditorWorkspace;
	onCommand: (cmd: EditorCommand) => void;
	onSelect?: (selection: Partial<EditorSelection>) => void;
	onSelectScene?: (sceneId: string) => void;
	setWorkspace?: (updater: (prev: EditorWorkspace) => EditorWorkspace) => void;
}

type DragPayload =
	| { kind: 'scene'; sceneId: string }
	| { kind: 'layer'; layerName: string }
	| { kind: 'element'; sceneId: string; elementId: string }
	| { kind: 'connection'; sceneId: string; connectionId: string };

function parseDrag(data: string): DragPayload | undefined {
	try {
		const parsed = JSON.parse(data) as DragPayload;
		if (
			parsed.kind === 'scene' ||
			parsed.kind === 'layer' ||
			parsed.kind === 'element' ||
			parsed.kind === 'connection'
		) {
			return parsed;
		}
	} catch {
		return undefined;
	}
	return undefined;
}

function setDrag(event: React.DragEvent, payload: DragPayload) {
	event.stopPropagation();
	event.dataTransfer.effectAllowed = 'move';
	event.dataTransfer.setData(
		'application/x-isostate-tree',
		JSON.stringify(payload)
	);
	event.dataTransfer.setData('text/plain', JSON.stringify(payload));
}

function TreeIcon({
	name
}: {
	name:
		| 'plus'
		| 'chevron-right'
		| 'chevron-down'
		| 'eye'
		| 'eye-off'
		| 'lock'
		| 'unlock';
}) {
	const path =
		name === 'plus'
			? 'M12 5v14M5 12h14'
			: name === 'chevron-right'
				? 'M9 6l6 6-6 6'
				: name === 'chevron-down'
					? 'M6 9l6 6 6-6'
					: name === 'eye'
						? 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6'
						: name === 'eye-off'
							? 'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.8 10.8 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-2.2 3.1M6.6 6.6C3.7 8.4 2 12 2 12s4 7 10 7c1 0 1.9-.2 2.8-.5'
							: name === 'lock'
								? 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6z'
								: 'M7 11V8a5 5 0 0 1 9.5-2.2M6 11h12v10H6z';
	return (
		<svg
			aria-hidden="true"
			className="isostate-icon"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d={path} />
		</svg>
	);
}

export function SceneTreePanel({
	workspace,
	onCommand,
	onSelect,
	onSelectScene,
	setWorkspace
}: SceneTreePanelProps) {
	const doc = workspace.document;
	const scenes = doc?.scenes ?? [];
	const layers = doc?.header.layers ?? [];
	const [collapsedScenes, setCollapsedScenes] = useState<Set<string>>(
		new Set()
	);
	const newLayerInputRef = useRef<HTMLInputElement>(null);

	const sceneIndex = useMemo(
		() => new Map(scenes.map((scene, index) => [scene.id, index])),
		[scenes]
	);
	const layerIndex = useMemo(
		() => new Map(layers.map((layer, index) => [layer.name, index])),
		[layers]
	);

	const sceneElements = (scene: SceneStep): ElementPlacement[] => {
		if (!doc) return [];
		const index = sceneIndex.get(scene.id) ?? 0;
		return Array.from(resolveSceneElements(doc, index).values());
	};

	const sceneConnections = (scene: SceneStep): ConnectionPlacement[] => {
		if (!doc) return [];
		const index = sceneIndex.get(scene.id) ?? 0;
		return Array.from(resolveSceneConnections(doc, index).values());
	};

	const toggleScene = (sceneId: string) => {
		setCollapsedScenes((prev) => {
			const next = new Set(prev);
			if (next.has(sceneId)) {
				next.delete(sceneId);
			} else {
				next.add(sceneId);
			}
			return next;
		});
	};

	const handleAddScene = () => {
		if (!doc) return;
		const activeIndex = scenes.findIndex(
			(scene) => scene.id === workspace.activeSceneId
		);
		const index = activeIndex >= 0 ? activeIndex + 1 : scenes.length;
		const newId = `scene-${scenes.length + 1}`;
		onCommand(createSceneAddCommand({ id: newId }, index));
		onSelectScene?.(newId);
	};

	const handleAddLayer = () => {
		const input = newLayerInputRef.current;
		const name = (input?.value ?? '').trim().toLowerCase().replace(/\s+/g, '-');
		if (!name || layers.some((layer) => layer.name === name)) return;
		onCommand(createLayerAddCommand({ name, order: layers.length }));
		if (input) input.value = '';
	};

	const toggleLayerVisibility = (name: string) => {
		setWorkspace?.((prev) => {
			const hidden = prev.uiState.hiddenLayers ?? [];
			const isHidden = hidden.includes(name);
			return {
				...prev,
				uiState: {
					...prev.uiState,
					hiddenLayers: isHidden
						? hidden.filter((layerName) => layerName !== name)
						: [...hidden, name]
				}
			};
		});
	};

	const toggleLayerLock = (name: string) => {
		setWorkspace?.((prev) => {
			const isLocked = prev.lockedLayers?.includes(name) ?? false;
			return {
				...prev,
				lockedLayers: isLocked
					? (prev.lockedLayers ?? []).filter((layerName) => layerName !== name)
					: [...(prev.lockedLayers ?? []), name]
			};
		});
	};

	const handleDrop = (
		event: React.DragEvent,
		target:
			| { kind: 'scene'; sceneId: string }
			| { kind: 'layer'; sceneId: string; layerName: string }
			| { kind: 'element'; sceneId: string; elementId: string }
			| { kind: 'connection'; sceneId: string; connectionId: string }
	) => {
		event.preventDefault();
		event.stopPropagation();
		const payload = parseDrag(
			event.dataTransfer.getData('application/x-isostate-tree') ||
				event.dataTransfer.getData('text/plain')
		);
		if (!payload) return;

		if (payload.kind === 'scene' && target.kind === 'scene') {
			const nextIndex = sceneIndex.get(target.sceneId);
			const oldIndex = sceneIndex.get(payload.sceneId);
			if (
				nextIndex === undefined ||
				oldIndex === undefined ||
				nextIndex === oldIndex ||
				nextIndex === 0 ||
				oldIndex === 0
			) {
				return;
			}
			onCommand(createSceneReorderCommand(payload.sceneId, nextIndex));
			return;
		}

		if (payload.kind === 'layer' && target.kind === 'layer') {
			const nextIndex = layerIndex.get(target.layerName);
			if (nextIndex === undefined || target.layerName === payload.layerName)
				return;
			onCommand(createLayerReorderCommand(payload.layerName, nextIndex));
			return;
		}

		if (payload.kind === 'element' && target.kind === 'layer') {
			onCommand(
				createObjectUpdateCommand(payload.sceneId, {
					id: payload.elementId,
					layer: target.layerName
				})
			);
			return;
		}

		if (payload.kind === 'element' && target.kind === 'element') {
			if (
				payload.sceneId !== target.sceneId ||
				payload.elementId === target.elementId
			) {
				return;
			}
			const scene = scenes.find((candidate) => candidate.id === target.sceneId);
			if (!scene) return;
			const nextIndex = sceneElements(scene).findIndex(
				(element) => element.id === target.elementId
			);
			if (nextIndex >= 0) {
				onCommand(
					createObjectReorderCommand(
						payload.sceneId,
						payload.elementId,
						nextIndex
					)
				);
			}
		}

		if (payload.kind === 'connection' && target.kind === 'layer') {
			onCommand(
				createConnectionUpdateCommand(payload.sceneId, {
					id: payload.connectionId,
					layer: target.layerName
				})
			);
		}
	};

	return (
		<div className="isostate-scene-tree">
			<div className="isostate-panel-header">
				<button
					type="button"
					className="isostate-btn isostate-btn--primary"
					onClick={handleAddScene}
					disabled={!doc}
					aria-label="Add scene"
					title="Add scene"
				>
					<TreeIcon name="plus" />
					<span>Scene</span>
				</button>
				<div className="isostate-layer-add-row">
					<input
						type="text"
						ref={newLayerInputRef}
						className="isostate-input isostate-input--sm"
						placeholder="new-layer"
						onKeyDown={(event) => {
							if (event.key === 'Enter') handleAddLayer();
						}}
					/>
					<button
						type="button"
						className="isostate-btn isostate-btn--sm"
						onClick={handleAddLayer}
						aria-label="Add layer"
						title="Add layer"
					>
						<TreeIcon name="plus" />
						<span>Layer</span>
					</button>
				</div>
			</div>
			<div className="isostate-tree-list">
				{scenes.map((scene, index) => {
					const isCollapsed = collapsedScenes.has(scene.id);
					const elements = sceneElements(scene);
					const connections = sceneConnections(scene);
					const isActive = scene.id === workspace.activeSceneId;

					return (
						<div
							key={scene.id}
							className={`isostate-tree-scene ${isActive ? 'isostate-tree-scene--active' : ''}`}
							role="treeitem"
							tabIndex={0}
							draggable={index !== 0}
							onDragStart={(event) =>
								setDrag(event, { kind: 'scene', sceneId: scene.id })
							}
							onDragOver={(event) => {
								event.preventDefault();
								event.stopPropagation();
							}}
							onDrop={(event) =>
								handleDrop(event, { kind: 'scene', sceneId: scene.id })
							}
						>
							<div className="isostate-tree-scene-header">
								<button
									type="button"
									className="isostate-tree-disclosure"
									onClick={() => toggleScene(scene.id)}
									aria-label={isCollapsed ? 'Expand scene' : 'Collapse scene'}
								>
									<TreeIcon
										name={isCollapsed ? 'chevron-right' : 'chevron-down'}
									/>
								</button>
								<button
									type="button"
									className="isostate-tree-name"
									onClick={() => onSelectScene?.(scene.id)}
								>
									{scene.id}
								</button>
								<span className="isostate-tree-count">
									{elements.length + connections.length}
								</span>
							</div>
							{!isCollapsed && (
								<div className="isostate-tree-layers">
									{layers.map((layer) => {
										const layerElements = elements.filter(
											(element) =>
												(element.layer ?? layers[0]?.name) === layer.name
										);
										const layerConnections = connections.filter(
											(connection) =>
												(connection.layer ?? layers[0]?.name) === layer.name
										);
										const isHidden =
											workspace.uiState.hiddenLayers?.includes(layer.name) ??
											false;
										const isLocked =
											workspace.lockedLayers?.includes(layer.name) ?? false;
										return (
											<div
												key={`${scene.id}-${layer.name}`}
												className="isostate-tree-layer"
												role="treeitem"
												tabIndex={0}
												draggable
												onDragStart={(event) =>
													setDrag(event, {
														kind: 'layer',
														layerName: layer.name
													})
												}
												onDragOver={(event) => {
													event.preventDefault();
													event.stopPropagation();
												}}
												onDrop={(event) =>
													handleDrop(event, {
														kind: 'layer',
														sceneId: scene.id,
														layerName: layer.name
													})
												}
											>
												<div className="isostate-tree-layer-header">
													<button
														type="button"
														className="isostate-layer-toggle"
														onClick={() => toggleLayerVisibility(layer.name)}
														title={isHidden ? 'Show layer' : 'Hide layer'}
														aria-label={isHidden ? 'Show layer' : 'Hide layer'}
													>
														<TreeIcon name={isHidden ? 'eye-off' : 'eye'} />
													</button>
													<button
														type="button"
														className="isostate-layer-toggle"
														onClick={() => toggleLayerLock(layer.name)}
														title={isLocked ? 'Unlock layer' : 'Lock layer'}
														aria-label={
															isLocked ? 'Unlock layer' : 'Lock layer'
														}
													>
														<TreeIcon name={isLocked ? 'lock' : 'unlock'} />
													</button>
													<span className="isostate-tree-layer-name">
														{layer.name}
													</span>
												</div>
												<div className="isostate-tree-elements">
													{layerElements.map((element) => (
														<button
															key={element.id}
															type="button"
															className={`isostate-tree-element ${
																workspace.selection.sceneId === scene.id &&
																workspace.selection.objectIds.includes(
																	element.id
																)
																	? 'isostate-tree-element--selected'
																	: ''
															}`}
															draggable
															onDragStart={(event) =>
																setDrag(event, {
																	kind: 'element',
																	sceneId: scene.id,
																	elementId: element.id
																})
															}
															onDragOver={(event) => {
																event.preventDefault();
																event.stopPropagation();
															}}
															onDrop={(event) =>
																handleDrop(event, {
																	kind: 'element',
																	sceneId: scene.id,
																	elementId: element.id
																})
															}
															onClick={() => {
																onSelectScene?.(scene.id);
																onSelect?.({
																	sceneId: scene.id,
																	objectIds: [element.id],
																	connectionIds: [],
																	layerNames: [layer.name]
																});
															}}
														>
															<span className="isostate-tree-element-id">
																{element.id}
															</span>
															<span className="isostate-tree-element-asset">
																{element.asset}
															</span>
														</button>
													))}
													{layerConnections.map((connection) => (
														<button
															key={connection.id}
															type="button"
															className={`isostate-tree-element isostate-tree-connection ${
																workspace.selection.sceneId === scene.id &&
																workspace.selection.connectionIds.includes(
																	connection.id
																)
																	? 'isostate-tree-element--selected'
																	: ''
															}`}
															draggable
															onDragStart={(event) =>
																setDrag(event, {
																	kind: 'connection',
																	sceneId: scene.id,
																	connectionId: connection.id
																})
															}
															onDragOver={(event) => {
																event.preventDefault();
																event.stopPropagation();
															}}
															onDrop={(event) =>
																handleDrop(event, {
																	kind: 'connection',
																	sceneId: scene.id,
																	connectionId: connection.id
																})
															}
															onClick={() => {
																onSelectScene?.(scene.id);
																onSelect?.({
																	sceneId: scene.id,
																	objectIds: [],
																	connectionIds: [connection.id],
																	layerNames: [layer.name]
																});
															}}
														>
															<span className="isostate-tree-element-id">
																{connection.id}
															</span>
															<span className="isostate-tree-element-asset">
																connection
															</span>
														</button>
													))}
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
