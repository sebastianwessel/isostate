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
	const w = new Window({ url: 'https://editor.test/' });
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
	test('orders manifest categories alphabetically and opens the first only', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = createEditorWorkspace({ sourceYaml: BASE_YAML });
		const root = createRoot(container);
		const g = globalThis as unknown as {
			fetch: (url: string) => Promise<Response>;
		};
		g.fetch = async (url) => {
			const isAlpha = url.endsWith('/alpha.json');
			return new Response(
				JSON.stringify({
					format: 'isostate.asset-manifest',
					version: 1,
					assetBaseUrl: isAlpha ? '/alpha-assets' : '/zebra-assets',
					assets: [
						isAlpha
							? {
									id: 'alpha-car',
									path: 'alpha.svg',
									group: 'Alpha',
									name: 'alpha',
									digest: 'sha256:alpha'
								}
							: {
									id: 'zebra-car',
									path: 'zebra.svg',
									group: 'Zebra',
									name: 'zebra',
									digest: 'sha256:zebra'
								}
					]
				}),
				{ status: 200 }
			);
		};

		root.render(
			createElement(AssetPanel, {
				workspace,
				assetManifestUrls: ['/zebra.json', '/alpha.json']
			})
		);

		await waitFor(() => container.querySelector('[title="alpha-car"]'));

		const groups = Array.from(
			container.querySelectorAll('.isostate-asset-group-title')
		) as HTMLButtonElement[];
		expect(groups.map((group) => group.textContent?.trim())).toEqual([
			'▾Alpha1',
			'▸Zebra1'
		]);
		expect(container.querySelector('[title="alpha-car"]')).toBeTruthy();
		expect(container.querySelector('[title="zebra-car"]')).toBeNull();
		expect(
			container.querySelector('[title="alpha-car"] img')?.getAttribute('src')
		).toBe('https://editor.test/alpha-assets/alpha.svg');

		groups[1].click();
		await waitFor(() => container.querySelector('[title="zebra-car"]'));
		expect(container.querySelector('[title="zebra-car"]')).toBeTruthy();
		expect(
			container.querySelector('[title="zebra-car"] img')?.getAttribute('src')
		).toBe('https://editor.test/zebra-assets/zebra.svg');

		root.unmount();
		container.remove();
	});

	test('renders sprite manifest entries as cropped logical asset previews', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const workspace = createEditorWorkspace({ sourceYaml: BASE_YAML });
		const root = createRoot(container);
		const g = globalThis as unknown as {
			fetch: (url: string) => Promise<Response>;
		};
		g.fetch = async () =>
			new Response(
				JSON.stringify({
					format: 'isostate.asset-manifest',
					version: 1,
					assetBaseUrl: '/assets',
					assets: [
						{
							id: 'traffic-sheet',
							type: 'sprite-sheet',
							path: 'traffic.png',
							group: 'traffic',
							name: 'traffic',
							digest: 'sha256:abc',
							sheetSize: [128, 64],
							tileSize: [32, 32],
							sprites: {
								car: [1, 0],
								bus: { rect: [64, 0, 64, 32] }
							}
						}
					]
				}),
				{ status: 200 }
			);

		root.render(
			createElement(AssetPanel, {
				workspace,
				assetManifestUrl: '/manifest.json'
			})
		);

		await waitFor(() => container.querySelector('[title="car"]'));

		const car = container
			.querySelector('[title="car"]')
			?.querySelector(
				'.isostate-asset-sprite-window img'
			) as HTMLImageElement | null;
		const bus = container
			.querySelector('[title="bus"]')
			?.querySelector(
				'.isostate-asset-sprite-window img'
			) as HTMLImageElement | null;
		expect(car).toBeTruthy();
		expect(bus).toBeTruthy();
		expect(car?.style.width).toBe('400%');
		expect(car?.style.height).toBe('200%');
		expect(car?.style.transform).toBe('translate(-25%, 0%)');
		expect(bus?.style.width).toBe('200%');
		expect(bus?.style.transform).toBe('translate(-50%, 0%)');

		root.unmount();
		container.remove();
	});

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

async function waitFor(predicate: () => unknown): Promise<void> {
	for (let attempt = 0; attempt < 20; attempt++) {
		if (predicate()) return;
		await new Promise((r) => setTimeout(r, 10));
	}
}
