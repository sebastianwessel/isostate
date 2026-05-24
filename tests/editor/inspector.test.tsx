import { beforeEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { applyEditorCommand } from '../../packages/editor/src/commands.ts';
import { InspectorPanel } from '../../packages/editor/src/inspector/InspectorPanel.tsx';
import type {
	EditorCommand,
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
        asset: text
        at: [1, 1]
        layer: default
        text:
          value: Hello
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
          asset: block
          at: [2, 2]
          layer: overlay
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
	g.FocusEvent = w.FocusEvent;
}

function makeWorkspace(): EditorWorkspace {
	return createEditorWorkspace({ sourceYaml: BASE_YAML });
}

function setInputValue(input: HTMLInputElement, value: string) {
	const setter = Object.getOwnPropertyDescriptor(
		window.HTMLInputElement.prototype,
		'value'
	)?.set;
	setter?.call(input, value);
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

function blurInput(input: HTMLInputElement) {
	input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
}

function TestWrapper({
	initialWorkspace
}: {
	initialWorkspace: EditorWorkspace;
}) {
	const [workspace, setWorkspace] = useState(initialWorkspace);
	return createElement(InspectorPanel, {
		workspace: {
			...workspace,
			selection: { objectIds: ['e1'], connectionIds: [], layerNames: [] }
		},
		onCommand: (cmd: EditorCommand) => {
			const result = applyEditorCommand(workspace, cmd);
			setWorkspace(result.workspace);
		}
	});
}

function TextElementTestWrapper({
	initialWorkspace
}: {
	initialWorkspace: EditorWorkspace;
}) {
	const [workspace, setWorkspace] = useState(initialWorkspace);
	return createElement(InspectorPanel, {
		workspace: {
			...workspace,
			selection: { objectIds: ['e2'], connectionIds: [], layerNames: [] }
		},
		onCommand: (cmd: EditorCommand) => {
			const result = applyEditorCommand(workspace, cmd);
			setWorkspace(result.workspace);
		}
	});
}

function ConnectionTestWrapper({
	initialWorkspace
}: {
	initialWorkspace: EditorWorkspace;
}) {
	const [workspace, setWorkspace] = useState(initialWorkspace);
	return createElement(InspectorPanel, {
		workspace: {
			...workspace,
			selection: { objectIds: [], connectionIds: ['c1'], layerNames: [] }
		},
		onCommand: (cmd: EditorCommand) => {
			const result = applyEditorCommand(workspace, cmd);
			setWorkspace(result.workspace);
		}
	});
}

beforeEach(() => {
	setupHappyDom();
});

describe('InspectorPanel', () => {
	test('element inspector shows the selected asset without invalid patch editing', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		root.render(
			createElement(InspectorPanel, {
				workspace: {
					...workspace,
					selection: { objectIds: ['e1'], connectionIds: [], layerNames: [] }
				},
				onCommand: () => {}
			})
		);
		await new Promise((r) => setTimeout(r, 10));
		const rows = container.querySelectorAll('.isostate-inspector-row');
		const assetRow = Array.from(rows).find((row) =>
			row.textContent?.includes('Asset')
		);
		expect(assetRow).toBeTruthy();
		const input = assetRow?.querySelector(
			'.isostate-input'
		) as HTMLInputElement;
		expect(input).toBeTruthy();
		expect(input.value).toBe('block');
		expect(input.readOnly).toBe(true);
		root.unmount();
		container.remove();
	});

	test('element inspector updates position X input', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		root.render(createElement(TestWrapper, { initialWorkspace: workspace }));
		await new Promise((r) => setTimeout(r, 10));
		const inputs = container.querySelectorAll('.isostate-input');
		const xInput = Array.from(inputs).find(
			(input) => (input as HTMLInputElement).type === 'number'
		) as HTMLInputElement;
		expect(xInput).toBeTruthy();
		expect(xInput.value).toBe('0');
		root.unmount();
		container.remove();
	});

	test('text element inspector exposes placement control', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		root.render(
			createElement(TextElementTestWrapper, { initialWorkspace: workspace })
		);
		await new Promise((r) => setTimeout(r, 10));
		const rows = container.querySelectorAll('.isostate-inspector-row');
		const placementRow = Array.from(rows).find((row) =>
			row.textContent?.includes('Placement')
		);
		const placementSelect = placementRow?.querySelector('.isostate-select');

		expect(placementSelect).toBeTruthy();
		expect(placementSelect?.textContent).toContain('cell');
		root.unmount();
		container.remove();
	});

	test('connection inspector shows from element dropdown', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		root.render(
			createElement(ConnectionTestWrapper, { initialWorkspace: workspace })
		);
		await new Promise((r) => setTimeout(r, 10));
		const rows = container.querySelectorAll('.isostate-inspector-row');
		const elementRows = Array.from(rows).filter((row) =>
			row.textContent?.includes('Element')
		);
		const fromElementSelect = elementRows
			.map((row) => row.querySelector('.isostate-select'))
			.find((select) => select?.textContent?.includes('e1'));
		expect(fromElementSelect).toBeTruthy();
		root.unmount();
		container.remove();
	});

	test('empty inspector edits the active scene id', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		let current = workspace;
		root.render(
			createElement(InspectorPanel, {
				workspace: current,
				onCommand: (cmd: EditorCommand) => {
					const result = applyEditorCommand(current, cmd);
					current = result.workspace;
				}
			})
		);
		await new Promise((r) => setTimeout(r, 10));
		const sceneInput = container.querySelector(
			'input[aria-label="Rename scene"]'
		) as HTMLInputElement;
		setInputValue(sceneInput, 'intro');
		blurInput(sceneInput);
		expect(current.document?.scenes[0].id).toBe('intro');
		expect(current.activeSceneId).toBe('intro');
		root.unmount();
		container.remove();
	});

	test('element inspector edits the selected element id', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: ['e1'], connectionIds: [], layerNames: [] }
		};
		const root = createRoot(container);
		let current = workspace;
		root.render(
			createElement(InspectorPanel, {
				workspace: current,
				onCommand: (cmd: EditorCommand) => {
					const result = applyEditorCommand(current, cmd);
					current = result.workspace;
				}
			})
		);
		await new Promise((r) => setTimeout(r, 10));
		const input = container.querySelector(
			'input[aria-label="Rename element e1"]'
		) as HTMLInputElement;
		setInputValue(input, 'api-server');
		blurInput(input);
		expect(current.document?.scenes[0].elements?.[0].id).toBe('api-server');
		expect(current.selection.objectIds).toEqual(['api-server']);
		root.unmount();
		container.remove();
	});

	test('layer inspector edits the selected layer id', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: [], connectionIds: [], layerNames: ['overlay'] }
		};
		const root = createRoot(container);
		let current = workspace;
		root.render(
			createElement(InspectorPanel, {
				workspace: current,
				onCommand: (cmd: EditorCommand) => {
					const result = applyEditorCommand(current, cmd);
					current = result.workspace;
				}
			})
		);
		await new Promise((r) => setTimeout(r, 10));
		const input = container.querySelector(
			'input[aria-label="Rename layer overlay"]'
		) as HTMLInputElement;
		setInputValue(input, 'foreground');
		blurInput(input);
		expect(
			current.document?.header.layers.some(
				(layer) => layer.name === 'foreground'
			)
		).toBe(true);
		expect(current.document?.scenes[1].add?.elements?.[0].layer).toBe(
			'foreground'
		);
		expect(current.selection.layerNames).toEqual(['foreground']);
		root.unmount();
		container.remove();
	});

	test('connection inspector can remove selected connection', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		let current = workspace;
		root.render(
			createElement(InspectorPanel, {
				workspace: {
					...current,
					selection: {
						objectIds: [],
						connectionIds: ['c1'],
						layerNames: []
					}
				},
				onCommand: (cmd: EditorCommand) => {
					const result = applyEditorCommand(current, cmd);
					current = result.workspace;
				}
			})
		);
		await new Promise((r) => setTimeout(r, 10));
		const button = Array.from(container.querySelectorAll('button')).find(
			(candidate) => candidate.textContent?.includes('Delete Connection')
		) as HTMLButtonElement;
		button.click();
		expect(current.document?.scenes[0].connections ?? []).toHaveLength(0);
		root.unmount();
		container.remove();
	});

	test('connection inspector can enable flow without manual YAML edits', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		let current = workspace;
		root.render(
			createElement(InspectorPanel, {
				workspace: {
					...current,
					selection: {
						objectIds: [],
						connectionIds: ['c1'],
						layerNames: []
					}
				},
				onCommand: (cmd: EditorCommand) => {
					const result = applyEditorCommand(current, cmd);
					current = result.workspace;
				}
			})
		);
		await new Promise((r) => setTimeout(r, 10));
		const button = Array.from(container.querySelectorAll('button')).find(
			(candidate) => candidate.textContent?.includes('Flow off')
		) as HTMLButtonElement;
		button.click();
		const connection = current.document?.scenes[0].connections?.find(
			(candidate) => candidate.id === 'c1'
		);
		expect(connection?.ambient?.some((item) => item.name === 'flow')).toBe(
			true
		);
		expect(connection?.style?.pattern).toBe('dashed');
		root.unmount();
		container.remove();
	});

	test('element inspector can remove an inherited element from later scene', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = {
			...makeWorkspace(),
			activeSceneId: 'scene-2'
		};
		const root = createRoot(container);
		let current = workspace;
		root.render(
			createElement(InspectorPanel, {
				workspace: {
					...current,
					selection: {
						sceneId: 'scene-2',
						objectIds: ['e1'],
						connectionIds: [],
						layerNames: []
					}
				},
				onCommand: (cmd: EditorCommand) => {
					const result = applyEditorCommand(current, cmd);
					current = result.workspace;
				}
			})
		);
		await new Promise((r) => setTimeout(r, 10));
		const button = Array.from(container.querySelectorAll('button')).find(
			(candidate) => candidate.textContent?.includes('Delete Element')
		) as HTMLButtonElement;
		button.click();
		expect(current.document?.scenes[1].remove?.elements).toEqual([
			{ id: 'e1' }
		]);
		root.unmount();
		container.remove();
	});

	test('connection inspector can remove inherited connection from later scene', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = {
			...makeWorkspace(),
			activeSceneId: 'scene-2'
		};
		const root = createRoot(container);
		let current = workspace;
		root.render(
			createElement(InspectorPanel, {
				workspace: {
					...current,
					selection: {
						sceneId: 'scene-2',
						objectIds: [],
						connectionIds: ['c1'],
						layerNames: []
					}
				},
				onCommand: (cmd: EditorCommand) => {
					const result = applyEditorCommand(current, cmd);
					current = result.workspace;
				}
			})
		);
		await new Promise((r) => setTimeout(r, 10));
		const button = Array.from(container.querySelectorAll('button')).find(
			(candidate) => candidate.textContent?.includes('Delete Connection')
		) as HTMLButtonElement;
		button.click();
		expect(current.document?.scenes[1].remove?.connections).toEqual([
			{ id: 'c1' }
		]);
		root.unmount();
		container.remove();
	});

	test('camera target dropdown shows element and area options', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		root.render(
			createElement(InspectorPanel, {
				workspace,
				onCommand: () => {},
				mode: 'general'
			})
		);
		await new Promise((r) => setTimeout(r, 10));
		const rows = container.querySelectorAll('.isostate-inspector-row');
		const targetRow = Array.from(rows).find((row) =>
			row.textContent?.includes('Target')
		);
		const cameraTargetSelect = targetRow?.querySelector('.isostate-select');
		expect(cameraTargetSelect).toBeTruthy();
		expect(cameraTargetSelect?.textContent).toContain('None');
		root.unmount();
		container.remove();
	});

	test('disabled invalid controls do not dispatch', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		let commandCount = 0;
		root.render(
			createElement(InspectorPanel, {
				workspace: {
					...workspace,
					selection: { objectIds: [], connectionIds: [], layerNames: [] }
				},
				onCommand: () => {
					commandCount++;
				}
			})
		);
		await new Promise((r) => setTimeout(r, 10));
		expect(
			container.querySelector('button[aria-label="Delete Element"]')
		).toBeNull();
		expect(
			container.querySelector('button[aria-label="Delete Connection"]')
		).toBeNull();
		expect(commandCount).toBe(0);
		root.unmount();
		container.remove();
	});
});
