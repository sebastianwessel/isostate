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
	g.KeyboardEvent = w.KeyboardEvent;
	g.Event = w.Event;
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

const PRIMITIVE_YAML = `header:
  version: "1"
  assetBaseUrl: https://example.com/assets
  assets:
    - id: block
      path: block.svg
  layers:
    - name: default
scenes:
  - id: scene-1
    elements:
      - id: rect1
        asset: rectangle
        at: [0, 0]
        layer: default
        primitive:
          rectangle:
            fill: red
            stroke: black
            strokeWidth: 2
            opacity: 0.5
      - id: circle1
        asset: circle
        at: [1, 0]
        layer: default
        primitive:
          circle:
            fill: blue
      - id: poly1
        asset: polygon
        at: [2, 0]
        layer: default
        primitive:
          polygon:
            points: [[0, 0], [1, 0], [0, 1]]
      - id: line1
        asset: line
        at: [3, 0]
        layer: default
        primitive:
          line:
            points: [[0, 0], [1, 1]]
`;

const MANUAL_ROUTE_YAML = `header:
  version: "1"
  assetBaseUrl: https://example.com/assets
  assets:
    - id: block
      path: block.svg
  layers:
    - name: default
scenes:
  - id: scene-1
    elements:
      - id: e1
        asset: block
        at: [0, 0]
        layer: default
      - id: e2
        asset: block
        at: [2, 2]
        layer: default
    connections:
      - id: c1
        route:
          - [0, 0]
          - [2, 2]
        style:
          variant: road
          pattern: dashed
          stroke: "#fff"
          strokeWidth: 3
          opacity: 0.8
          dash: [4, 2]
          outline: "#000"
          outlineWidth: 1
          lane: center-dashed
        start: dot
        end: diamond
        direction: reverse
        enter: fade-in
        exit: fade-out
`;

const CAMERA_YAML = `header:
  version: "1"
  assetBaseUrl: https://example.com/assets
  assets:
    - id: block
      path: block.svg
  layers:
    - name: default
scenes:
  - id: scene-1
    elements:
      - id: e1
        asset: block
        at: [0, 0]
        layer: default
      - id: e2
        asset: block
        at: [3, 3]
        layer: default
    camera:
      target:
        area:
          at: [1, 1]
          size: [2, 2]
      padding: 40
      duration: 500
      easing: ease-in-out
`;

const CAMERA_ELEMENT_YAML = `header:
  version: "1"
  assetBaseUrl: https://example.com/assets
  assets:
    - id: block
      path: block.svg
  layers:
    - name: default
scenes:
  - id: scene-1
    elements:
      - id: e1
        asset: block
        at: [0, 0]
        layer: default
      - id: e2
        asset: block
        at: [3, 3]
        layer: default
    camera:
      target:
        element: e1
      padding: 20
`;

function makeWorkspaceFrom(yaml: string): EditorWorkspace {
	return createEditorWorkspace({ sourceYaml: yaml });
}

function LiveInspectorWrapper({
	initialWorkspace,
	mode,
	latestRef,
	onWorkspaceChange
}: {
	initialWorkspace: EditorWorkspace;
	mode?: 'attributes' | 'general';
	latestRef: { current: EditorWorkspace };
	onWorkspaceChange: (workspace: EditorWorkspace) => void;
}) {
	const [workspace, setWorkspace] = useState(initialWorkspace);
	return createElement(InspectorPanel, {
		workspace,
		mode,
		onCommand: (cmd: EditorCommand) => {
			// Apply against latestRef.current rather than the closed-over
			// `workspace` state so multiple synchronous onCommand calls in the
			// same event handler (e.g. multi-selection loops) stack correctly,
			// matching how a real app dispatcher would sequence commands.
			const result = applyEditorCommand(latestRef.current, cmd);
			latestRef.current = result.workspace;
			setWorkspace(result.workspace);
			onWorkspaceChange(result.workspace);
		}
	});
}

async function renderPanel(
	workspace: EditorWorkspace,
	options?: { mode?: 'attributes' | 'general' }
) {
	const container = document.createElement('div');
	document.body.appendChild(container);
	let current = workspace;
	const latestRef = { current: workspace };
	const root = createRoot(container);
	root.render(
		createElement(LiveInspectorWrapper, {
			initialWorkspace: current,
			mode: options?.mode,
			latestRef,
			onWorkspaceChange: (next: EditorWorkspace) => {
				current = next;
			}
		})
	);
	await new Promise((r) => setTimeout(r, 10));
	return {
		container,
		root,
		getWorkspace: () => current,
		cleanup: () => {
			root.unmount();
			container.remove();
		}
	};
}

function findRowByLabel(container: HTMLElement, label: string) {
	const rows = container.querySelectorAll('.isostate-inspector-row');
	return Array.from(rows).find(
		(row) =>
			row.querySelector('.isostate-inspector-label')?.textContent === label
	) as HTMLElement | undefined;
}

function numberInput(row: HTMLElement | undefined) {
	return row?.querySelector('input[type="number"]') as HTMLInputElement;
}

function textInput(row: HTMLElement | undefined) {
	return row?.querySelector('input[type="text"]') as HTMLInputElement;
}

async function chooseSelectOption(
	row: HTMLElement | undefined,
	optionText: string
) {
	const trigger = row?.querySelector('button') as HTMLButtonElement;
	trigger.click();
	await new Promise((r) => setTimeout(r, 10));
	const options = Array.from(document.querySelectorAll('[role="option"]'));
	const option = options.find(
		(candidate) => candidate.textContent === optionText
	) as HTMLElement;
	option.click();
	await new Promise((r) => setTimeout(r, 10));
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

	test('element inspector updates position Y input', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: ['e1'], connectionIds: [], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		const row = findRowByLabel(container, 'Position Y');
		setInputValue(numberInput(row), '5');
		expect(getWorkspace().document?.scenes[0].elements?.[0].at).toEqual([0, 5]);
		cleanup();
	});

	test('element inspector updates size input', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: ['e1'], connectionIds: [], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		const row = findRowByLabel(container, 'Size');
		setInputValue(numberInput(row), '3');
		expect(getWorkspace().document?.scenes[0].elements?.[0].size).toBe(3);
		cleanup();
	});

	test('element inspector changes layer via select', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: ['e1'], connectionIds: [], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		const row = findRowByLabel(container, 'Layer');
		await chooseSelectOption(row, 'overlay');
		expect(getWorkspace().document?.scenes[0].elements?.[0].layer).toBe(
			'overlay'
		);
		cleanup();
	});

	test('element inspector sets and clears enter animation', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: ['e1'], connectionIds: [], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		const row = findRowByLabel(container, 'Enter');
		await chooseSelectOption(row, 'fade-in');
		expect(getWorkspace().document?.scenes[0].elements?.[0].enter).toBe(
			'fade-in'
		);
		cleanup();
	});

	test('element inspector sets exit animation', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: ['e1'], connectionIds: [], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		const row = findRowByLabel(container, 'Exit');
		await chooseSelectOption(row, 'fade-out');
		expect(getWorkspace().document?.scenes[0].elements?.[0].exit).toBe(
			'fade-out'
		);
		cleanup();
	});

	test('element inspector toggles ambient animation buttons on and off', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: ['e1'], connectionIds: [], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		const findPulseButton = () =>
			Array.from(container.querySelectorAll('button')).find(
				(candidate) => candidate.textContent === 'pulse'
			) as HTMLButtonElement;
		findPulseButton().click();
		await new Promise((r) => setTimeout(r, 10));
		expect(getWorkspace().document?.scenes[0].elements?.[0].ambient).toEqual([
			{ name: 'pulse' }
		]);
		findPulseButton().click();
		await new Promise((r) => setTimeout(r, 10));
		expect(
			getWorkspace().document?.scenes[0].elements?.[0].ambient ?? []
		).toEqual([]);
		cleanup();
	});

	test('text element inspector updates content, align, font size and fill', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: ['e2'], connectionIds: [], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);

		setInputValue(textInput(findRowByLabel(container, 'Content')), 'World');
		expect(getWorkspace().document?.scenes[0].elements?.[1].text?.value).toBe(
			'World'
		);

		await chooseSelectOption(findRowByLabel(container, 'Align'), 'end');
		expect(getWorkspace().document?.scenes[0].elements?.[1].text?.align).toBe(
			'end'
		);

		setInputValue(numberInput(findRowByLabel(container, 'Font Size')), '20');
		expect(
			getWorkspace().document?.scenes[0].elements?.[1].text?.fontSize
		).toBe(20);

		setInputValue(textInput(findRowByLabel(container, 'Fill')), 'red');
		expect(getWorkspace().document?.scenes[0].elements?.[1].text?.fill).toBe(
			'red'
		);

		cleanup();
	});

	test('text element inspector updates placement via select', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: ['e2'], connectionIds: [], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		await chooseSelectOption(findRowByLabel(container, 'Placement'), 'caption');
		expect(
			getWorkspace().document?.scenes[0].elements?.[1].text?.placement
		).toBe('caption');
		cleanup();
	});

	test('rectangle primitive inspector edits fill, stroke, strokeWidth and opacity', async () => {
		const workspace = {
			...makeWorkspaceFrom(PRIMITIVE_YAML),
			selection: { objectIds: ['rect1'], connectionIds: [], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);

		setInputValue(textInput(findRowByLabel(container, 'Fill')), 'green');
		expect(
			getWorkspace().document?.scenes[0].elements?.[0].primitive?.rectangle
				?.fill
		).toBe('green');

		setInputValue(textInput(findRowByLabel(container, 'Stroke')), 'yellow');
		expect(
			getWorkspace().document?.scenes[0].elements?.[0].primitive?.rectangle
				?.stroke
		).toBe('yellow');

		setInputValue(numberInput(findRowByLabel(container, 'Stroke Width')), '4');
		expect(
			getWorkspace().document?.scenes[0].elements?.[0].primitive?.rectangle
				?.strokeWidth
		).toBe(4);

		setInputValue(numberInput(findRowByLabel(container, 'Opacity')), '0.25');
		expect(
			getWorkspace().document?.scenes[0].elements?.[0].primitive?.rectangle
				?.opacity
		).toBe(0.25);

		cleanup();
	});

	test('circle primitive inspector exposes fill row', async () => {
		const workspace = {
			...makeWorkspaceFrom(PRIMITIVE_YAML),
			selection: { objectIds: ['circle1'], connectionIds: [], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		setInputValue(textInput(findRowByLabel(container, 'Fill')), 'cyan');
		expect(
			getWorkspace().document?.scenes[0].elements?.[1].primitive?.circle?.fill
		).toBe('cyan');
		cleanup();
	});

	test('polygon primitive inspector edits stroke without a fill row change', async () => {
		const workspace = {
			...makeWorkspaceFrom(PRIMITIVE_YAML),
			selection: { objectIds: ['poly1'], connectionIds: [], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		setInputValue(textInput(findRowByLabel(container, 'Stroke')), 'purple');
		expect(
			getWorkspace().document?.scenes[0].elements?.[2].primitive?.polygon
				?.stroke
		).toBe('purple');
		cleanup();
	});

	test('line primitive inspector has no fill row and edits stroke width', async () => {
		const workspace = {
			...makeWorkspaceFrom(PRIMITIVE_YAML),
			selection: { objectIds: ['line1'], connectionIds: [], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		expect(findRowByLabel(container, 'Fill')).toBeUndefined();
		setInputValue(numberInput(findRowByLabel(container, 'Stroke Width')), '6');
		expect(
			getWorkspace().document?.scenes[0].elements?.[3].primitive?.line
				?.strokeWidth
		).toBe(6);
		cleanup();
	});

	test('connection inspector switches route source from endpoints to manual and back', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: [], connectionIds: ['c1'], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);

		await chooseSelectOption(
			findRowByLabel(container, 'Route Source'),
			'Manual Route'
		);
		const afterManual = getWorkspace().document?.scenes[0].connections?.[0];
		expect(afterManual?.route).toBeTruthy();
		expect(afterManual?.from).toBeUndefined();
		expect(afterManual?.to).toBeUndefined();

		cleanup();
	});

	test('connection inspector manual route textarea parses and updates points', async () => {
		const workspace = {
			...makeWorkspaceFrom(MANUAL_ROUTE_YAML),
			selection: { objectIds: [], connectionIds: ['c1'], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		const row = findRowByLabel(container, 'Route');
		const textarea = row?.querySelector('textarea') as HTMLTextAreaElement;
		expect(textarea).toBeTruthy();
		expect(textarea.value).toBe('0, 0\n2, 2');

		const setter = Object.getOwnPropertyDescriptor(
			window.HTMLTextAreaElement.prototype,
			'value'
		)?.set;
		setter?.call(textarea, '0, 0\n2, 0\n2, 3');
		textarea.dispatchEvent(new Event('input', { bubbles: true }));

		expect(getWorkspace().document?.scenes[0].connections?.[0].route).toEqual([
			[0, 0],
			[2, 0],
			[2, 3]
		]);
		cleanup();
	});

	test('connection inspector manual route textarea ignores unparsable input', async () => {
		const workspace = {
			...makeWorkspaceFrom(MANUAL_ROUTE_YAML),
			selection: { objectIds: [], connectionIds: ['c1'], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		const row = findRowByLabel(container, 'Route');
		const textarea = row?.querySelector('textarea') as HTMLTextAreaElement;
		const setter = Object.getOwnPropertyDescriptor(
			window.HTMLTextAreaElement.prototype,
			'value'
		)?.set;
		setter?.call(textarea, 'not a route');
		textarea.dispatchEvent(new Event('input', { bubbles: true }));
		expect(getWorkspace().document?.scenes[0].connections?.[0].route).toEqual([
			[0, 0],
			[2, 2]
		]);
		cleanup();
	});

	test('connection inspector switches from-endpoint type to grid point and edits X/Y', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: [], connectionIds: ['c1'], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		const rows = () => container.querySelectorAll('.isostate-inspector-row');
		const typeRows = () =>
			Array.from(rows()).filter(
				(row) =>
					row.querySelector('.isostate-inspector-label')?.textContent === 'Type'
			);
		await chooseSelectOption(typeRows()[0], 'Grid Point');
		expect(getWorkspace().document?.scenes[0].connections?.[0].from).toEqual({
			at: [0, 0]
		});

		const xRow = findRowByLabel(container, 'X');
		setInputValue(numberInput(xRow), '4');
		expect(
			getWorkspace().document?.scenes[0].connections?.[0].from?.at
		).toEqual([4, 0]);

		const yRow = findRowByLabel(container, 'Y');
		setInputValue(numberInput(yRow), '7');
		expect(
			getWorkspace().document?.scenes[0].connections?.[0].from?.at
		).toEqual([4, 7]);

		await chooseSelectOption(typeRows()[0], 'Element');
		expect(getWorkspace().document?.scenes[0].connections?.[0].from).toEqual({
			element: 'e1'
		});

		cleanup();
	});

	test('connection inspector switches to-endpoint type to grid point and edits X/Y', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: [], connectionIds: ['c1'], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		const typeRows = () =>
			Array.from(container.querySelectorAll('.isostate-inspector-row')).filter(
				(row) =>
					row.querySelector('.isostate-inspector-label')?.textContent === 'Type'
			);
		await chooseSelectOption(typeRows()[1], 'Grid Point');
		expect(getWorkspace().document?.scenes[0].connections?.[0].to).toEqual({
			at: [0, 0]
		});

		const xRows = () =>
			Array.from(container.querySelectorAll('.isostate-inspector-row')).filter(
				(row) =>
					row.querySelector('.isostate-inspector-label')?.textContent === 'X'
			);
		setInputValue(numberInput(xRows()[0]), '9');
		expect(getWorkspace().document?.scenes[0].connections?.[0].to?.at).toEqual([
			9, 0
		]);

		const yRows = () =>
			Array.from(container.querySelectorAll('.isostate-inspector-row')).filter(
				(row) =>
					row.querySelector('.isostate-inspector-label')?.textContent === 'Y'
			);
		setInputValue(numberInput(yRows()[0]), '6');
		expect(getWorkspace().document?.scenes[0].connections?.[0].to?.at).toEqual([
			9, 6
		]);

		await chooseSelectOption(typeRows()[1], 'Element');
		expect(getWorkspace().document?.scenes[0].connections?.[0].to).toEqual({
			element: 'e1'
		});

		const elementRows = () =>
			Array.from(container.querySelectorAll('.isostate-inspector-row')).filter(
				(row) =>
					row.querySelector('.isostate-inspector-label')?.textContent ===
					'Element'
			);
		await chooseSelectOption(elementRows()[1], 'e2');
		expect(getWorkspace().document?.scenes[0].connections?.[0].to).toEqual({
			element: 'e2'
		});

		cleanup();
	});

	test('connection inspector switches route source back from manual to endpoints', async () => {
		const workspace = {
			...makeWorkspaceFrom(MANUAL_ROUTE_YAML),
			selection: { objectIds: [], connectionIds: ['c1'], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		await chooseSelectOption(
			findRowByLabel(container, 'Route Source'),
			'Endpoints'
		);
		const connection = getWorkspace().document?.scenes[0].connections?.[0];
		expect(connection?.route).toBeUndefined();
		expect(connection?.from).toEqual({ element: 'e1' });
		expect(connection?.to).toEqual({ element: 'e2' });
		cleanup();
	});

	test('connection inspector renames the connection id', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: [], connectionIds: ['c1'], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		const input = container.querySelector(
			'input[aria-label="Rename connection c1"]'
		) as HTMLInputElement;
		setInputValue(input, 'link-1');
		blurInput(input);
		expect(getWorkspace().document?.scenes[0].connections?.[0].id).toBe(
			'link-1'
		);
		expect(getWorkspace().selection.connectionIds).toEqual(['link-1']);
		cleanup();
	});

	test('element inspector updates position X input', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: ['e1'], connectionIds: [], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		const row = findRowByLabel(container, 'Position X');
		setInputValue(numberInput(row), '6');
		expect(getWorkspace().document?.scenes[0].elements?.[0].at).toEqual([6, 0]);
		cleanup();
	});

	test('camera target select "None" option removes the camera', async () => {
		const workspace = makeWorkspaceFrom(CAMERA_YAML);
		const { container, getWorkspace, cleanup } = await renderPanel(workspace, {
			mode: 'general'
		});
		await chooseSelectOption(findRowByLabel(container, 'Target'), 'None');
		expect(getWorkspace().document?.scenes[0].camera).toBeUndefined();
		cleanup();
	});

	test('connection inspector changes from element via select', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: [], connectionIds: ['c1'], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		const elementRows = () =>
			Array.from(container.querySelectorAll('.isostate-inspector-row')).filter(
				(row) =>
					row.querySelector('.isostate-inspector-label')?.textContent ===
					'Element'
			);
		await chooseSelectOption(elementRows()[0], 'e2');
		expect(getWorkspace().document?.scenes[0].connections?.[0].from).toEqual({
			element: 'e2'
		});
		cleanup();
	});

	test('connection inspector edits from/to side and offset', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: [], connectionIds: ['c1'], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		const sideRows = () =>
			Array.from(container.querySelectorAll('.isostate-inspector-row')).filter(
				(row) =>
					row.querySelector('.isostate-inspector-label')?.textContent === 'Side'
			);
		await chooseSelectOption(sideRows()[0], 'top');
		expect(getWorkspace().document?.scenes[0].connections?.[0].from?.side).toBe(
			'top'
		);

		const offsetRows = () =>
			Array.from(container.querySelectorAll('.isostate-inspector-row')).filter(
				(row) =>
					row.querySelector('.isostate-inspector-label')?.textContent ===
					'Offset'
			);
		setInputValue(numberInput(offsetRows()[0]), '0.2');
		expect(
			getWorkspace().document?.scenes[0].connections?.[0].from?.offset
		).toBe(0.2);

		await chooseSelectOption(sideRows()[1], 'bottom');
		expect(getWorkspace().document?.scenes[0].connections?.[0].to?.side).toBe(
			'bottom'
		);

		setInputValue(numberInput(offsetRows()[1]), '0.3');
		expect(getWorkspace().document?.scenes[0].connections?.[0].to?.offset).toBe(
			0.3
		);

		cleanup();
	});

	test('connection inspector edits routing mode, avoid, clearance, grid step, max bends and prefer', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: [], connectionIds: ['c1'], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);

		await chooseSelectOption(findRowByLabel(container, 'Mode'), 'manual');
		expect(
			getWorkspace().document?.scenes[0].connections?.[0].routing?.mode
		).toBe('manual');

		await chooseSelectOption(findRowByLabel(container, 'Avoid'), 'none');
		expect(
			getWorkspace().document?.scenes[0].connections?.[0].routing?.avoid
		).toBe('none');

		setInputValue(numberInput(findRowByLabel(container, 'Clearance')), '1.5');
		expect(
			getWorkspace().document?.scenes[0].connections?.[0].routing?.clearance
		).toBe(1.5);

		setInputValue(numberInput(findRowByLabel(container, 'Grid Step')), '0.5');
		expect(
			getWorkspace().document?.scenes[0].connections?.[0].routing?.gridStep
		).toBe(0.5);

		setInputValue(numberInput(findRowByLabel(container, 'Max Bends')), '5');
		expect(
			getWorkspace().document?.scenes[0].connections?.[0].routing?.maxBends
		).toBe(5);

		await chooseSelectOption(
			findRowByLabel(container, 'Prefer'),
			'fewest-bends'
		);
		expect(
			getWorkspace().document?.scenes[0].connections?.[0].routing?.prefer
		).toBe('fewest-bends');

		cleanup();
	});

	test('connection inspector edits style variant, pattern, stroke, strokeWidth, opacity and dash', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: [], connectionIds: ['c1'], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);

		await chooseSelectOption(findRowByLabel(container, 'Variant'), 'road');
		expect(
			getWorkspace().document?.scenes[0].connections?.[0].style?.variant
		).toBe('road');

		await chooseSelectOption(findRowByLabel(container, 'Pattern'), 'dotted');
		expect(
			getWorkspace().document?.scenes[0].connections?.[0].style?.pattern
		).toBe('dotted');

		setInputValue(textInput(findRowByLabel(container, 'Stroke')), '#123456');
		expect(
			getWorkspace().document?.scenes[0].connections?.[0].style?.stroke
		).toBe('#123456');

		setInputValue(
			numberInput(findRowByLabel(container, 'Stroke Width')),
			'2.5'
		);
		expect(
			getWorkspace().document?.scenes[0].connections?.[0].style?.strokeWidth
		).toBe(2.5);

		setInputValue(numberInput(findRowByLabel(container, 'Opacity')), '0.4');
		expect(
			getWorkspace().document?.scenes[0].connections?.[0].style?.opacity
		).toBe(0.4);

		const dashRow = findRowByLabel(container, 'Dash');
		const dashInputs = dashRow?.querySelectorAll('input[type="number"]');
		setInputValue(dashInputs?.[0] as HTMLInputElement, '6');
		expect(
			getWorkspace().document?.scenes[0].connections?.[0].style?.dash
		).toEqual([6, 4]);
		setInputValue(dashInputs?.[1] as HTMLInputElement, '8');
		expect(
			getWorkspace().document?.scenes[0].connections?.[0].style?.dash
		).toEqual([6, 8]);

		cleanup();
	});

	test('connection inspector edits outline, outline width and lane', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: [], connectionIds: ['c1'], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);

		setInputValue(textInput(findRowByLabel(container, 'Outline')), '#abcdef');
		expect(
			getWorkspace().document?.scenes[0].connections?.[0].style?.outline
		).toBe('#abcdef');

		setInputValue(
			numberInput(findRowByLabel(container, 'Outline Width')),
			'1.5'
		);
		expect(
			getWorkspace().document?.scenes[0].connections?.[0].style?.outlineWidth
		).toBe(1.5);

		await chooseSelectOption(
			findRowByLabel(container, 'Lane'),
			'center-dashed'
		);
		expect(
			getWorkspace().document?.scenes[0].connections?.[0].style?.lane
		).toBe('center-dashed');

		cleanup();
	});

	test('connection inspector edits start, end, direction, enter and exit', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: [], connectionIds: ['c1'], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);

		await chooseSelectOption(findRowByLabel(container, 'Start'), 'circle');
		expect(getWorkspace().document?.scenes[0].connections?.[0].start).toBe(
			'circle'
		);

		await chooseSelectOption(findRowByLabel(container, 'End'), 'bar');
		expect(getWorkspace().document?.scenes[0].connections?.[0].end).toBe('bar');

		await chooseSelectOption(findRowByLabel(container, 'Direction'), 'reverse');
		expect(getWorkspace().document?.scenes[0].connections?.[0].direction).toBe(
			'reverse'
		);

		await chooseSelectOption(findRowByLabel(container, 'Enter'), 'flip-in');
		expect(getWorkspace().document?.scenes[0].connections?.[0].enter).toBe(
			'flip-in'
		);

		await chooseSelectOption(findRowByLabel(container, 'Exit'), 'flip-out');
		expect(getWorkspace().document?.scenes[0].connections?.[0].exit).toBe(
			'flip-out'
		);

		cleanup();
	});

	test('connection inspector changes layer via select', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: [], connectionIds: ['c1'], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		await chooseSelectOption(findRowByLabel(container, 'Layer'), 'overlay');
		expect(getWorkspace().document?.scenes[0].connections?.[0].layer).toBe(
			'overlay'
		);
		cleanup();
	});

	test('multi selection controls show count and assign a layer to all selected objects', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: ['e1', 'e2'], connectionIds: [], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		const header = Array.from(
			container.querySelectorAll('.isostate-inspector-section')
		).find((section) => section.textContent?.includes('Selected'));
		expect(header?.textContent).toBe('2 Selected');

		const row = findRowByLabel(container, 'Layer');
		await chooseSelectOption(row, 'overlay');
		const elements = getWorkspace().document?.scenes[0].elements ?? [];
		expect(elements.find((e) => e.id === 'e1')?.layer).toBe('overlay');
		expect(elements.find((e) => e.id === 'e2')?.layer).toBe('overlay');
		cleanup();
	});

	test('multi selection nudge buttons dispatch object update commands without throwing', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: ['e1', 'e2'], connectionIds: [], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		const nudgeRow = container.querySelector('.isostate-nudge-row');
		const buttons = Array.from(nudgeRow?.querySelectorAll('button') ?? []);
		expect(buttons).toHaveLength(4);
		for (const button of buttons) {
			(button as HTMLButtonElement).click();
		}
		const elements = getWorkspace().document?.scenes[0].elements ?? [];
		expect(elements.find((e) => e.id === 'e1')?.at).toEqual([0, 0]);
		cleanup();
	});

	test('multi selection with a connection and object shows combined count', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: {
				objectIds: ['e1'],
				connectionIds: ['c1'],
				layerNames: []
			}
		};
		const { container, cleanup } = await renderPanel(workspace);
		const header = Array.from(
			container.querySelectorAll('.isostate-inspector-section')
		).find((section) => section.textContent?.includes('Selected'));
		expect(header?.textContent).toBe('2 Selected');
		cleanup();
	});

	test('camera section (general mode) creates an element-target camera', async () => {
		const workspace = makeWorkspace();
		const { container, getWorkspace, cleanup } = await renderPanel(workspace, {
			mode: 'general'
		});
		await chooseSelectOption(findRowByLabel(container, 'Target'), 'Element');
		const camera = getWorkspace().document?.scenes[0].camera;
		expect(camera?.target).toEqual({ element: 'e1' });
		cleanup();
	});

	test('camera section creates an area-target camera and edits X/Y/width/height', async () => {
		const workspace = makeWorkspace();
		const { container, getWorkspace, cleanup } = await renderPanel(workspace, {
			mode: 'general'
		});
		await chooseSelectOption(findRowByLabel(container, 'Target'), 'Area');
		let camera = getWorkspace().document?.scenes[0].camera;
		expect(camera?.target).toEqual({ area: { at: [0, 0], size: [1, 1] } });

		setInputValue(numberInput(findRowByLabel(container, 'X')), '2');
		camera = getWorkspace().document?.scenes[0].camera;
		expect(camera?.target).toEqual({ area: { at: [2, 0], size: [1, 1] } });

		setInputValue(numberInput(findRowByLabel(container, 'Y')), '3');
		camera = getWorkspace().document?.scenes[0].camera;
		expect(camera?.target).toEqual({ area: { at: [2, 3], size: [1, 1] } });

		setInputValue(numberInput(findRowByLabel(container, 'Width')), '4');
		camera = getWorkspace().document?.scenes[0].camera;
		expect(camera?.target).toEqual({ area: { at: [2, 3], size: [4, 1] } });

		setInputValue(numberInput(findRowByLabel(container, 'Height')), '5');
		camera = getWorkspace().document?.scenes[0].camera;
		expect(camera?.target).toEqual({ area: { at: [2, 3], size: [4, 5] } });

		cleanup();
	});

	test('camera section creates a reset-target camera and hides padding controls', async () => {
		const workspace = makeWorkspace();
		const { container, getWorkspace, cleanup } = await renderPanel(workspace, {
			mode: 'general'
		});
		await chooseSelectOption(findRowByLabel(container, 'Target'), 'Reset');
		const camera = getWorkspace().document?.scenes[0].camera;
		expect(camera?.target).toEqual({ reset: true });
		expect(findRowByLabel(container, 'Padding')).toBeUndefined();
		cleanup();
	});

	test('camera section edits element target, padding, duration and easing on an existing camera', async () => {
		const workspace = makeWorkspaceFrom(CAMERA_ELEMENT_YAML);
		const { container, getWorkspace, cleanup } = await renderPanel(workspace, {
			mode: 'general'
		});

		const elementRow = findRowByLabel(container, 'Element');
		await chooseSelectOption(elementRow, 'e2');
		expect(getWorkspace().document?.scenes[0].camera?.target).toEqual({
			element: 'e2'
		});

		setInputValue(numberInput(findRowByLabel(container, 'Padding')), '64');
		expect(getWorkspace().document?.scenes[0].camera?.padding).toBe(64);

		setInputValue(numberInput(findRowByLabel(container, 'Duration')), '750');
		expect(getWorkspace().document?.scenes[0].camera?.duration).toBe(750);

		await chooseSelectOption(
			findRowByLabel(container, 'Easing'),
			'ease-in-out'
		);
		expect(getWorkspace().document?.scenes[0].camera?.easing).toBe(
			'ease-in-out'
		);

		cleanup();
	});

	test('camera section clears the camera via the Clear Camera button', async () => {
		const workspace = makeWorkspaceFrom(CAMERA_YAML);
		const { container, getWorkspace, cleanup } = await renderPanel(workspace, {
			mode: 'general'
		});
		const clearButton = Array.from(container.querySelectorAll('button')).find(
			(candidate) => candidate.textContent === 'Clear Camera'
		) as HTMLButtonElement;
		expect(clearButton).toBeTruthy();
		clearButton.click();
		expect(getWorkspace().document?.scenes[0].camera).toBeUndefined();
		cleanup();
	});

	test('general mode shows scene id, element and connection counts read-only', async () => {
		const workspace = makeWorkspace();
		const { container, cleanup } = await renderPanel(workspace, {
			mode: 'general'
		});
		const sceneIdRow = findRowByLabel(container, 'Scene ID');
		const input = sceneIdRow?.querySelector('input') as HTMLInputElement;
		expect(input.readOnly).toBe(true);
		expect(input.value).toBe('scene-1');
		const elementsRow = findRowByLabel(container, 'Elements');
		expect(elementsRow?.textContent).toContain('2');
		const connectionsRow = findRowByLabel(container, 'Connections');
		expect(connectionsRow?.textContent).toContain('1');
		cleanup();
	});

	test('EditableIdInput commits the new id when Enter is pressed', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: ['e1'], connectionIds: [], layerNames: [] }
		};
		const { container, getWorkspace, cleanup } = await renderPanel(workspace);
		const input = container.querySelector(
			'input[aria-label="Rename element e1"]'
		) as HTMLInputElement;

		input.focus();
		setInputValue(input, 'renamed-via-enter');
		input.dispatchEvent(
			new (
				window as unknown as { KeyboardEvent: typeof KeyboardEvent }
			).KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
		);
		await new Promise((r) => setTimeout(r, 10));
		expect(getWorkspace().document?.scenes[0].elements?.[0].id).toBe(
			'renamed-via-enter'
		);
		expect(getWorkspace().selection.objectIds).toEqual(['renamed-via-enter']);

		cleanup();
	});

	test('EditableIdInput pressing Escape without edits does not dispatch a command', async () => {
		const workspace = {
			...makeWorkspace(),
			selection: { objectIds: ['e1'], connectionIds: [], layerNames: [] }
		};
		let commandCount = 0;
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		root.render(
			createElement(InspectorPanel, {
				workspace,
				onCommand: () => {
					commandCount++;
				}
			})
		);
		await new Promise((r) => setTimeout(r, 10));
		const input = container.querySelector(
			'input[aria-label="Rename element e1"]'
		) as HTMLInputElement;
		input.focus();
		input.dispatchEvent(
			new (
				window as unknown as { KeyboardEvent: typeof KeyboardEvent }
			).KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
		);
		expect(commandCount).toBe(0);
		root.unmount();
		container.remove();
	});
});
