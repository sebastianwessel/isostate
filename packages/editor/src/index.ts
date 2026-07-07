import {
	compileScene,
	toJs,
	toJson
} from '@sebastianwessel/isostate/dsl/browser';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { applyEditorCommand, createYamlFormatCommand } from './commands.ts';
import { IsostateEditor } from './IsostateEditor.tsx';
import { serializeEditorWorkspace } from './serialization.ts';
import type {
	EditorDiagnostic,
	EditorOperation,
	EditorWorkspace,
	IsostateEditorProps,
	MountEditorOptions,
	MountedEditor
} from './types.ts';
import { createEditorWorkspace } from './workspace.ts';

export { IsostateEditor } from './IsostateEditor.tsx';
export type {
	IsostateEditorProps,
	MountEditorOptions,
	MountedEditor
} from './types.ts';

const DEFAULT_YAML = `header:
  version: "1"
  assets: []
  layers:
    - name: default
scenes:
  - id: scene-1
    elements:
      - id: title
        asset: text
        at: [1, 1]
        layer: default
        text:
          value: Start building
          align: middle
          placement: cell
          fontSize: 14
`;

function createInitialWorkspace(
	options: MountEditorOptions = {}
): EditorWorkspace {
	const sourceYaml =
		options.initialWorkspace?.sourceYaml ?? options.initialYaml ?? DEFAULT_YAML;

	let workspace = createEditorWorkspace({
		name: options.initialWorkspace?.name,
		sourceYaml,
		activeSceneId: options.initialWorkspace?.activeSceneId
	});

	workspace = {
		...workspace,
		editState: {
			...workspace.editState,
			readonly: options.readonly ?? false
		},
		uiState: {
			...workspace.uiState,
			theme: options.theme ?? 'system'
		}
	};

	return workspace;
}

function createEditorError(code: string, message: string): Error {
	return Object.assign(new Error(`${code}: ${message}`), { code });
}

function hasErrors(diagnostics: EditorDiagnostic[]): boolean {
	return diagnostics.some((diagnostic) => diagnostic.severity === 'error');
}

export function mountEditor(
	target: HTMLElement,
	options?: MountEditorOptions
): MountedEditor {
	if (!target) {
		throw new Error('mountEditor requires a valid target HTMLElement');
	}

	let destroyed = false;
	const workspace = createInitialWorkspace(options);
	let currentWorkspace = workspace;

	const handleWorkspaceChange = (ws: EditorWorkspace) => {
		currentWorkspace = ws;
	};

	const createProps = (overrides: Partial<IsostateEditorProps> = {}) => ({
		value: currentWorkspace.sourceYaml,
		theme: currentWorkspace.uiState.theme,
		readonly: currentWorkspace.editState.readonly,
		assetManifestUrl: options?.assetManifestUrl,
		assetManifestUrls: options?.assetManifestUrls,
		assetProvider: options?.assetProvider,
		onChange: options?.onChange,
		onValidate: options?.onValidate,
		onExport: options?.onExport,
		onWorkspaceChange: handleWorkspaceChange,
		...overrides
	});

	const root = createRoot(target);
	const renderEditor = (overrides: Partial<IsostateEditorProps> = {}) => {
		root.render(createElement(IsostateEditor, createProps(overrides)));
	};

	const emitChange = (operation: EditorOperation) => {
		options?.onChange?.({
			sourceYaml: currentWorkspace.sourceYaml,
			document: currentWorkspace.document,
			diagnostics: currentWorkspace.diagnostics,
			operation
		});
		options?.onValidate?.(currentWorkspace.diagnostics);
	};

	root.render(createElement(IsostateEditor, createProps()));

	const api: MountedEditor = {
		element: target,

		getWorkspace(): EditorWorkspace {
			if (destroyed) throw new Error('EDITOR_DESTROYED');
			return currentWorkspace;
		},

		setYaml(sourceYaml: string): void {
			if (destroyed) throw new Error('EDITOR_DESTROYED');
			currentWorkspace = {
				...createEditorWorkspace({
					name: currentWorkspace.name,
					sourceYaml,
					activeSceneId: currentWorkspace.activeSceneId
				}),
				editState: currentWorkspace.editState,
				uiState: currentWorkspace.uiState,
				selection: currentWorkspace.selection,
				viewport: currentWorkspace.viewport,
				lockedLayers: currentWorkspace.lockedLayers
			};
			renderEditor();
			emitChange({ type: 'yaml.edit' });
		},

		setTheme(theme: 'light' | 'dark' | 'system'): void {
			if (destroyed) throw new Error('EDITOR_DESTROYED');
			currentWorkspace = {
				...currentWorkspace,
				uiState: { ...currentWorkspace.uiState, theme }
			};
			renderEditor();
		},

		validate(): EditorDiagnostic[] {
			if (destroyed) throw new Error('EDITOR_DESTROYED');
			return currentWorkspace.diagnostics;
		},

		formatYaml(): boolean {
			if (destroyed) throw new Error('EDITOR_DESTROYED');
			const result = applyEditorCommand(
				currentWorkspace,
				createYamlFormatCommand()
			);
			if (!result.changed) {
				return false;
			}
			currentWorkspace = result.workspace;
			renderEditor();
			emitChange({ type: 'yaml.format' });
			return true;
		},

		exportYaml(): string {
			if (destroyed) throw new Error('EDITOR_DESTROYED');
			const content = serializeEditorWorkspace(currentWorkspace);
			options?.onExport?.({
				kind: 'yaml',
				filename: 'scene.isostate.yaml',
				content,
				diagnostics: currentWorkspace.diagnostics
			});
			return content;
		},

		exportRuntimeBundle(format: 'js' | 'json'): string {
			if (destroyed) throw new Error('EDITOR_DESTROYED');
			if (
				!currentWorkspace.document ||
				hasErrors(currentWorkspace.diagnostics)
			) {
				throw createEditorError(
					'EDITOR_INVALID_SOURCE',
					currentWorkspace.diagnostics[0]?.message ??
						'Current YAML cannot be compiled'
				);
			}
			try {
				const bundle = compileScene(currentWorkspace.document);
				const content = format === 'js' ? toJs(bundle) : toJson(bundle);
				options?.onExport?.({
					kind: format === 'js' ? 'runtime-js' : 'runtime-json',
					filename: `scene.isostate.${format}`,
					content,
					diagnostics: currentWorkspace.diagnostics
				});
				return content;
			} catch (err) {
				throw createEditorError(
					'EDITOR_INVALID_SOURCE',
					err instanceof Error ? err.message : String(err)
				);
			}
		},

		destroy(): void {
			if (destroyed) return;
			destroyed = true;
			root.unmount();
			target.innerHTML = '';
		}
	};

	return api;
}

export {
	createAssetPlacementCommand,
	createManifestAssetProvider,
	filterAssetsByGroup,
	filterAssetsByTag,
	getMissingAssets,
	getUnusedAssets,
	searchAssets,
	validateAssetManifest
} from './assets.ts';
export {
	applyEditorCommand,
	createAssetAddCommand,
	createAssetRemoveCommand,
	createAssetUpdateCommand,
	createCameraRemoveCommand,
	createCameraUpdateCommand,
	createConnectionAddCommand,
	createConnectionRemoveCommand,
	createConnectionUpdateCommand,
	createLayerAddCommand,
	createLayerRemoveCommand,
	createLayerReorderCommand,
	createLayerUpdateCommand,
	createObjectAddCommand,
	createObjectRemoveCommand,
	createObjectReorderCommand,
	createObjectUpdateCommand,
	createSceneAddCommand,
	createSceneRemoveCommand,
	createSceneReorderCommand,
	createSceneUpdateCommand,
	createYamlEditCommand,
	createYamlFormatCommand
} from './commands.ts';
export {
	serializeEditorWorkspace,
	serializeSceneDocument
} from './serialization.ts';
export type {
	EditorAssetBrowserState,
	EditorChangeEvent,
	EditorCommand,
	EditorCommandResult,
	EditorDiagnostic,
	EditorEditState,
	EditorExportArtifact,
	EditorOperation,
	EditorSelection,
	EditorUiState,
	EditorViewport,
	EditorWorkspace,
	EditorWorkspaceInput
} from './types.ts';
export { createEditorWorkspace } from './workspace.ts';
