import { describe, expect, test } from 'bun:test';
import softwareManifest from '../../assets/software-architecture/manifest.json';
import type { SceneDocument } from '../../packages/core/src/types/scene.ts';

function requireDocument(document: SceneDocument | undefined): SceneDocument {
	if (!document) throw new Error('Expected a valid scene document');
	return document;
}

import { compileScene, parseScene } from '../../packages/core/src/dsl/index.ts';
import { getAssetPanelGroup } from '../../packages/editor/src/assets/asset-groups.ts';
import {
	getPlaceableManifestAssets,
	getUnusedAssets,
	validateAssetManifest
} from '../../packages/editor/src/assets.ts';
import {
	applyEditorCommand,
	createAssetRemoveCommand,
	createConnectionUpdateCommand,
	createObjectUpdateCommand,
	createYamlFormatCommand
} from '../../packages/editor/src/commands.ts';
import { getSwappableAssetIds } from '../../packages/editor/src/inspector/ElementActivityFields.tsx';
import {
	resolveSceneConnections,
	resolveSceneElements
} from '../../packages/editor/src/scene-resolver.ts';
import { serializeSceneDocument } from '../../packages/editor/src/serialization.ts';
import { createEditorWorkspace } from '../../packages/editor/src/workspace.ts';

const YAML = `header:
  version: "1"
  assetBaseUrl: https://example.com/assets
  assets:
    - id: server
      path: server.svg
    - id: client
      path: client.svg
    - id: states
      type: sprite-sheet
      path: states.png
      sheetSize: [64, 32]
      tileSize: [32, 32]
      sprites:
        ready: [0, 0]
        done: [1, 0]
  layers:
    - name: default
scenes:
  - id: start
    elements:
      - id: e1
        asset: server
        at: [0, 0]
        activity: {state: processing, color: "#38bdf8"}
      - id: e2
        asset: client
        at: [3, 3]
    connections:
      - id: link
        from: {element: e1}
        to: {element: e2}
        direction: reverse
        style:
          variant: beam
          stroke: "#38bdf8"
          cornerRadius: 12
          glow: "#38bdf8"
          glowWidth: 9
        message: {kind: envelope, color: "#ffffff", size: 12, duration: 2400, count: 3, enabled: true}
  - id: finish
`;

describe('editor connector and node experience', () => {
	test('formatting, reload and runtime export preserve all effect fields', () => {
		const workspace = createEditorWorkspace({ sourceYaml: YAML });
		expect(
			workspace.diagnostics.filter((item) => item.severity === 'error')
		).toEqual([]);
		const formatted = applyEditorCommand(workspace, createYamlFormatCommand());
		expect(formatted.changed).toBe(true);
		expect(formatted.workspace.document).toEqual(workspace.document);
		const reloaded = createEditorWorkspace({
			sourceYaml: formatted.workspace.sourceYaml
		});
		expect(reloaded.document).toEqual(workspace.document);
		const compiled = compileScene(
			parseScene(serializeSceneDocument(requireDocument(reloaded.document)))
		);
		expect(compiled.scenes[0].connectors[0].style).toMatchObject({
			variant: 'beam',
			cornerRadius: 12,
			glow: '#38bdf8',
			glowWidth: 9
		});
		expect(compiled.scenes[0].connectors[0].message).toMatchObject({
			kind: 'envelope',
			count: 3,
			duration: 2400
		});
		expect(compiled.scenes[0].elements[0].activity).toEqual({
			state: 'processing',
			color: '#38bdf8'
		});
	});

	test('empty message objects and explicit disabled messages remain distinct in YAML', () => {
		const document = parseScene(YAML);
		const connection = document.scenes[0].connections?.[0];
		if (!connection) throw new Error('Missing connection');
		connection.message = {};
		expect(
			parseScene(serializeSceneDocument(document)).scenes[0].connections?.[0]
				.message
		).toEqual({});
		connection.message = { enabled: false };
		expect(
			parseScene(serializeSceneDocument(document)).scenes[0].connections?.[0]
				.message
		).toEqual({ enabled: false });
	});

	test('later connection edits merge style and replace the message object, with undo and redo', () => {
		const original = createEditorWorkspace({ sourceYaml: YAML });
		const first = applyEditorCommand(
			original,
			createConnectionUpdateCommand('finish', {
				id: 'link',
				style: { cornerRadius: 20 },
				message: { enabled: false }
			})
		);
		expect(first.changed).toBe(true);
		const resolved = resolveSceneConnections(
			requireDocument(first.workspace.document),
			1
		).get('link');
		expect(resolved?.style).toMatchObject({
			variant: 'beam',
			glowWidth: 9,
			cornerRadius: 20
		});
		expect(resolved?.message).toEqual({ enabled: false });
		if (!first.inverse) throw new Error('Missing inverse command');
		const undone = applyEditorCommand(first.workspace, first.inverse);
		expect(undone.workspace.sourceYaml).toBe(original.sourceYaml);
		const redone = applyEditorCommand(
			undone.workspace,
			createConnectionUpdateCommand('finish', {
				id: 'link',
				style: { cornerRadius: 20 },
				message: { enabled: false }
			})
		);
		expect(redone.workspace.document).toEqual(first.workspace.document);
		const replaced = applyEditorCommand(
			redone.workspace,
			createConnectionUpdateCommand('finish', {
				id: 'link',
				style: { strokeWidth: 4 },
				message: { kind: 'orb' }
			})
		);
		expect(
			resolveSceneConnections(
				requireDocument(replaced.workspace.document),
				1
			).get('link')
		).toMatchObject({
			style: { cornerRadius: 20, strokeWidth: 4, glowWidth: 9 },
			message: { kind: 'orb' }
		});
	});

	test('asset swaps and activity replacements become scene deltas and survive reload', () => {
		const original = createEditorWorkspace({ sourceYaml: YAML });
		const result = applyEditorCommand(
			original,
			createObjectUpdateCommand('finish', {
				id: 'e1',
				asset: 'done',
				activity: { state: 'complete' }
			})
		);
		expect(result.changed).toBe(true);
		expect(result.workspace.document?.scenes[1].update?.elements).toEqual([
			{ id: 'e1', asset: 'done', activity: { state: 'complete' } }
		]);
		const reload = createEditorWorkspace({
			sourceYaml: result.workspace.sourceYaml
		});
		expect(
			resolveSceneElements(requireDocument(reload.document), 1).get('e1')
		).toMatchObject({
			asset: 'done',
			activity: { state: 'complete' }
		});
		expect(
			resolveSceneElements(requireDocument(reload.document), 0).get('e1')?.asset
		).toBe('server');
		expect(
			getSwappableAssetIds(requireDocument(reload.document).header.assets)
		).toEqual(['server', 'client', 'ready', 'done']);
	});

	test('assets used only by a later swap count as used and cannot be removed', () => {
		const original = createEditorWorkspace({ sourceYaml: YAML });
		const result = applyEditorCommand(
			original,
			createObjectUpdateCommand('finish', { id: 'e1', asset: 'done' })
		);
		expect(result.changed).toBe(true);
		const catalog = {
			assetBaseUrl: './assets',
			assets: requireDocument(original.document).header.assets.map((asset) => ({
				...asset,
				path: asset.path ?? asset.id,
				group: 'test',
				name: asset.id,
				digest: 'sha256:test'
			}))
		};
		expect(getUnusedAssets(original, catalog)).toEqual(['states']);
		expect(getUnusedAssets(result.workspace, catalog)).toEqual([]);
		const removal = applyEditorCommand(
			result.workspace,
			createAssetRemoveCommand('states')
		);
		expect(removal.changed).toBe(false);
		expect(removal.workspace.sourceYaml).toBe(result.workspace.sourceYaml);
	});

	test('asset swaps reject generated assets and unknown targets', () => {
		const workspace = createEditorWorkspace({ sourceYaml: YAML });
		for (const asset of ['text', 'rectangle', 'missing']) {
			const result = applyEditorCommand(
				workspace,
				createObjectUpdateCommand('finish', { id: 'e1', asset })
			);
			expect(result.changed).toBe(false);
			expect(result.workspace.sourceYaml).toBe(YAML);
		}
	});

	test('the complete software catalog remains placeable and groups directional handoffs with people', () => {
		const report = validateAssetManifest(softwareManifest);
		expect(report.valid).toBe(true);
		if (!report.valid) throw new Error('Invalid catalog');
		const assets = getPlaceableManifestAssets(report.catalog);
		expect(assets.length).toBeGreaterThanOrEqual(92);
		expect(new Set(assets.map((asset) => asset.id)).size).toBe(assets.length);
		for (const id of [
			'human-handoff',
			'human-to-ai-handoff',
			'ai-to-human-handoff'
		]) {
			const asset = assets.find((entry) => entry.id === id);
			if (id === 'human-handoff') expect(asset).toBeDefined();
			if (asset)
				expect(getAssetPanelGroup(asset)).toBe('People & collaboration');
		}
	});
});
