import { describe, expect, test } from 'bun:test';
import { createEditorWorkspace } from '../../packages/editor/src/workspace.ts';

const VALID_YAML = `header:
  version: "1"
  assetBaseUrl: "https://example.com/assets"
  assets:
    - id: server
      path: server.svg
  layers:
    - name: default
scenes:
  - id: scene-1
    elements:
      - id: e1
        asset: server
        at: [0, 0]
`;

const INVALID_YAML = `invalid yaml: [`;

describe('createEditorWorkspace', () => {
	test('parses valid YAML and populates document', () => {
		const workspace = createEditorWorkspace({ sourceYaml: VALID_YAML });
		expect(workspace.document).toBeDefined();
		expect(workspace.document?.header.version).toBe('1');
		expect(workspace.document?.scenes[0].id).toBe('scene-1');
		expect(workspace.diagnostics.length).toBe(0);
	});

	test('defaults activeSceneId to first scene', () => {
		const workspace = createEditorWorkspace({ sourceYaml: VALID_YAML });
		expect(workspace.activeSceneId).toBe('scene-1');
	});

	test('uses provided activeSceneId', () => {
		const workspace = createEditorWorkspace({
			sourceYaml: VALID_YAML,
			activeSceneId: 'other'
		});
		expect(workspace.activeSceneId).toBe('other');
	});

	test('defaults name to Untitled', () => {
		const workspace = createEditorWorkspace({ sourceYaml: VALID_YAML });
		expect(workspace.name).toBe('Untitled');
	});

	test('uses provided name', () => {
		const workspace = createEditorWorkspace({
			sourceYaml: VALID_YAML,
			name: 'My Workspace'
		});
		expect(workspace.name).toBe('My Workspace');
	});

	test('initializes empty selection', () => {
		const workspace = createEditorWorkspace({ sourceYaml: VALID_YAML });
		expect(workspace.selection.objectIds).toEqual([]);
		expect(workspace.selection.connectionIds).toEqual([]);
		expect(workspace.selection.layerNames).toEqual([]);
	});

	test('initializes default viewport', () => {
		const workspace = createEditorWorkspace({ sourceYaml: VALID_YAML });
		expect(workspace.viewport.zoom).toBe(1);
		expect(workspace.viewport.pan).toEqual({ x: 0, y: 0 });
		expect(workspace.viewport.showGrid).toBe(true);
		expect(workspace.viewport.showFloor).toBe(true);
	});

	test('initializes default editState and uiState', () => {
		const workspace = createEditorWorkspace({ sourceYaml: VALID_YAML });
		expect(workspace.editState.readonly).toBe(false);
		expect(workspace.editState.dragging).toBe(false);
		expect(workspace.uiState.theme).toBe('system');
		expect(workspace.uiState.sidebarTab).toBe('attributes');
		expect(workspace.uiState.sidebarWidth).toBe(360);
	});

	test('initializes empty history', () => {
		const workspace = createEditorWorkspace({ sourceYaml: VALID_YAML });
		expect(workspace.history).toEqual([]);
	});

	test('returns undefined document and parse diagnostics for invalid YAML', () => {
		const workspace = createEditorWorkspace({ sourceYaml: INVALID_YAML });
		expect(workspace.document).toBeUndefined();
		expect(workspace.diagnostics.length).toBeGreaterThan(0);
		expect(workspace.diagnostics[0].severity).toBe('error');
	});
});
