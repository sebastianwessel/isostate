import { beforeEach, describe, expect, test } from 'bun:test';
import { compileScene } from '@sebastianwessel/isostate/dsl/browser';
import { projectGridPoint } from '@sebastianwessel/isostate/editor-support';
import { Window } from 'happy-dom';
import { createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CanvasView } from '../../packages/editor/src/canvas/CanvasView.tsx';
import { snapGridCell } from '../../packages/editor/src/canvas/gridSnapping.ts';
import { applyEditorCommand } from '../../packages/editor/src/commands.ts';
import type {
	EditorCommand,
	EditorCommandResult,
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
scenes:
  - id: scene-1
    elements:
      - id: e1
        asset: block
        at: [0, 0]
        layer: default
`;

const MULTI_SCENE_YAML = `header:
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
  - id: scene-2
    update:
      elements:
        - id: e1
          at: [4, 3]
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
	g.PointerEvent = w.PointerEvent;
	g.DragEvent = w.DragEvent;

	type MatrixLike = {
		a: number;
		b: number;
		c: number;
		d: number;
		e: number;
		f: number;
	};
	const proto = w.SVGSVGElement.prototype as SVGSVGElement & {
		getScreenCTM: () => { inverse: () => MatrixLike };
		createSVGPoint: () => {
			x: number;
			y: number;
			matrixTransform(m: MatrixLike): { x: number; y: number };
		};
	};
	proto.getScreenCTM = () => ({
		inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
	});
	proto.createSVGPoint = () => ({
		x: 0,
		y: 0,
		matrixTransform(m: MatrixLike) {
			return {
				x: this.x * m.a + this.y * m.c + m.e,
				y: this.x * m.b + this.y * m.d + m.f
			};
		}
	});
}

function makeWorkspace(): EditorWorkspace {
	return createEditorWorkspace({ sourceYaml: BASE_YAML });
}

function makeMultiSceneWorkspace(): EditorWorkspace {
	return createEditorWorkspace({
		sourceYaml: MULTI_SCENE_YAML,
		activeSceneId: 'scene-2'
	});
}

function getGridPoint(workspace: EditorWorkspace, grid: [number, number]) {
	const sourceDocument = workspace.document;
	if (!sourceDocument) throw new Error('Expected valid workspace document');
	const document = {
		...sourceDocument,
		header: {
			...sourceDocument.header,
			floor: {
				...sourceDocument.header.floor,
				size: [20, 20] as [number, number],
				visible: false
			}
		}
	};
	const bundle = compileScene(document);
	return projectGridPoint(bundle, grid);
}

function createDataTransfer(initial: Record<string, string> = {}) {
	const data = new Map(Object.entries(initial));
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

function createPointerEventAt(type: string, point: { x: number; y: number }) {
	const event = new PointerEvent(type, { bubbles: true });
	Object.defineProperties(event, {
		clientX: { configurable: true, get: () => point.x },
		clientY: { configurable: true, get: () => point.y }
	});
	return event;
}

function setEventClientPoint(event: Event, point: { x: number; y: number }) {
	Object.defineProperties(event, {
		clientX: { configurable: true, get: () => point.x },
		clientY: { configurable: true, get: () => point.y }
	});
}

async function waitForCanvasRender() {
	await new Promise((r) => setTimeout(r, 80));
}

function TestWrapper({
	initialWorkspace
}: {
	initialWorkspace: EditorWorkspace;
}) {
	const [workspace, setWorkspace] = useState(initialWorkspace);
	return createElement(CanvasView, {
		workspace,
		onCommand: (cmd) => {
			const result = applyEditorCommand(workspace, cmd);
			setWorkspace(result.workspace);
		},
		onSelect: (sel) =>
			setWorkspace((prev) => ({
				...prev,
				selection: { ...prev.selection, ...sel }
			})),
		theme: 'light'
	});
}

beforeEach(() => {
	setupHappyDom();
});

describe('CanvasView', () => {
	test('mounts runtime preview when document is valid', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		root.render(
			createElement(CanvasView, {
				workspace,
				onCommand: () => {},
				theme: 'light'
			})
		);
		await waitForCanvasRender();
		expect(container.querySelector('svg')).toBeTruthy();
		root.unmount();
		container.remove();
	});

	test('syncs the mounted canvas to the active scene', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeMultiSceneWorkspace();
		const root = createRoot(container);
		root.render(
			createElement(CanvasView, {
				workspace,
				onCommand: () => {},
				theme: 'light'
			})
		);
		await waitForCanvasRender();
		const expected = getGridPoint(workspace, [5, 4]);
		const element = container.querySelector('.iso-element-e1') as SVGGElement;
		expect(element?.getAttribute('transform')).toBe(
			`translate(${expected.x} ${expected.y}) scale(1)`
		);
		root.unmount();
		container.remove();
	});

	test('resyncs the mounted canvas when the active scene changes', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeMultiSceneWorkspace();
		const root = createRoot(container);
		root.render(
			createElement(CanvasView, {
				workspace: { ...workspace, activeSceneId: 'scene-1' },
				onCommand: () => {},
				theme: 'light'
			})
		);
		await waitForCanvasRender();
		root.render(
			createElement(CanvasView, {
				workspace,
				onCommand: () => {},
				theme: 'light'
			})
		);
		await waitForCanvasRender();
		const expected = getGridPoint(workspace, [5, 4]);
		const element = container.querySelector('.iso-element-e1') as SVGGElement;
		expect(element?.getAttribute('transform')).toBe(
			`translate(${expected.x} ${expected.y}) scale(1)`
		);
		root.unmount();
		container.remove();
	});

	test('uses the runtime floor grid when showGrid is true', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		root.render(
			createElement(CanvasView, {
				workspace,
				onCommand: () => {},
				theme: 'light'
			})
		);
		await waitForCanvasRender();
		const grid = container.querySelector('.iso-floor-grid');
		expect(grid).toBeTruthy();
		expect(
			container.querySelectorAll('.isostate-editor-grid-cell')
		).toHaveLength(0);
		expect(grid?.querySelectorAll('line')).toHaveLength(42);
		root.unmount();
		container.remove();
	});

	test('grid opacity slider updates the canvas floor grid opacity', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		let nextViewport: EditorWorkspace['viewport'] | undefined;
		root.render(
			createElement(CanvasView, {
				workspace,
				onCommand: () => {},
				onViewportChange: (viewport) => {
					nextViewport = viewport;
				},
				theme: 'light'
			})
		);
		await waitForCanvasRender();
		const slider = container.querySelector(
			'.isostate-grid-opacity'
		) as HTMLInputElement;
		expect(slider.step).toBe('0.01');
		slider.value = '0.7';
		slider.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
		expect(nextViewport?.gridOpacity).toBe(0.7);
		root.unmount();
		container.remove();
	});

	test('snapGridCell can snap outside bounds for edit placement', () => {
		expect(
			snapGridCell([24.8, 25.1], { origin: [0, 0], size: [20, 20] })
		).toEqual([19, 19]);
		expect(
			snapGridCell(
				[24.8, 25.1],
				{ origin: [0, 0], size: [20, 20] },
				{ clamp: false }
			)
		).toEqual([24, 25]);
	});

	test('left-dragging empty zoomed canvas pans the viewport', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = {
			...makeWorkspace(),
			viewport: { ...makeWorkspace().viewport, zoom: 2 }
		};
		const root = createRoot(container);
		let nextViewport: EditorWorkspace['viewport'] | undefined;
		root.render(
			createElement(CanvasView, {
				workspace,
				onCommand: () => {},
				onViewportChange: (viewport) => {
					nextViewport = viewport;
				},
				theme: 'light'
			})
		);
		await waitForCanvasRender();
		const canvas = container.querySelector(
			'.isostate-editor-canvas-view'
		) as HTMLDivElement;
		Object.defineProperty(canvas, 'getBoundingClientRect', {
			value: () => ({
				x: 0,
				y: 0,
				left: 0,
				top: 0,
				right: 1000,
				bottom: 500,
				width: 1000,
				height: 500,
				toJSON() {
					return {};
				}
			})
		});
		canvas.dispatchEvent(
			createPointerEventAt('pointerdown', { x: 900, y: 10 })
		);
		canvas.dispatchEvent(
			createPointerEventAt('pointermove', { x: 800, y: 60 })
		);
		canvas.dispatchEvent(createPointerEventAt('pointerup', { x: 800, y: 60 }));

		expect(nextViewport?.pan.x).not.toBe(0);
		expect(nextViewport?.pan.y).not.toBe(0);
		expect(nextViewport?.zoom).toBe(2);

		root.unmount();
		container.remove();
	});

	test('selecting an element updates workspace selection', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		let lastSelection: EditorSelection | null = null;
		root.render(
			createElement(CanvasView, {
				workspace,
				onCommand: () => {},
				onSelect: (sel) => {
					lastSelection = { ...workspace.selection, ...sel };
				},
				theme: 'light'
			})
		);
		await waitForCanvasRender();
		const pt = getGridPoint(workspace, [0, 0]);
		const canvas = container.querySelector(
			'.isostate-editor-canvas-view'
		) as HTMLDivElement;
		canvas.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				clientX: pt.x,
				clientY: pt.y
			})
		);
		canvas.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				clientX: pt.x,
				clientY: pt.y
			})
		);
		expect(lastSelection?.objectIds).toContain('e1');
		root.unmount();
		container.remove();
	});

	test('drag-to-place dispatches object.add command', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		let lastCommand: EditorCommand | null = null;
		root.render(
			createElement(CanvasView, {
				workspace: {
					...workspace,
					editState: {
						...workspace.editState,
						dragPayload: { kind: 'asset', assetId: 'block' }
					}
				},
				onCommand: (cmd) => {
					lastCommand = cmd;
				},
				theme: 'light'
			})
		);
		await waitForCanvasRender();
		const pt = getGridPoint(workspace, [2, 2]);
		const canvas = container.querySelector(
			'.isostate-editor-canvas-view'
		) as HTMLDivElement;
		canvas.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				clientX: pt.x,
				clientY: pt.y
			})
		);
		canvas.dispatchEvent(
			new PointerEvent('pointermove', {
				bubbles: true,
				clientX: pt.x,
				clientY: pt.y
			})
		);
		canvas.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				clientX: pt.x,
				clientY: pt.y
			})
		);
		expect(lastCommand?.id).toBe('object.add');
		root.unmount();
		container.remove();
	});

	test('drop with asset dataTransfer dispatches object.add command', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		let lastCommand: EditorCommand | null = null;
		root.render(
			createElement(CanvasView, {
				workspace,
				onCommand: (cmd) => {
					lastCommand = cmd;
				},
				theme: 'light'
			})
		);
		await waitForCanvasRender();
		const pt = getGridPoint(workspace, [2, 2]);
		const canvas = container.querySelector(
			'.isostate-editor-canvas-view'
		) as HTMLDivElement;
		const event = new DragEvent('drop', { bubbles: true, cancelable: true });
		Object.defineProperties(event, {
			dataTransfer: {
				value: createDataTransfer({
					'application/x-isostate-asset': 'block'
				})
			}
		});
		setEventClientPoint(event, pt);
		canvas.dispatchEvent(event);
		expect(lastCommand?.id).toBe('object.add');
		root.unmount();
		container.remove();
	});

	test('drop with built-in asset dataTransfer creates renderable element payload', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		let result: EditorCommandResult | null = null;
		root.render(
			createElement(CanvasView, {
				workspace,
				onCommand: (cmd) => {
					result = applyEditorCommand(workspace, cmd);
				},
				theme: 'light'
			})
		);
		await waitForCanvasRender();
		const pt = getGridPoint(workspace, [2, 2]);
		const canvas = container.querySelector(
			'.isostate-editor-canvas-view'
		) as HTMLDivElement;
		const event = new DragEvent('drop', { bubbles: true, cancelable: true });
		Object.defineProperties(event, {
			dataTransfer: {
				value: createDataTransfer({
					'application/x-isostate-asset': 'text'
				})
			}
		});
		setEventClientPoint(event, pt);
		canvas.dispatchEvent(event);

		expect(result?.changed).toBe(true);
		const element = result?.workspace.document?.scenes[0].elements?.find(
			(candidate) => candidate.asset === 'text' && candidate.id !== 'e1'
		);
		expect(element?.text?.value).toBe('Text');
		const compiledDocument = result?.workspace.document;
		expect(compiledDocument).toBeDefined();
		if (!compiledDocument)
			throw new Error('Expected command to produce a document');
		expect(() => compileScene(compiledDocument)).not.toThrow();

		root.unmount();
		container.remove();
	});

	test.each([
		['rectangle', 'primitive.rectangle'],
		['circle', 'primitive.circle'],
		['polygon', 'primitive.polygon'],
		['line', 'primitive.line']
	])('drop with built-in %s asset creates a %s element', async (assetId) => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		let result: EditorCommandResult | null = null;
		root.render(
			createElement(CanvasView, {
				workspace,
				onCommand: (cmd) => {
					result = applyEditorCommand(workspace, cmd);
				},
				theme: 'light'
			})
		);
		await waitForCanvasRender();
		const pt = getGridPoint(workspace, [2, 2]);
		const canvas = container.querySelector(
			'.isostate-editor-canvas-view'
		) as HTMLDivElement;
		const event = new DragEvent('drop', { bubbles: true, cancelable: true });
		Object.defineProperties(event, {
			dataTransfer: {
				value: createDataTransfer({
					'application/x-isostate-asset': assetId
				})
			}
		});
		setEventClientPoint(event, pt);
		canvas.dispatchEvent(event);

		expect(result?.changed).toBe(true);
		const element = result?.workspace.document?.scenes[0].elements?.find(
			(candidate) => candidate.asset === assetId && candidate.id !== 'e1'
		);
		expect(element?.primitive?.[assetId as 'rectangle']).toBeDefined();
		const compiledDocument = result?.workspace.document;
		expect(compiledDocument).toBeDefined();
		if (!compiledDocument)
			throw new Error('Expected command to produce a document');
		expect(() => compileScene(compiledDocument)).not.toThrow();

		root.unmount();
		container.remove();
	});

	test('drop with an unrecognized built-in asset id creates a bare element', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		let result: EditorCommandResult | null = null;
		root.render(
			createElement(CanvasView, {
				workspace,
				onCommand: (cmd) => {
					result = applyEditorCommand(workspace, cmd);
				},
				theme: 'light'
			})
		);
		await waitForCanvasRender();
		const pt = getGridPoint(workspace, [2, 2]);
		const canvas = container.querySelector(
			'.isostate-editor-canvas-view'
		) as HTMLDivElement;
		const event = new DragEvent('drop', { bubbles: true, cancelable: true });
		Object.defineProperties(event, {
			dataTransfer: {
				value: createDataTransfer({
					'application/x-isostate-asset': 'block'
				})
			}
		});
		setEventClientPoint(event, pt);
		canvas.dispatchEvent(event);

		expect(result?.changed).toBe(true);
		const element = result?.workspace.document?.scenes[0].elements?.find(
			(candidate) => candidate.asset === 'block' && candidate.id !== 'e1'
		);
		expect(element?.text).toBeUndefined();
		expect(element?.primitive).toBeUndefined();

		root.unmount();
		container.remove();
	});

	test('drop with manifest asset dataTransfer dispatches asset.place command', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		let lastCommand: EditorCommand | null = null;
		root.render(
			createElement(CanvasView, {
				workspace,
				onCommand: (cmd) => {
					lastCommand = cmd;
				},
				theme: 'light'
			})
		);
		await waitForCanvasRender();
		const pt = getGridPoint(workspace, [4, 5]);
		const canvas = container.querySelector(
			'.isostate-editor-canvas-view'
		) as HTMLDivElement;
		const event = new DragEvent('drop', { bubbles: true, cancelable: true });
		Object.defineProperties(event, {
			dataTransfer: {
				value: createDataTransfer({
					'application/x-isostate-manifest-asset': JSON.stringify({
						entry: {
							id: 'server',
							path: 'server.svg',
							group: 'compute',
							name: 'server',
							digest: 'sha256:abc'
						},
						assetBaseUrl: '/assets'
					})
				})
			}
		});
		setEventClientPoint(event, pt);
		canvas.dispatchEvent(event);
		expect(lastCommand?.id).toBe('asset.place');
		root.unmount();
		container.remove();
	});

	test('moving an element dispatches object.update command', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		let lastCommand: EditorCommand | null = null;
		root.render(
			createElement(CanvasView, {
				workspace,
				onCommand: (cmd) => {
					lastCommand = cmd;
				},
				theme: 'light'
			})
		);
		await waitForCanvasRender();
		const start = getGridPoint(workspace, [0, 0]);
		const end = getGridPoint(workspace, [2, 2]);
		const canvas = container.querySelector(
			'.isostate-editor-canvas-view'
		) as HTMLDivElement;
		canvas.dispatchEvent(createPointerEventAt('pointerdown', start));
		canvas.dispatchEvent(createPointerEventAt('pointermove', end));
		canvas.dispatchEvent(createPointerEventAt('pointerup', end));
		expect(lastCommand?.id).toBe('object.update');
		root.unmount();
		container.remove();
	});

	test('clicking an element selects without moving it', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		let lastCommand: EditorCommand | null = null;
		let lastSelection: EditorSelection | null = null;
		root.render(
			createElement(CanvasView, {
				workspace,
				onCommand: (cmd) => {
					lastCommand = cmd;
				},
				onSelect: (sel) => {
					lastSelection = { ...workspace.selection, ...sel };
				},
				theme: 'light'
			})
		);
		await waitForCanvasRender();
		const pt = getGridPoint(workspace, [1, 1]);
		const canvas = container.querySelector(
			'.isostate-editor-canvas-view'
		) as HTMLDivElement;
		canvas.dispatchEvent(createPointerEventAt('pointerdown', pt));
		canvas.dispatchEvent(createPointerEventAt('pointerup', pt));
		expect(lastSelection?.objectIds).toContain('e1');
		expect(lastCommand).toBeNull();
		root.unmount();
		container.remove();
	});

	test('locked layer edit produces diagnostic and no mutation', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		let lastResult: EditorCommandResult | null = null;
		root.render(
			createElement(CanvasView, {
				workspace: { ...workspace, lockedLayers: ['default'] },
				onCommand: (cmd) => {
					lastResult = applyEditorCommand(workspace, cmd);
				},
				theme: 'light'
			})
		);
		await waitForCanvasRender();
		const pt = getGridPoint(workspace, [0, 0]);
		const canvas = container.querySelector(
			'.isostate-editor-canvas-view'
		) as HTMLDivElement;
		canvas.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				clientX: pt.x,
				clientY: pt.y
			})
		);
		canvas.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				clientX: pt.x,
				clientY: pt.y
			})
		);
		expect(
			lastResult?.diagnostics.some((d) => d.code === 'EDITOR_LOCKED_TARGET')
		).toBe(true);
		root.unmount();
		container.remove();
	});

	test('hidden layer toggle hides rendered layer nodes', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		root.render(
			createElement(CanvasView, {
				workspace: {
					...workspace,
					uiState: { ...workspace.uiState, hiddenLayers: ['default'] }
				},
				onCommand: () => {},
				theme: 'light'
			})
		);
		await waitForCanvasRender();

		const layerNodes = container.querySelectorAll<SVGElement>(
			'[data-layer="default"]'
		);
		expect(layerNodes.length).toBeGreaterThan(0);
		expect(
			Array.from(layerNodes).every((node) => node.style.display === 'none')
		).toBe(true);

		root.unmount();
		container.remove();
	});

	test('remount after command restores selection', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		root.render(createElement(TestWrapper, { initialWorkspace: workspace }));
		await waitForCanvasRender();
		const start = getGridPoint(workspace, [0, 0]);
		const end = getGridPoint(workspace, [2, 2]);
		const canvas = container.querySelector(
			'.isostate-editor-canvas-view'
		) as HTMLDivElement;
		canvas.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				clientX: start.x,
				clientY: start.y
			})
		);
		canvas.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				clientX: start.x,
				clientY: start.y
			})
		);
		await new Promise((r) => setTimeout(r, 10));
		let overlay = container.querySelector('.isostate-editor-selection');
		expect(overlay).toBeTruthy();

		canvas.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				clientX: start.x,
				clientY: start.y
			})
		);
		canvas.dispatchEvent(
			new PointerEvent('pointermove', {
				bubbles: true,
				clientX: end.x,
				clientY: end.y
			})
		);
		canvas.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				clientX: end.x,
				clientY: end.y
			})
		);
		await waitForCanvasRender();

		overlay = container.querySelector('.isostate-editor-selection');
		expect(overlay).toBeTruthy();
		root.unmount();
		container.remove();
	});

	test('selection overlay includes selected element grid cell', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = makeWorkspace();
		const root = createRoot(container);
		root.render(
			createElement(CanvasView, {
				workspace: {
					...workspace,
					selection: { objectIds: ['e1'], connectionIds: [], layerNames: [] }
				},
				onCommand: () => {},
				theme: 'light'
			})
		);
		await waitForCanvasRender();
		const selectedCell = container.querySelector(
			'.isostate-editor-selection-cell'
		);
		const bounds = container.querySelector('.isostate-editor-selection-bounds');
		const handles = container.querySelectorAll(
			'.isostate-editor-selection-handle'
		);
		expect(selectedCell).toBeTruthy();
		expect(bounds).toBeTruthy();
		expect(handles).toHaveLength(8);
		expect(selectedCell?.getAttribute('points')).toBe(
			[
				getGridPoint(workspace, [0, 0]),
				getGridPoint(workspace, [1, 0]),
				getGridPoint(workspace, [1, 1]),
				getGridPoint(workspace, [0, 1])
			]
				.map((p) => `${p.x},${p.y}`)
				.join(' ')
		);
		root.unmount();
		container.remove();
	});

	test('grid snapping uses the containing cell instead of the nearest intersection', () => {
		expect(snapGridCell([2.5, 2.5])).toEqual([2, 2]);
		expect(snapGridCell([2.999, 3.001])).toEqual([2, 3]);
		expect(snapGridCell([2, 2])).toEqual([2, 2]);
	});

	test('grid snapping clamps to editor grid bounds', () => {
		const bounds = { origin: [0, 0], size: [20, 20] } as const;
		expect(snapGridCell([-4.2, 3.4], bounds)).toEqual([0, 3]);
		expect(snapGridCell([30, 22], bounds)).toEqual([19, 19]);
	});
});
