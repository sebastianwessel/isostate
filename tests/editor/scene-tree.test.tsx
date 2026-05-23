import { beforeEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { applyEditorCommand } from '../../packages/editor/src/commands.ts';
import { SceneTreePanel } from '../../packages/editor/src/scenes/SceneTreePanel.tsx';
import type {
	EditorCommand,
	EditorSelection,
	EditorWorkspace
} from '../../packages/editor/src/types.ts';
import { createEditorWorkspace } from '../../packages/editor/src/workspace.ts';

const BASE_YAML = `header:
  version: "1"
  assetBaseUrl: https://example.com/assets
  assets:
    - id: block
      path: block.svg
  layers:
    - name: default
    - name: overlay
scenes:
  - id: scene-1
    elements:
      - id: e1
        asset: block
        at: [0, 0]
        layer: default
      - id: e2
        asset: block
        at: [1, 1]
        layer: overlay
    connections:
      - id: c1
        from:
          element: e1
        to:
          element: e2
        layer: default
  - id: scene-2
    add:
      elements:
        - id: e3
          asset: block
          at: [2, 2]
          layer: default
`;

function setupHappyDom() {
	const w = new Window();
	const g = globalThis as unknown as Record<string, unknown>;
	g.document = w.document;
	g.window = w;
	g.HTMLElement = w.HTMLElement;
	g.Element = w.Element;
	g.Node = w.Node;
	g.SVGElement = w.SVGElement;
	g.DragEvent = w.DragEvent;
}

function makeWorkspace(): EditorWorkspace {
	return createEditorWorkspace({ sourceYaml: BASE_YAML });
}

function TestWrapper({
	initialWorkspace,
	onSelect
}: {
	initialWorkspace: EditorWorkspace;
	onSelect?: (selection: Partial<EditorSelection>) => void;
}) {
	const [workspace, setWorkspace] = useState(initialWorkspace);
	return createElement(SceneTreePanel, {
		workspace,
		onCommand: (cmd: EditorCommand) => {
			const result = applyEditorCommand(workspace, cmd);
			setWorkspace(result.workspace);
		},
		onSelect: (selection) => {
			onSelect?.(selection);
			setWorkspace((prev) => ({
				...prev,
				selection: { ...prev.selection, ...selection }
			}));
		},
		onSelectScene: (sceneId: string) => {
			setWorkspace((prev) => ({ ...prev, activeSceneId: sceneId }));
		},
		setWorkspace
	});
}

function createDragEvent(type: string, dataTransfer = createDataTransfer()) {
	const event = new DragEvent(type, { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
	return event;
}

function createDataTransfer() {
	const data = new Map<string, string>();
	return {
		effectAllowed: 'all',
		getData(type: string) {
			return data.get(type) ?? '';
		},
		setData(type: string, value: string) {
			data.set(type, value);
		}
	};
}

beforeEach(() => {
	setupHappyDom();
});

describe('SceneTreePanel', () => {
	test('renders scenes, layers, and elements in one tree', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		root.render(createElement(TestWrapper, { initialWorkspace: makeWorkspace() }));
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(container.querySelectorAll('.isostate-tree-scene').length).toBe(2);
		expect(container.querySelectorAll('.isostate-tree-layer').length).toBe(4);
		expect(
			container.querySelectorAll(
				'.isostate-tree-element:not(.isostate-tree-connection)'
			).length
		).toBe(5);
		expect(container.querySelectorAll('.isostate-tree-connection').length).toBe(
			2
		);

		root.unmount();
		container.remove();
	});

	test('later scenes show resolved inherited elements and connections', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		root.render(createElement(TestWrapper, { initialWorkspace: makeWorkspace() }));
		await new Promise((resolve) => setTimeout(resolve, 10));

		const scene2 = Array.from(
			container.querySelectorAll('.isostate-tree-scene')
		).find((scene) => scene.textContent?.includes('scene-2')) as HTMLElement;

		expect(scene2.textContent).toContain('e1');
		expect(scene2.textContent).toContain('e2');
		expect(scene2.textContent).toContain('e3');
		expect(scene2.textContent).toContain('c1');

		root.unmount();
		container.remove();
	});

	test('selecting an element updates scene and object selection', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		let selected: Partial<EditorSelection> | undefined;
		root.render(
			createElement(TestWrapper, {
				initialWorkspace: makeWorkspace(),
				onSelect: (selection) => {
					selected = selection;
				}
			})
		);
		await new Promise((resolve) => setTimeout(resolve, 10));

		const element = Array.from(
			container.querySelectorAll('.isostate-tree-element')
		).find((item) => item.textContent?.includes('e2')) as HTMLButtonElement;
		element.click();

		expect(selected?.objectIds).toEqual(['e2']);
		expect(selected?.layerNames).toEqual(['overlay']);

		root.unmount();
		container.remove();
	});

	test('selecting a connection updates scene and connection selection', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		let selected: Partial<EditorSelection> | undefined;
		root.render(
			createElement(TestWrapper, {
				initialWorkspace: makeWorkspace(),
				onSelect: (selection) => {
					selected = selection;
				}
			})
		);
		await new Promise((resolve) => setTimeout(resolve, 10));

		const connection = container.querySelector(
			'.isostate-tree-connection'
		) as HTMLButtonElement;
		connection.click();

		expect(selected?.connectionIds).toEqual(['c1']);
		expect(selected?.objectIds).toEqual([]);
		expect(selected?.layerNames).toEqual(['default']);

		root.unmount();
		container.remove();
	});

	test('adding a scene uses the tree header action', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		root.render(createElement(TestWrapper, { initialWorkspace: makeWorkspace() }));
		await new Promise((resolve) => setTimeout(resolve, 10));

		const addButton = container.querySelector(
			'button[aria-label="Add scene"]'
		) as HTMLButtonElement;
		addButton.click();
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(container.querySelectorAll('.isostate-tree-scene').length).toBe(3);

		root.unmount();
		container.remove();
	});

	test('adding a layer updates every scene group', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		root.render(createElement(TestWrapper, { initialWorkspace: makeWorkspace() }));
		await new Promise((resolve) => setTimeout(resolve, 10));

		const input = container.querySelector(
			'.isostate-layer-add-row input'
		) as HTMLInputElement;
		input.value = 'Foreground';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		const button = container.querySelector(
			'button[aria-label="Add layer"]'
		) as HTMLButtonElement;
		button.click();
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(
			Array.from(container.querySelectorAll('.isostate-tree-layer-name')).filter(
				(node) => node.textContent === 'foreground'
			)
		).toHaveLength(2);

		root.unmount();
		container.remove();
	});

	test('dragging a layer row reorders layers in the tree', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		root.render(createElement(TestWrapper, { initialWorkspace: makeWorkspace() }));
		await new Promise((resolve) => setTimeout(resolve, 10));

		const layers = Array.from(
			container.querySelectorAll('.isostate-tree-layer')
		) as HTMLElement[];
		const defaultLayer = layers.find((layer) =>
			layer.textContent?.includes('default')
		) as HTMLElement;
		const overlayLayer = layers.find((layer) =>
			layer.textContent?.includes('overlay')
		) as HTMLElement;
		const transfer = createDataTransfer();
		overlayLayer.dispatchEvent(createDragEvent('dragstart', transfer));
		defaultLayer.dispatchEvent(createDragEvent('drop', transfer));
		await new Promise((resolve) => setTimeout(resolve, 10));

		const firstSceneLayerNames = Array.from(
			container
				.querySelector('.isostate-tree-scene')
				?.querySelectorAll('.isostate-tree-layer-name') ?? []
		).map((node) => node.textContent);
		expect(firstSceneLayerNames.slice(0, 2)).toEqual(['overlay', 'default']);

		root.unmount();
		container.remove();
	});
});
