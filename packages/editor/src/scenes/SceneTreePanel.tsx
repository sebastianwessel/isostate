import type {
	ConnectionPlacement,
	ElementPlacement,
	SceneStep
} from '@sebastianwessel/isostate/types';
import {
	ChevronDown,
	ChevronRight,
	Eye,
	EyeOff,
	Lock,
	Plus,
	Unlock
} from 'lucide-react';
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
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import { Input } from '../ui/input.tsx';
import { ScrollArea } from '../ui/scroll-area.tsx';

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
				<Button
					type="button"
					onClick={handleAddScene}
					disabled={!doc}
					aria-label="Add scene"
					title="Add scene"
					size="sm"
				>
					<Plus data-icon="inline-start" />
					<span>Scene</span>
				</Button>
				<div className="isostate-layer-add-row">
					<Input
						type="text"
						ref={newLayerInputRef}
						placeholder="new-layer"
						onKeyDown={(event) => {
							if (event.key === 'Enter') handleAddLayer();
						}}
					/>
					<Button
						type="button"
						onClick={handleAddLayer}
						aria-label="Add layer"
						title="Add layer"
						size="sm"
					>
						<Plus data-icon="inline-start" />
						<span>Layer</span>
					</Button>
				</div>
			</div>
			<ScrollArea className="isostate-tree-list">
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
								<Button
									type="button"
									variant="ghost"
									size="icon-xs"
									className="isostate-tree-disclosure"
									onClick={() => toggleScene(scene.id)}
									aria-label={isCollapsed ? 'Expand scene' : 'Collapse scene'}
								>
									{isCollapsed ? (
										<ChevronRight aria-hidden="true" />
									) : (
										<ChevronDown aria-hidden="true" />
									)}
								</Button>
								<button
									type="button"
									className="isostate-tree-name"
									onClick={() => onSelectScene?.(scene.id)}
								>
									{scene.id}
								</button>
								<Badge className="isostate-tree-count" variant="secondary">
									{elements.length + connections.length}
								</Badge>
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
												className={`isostate-tree-layer ${isHidden ? 'isostate-tree-layer--hidden' : ''}`}
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
													<Button
														type="button"
														variant="ghost"
														size="icon-xs"
														className="isostate-layer-toggle"
														onClick={() => toggleLayerVisibility(layer.name)}
														title={isHidden ? 'Show layer' : 'Hide layer'}
														aria-label={isHidden ? 'Show layer' : 'Hide layer'}
													>
														{isHidden ? (
															<EyeOff aria-hidden="true" />
														) : (
															<Eye aria-hidden="true" />
														)}
													</Button>
													<Button
														type="button"
														variant="ghost"
														size="icon-xs"
														className="isostate-layer-toggle"
														onClick={() => toggleLayerLock(layer.name)}
														title={isLocked ? 'Unlock layer' : 'Lock layer'}
														aria-label={
															isLocked ? 'Unlock layer' : 'Lock layer'
														}
													>
														{isLocked ? (
															<Lock aria-hidden="true" />
														) : (
															<Unlock aria-hidden="true" />
														)}
													</Button>
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
															<Badge
																className="isostate-tree-element-asset"
																variant="outline"
															>
																{element.asset}
															</Badge>
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
															<Badge
																className="isostate-tree-element-asset"
																variant="outline"
															>
																connection
															</Badge>
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
			</ScrollArea>
		</div>
	);
}
