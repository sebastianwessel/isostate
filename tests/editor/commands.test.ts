import { describe, expect, test } from 'bun:test';
import { createAssetPlacementCommand } from '../../packages/editor/src/assets.ts';
import {
	applyEditorCommand,
	createAssetAddCommand,
	createAssetRemoveCommand,
	createAssetUpdateCommand,
	createCameraRemoveCommand,
	createCameraUpdateCommand,
	createConnectionAddCommand,
	createConnectionRemoveCommand,
	createConnectionRenameCommand,
	createConnectionUpdateCommand,
	createLayerAddCommand,
	createLayerRemoveCommand,
	createLayerReorderCommand,
	createLayerUpdateCommand,
	createObjectAddCommand,
	createObjectRemoveCommand,
	createObjectRenameCommand,
	createObjectUpdateCommand,
	createSceneAddCommand,
	createSceneRemoveCommand,
	createSceneReorderCommand,
	createSceneUpdateCommand,
	createYamlEditCommand,
	createYamlFormatCommand
} from '../../packages/editor/src/commands.ts';
import { createEditorWorkspace } from '../../packages/editor/src/workspace.ts';

const BASE_YAML = `header:
  version: "1"
  assetBaseUrl: https://example.com/assets
  assets:
    - id: server
      path: server.svg
    - id: client
      path: client.svg
  layers:
    - name: default
    - name: overlay
scenes:
  - id: scene-1
    elements:
      - id: e1
        asset: server
        at: [0, 0]
        layer: default
      - id: e2
        asset: client
        at: [1, 1]
        layer: default
    connections:
      - id: c1
        from:
          element: e1
        to:
          element: e2
  - id: scene-2
    add:
      elements:
        - id: e3
          asset: server
          at: [2, 2]
`;

function makeWorkspace() {
	return createEditorWorkspace({ sourceYaml: BASE_YAML });
}

describe('applyEditorCommand', () => {
	test('is immutable', () => {
		const workspace = makeWorkspace();
		const command = createYamlEditCommand(BASE_YAML);
		const result = applyEditorCommand(workspace, command);
		expect(result.workspace).not.toBe(workspace);
		expect(result.workspace.sourceYaml).toBe(BASE_YAML);
	});

	test('yaml.edit updates sourceYaml and document', () => {
		const workspace = makeWorkspace();
		const newYaml = BASE_YAML.replace('scene-1', 'scene-one');
		const command = createYamlEditCommand(newYaml);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(result.workspace.sourceYaml).toContain('scene-one');
		expect(result.workspace.document).toBeDefined();
	});

	test('yaml.format produces canonical output', () => {
		const workspace = makeWorkspace();
		const command = createYamlFormatCommand();
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(result.workspace.document).toBeDefined();
		expect(result.workspace.document).toEqual(workspace.document);
	});

	test('scene.add inserts a scene', () => {
		const workspace = makeWorkspace();
		const newScene = { id: 'scene-3' };
		const command = createSceneAddCommand(
			newScene as import('@sebastianwessel/isostate/types').SceneStep,
			1
		);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(result.workspace.document?.scenes.map((s) => s.id)).toEqual([
			'scene-1',
			'scene-3',
			'scene-2'
		]);
	});

	test('scene.update renames a scene', () => {
		const workspace = makeWorkspace();
		const command = createSceneUpdateCommand('scene-2', { id: 'scene-two' });
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.scenes.some((s) => s.id === 'scene-two')
		).toBe(true);
	});

	test('scene.remove deletes a scene', () => {
		const workspace = makeWorkspace();
		const command = createSceneRemoveCommand('scene-2');
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(result.workspace.document?.scenes.length).toBe(1);
	});

	test('scene.reorder moves a scene', () => {
		const workspace = makeWorkspace();
		// Add a third scene first
		const addCmd = createSceneAddCommand(
			{ id: 'scene-3' } as import('@sebastianwessel/isostate/types').SceneStep,
			2
		);
		const ws2 = applyEditorCommand(workspace, addCmd).workspace;
		const command = createSceneReorderCommand('scene-3', 1);
		const result = applyEditorCommand(ws2, command);
		expect(result.changed).toBe(true);
		expect(result.workspace.document?.scenes.map((s) => s.id)).toEqual([
			'scene-1',
			'scene-3',
			'scene-2'
		]);
	});

	test('object.add on first scene adds to elements', () => {
		const workspace = makeWorkspace();
		const element = {
			id: 'e4',
			asset: 'server',
			at: [3, 3]
		} as import('@sebastianwessel/isostate/types').ElementPlacement;
		const command = createObjectAddCommand('scene-1', element);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.scenes[0].elements?.some((e) => e.id === 'e4')
		).toBe(true);
	});

	test('object.add expands the authored floor when needed', () => {
		const workspace = makeWorkspace();
		const element = {
			id: 'far',
			asset: 'server',
			at: [24, 25],
			size: 2
		} as import('@sebastianwessel/isostate/types').ElementPlacement;
		const command = createObjectAddCommand('scene-1', element);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(result.workspace.document?.header.floor?.size).toEqual([26, 27]);
	});

	test('object.add on later scene adds to add.elements', () => {
		const workspace = makeWorkspace();
		const element = {
			id: 'e4',
			asset: 'server',
			at: [3, 3]
		} as import('@sebastianwessel/isostate/types').ElementPlacement;
		const command = createObjectAddCommand('scene-2', element);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.scenes[1].add?.elements?.some(
				(e) => e.id === 'e4'
			)
		).toBe(true);
	});

	test('object.update on first scene mutates element', () => {
		const workspace = makeWorkspace();
		const patch = {
			id: 'e1',
			at: [5, 5]
		} as import('@sebastianwessel/isostate/types').ElementPatch;
		const command = createObjectUpdateCommand('scene-1', patch);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.scenes[0].elements?.find((e) => e.id === 'e1')
				?.at
		).toEqual([5, 5]);
	});

	test('object.update expands the authored floor for moved elements', () => {
		const workspace = makeWorkspace();
		const patch = {
			id: 'e1',
			at: [30, 31]
		} as import('@sebastianwessel/isostate/types').ElementPatch;
		const command = createObjectUpdateCommand('scene-1', patch);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(result.workspace.document?.header.floor?.size).toEqual([31, 32]);
	});

	test('object.update on later scene for base element creates update.elements', () => {
		const workspace = makeWorkspace();
		const patch = {
			id: 'e1',
			at: [5, 5]
		} as import('@sebastianwessel/isostate/types').ElementPatch;
		const command = createObjectUpdateCommand('scene-2', patch);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.scenes[1].update?.elements?.find(
				(e) => e.id === 'e1'
			)?.at
		).toEqual([5, 5]);
	});

	test('object.update on later scene for newly added element mutates add.elements', () => {
		const workspace = makeWorkspace();
		const patch = {
			id: 'e3',
			at: [6, 6]
		} as import('@sebastianwessel/isostate/types').ElementPatch;
		const command = createObjectUpdateCommand('scene-2', patch);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.scenes[1].add?.elements?.find(
				(e) => e.id === 'e3'
			)?.at
		).toEqual([6, 6]);
		expect(
			result.workspace.document?.scenes[1].update?.elements
		).toBeUndefined();
	});

	test('object.rename updates element ids and references', () => {
		const workspace = makeWorkspace();
		const command = createObjectRenameCommand('e1', 'api-server');
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(result.workspace.document?.scenes[0].elements?.[0].id).toBe(
			'api-server'
		);
		expect(
			result.workspace.document?.scenes[0].connections?.[0].from?.element
		).toBe('api-server');
		expect(result.workspace.sourceYaml).toContain('id: api-server');
	});

	test('object.remove on first scene removes from elements and connections', () => {
		const workspace = makeWorkspace();
		const command = createObjectRemoveCommand('scene-1', 'e1');
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.scenes[0].elements?.some((e) => e.id === 'e1')
		).toBe(false);
		expect(result.workspace.document?.scenes[0].connections).toBeUndefined();
	});

	test('object.remove on later scene for base element creates remove.elements and removes connections', () => {
		const workspace = makeWorkspace();
		const command = createObjectRemoveCommand('scene-2', 'e1');
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.scenes[1].remove?.elements?.some(
				(r) => r.id === 'e1'
			)
		).toBe(true);
		expect(
			result.workspace.document?.scenes[1].remove?.connections?.some(
				(r) => r.id === 'c1'
			)
		).toBe(true);
	});

	test('object.remove on later scene for newly added element removes from add.elements', () => {
		const workspace = makeWorkspace();
		const command = createObjectRemoveCommand('scene-2', 'e3');
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.scenes[1].add?.elements?.some(
				(e) => e.id === 'e3'
			)
		).toBeFalsy();
		expect(
			result.workspace.document?.scenes[1].remove?.elements
		).toBeUndefined();
	});

	test('connection.add on first scene adds to connections', () => {
		const workspace = makeWorkspace();
		const connection = {
			id: 'c2',
			from: { element: 'e1' },
			to: { element: 'e2' }
		} as import('@sebastianwessel/isostate/types').ConnectionPlacement;
		const command = createConnectionAddCommand('scene-1', connection);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.scenes[0].connections?.some(
				(c) => c.id === 'c2'
			)
		).toBe(true);
	});

	test('connection.add on later scene adds to add.connections', () => {
		const workspace = makeWorkspace();
		const connection = {
			id: 'c2',
			from: { element: 'e1' },
			to: { element: 'e2' }
		} as import('@sebastianwessel/isostate/types').ConnectionPlacement;
		const command = createConnectionAddCommand('scene-2', connection);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.scenes[1].add?.connections?.some(
				(c) => c.id === 'c2'
			)
		).toBe(true);
	});

	test('connection.update on first scene mutates connection', () => {
		const workspace = makeWorkspace();
		const patch = {
			id: 'c1',
			layer: 'default'
		} as import('@sebastianwessel/isostate/types').ConnectionPatch;
		const command = createConnectionUpdateCommand('scene-1', patch);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.scenes[0].connections?.find(
				(c) => c.id === 'c1'
			)?.layer
		).toBe('default');
	});

	test('connection.update on later scene for base connection creates update.connections', () => {
		const workspace = makeWorkspace();
		const patch = {
			id: 'c1',
			layer: 'default'
		} as import('@sebastianwessel/isostate/types').ConnectionPatch;
		const command = createConnectionUpdateCommand('scene-2', patch);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.scenes[1].update?.connections?.find(
				(c) => c.id === 'c1'
			)?.layer
		).toBe('default');
	});

	test('connection.rename updates connection ids across scene deltas', () => {
		const workspace = makeWorkspace();
		const command = createConnectionRenameCommand('c1', 'server-link');
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(result.workspace.document?.scenes[0].connections?.[0].id).toBe(
			'server-link'
		);
		expect(result.workspace.sourceYaml).toContain('id: server-link');
	});

	test('connection.remove on first scene removes from connections', () => {
		const workspace = makeWorkspace();
		const command = createConnectionRemoveCommand('scene-1', 'c1');
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(result.workspace.document?.scenes[0].connections).toBeUndefined();
	});

	test('connection.remove on later scene for base connection creates remove.connections', () => {
		const workspace = makeWorkspace();
		const command = createConnectionRemoveCommand('scene-2', 'c1');
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.scenes[1].remove?.connections?.some(
				(r) => r.id === 'c1'
			)
		).toBe(true);
	});

	test('layer.add adds a layer', () => {
		const workspace = makeWorkspace();
		const command = createLayerAddCommand({ name: 'new-layer', order: 2 });
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.header.layers.some(
				(l) => l.name === 'new-layer'
			)
		).toBe(true);
	});

	test('layer.update renames a layer', () => {
		const workspace = makeWorkspace();
		const command = createLayerUpdateCommand('overlay', { name: 'renamed' });
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.header.layers.some((l) => l.name === 'renamed')
		).toBe(true);
	});

	test('layer.remove blocks removal of referenced layer', () => {
		const workspace = makeWorkspace();
		const command = createLayerRemoveCommand('default');
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(false);
		expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
	});

	test('layer.remove succeeds for unused layer', () => {
		const workspace = makeWorkspace();
		const command = createLayerRemoveCommand('overlay');
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.header.layers.some((l) => l.name === 'overlay')
		).toBe(false);
	});

	test('layer.reorder moves a layer', () => {
		const workspace = makeWorkspace();
		const command = createLayerReorderCommand('default', 1);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.header.layers.findIndex(
				(l) => l.name === 'default'
			)
		).toBe(1);
	});

	test('asset.add adds an asset', () => {
		const workspace = makeWorkspace();
		const command = createAssetAddCommand({ id: 'db', path: 'db.svg' });
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.header.assets.some((a) => a.id === 'db')
		).toBe(true);
	});

	test('asset.update updates an asset', () => {
		const workspace = makeWorkspace();
		const command = createAssetUpdateCommand('server', {
			path: 'server-new.svg'
		});
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.header.assets.find((a) => a.id === 'server')
				?.path
		).toBe('server-new.svg');
	});

	test('asset.remove blocks removal of referenced asset', () => {
		const workspace = makeWorkspace();
		const command = createAssetRemoveCommand('server');
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(false);
		expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
	});

	test('asset placement command sets assetBaseUrl, adds asset, and creates element', () => {
		const workspace = makeWorkspace();
		const manifestEntry = {
			id: 'new-asset',
			path: 'new/asset.svg',
			group: 'new',
			name: 'asset',
			digest: 'sha256:abc'
		};
		const command = createAssetPlacementCommand(
			'scene-1',
			manifestEntry,
			[3, 3],
			'https://example.com/assets'
		);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(result.workspace.document?.header.assetBaseUrl).toBe(
			'https://example.com/assets'
		);
		expect(
			result.workspace.document?.header.assets.some((a) => a.id === 'new-asset')
		).toBe(true);
		const element = result.workspace.document?.scenes[0].elements?.find(
			(e) => e.asset === 'new-asset'
		);
		expect(element).toBeDefined();
		expect(element?.at).toEqual([3, 3]);
		expect(element?.size).toBe(1);
	});

	test('asset placement command expands the authored floor', () => {
		const workspace = makeWorkspace();
		const manifestEntry = {
			id: 'new-asset',
			path: 'new/asset.svg',
			group: 'new',
			name: 'asset',
			digest: 'sha256:abc'
		};
		const command = createAssetPlacementCommand(
			'scene-1',
			manifestEntry,
			[22, 23],
			'https://example.com/assets'
		);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(result.workspace.document?.header.floor?.size).toEqual([23, 24]);
	});

	test('asset placement command reuses existing asset declaration', () => {
		const workspace = makeWorkspace();
		const manifestEntry = {
			id: 'server',
			path: 'server.svg',
			group: 'servers',
			name: 'server',
			digest: 'sha256:abc'
		};
		const command = createAssetPlacementCommand(
			'scene-1',
			manifestEntry,
			[3, 3],
			'https://example.com/assets'
		);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(
			result.workspace.document?.header.assets.filter((a) => a.id === 'server')
				.length
		).toBe(1);
	});

	test('camera.update sets camera', () => {
		const workspace = makeWorkspace();
		const camera = {
			target: { element: 'e1' }
		} as import('@sebastianwessel/isostate/types').CameraFocus;
		const command = createCameraUpdateCommand('scene-1', camera);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(result.workspace.document?.scenes[0].camera?.target).toEqual({
			element: 'e1'
		});
	});

	test('camera.remove removes camera', () => {
		const workspace = makeWorkspace();
		const addCamera = createCameraUpdateCommand('scene-1', {
			target: { element: 'e1' }
		} as import('@sebastianwessel/isostate/types').CameraFocus);
		const ws1 = applyEditorCommand(workspace, addCamera).workspace;
		const command = createCameraRemoveCommand('scene-1');
		const result = applyEditorCommand(ws1, command);
		expect(result.changed).toBe(true);
		expect(result.workspace.document?.scenes[0].camera).toBeUndefined();
	});

	test('blocks invalid semantic commands', () => {
		const workspace = makeWorkspace();
		const command = createSceneRemoveCommand('scene-1');
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(false);
		expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
		expect(result.workspace.document?.scenes.length).toBe(2);
	});

	test('undo inverse restores original workspace', () => {
		const workspace = makeWorkspace();
		const command = createObjectAddCommand('scene-1', {
			id: 'e9',
			asset: 'server',
			at: [9, 9]
		} as import('@sebastianwessel/isostate/types').ElementPlacement);
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(true);
		expect(result.inverse).toBeDefined();
		// biome-ignore lint/style/noNonNullAssertion: checked by previous expect
		const undoResult = applyEditorCommand(result.workspace, result.inverse!);
		expect(undoResult.changed).toBe(true);
		expect(undoResult.workspace.sourceYaml).toBe(workspace.sourceYaml);
		expect(JSON.stringify(undoResult.workspace.document)).toBe(
			JSON.stringify(workspace.document)
		);
	});

	test('records history on successful commands', () => {
		const workspace = makeWorkspace();
		const command = createObjectAddCommand('scene-1', {
			id: 'e9',
			asset: 'server',
			at: [9, 9]
		} as import('@sebastianwessel/isostate/types').ElementPlacement);
		const result = applyEditorCommand(workspace, command);
		expect(result.workspace.history.length).toBe(1);
		expect(result.workspace.history[0].changed).toBe(true);
	});

	test('does not record history for blocked commands', () => {
		const workspace = makeWorkspace();
		const command = createSceneRemoveCommand('scene-1');
		const result = applyEditorCommand(workspace, command);
		expect(result.changed).toBe(false);
		expect(result.workspace.history.length).toBe(0);
	});
});
