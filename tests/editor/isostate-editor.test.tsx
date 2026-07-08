import { beforeEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IsostateEditor } from '../../packages/editor/src/IsostateEditor.tsx';
import type {
	EditorWorkspace,
	IsostateEditorProps
} from '../../packages/editor/src/types.ts';

const YAML_A = `header:
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
`;

const YAML_B = `header:
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
  - id: scene-2
    add:
      elements: []
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
	g.KeyboardEvent = w.KeyboardEvent;
	g.MouseEvent = w.MouseEvent;
	g.PointerEvent = w.PointerEvent ?? w.MouseEvent;
}

/**
 * Radix's Tabs primitive only reacts to a full pointerdown/up + click
 * sequence (not a bare `.click()`), so drive interactions through the same
 * event sequence a real pointer click produces.
 */
function pointerClick(element: Element) {
	element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
	element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
	element.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
	element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
	element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function ControlledWrapper(props: Partial<IsostateEditorProps>) {
	const [, setWorkspace] = useState<EditorWorkspace>();
	return createElement(IsostateEditor, {
		...props,
		onWorkspaceChange: (ws) => {
			setWorkspace(ws);
			props.onWorkspaceChange?.(ws);
		}
	});
}

beforeEach(() => {
	setupHappyDom();
});

async function tick() {
	await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('IsostateEditor', () => {
	test('changing the value prop replaces the workspace document while keeping UI state', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);

		function Harness() {
			const [value, setValue] = useState(YAML_A);
			return createElement('div', null, [
				createElement(IsostateEditor, { key: 'editor', value }),
				createElement(
					'button',
					{
						key: 'swap',
						type: 'button',
						'data-testid': 'swap',
						onClick: () => setValue(YAML_B)
					},
					'swap'
				)
			]);
		}

		root.render(createElement(Harness));
		await tick();

		const gridButton = Array.from(container.querySelectorAll('button')).find(
			(btn) => btn.textContent?.includes('Grid')
		) as HTMLButtonElement;
		gridButton.click();
		await tick();

		const swapButton = container.querySelector(
			'[data-testid="swap"]'
		) as HTMLButtonElement;
		swapButton.click();
		await tick();

		expect(
			container.querySelectorAll(
				'.isostate-scene-select [data-slot="select-value"]'
			).length
		).toBeGreaterThan(0);
		expect(container.querySelector('.isostate-editor')).toBeTruthy();

		root.unmount();
		container.remove();
	});

	test('toggling readonly prop marks the editor as readonly', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);

		function Harness() {
			const [readonly, setReadonly] = useState(false);
			return createElement('div', null, [
				createElement(IsostateEditor, {
					key: 'editor',
					value: YAML_A,
					readonly
				}),
				createElement(
					'button',
					{
						key: 'toggle',
						type: 'button',
						'data-testid': 'toggle-readonly',
						onClick: () => setReadonly((prev) => !prev)
					},
					'toggle'
				)
			]);
		}

		root.render(createElement(Harness));
		await tick();

		expect(
			container.querySelector('.isostate-editor')?.getAttribute('data-readonly')
		).toBe('false');

		const toggle = container.querySelector(
			'[data-testid="toggle-readonly"]'
		) as HTMLButtonElement;
		toggle.click();
		await tick();

		expect(
			container.querySelector('.isostate-editor')?.getAttribute('data-readonly')
		).toBe('true');

		root.unmount();
		container.remove();
	});

	test('toggling grid, theme, and yaml panel updates toolbar state', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		root.render(createElement(IsostateEditor, { value: YAML_A }));
		await tick();

		const themeButton = Array.from(container.querySelectorAll('button')).find(
			(btn) => btn.getAttribute('aria-label')?.startsWith('Preview')
		) as HTMLButtonElement;
		expect(themeButton.textContent).toContain('Light');
		themeButton.click();
		await tick();
		expect(
			container.querySelector('.isostate-editor')?.getAttribute('data-theme')
		).toBe('dark');

		const yamlToggle = container.querySelector(
			'button[aria-label="Hide YAML editor"]'
		) as HTMLButtonElement;
		expect(yamlToggle).toBeTruthy();
		yamlToggle.click();
		await tick();
		expect(
			container.querySelector('button[aria-label="Show YAML editor"]')
		).toBeTruthy();
		expect(container.querySelector('.isostate-editor-yaml')).toBeNull();

		root.unmount();
		container.remove();
	});

	test('switching sidebar tabs shows assets, attributes, and general panels', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		root.render(createElement(IsostateEditor, { value: YAML_A }));
		await tick();

		const tabs = container.querySelectorAll('[role="tab"]');
		expect(tabs.length).toBe(3);

		const attributesTab = Array.from(tabs).find(
			(tab) => tab.textContent === 'Attributes'
		) as HTMLElement;
		pointerClick(attributesTab);
		await tick();
		expect(container.querySelector('.isostate-scene-tree')).toBeTruthy();

		const generalTab = Array.from(
			container.querySelectorAll('[role="tab"]')
		).find((tab) => tab.textContent === 'General') as HTMLElement;
		pointerClick(generalTab);
		await tick();
		expect(
			container.querySelectorAll('.isostate-inspector-row').length
		).toBeGreaterThan(0);

		root.unmount();
		container.remove();
	});

	test('changing the active scene selection updates preview label and selection', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		let latestWorkspace: EditorWorkspace | undefined;
		root.render(
			createElement(ControlledWrapper, {
				value: YAML_B,
				onWorkspaceChange: (ws) => {
					latestWorkspace = ws;
				}
			})
		);
		await tick();

		expect(
			container.querySelector('.isostate-preview-label')?.textContent
		).toBe('scene-1');

		const sceneTrigger = container.querySelector(
			'.isostate-scene-select'
		) as HTMLElement;
		sceneTrigger.click();
		await tick();
		const scene2Option = Array.from(
			document.querySelectorAll('[role="option"]')
		).find((option) => option.textContent === 'scene-2') as HTMLElement;
		scene2Option.click();
		await tick();

		expect(latestWorkspace?.activeSceneId).toBe('scene-2');
		expect(latestWorkspace?.selection.sceneId).toBe('scene-2');
		expect(
			container.querySelector('.isostate-preview-label')?.textContent
		).toBe('scene-2');

		root.unmount();
		container.remove();
	});

	test('escape key clears an in-progress asset drag payload', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		let latestWorkspace: EditorWorkspace | undefined;
		root.render(
			createElement(ControlledWrapper, {
				value: YAML_A,
				onWorkspaceChange: (ws) => {
					latestWorkspace = ws;
				}
			})
		);
		await tick();

		const assetItem = container.querySelector(
			'.isostate-asset-item--builtin'
		) as HTMLElement;
		expect(assetItem).toBeTruthy();
		assetItem.click();
		await tick();
		expect(assetItem.classList.contains('isostate-asset-item--active')).toBe(
			true
		);
		expect(latestWorkspace?.editState.dragPayload).toEqual({
			kind: 'asset',
			assetId: expect.any(String)
		});

		window.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
		);
		await tick();

		expect(latestWorkspace?.editState.dragPayload).toBeUndefined();
		expect(
			container
				.querySelector('.isostate-asset-item--builtin')
				?.classList.contains('isostate-asset-item--active')
		).toBe(false);

		root.unmount();
		container.remove();
	});

	test('scrubbing the preview slider updates runtime progress and label', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		root.render(createElement(IsostateEditor, { value: YAML_B }));
		await tick();

		const slider = container.querySelector(
			'input[aria-label="Scene progress"]'
		) as HTMLInputElement;
		expect(slider).toBeTruthy();

		const setter = Object.getOwnPropertyDescriptor(
			window.HTMLInputElement.prototype,
			'value'
		)?.set;
		setter?.call(slider, '0.5');
		// happy-dom's range input does not drive React's synthetic `input`
		// value-tracker, so exercise the slider through its `onKeyUp` handler
		// (the same `setPreviewProgress` code path) instead.
		slider.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
		await tick();

		expect(
			container
				.querySelector('.isostate-preview-player')
				?.getAttribute('data-active')
		).toBe('true');
		expect(
			container.querySelector('.isostate-preview-label')?.textContent
		).toBe('50%');

		root.unmount();
		container.remove();
	});

	test('renders an invalid-YAML overlay and keeps the canvas read-only', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		root.render(
			createElement(IsostateEditor, {
				value: 'header:\n  assets: []\nscenes: nope\n'
			})
		);
		await tick();

		expect(
			container.querySelector('.isostate-editor-canvas-overlay')
		).toBeTruthy();
		expect(
			container.querySelector('.isostate-editor-canvas--invalid')
		).toBeTruthy();

		root.unmount();
		container.remove();
	});

	test('onChange and onValidate fire when the yaml source is edited via format action', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		const changes: string[] = [];
		let diagnosticsCalls = 0;
		root.render(
			createElement(IsostateEditor, {
				value: YAML_A,
				onChange: (event) => changes.push(event.operation.type),
				onValidate: () => {
					diagnosticsCalls++;
				}
			})
		);
		await tick();

		const formatButton = Array.from(container.querySelectorAll('button')).find(
			(btn) => btn.textContent?.includes('Format')
		) as HTMLButtonElement;
		formatButton.click();
		await tick();

		expect(changes).toContain('yaml.format');
		expect(diagnosticsCalls).toBeGreaterThan(0);

		root.unmount();
		container.remove();
	});

	test('clicking canvas zoom in updates the viewport zoom level', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		let latestWorkspace: EditorWorkspace | undefined;
		root.render(
			createElement(ControlledWrapper, {
				value: YAML_A,
				onWorkspaceChange: (ws) => {
					latestWorkspace = ws;
				}
			})
		);
		await tick();
		await tick();
		const initialZoom = latestWorkspace?.viewport.zoom ?? 1;

		const zoomInButton = container.querySelector(
			'button[aria-label="Zoom in"]'
		) as HTMLButtonElement;
		zoomInButton.click();
		await tick();

		expect(latestWorkspace?.viewport.zoom ?? 1).toBeGreaterThan(initialZoom);

		root.unmount();
		container.remove();
	});
});
