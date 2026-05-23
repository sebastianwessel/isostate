import { ParseError } from '@sebastianwessel/isostate';
import {
	parseScene,
	validateScene
} from '@sebastianwessel/isostate/dsl/browser';
import type {
	AssetCatalogEntry,
	CameraFocus,
	ConnectionPatch,
	ConnectionPlacement,
	ElementPatch,
	ElementPlacement,
	LayerDefinition,
	SceneDocument,
	SceneStep,
	TextContent
} from '@sebastianwessel/isostate/types';
import { serializeSceneDocument } from './serialization.ts';
import type {
	EditorCommand,
	EditorCommandResult,
	EditorDiagnostic,
	EditorWorkspace
} from './types.ts';

function clone<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj));
}

function convertValidationReport(report: {
	errors: Array<{
		code: string;
		message: string;
		sceneId?: string;
		elementId?: string;
		connectionId?: string;
		location?: { line?: number; column?: number };
	}>;
	warnings: Array<{
		code: string;
		message: string;
		sceneId?: string;
		elementId?: string;
		connectionId?: string;
		location?: { line?: number; column?: number };
	}>;
	isValid: boolean;
}): EditorDiagnostic[] {
	const diagnostics: EditorDiagnostic[] = [];
	for (const error of report.errors) {
		diagnostics.push({
			code: error.code,
			message: error.message,
			severity: 'error',
			sceneId: error.sceneId,
			objectId: error.elementId ?? error.connectionId,
			line: error.location?.line,
			column: error.location?.column
		});
	}
	for (const warning of report.warnings) {
		diagnostics.push({
			code: warning.code,
			message: warning.message,
			severity: 'warning',
			sceneId: warning.sceneId,
			objectId: warning.elementId ?? warning.connectionId,
			line: warning.location?.line,
			column: warning.location?.column
		});
	}
	return diagnostics;
}

function convertParseError(err: ParseError): EditorDiagnostic {
	return {
		code: err.code,
		message: err.message,
		severity: 'error',
		line: typeof err.details?.line === 'number' ? err.details.line : undefined,
		column:
			typeof err.details?.column === 'number' ? err.details.column : undefined
	};
}

function createSnapshotInverse(
	commandId: string,
	oldWorkspace: EditorWorkspace
): EditorCommand {
	return {
		id: `inverse-${commandId}`,
		label: `Undo`,
		apply(workspace) {
			return {
				workspace: {
					...workspace,
					sourceYaml: oldWorkspace.sourceYaml,
					document: oldWorkspace.document,
					diagnostics: oldWorkspace.diagnostics
				},
				changed: true,
				diagnostics: []
			};
		}
	};
}

export function withDocumentMutation(
	workspace: EditorWorkspace,
	id: string,
	_label: string,
	mutate: (doc: SceneDocument) => void
): EditorCommandResult {
	if (!workspace.document) {
		return {
			workspace,
			changed: false,
			diagnostics: [
				{
					code: 'EDITOR_INVALID_SOURCE',
					message: 'Workspace has no valid document',
					severity: 'error'
				}
			]
		};
	}
	try {
		const doc = clone(workspace.document);
		mutate(doc);
		const newYaml = serializeSceneDocument(doc);
		if (newYaml === workspace.sourceYaml) {
			return { workspace, changed: false, diagnostics: [] };
		}
		return {
			workspace: { ...workspace, sourceYaml: newYaml },
			changed: true,
			diagnostics: [],
			inverse: createSnapshotInverse(id, workspace)
		};
	} catch (err) {
		return {
			workspace,
			changed: false,
			diagnostics: [
				{
					code: 'EDITOR_INVALID_SELECTION',
					message: String(err),
					severity: 'error'
				}
			]
		};
	}
}

function mergeElementPatch<T extends ElementPlacement | ElementPatch>(
	target: T,
	patch: ElementPatch
): T {
	const merged = { ...target, ...patch } as T;
	if (
		patch.text !== undefined &&
		'text' in target &&
		target.text !== undefined
	) {
		(merged as ElementPlacement).text = {
			...target.text,
			...patch.text
		} as TextContent;
	}
	if (
		patch.primitive !== undefined &&
		'primitive' in target &&
		target.primitive !== undefined
	) {
		const targetP = target.primitive;
		const patchP = patch.primitive;
		(merged as ElementPlacement).primitive = {
			rectangle:
				patchP.rectangle !== undefined
					? { ...(targetP.rectangle ?? {}), ...patchP.rectangle }
					: targetP.rectangle,
			circle:
				patchP.circle !== undefined
					? { ...(targetP.circle ?? {}), ...patchP.circle }
					: targetP.circle,
			polygon:
				patchP.polygon !== undefined
					? { ...(targetP.polygon ?? {}), ...patchP.polygon }
					: targetP.polygon,
			line:
				patchP.line !== undefined
					? { ...(targetP.line ?? {}), ...patchP.line }
					: targetP.line
		} as import('@sebastianwessel/isostate/types').PrimitiveContent;
	}
	return merged;
}

function resolveBaseElements(
	document: SceneDocument,
	upToIndex: number
): Map<string, ElementPlacement> {
	const elements = new Map<string, ElementPlacement>();
	for (let i = 0; i <= upToIndex; i++) {
		const scene = document.scenes[i];
		if (i === 0) {
			for (const e of scene.elements ?? []) {
				elements.set(e.id, e);
			}
		} else {
			for (const patch of scene.update?.elements ?? []) {
				const existing = elements.get(patch.id);
				if (existing) {
					elements.set(
						patch.id,
						mergeElementPatch(existing, patch) as ElementPlacement
					);
				}
			}
			for (const e of scene.add?.elements ?? []) {
				elements.set(e.id, e);
			}
			for (const removal of scene.remove?.elements ?? []) {
				elements.delete(removal.id);
			}
		}
	}
	return elements;
}

function resolveBaseConnections(
	document: SceneDocument,
	upToIndex: number
): Map<string, ConnectionPlacement> {
	const connections = new Map<string, ConnectionPlacement>();
	for (let i = 0; i <= upToIndex; i++) {
		const scene = document.scenes[i];
		if (i === 0) {
			for (const c of scene.connections ?? []) {
				connections.set(c.id, c);
			}
		} else {
			for (const patch of scene.update?.connections ?? []) {
				const existing = connections.get(patch.id);
				if (existing) {
					connections.set(patch.id, {
						...existing,
						...patch,
						style: patch.style
							? { ...existing.style, ...patch.style }
							: existing.style
					});
				}
			}
			for (const c of scene.add?.connections ?? []) {
				connections.set(c.id, c);
			}
			for (const removal of scene.remove?.connections ?? []) {
				connections.delete(removal.id);
			}
		}
	}
	return connections;
}

export function createYamlEditCommand(newYaml: string): EditorCommand {
	return {
		id: 'yaml.edit',
		label: 'Edit YAML',
		apply(workspace) {
			return {
				workspace: { ...workspace, sourceYaml: newYaml },
				changed: newYaml !== workspace.sourceYaml,
				diagnostics: [],
				inverse: createSnapshotInverse('yaml.edit', workspace)
			};
		}
	};
}

export function createYamlFormatCommand(): EditorCommand {
	return {
		id: 'yaml.format',
		label: 'Format YAML',
		apply(workspace) {
			if (!workspace.document) {
				return {
					workspace,
					changed: false,
					diagnostics: [
						{
							code: 'EDITOR_INVALID_SOURCE',
							message: 'Cannot format invalid YAML',
							severity: 'error'
						}
					]
				};
			}
			const newYaml = serializeSceneDocument(workspace.document);
			return {
				workspace: { ...workspace, sourceYaml: newYaml },
				changed: newYaml !== workspace.sourceYaml,
				diagnostics: [],
				inverse: createSnapshotInverse('yaml.format', workspace)
			};
		}
	};
}

export function createSceneAddCommand(
	scene: SceneStep,
	insertIndex?: number
): EditorCommand {
	return {
		id: 'scene.add',
		label: 'Add Scene',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'scene.add',
				'Add Scene',
				(doc) => {
					const index = insertIndex ?? doc.scenes.length;
					doc.scenes.splice(index, 0, clone(scene));
				}
			);
		}
	};
}

export function createSceneUpdateCommand(
	sceneId: string,
	patch: Partial<SceneStep>
): EditorCommand {
	return {
		id: 'scene.update',
		label: 'Update Scene',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'scene.update',
				'Update Scene',
				(doc) => {
					const scene = doc.scenes.find((s) => s.id === sceneId);
					if (!scene) throw new Error(`Scene ${sceneId} not found`);
					if (patch.id !== undefined) scene.id = patch.id;
					if (patch.elements !== undefined)
						scene.elements = clone(patch.elements);
					if (patch.connections !== undefined)
						scene.connections = clone(patch.connections);
					if (patch.add !== undefined) scene.add = clone(patch.add);
					if (patch.update !== undefined) scene.update = clone(patch.update);
					if (patch.remove !== undefined) scene.remove = clone(patch.remove);
					if (patch.camera !== undefined) scene.camera = clone(patch.camera);
				}
			);
		}
	};
}

export function createSceneRemoveCommand(sceneId: string): EditorCommand {
	return {
		id: 'scene.remove',
		label: 'Remove Scene',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'scene.remove',
				'Remove Scene',
				(doc) => {
					const index = doc.scenes.findIndex((s) => s.id === sceneId);
					if (index === -1) throw new Error(`Scene ${sceneId} not found`);
					doc.scenes.splice(index, 1);
				}
			);
		}
	};
}

export function createSceneReorderCommand(
	sceneId: string,
	newIndex: number
): EditorCommand {
	return {
		id: 'scene.reorder',
		label: 'Reorder Scene',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'scene.reorder',
				'Reorder Scene',
				(doc) => {
					const oldIndex = doc.scenes.findIndex((s) => s.id === sceneId);
					if (oldIndex === -1) throw new Error(`Scene ${sceneId} not found`);
					const [scene] = doc.scenes.splice(oldIndex, 1);
					doc.scenes.splice(newIndex, 0, scene);
				}
			);
		}
	};
}

export function createObjectAddCommand(
	sceneId: string,
	element: ElementPlacement
): EditorCommand {
	return {
		id: 'object.add',
		label: 'Add Object',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'object.add',
				'Add Object',
				(doc) => {
					const sceneIndex = doc.scenes.findIndex((s) => s.id === sceneId);
					if (sceneIndex === -1) throw new Error(`Scene ${sceneId} not found`);
					const scene = doc.scenes[sceneIndex];
					if (sceneIndex === 0) {
						scene.elements = scene.elements ?? [];
						scene.elements.push(clone(element));
					} else {
						scene.add = scene.add ?? {};
						scene.add.elements = scene.add.elements ?? [];
						scene.add.elements.push(clone(element));
					}
				}
			);
		}
	};
}

export function createObjectUpdateCommand(
	sceneId: string,
	patch: ElementPatch
): EditorCommand {
	return {
		id: 'object.update',
		label: 'Update Object',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'object.update',
				'Update Object',
				(doc) => {
					const sceneIndex = doc.scenes.findIndex((s) => s.id === sceneId);
					if (sceneIndex === -1) throw new Error(`Scene ${sceneId} not found`);
					const scene = doc.scenes[sceneIndex];
					if (sceneIndex === 0) {
						const elements = scene.elements ?? [];
						const index = elements.findIndex((e) => e.id === patch.id);
						if (index === -1) throw new Error(`Element ${patch.id} not found`);
						elements[index] = mergeElementPatch(
							elements[index],
							patch
						) as ElementPlacement;
					} else {
						const baseElements = resolveBaseElements(doc, sceneIndex - 1);
						if (baseElements.has(patch.id)) {
							scene.update = scene.update ?? {};
							scene.update.elements = scene.update.elements ?? [];
							const existingIndex = scene.update.elements.findIndex(
								(e) => e.id === patch.id
							);
							if (existingIndex !== -1) {
								scene.update.elements[existingIndex] = mergeElementPatch(
									scene.update.elements[existingIndex],
									patch
								);
							} else {
								scene.update.elements.push(clone(patch));
							}
						} else {
							const addElements = scene.add?.elements ?? [];
							const index = addElements.findIndex((e) => e.id === patch.id);
							if (index === -1)
								throw new Error(
									`Element ${patch.id} not found in scene ${sceneId}`
								);
							addElements[index] = mergeElementPatch(
								addElements[index],
								patch
							) as ElementPlacement;
						}
					}
				}
			);
		}
	};
}

export function createObjectReorderCommand(
	sceneId: string,
	elementId: string,
	newIndex: number
): EditorCommand {
	return {
		id: 'object.reorder',
		label: 'Reorder Object',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'object.reorder',
				'Reorder Object',
				(doc) => {
					const sceneIndex = doc.scenes.findIndex((s) => s.id === sceneId);
					if (sceneIndex === -1) throw new Error(`Scene ${sceneId} not found`);
					const scene = doc.scenes[sceneIndex];
					const elements =
						sceneIndex === 0 ? scene.elements : scene.add?.elements;
					if (!elements) {
						throw new Error(`Scene ${sceneId} has no reorderable elements`);
					}
					const oldIndex = elements.findIndex(
						(element) => element.id === elementId
					);
					if (oldIndex === -1) {
						throw new Error(
							`Element ${elementId} not found in scene ${sceneId}`
						);
					}
					const boundedIndex = Math.max(
						0,
						Math.min(newIndex, elements.length - 1)
					);
					const [element] = elements.splice(oldIndex, 1);
					elements.splice(boundedIndex, 0, element);
				}
			);
		}
	};
}

export function createObjectRemoveCommand(
	sceneId: string,
	elementId: string
): EditorCommand {
	return {
		id: 'object.remove',
		label: 'Remove Object',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'object.remove',
				'Remove Object',
				(doc) => {
					const sceneIndex = doc.scenes.findIndex((s) => s.id === sceneId);
					if (sceneIndex === -1) throw new Error(`Scene ${sceneId} not found`);
					const scene = doc.scenes[sceneIndex];
					if (sceneIndex === 0) {
						scene.elements = scene.elements?.filter((e) => e.id !== elementId);
						if (scene.connections) {
							scene.connections = scene.connections.filter(
								(c) =>
									c.from?.element !== elementId && c.to?.element !== elementId
							);
						}
					} else {
						const baseElements = resolveBaseElements(doc, sceneIndex - 1);
						if (baseElements.has(elementId)) {
							scene.remove = scene.remove ?? {};
							scene.remove.elements = scene.remove.elements ?? [];
							scene.remove.elements.push({ id: elementId });
							// Remove endpoint connections referencing this element
							const baseConnections = resolveBaseConnections(
								doc,
								sceneIndex - 1
							);
							for (const conn of baseConnections.values()) {
								if (
									conn.from?.element === elementId ||
									conn.to?.element === elementId
								) {
									const alreadyRemoved = scene.remove.connections?.some(
										(r) => r.id === conn.id
									);
									if (!alreadyRemoved) {
										scene.remove.connections = scene.remove.connections ?? [];
										scene.remove.connections.push({ id: conn.id });
									}
								}
							}
						} else {
							if (scene.add?.elements) {
								scene.add.elements = scene.add.elements.filter(
									(e) => e.id !== elementId
								);
								if (scene.add.elements.length === 0) delete scene.add.elements;
								if (Object.keys(scene.add).length === 0) delete scene.add;
							}
						}
					}
				}
			);
		}
	};
}

export function createConnectionAddCommand(
	sceneId: string,
	connection: ConnectionPlacement
): EditorCommand {
	return {
		id: 'connection.add',
		label: 'Add Connection',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'connection.add',
				'Add Connection',
				(doc) => {
					const sceneIndex = doc.scenes.findIndex((s) => s.id === sceneId);
					if (sceneIndex === -1) throw new Error(`Scene ${sceneId} not found`);
					const scene = doc.scenes[sceneIndex];
					if (sceneIndex === 0) {
						scene.connections = scene.connections ?? [];
						scene.connections.push(clone(connection));
					} else {
						scene.add = scene.add ?? {};
						scene.add.connections = scene.add.connections ?? [];
						scene.add.connections.push(clone(connection));
					}
				}
			);
		}
	};
}

export function createConnectionUpdateCommand(
	sceneId: string,
	patch: ConnectionPatch
): EditorCommand {
	return {
		id: 'connection.update',
		label: 'Update Connection',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'connection.update',
				'Update Connection',
				(doc) => {
					const sceneIndex = doc.scenes.findIndex((s) => s.id === sceneId);
					if (sceneIndex === -1) throw new Error(`Scene ${sceneId} not found`);
					const scene = doc.scenes[sceneIndex];
					if (sceneIndex === 0) {
						const connections = scene.connections ?? [];
						const index = connections.findIndex((c) => c.id === patch.id);
						if (index === -1)
							throw new Error(`Connection ${patch.id} not found`);
						const existing = connections[index];
						connections[index] = {
							...existing,
							...patch,
							style: patch.style
								? { ...existing.style, ...patch.style }
								: existing.style
						};
					} else {
						const baseConnections = resolveBaseConnections(doc, sceneIndex - 1);
						if (baseConnections.has(patch.id)) {
							scene.update = scene.update ?? {};
							scene.update.connections = scene.update.connections ?? [];
							const existingIndex = scene.update.connections.findIndex(
								(c) => c.id === patch.id
							);
							if (existingIndex !== -1) {
								const existing = scene.update.connections[existingIndex];
								scene.update.connections[existingIndex] = {
									...existing,
									...patch,
									style: patch.style
										? { ...existing.style, ...patch.style }
										: existing.style
								};
							} else {
								scene.update.connections.push(clone(patch));
							}
						} else {
							const addConnections = scene.add?.connections ?? [];
							const index = addConnections.findIndex((c) => c.id === patch.id);
							if (index === -1)
								throw new Error(
									`Connection ${patch.id} not found in scene ${sceneId}`
								);
							const existing = addConnections[index];
							addConnections[index] = {
								...existing,
								...patch,
								style: patch.style
									? { ...existing.style, ...patch.style }
									: existing.style
							};
						}
					}
				}
			);
		}
	};
}

export function createConnectionRemoveCommand(
	sceneId: string,
	connectionId: string
): EditorCommand {
	return {
		id: 'connection.remove',
		label: 'Remove Connection',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'connection.remove',
				'Remove Connection',
				(doc) => {
					const sceneIndex = doc.scenes.findIndex((s) => s.id === sceneId);
					if (sceneIndex === -1) throw new Error(`Scene ${sceneId} not found`);
					const scene = doc.scenes[sceneIndex];
					if (sceneIndex === 0) {
						scene.connections = scene.connections?.filter(
							(c) => c.id !== connectionId
						);
					} else {
						const baseConnections = resolveBaseConnections(doc, sceneIndex - 1);
						if (baseConnections.has(connectionId)) {
							scene.remove = scene.remove ?? {};
							scene.remove.connections = scene.remove.connections ?? [];
							scene.remove.connections.push({ id: connectionId });
						} else {
							if (scene.add?.connections) {
								scene.add.connections = scene.add.connections.filter(
									(c) => c.id !== connectionId
								);
								if (scene.add.connections.length === 0)
									delete scene.add.connections;
								if (Object.keys(scene.add).length === 0) delete scene.add;
							}
						}
					}
				}
			);
		}
	};
}

export function createLayerAddCommand(layer: LayerDefinition): EditorCommand {
	return {
		id: 'layer.add',
		label: 'Add Layer',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'layer.add',
				'Add Layer',
				(doc) => {
					doc.header.layers.push(clone(layer));
				}
			);
		}
	};
}

export function createLayerUpdateCommand(
	name: string,
	patch: Partial<LayerDefinition>
): EditorCommand {
	return {
		id: 'layer.update',
		label: 'Update Layer',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'layer.update',
				'Update Layer',
				(doc) => {
					const layer = doc.header.layers.find((l) => l.name === name);
					if (!layer) throw new Error(`Layer ${name} not found`);
					if (patch.name !== undefined) layer.name = patch.name;
					if (patch.order !== undefined) layer.order = patch.order;
				}
			);
		}
	};
}

export function createLayerRemoveCommand(name: string): EditorCommand {
	return {
		id: 'layer.remove',
		label: 'Remove Layer',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'layer.remove',
				'Remove Layer',
				(doc) => {
					doc.header.layers = doc.header.layers.filter((l) => l.name !== name);
				}
			);
		}
	};
}

export function createLayerReorderCommand(
	name: string,
	newIndex: number
): EditorCommand {
	return {
		id: 'layer.reorder',
		label: 'Reorder Layer',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'layer.reorder',
				'Reorder Layer',
				(doc) => {
					const oldIndex = doc.header.layers.findIndex((l) => l.name === name);
					if (oldIndex === -1) throw new Error(`Layer ${name} not found`);
					const [layer] = doc.header.layers.splice(oldIndex, 1);
					doc.header.layers.splice(newIndex, 0, layer);
				}
			);
		}
	};
}

export function createAssetAddCommand(asset: AssetCatalogEntry): EditorCommand {
	return {
		id: 'asset.add',
		label: 'Add Asset',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'asset.add',
				'Add Asset',
				(doc) => {
					doc.header.assets.push(clone(asset));
				}
			);
		}
	};
}

export function createAssetUpdateCommand(
	id: string,
	patch: Partial<AssetCatalogEntry>
): EditorCommand {
	return {
		id: 'asset.update',
		label: 'Update Asset',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'asset.update',
				'Update Asset',
				(doc) => {
					const asset = doc.header.assets.find((a) => a.id === id);
					if (!asset) throw new Error(`Asset ${id} not found`);
					if (patch.id !== undefined) asset.id = patch.id;
					if (patch.path !== undefined) asset.path = patch.path;
					if (patch.anchor !== undefined) asset.anchor = patch.anchor;
				}
			);
		}
	};
}

export function createAssetRemoveCommand(id: string): EditorCommand {
	return {
		id: 'asset.remove',
		label: 'Remove Asset',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'asset.remove',
				'Remove Asset',
				(doc) => {
					doc.header.assets = doc.header.assets.filter((a) => a.id !== id);
				}
			);
		}
	};
}

export function createCameraUpdateCommand(
	sceneId: string,
	camera: CameraFocus
): EditorCommand {
	return {
		id: 'camera.update',
		label: 'Update Camera',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'camera.update',
				'Update Camera',
				(doc) => {
					const scene = doc.scenes.find((s) => s.id === sceneId);
					if (!scene) throw new Error(`Scene ${sceneId} not found`);
					scene.camera = clone(camera);
				}
			);
		}
	};
}

export function createCameraRemoveCommand(sceneId: string): EditorCommand {
	return {
		id: 'camera.remove',
		label: 'Remove Camera',
		apply(workspace) {
			return withDocumentMutation(
				workspace,
				'camera.remove',
				'Remove Camera',
				(doc) => {
					const scene = doc.scenes.find((s) => s.id === sceneId);
					if (!scene) throw new Error(`Scene ${sceneId} not found`);
					delete scene.camera;
				}
			);
		}
	};
}

export function applyEditorCommand(
	workspace: EditorWorkspace,
	command: EditorCommand
): EditorCommandResult {
	const proposed = command.apply(workspace);

	if (!proposed.changed) {
		return proposed;
	}

	const isYamlCommand =
		command.id === 'yaml.edit' || command.id === 'yaml.format';

	if (!isYamlCommand && !workspace.document) {
		return {
			workspace,
			changed: false,
			diagnostics: [
				{
					code: 'EDITOR_INVALID_SOURCE',
					message: 'Workspace has no valid document',
					severity: 'error'
				}
			],
			inverse: undefined
		};
	}

	let document: SceneDocument | undefined = workspace.document;
	let diagnostics: EditorDiagnostic[] = [];
	let hasErrors = false;

	try {
		const parsed = parseScene(proposed.workspace.sourceYaml);
		const report = validateScene(parsed);
		diagnostics = convertValidationReport(report);
		hasErrors = report.errors.length > 0;
		if (!hasErrors) {
			document = parsed;
		}
	} catch (err) {
		const diag =
			err instanceof ParseError
				? convertParseError(err)
				: {
						code: 'UNKNOWN_ERROR',
						message: String(err),
						severity: 'error' as const
					};
		diagnostics = [diag];
		hasErrors = true;
	}

	if (!isYamlCommand && hasErrors) {
		return {
			workspace,
			changed: false,
			diagnostics,
			inverse: undefined
		};
	}

	const newWorkspace: EditorWorkspace = {
		...proposed.workspace,
		document,
		diagnostics
	};

	const historyEntry: EditorCommandResult = {
		workspace: { ...newWorkspace, history: workspace.history },
		changed: true,
		diagnostics,
		inverse: proposed.inverse
	};

	return {
		workspace: {
			...newWorkspace,
			history: [...workspace.history, historyEntry]
		},
		changed: true,
		diagnostics,
		inverse: proposed.inverse
	};
}
