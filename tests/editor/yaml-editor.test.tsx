import { beforeEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { createElement, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { EditorView } from '@codemirror/view';
import { IsostateEditor } from '../../packages/editor/src/IsostateEditor.tsx';
import { YamlEditor } from '../../packages/editor/src/yaml-editor/YamlEditor.tsx';
import { applyEditorCommand } from '../../packages/editor/src/commands.ts';
import { createEditorWorkspace } from '../../packages/editor/src/workspace.ts';
import type { EditorCommand, EditorWorkspace } from '../../packages/editor/src/types.ts';

const VALID_YAML = `header:
  version: "1"
  assets: []
  layers:
    - name: default
scenes:
  - id: scene-1
`;

const INVALID_YAML = `header:
  version: "1"
  assets: []
  layers:
    - name: default
scenes:
  - id: scene-1
    elements:
      - id: e1
        asset: unknown-asset
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
	g.MutationObserver = w.MutationObserver;
}

function TestWrapper({
	initialWorkspace
}: {
	initialWorkspace: EditorWorkspace;
}) {
	const [workspace, setWorkspace] = useState(initialWorkspace);
	return createElement(IsostateEditor, {
		value: workspace.sourceYaml,
		theme: 'light',
		onWorkspaceChange: (ws: EditorWorkspace) => setWorkspace(ws),
		onChange: (event: { sourceYaml: string }) => {
			setWorkspace((prev: EditorWorkspace) => ({ ...prev, sourceYaml: event.sourceYaml }));
		}
	});
}

beforeEach(() => {
	setupHappyDom();
});

describe('YamlEditor', () => {
	test('renders a CodeMirror instance', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		root.render(
			createElement(YamlEditor, {
				value: VALID_YAML,
				onChange: () => {},
				theme: 'light'
			})
		);
		await new Promise((r) => setTimeout(r, 50));
		const cmEditor = container.querySelector('.cm-editor');
		expect(cmEditor).toBeTruthy();
		root.unmount();
		container.remove();
	});

	test('renders highlighted YAML tokens', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		root.render(
			createElement(YamlEditor, {
				value: VALID_YAML,
				onChange: () => {},
				theme: 'light'
			})
		);
		await new Promise((r) => setTimeout(r, 50));

		const token = container.querySelector(
			'.cm-line span[class], .cm-line span[style]'
		);
		expect(token).toBeTruthy();

		root.unmount();
		container.remove();
	});

	test('typing emits onChange after debounce', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		let changedValue = '';
		const viewRef = { current: null as EditorView | null };
		root.render(
			createElement(YamlEditor, {
				value: VALID_YAML,
				onChange: (v: string) => {
					changedValue = v;
				},
				theme: 'light',
				__testViewRef: viewRef
			})
		);
		await new Promise((r) => setTimeout(r, 50));

		const view = viewRef.current;
		expect(view).toBeTruthy();

		view?.dispatch({
			changes: { from: view.state.doc.length, insert: '\n# added' }
		});

		// Should not have changed yet (debounce)
		expect(changedValue).toBe('');

		// Wait for debounce
		await new Promise((r) => setTimeout(r, 400));
		expect(changedValue).toContain('# added');

		root.unmount();
		container.remove();
	});

	test('external value update updates editor content', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);
		let currentValue = VALID_YAML;
		root.render(
			createElement(YamlEditor, {
				value: currentValue,
				onChange: (v: string) => {
					currentValue = v;
				},
				theme: 'light'
			})
		);
		await new Promise((r) => setTimeout(r, 50));

		const newValue = VALID_YAML + '\n# updated';
		root.render(
			createElement(YamlEditor, {
				value: newValue,
				onChange: (v: string) => {
					currentValue = v;
				},
				theme: 'light'
			})
		);
		await new Promise((r) => setTimeout(r, 50));

		const cmContent = container.querySelector('.cm-content') as HTMLElement;
		expect(cmContent.textContent).toContain('# updated');

		root.unmount();
		container.remove();
	});
});

describe('IsostateEditor YAML integration', () => {
	test('invalid YAML state disables canvas interactions', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);

		const workspace = createEditorWorkspace({ sourceYaml: INVALID_YAML });
			root.render(createElement(TestWrapper, { initialWorkspace: workspace }));
		await new Promise((r) => setTimeout(r, 50));

		const canvas = container.querySelector('.isostate-editor-canvas');
		expect(canvas?.classList.contains('isostate-editor-canvas--invalid')).toBe(true);

		const overlay = container.querySelector('.isostate-editor-canvas-overlay');
		expect(overlay).toBeTruthy();
		expect(overlay?.textContent).toContain('YAML invalid');

		root.unmount();
		container.remove();
	});

	test('format button dispatches yaml.format command', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);

		const nonCanonicalYaml = VALID_YAML.replace(
			'version: "1"',
			'version: "1"\n  className: "foo"'
		);
		let capturedWorkspace: EditorWorkspace | null = null;

		root.render(
				createElement(IsostateEditor, {
					value: nonCanonicalYaml,
					theme: 'light',
				onWorkspaceChange: (ws: EditorWorkspace) => {
					capturedWorkspace = ws;
				}
			})
		);
		await new Promise((r) => setTimeout(r, 50));

		const formatBtn = Array.from(container.querySelectorAll('button')).find(
			(b) => b.textContent === 'Format'
		);
		expect(formatBtn).toBeTruthy();
		formatBtn?.click();
		await new Promise((r) => setTimeout(r, 10));

		expect(capturedWorkspace).toBeTruthy();
		expect(capturedWorkspace?.sourceYaml).toContain('className: foo');

		root.unmount();
		container.remove();
	});

	test('editor always shows both canvas and YAML editor', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);

		const workspace = createEditorWorkspace({ sourceYaml: VALID_YAML });
			root.render(createElement(TestWrapper, { initialWorkspace: workspace }));
		await new Promise((r) => setTimeout(r, 50));

		const canvasView = container.querySelector('.isostate-editor-canvas-view');
		expect(canvasView).toBeTruthy();

		const yamlEditor = container.querySelector('.isostate-editor-yaml-editor');
		expect(yamlEditor).toBeTruthy();

		root.unmount();
		container.remove();
	});
});
