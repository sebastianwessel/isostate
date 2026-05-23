import { beforeEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { AssetPanel } from '../../packages/editor/src/assets/AssetPanel.tsx';
import { createEditorWorkspace } from '../../packages/editor/src/workspace.ts';

const BASE_YAML = `header:
  version: "1"
  layers:
    - name: default
scenes:
  - id: scene-1
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
}

beforeEach(() => {
	setupHappyDom();
});

describe('AssetPanel', () => {
	test('renders preview artwork for built-in assets', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = createEditorWorkspace({ sourceYaml: BASE_YAML });
		const root = createRoot(container);

		root.render(
			createElement(AssetPanel, {
				workspace
			})
		);

		await new Promise((r) => setTimeout(r, 10));

		const builtInItems = Array.from(
			container.querySelectorAll('.isostate-asset-item--builtin')
		);
		expect(builtInItems).toHaveLength(5);
		expect(builtInItems.map((item) => item.getAttribute('title'))).toEqual([
			'text',
			'rectangle',
			'circle',
			'polygon',
			'line'
		]);
		for (const item of builtInItems) {
			expect(
				item.querySelector('.isostate-asset-thumb--builtin svg')
			).toBeTruthy();
		}

		root.unmount();
		container.remove();
	});
});
