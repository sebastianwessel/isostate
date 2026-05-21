import { beforeEach, describe, expect, test } from 'bun:test';
import {
	buildSceneDOM,
	getResolvedViewBox
} from '../../packages/core/src/rendering/rendering-engine.ts';
import type { RuntimeBundle } from '../../packages/core/src/types/index.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

class MiniElement {
	childNodes: MiniElement[] = [];
	parentElement: MiniElement | null = null;
	attributes: { id: string; value: string }[] = [];
	style: Record<string, string | ((id: string, value: string) => void)> = {
		setProperty(id: string, value: string): void {
			this[name] = value;
		}
	};
	classList = {
		add: (...names: string[]) => {
			const current = new Set(
				(this.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
			);
			for (const name of names) current.add(name);
			this.setAttribute('class', [...current].join(' '));
		},
		remove: (...names: string[]) => {
			const current = new Set(
				(this.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
			);
			for (const name of names) current.delete(name);
			this.setAttribute('class', [...current].join(' '));
		}
	};
	textContent = '';

	constructor(
		public localName: string,
		public namespaceURI: string | null = SVG_NS
	) {}

	get firstChild(): MiniElement | null {
		return this.childNodes[0] ?? null;
	}

	setAttribute(name: string, value: string): void {
		const existing = this.attributes.find((attr) => attr.name === name);
		if (existing) existing.value = value;
		else this.attributes.push({ name, value });
	}

	setAttributeNS(_namespace: string, name: string, value: string): void {
		this.setAttribute(name, value);
	}

	getAttribute(name: string): string | null {
		return this.attributes.find((attr) => attr.name === name)?.value ?? null;
	}

	appendChild<T extends MiniElement>(node: T): T {
		node.parentElement = this;
		this.childNodes.push(node);
		return node;
	}

	insertBefore<T extends MiniElement>(node: T, before: MiniElement): T {
		node.parentElement = this;
		const index = this.childNodes.indexOf(before);
		this.childNodes.splice(index < 0 ? this.childNodes.length : index, 0, node);
		return node;
	}

	removeChild<T extends MiniElement>(node: T): T {
		this.childNodes = this.childNodes.filter((child) => child !== node);
		node.parentElement = null;
		return node;
	}

	addEventListener(): void {}

	getBoundingClientRect(): DOMRect {
		return {
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			top: 0,
			right: 0,
			bottom: 0,
			left: 0,
			toJSON: () => ({})
		} as DOMRect;
	}

	querySelector(selector: string): MiniElement | null {
		return this.querySelectorAll(selector)[0] ?? null;
	}

	querySelectorAll(selector: string): MiniElement[] {
		const matches: MiniElement[] = [];
		const visit = (node: MiniElement): void => {
			for (const child of node.childNodes) {
				if (matchesSelector(child, selector)) matches.push(child);
				visit(child);
			}
		};
		visit(this);
		return matches;
	}

	cloneNode(deep = false): MiniElement {
		const clone = new MiniElement(this.localName, this.namespaceURI);
		for (const attr of this.attributes)
			clone.setAttribute(attr.name, attr.value);
		clone.textContent = this.textContent;
		if (deep) {
			for (const child of this.childNodes)
				clone.appendChild(child.cloneNode(true));
		}
		return clone;
	}
}

class MiniDocument {
	documentElement: MiniElement | null = null;

	createElementNS(namespace: string, localName: string): MiniElement {
		return new MiniElement(localName, namespace);
	}

	importNode<T extends MiniElement>(node: T, deep = false): T {
		return node.cloneNode(deep) as T;
	}

	querySelector(selector: string): MiniElement | null {
		return this.documentElement?.querySelector(selector) ?? null;
	}
}

beforeEach(() => {
	(globalThis as unknown as { document: MiniDocument }).document =
		new MiniDocument();
});

describe('rendering engine', () => {
	test('renders URL assets as image nodes and hides unlabeled root from accessibility tree', () => {
		const container = new MiniElement('div', null) as unknown as HTMLElement;
		const bundle = createBundle({
			className: 'demo-surface custom-hook',
			assets: {
				'server-rack': { url: './assets/server-rack.svg' }
			},
			scenes: [sceneStop([{ id: 'rack-a', asset: 'server-rack' }])]
		});

		const svg = buildSceneDOM(container, bundle);
		const element = svg.querySelector('[data-id="rack-a"]');

		expect(svg.getAttribute('aria-hidden')).toBe('true');
		expect(svg.getAttribute('role')).toBeNull();
		expect(svg.getAttribute('width')).toBe('100%');
		expect(svg.getAttribute('height')).toBe('100%');
		expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
		expect(svg.getAttribute('class')).toContain('iso-scene');
		expect(svg.getAttribute('class')).toContain('demo-surface');
		expect(svg.getAttribute('class')).toContain('custom-hook');
		expect(element?.querySelector('image')?.getAttribute('href')).toBe(
			'./assets/server-rack.svg'
		);
		expect(element?.getAttribute('data-asset')).toBe('server-rack');
		expect(element?.localName).toBe('g');
		expect(element?.getAttribute('transform')).toContain('translate(');
	});

	test('preserves placement transform while applying entry animation', () => {
		const container = new MiniElement('div', null) as unknown as HTMLElement;
		const bundle = createBundle({
			assets: {
				block: { url: './assets/block.svg' }
			},
			scenes: [
				sceneStop([
					{ id: 'block-a', asset: 'block', enter: 'rise-from-ground' }
				])
			]
		});

		const svg = buildSceneDOM(container, bundle);
		const element = svg.querySelector('[data-id="block-a"]');

		expect(element?.style.animation).toContain('iso-anim-rise-from-ground');
		expect(element?.getAttribute('transform')).toContain('translate(');
	});

	test('hides elements removed in the first compiled scene stop on initial render', () => {
		const container = new MiniElement('div', null) as unknown as HTMLElement;
		const bundle = createBundle({
			assets: {
				block: { url: './assets/block.svg' }
			},
			scenes: [
				sceneStop([{ id: 'block-a', asset: 'block', presence: 'removed' }])
			]
		});

		const svg = buildSceneDOM(container, bundle);
		const element = svg.querySelector('[data-id="block-a"]');

		expect(element?.style.visibility).toBe('hidden');
		expect(element?.style.pointerEvents).toBe('none');
	});

	test('renders browser-loaded URL assets as image nodes', () => {
		const container = new MiniElement('div', null) as unknown as HTMLElement;
		const bundle = createBundle({
			assets: {
				icon: { url: './assets/icon.svg' }
			},
			scenes: [sceneStop([{ id: 'icon-a', asset: 'icon' }])]
		});

		const svg = buildSceneDOM(container, bundle);
		const element = svg.querySelector('[data-id="icon-a"]');
		const image = element?.querySelector('image');

		expect(element?.localName).toBe('g');
		expect(element?.getAttribute('transform')).toContain('translate(');
		expect(image?.getAttribute('href')).toBe('./assets/icon.svg');
		expect(image?.getAttribute('x')).toBe('-32');
		expect(image?.getAttribute('y')).toBe('-64');
		expect(image?.getAttribute('width')).toBe('64');
		expect(image?.getAttribute('height')).toBe('64');
		expect(image?.getAttribute('preserveAspectRatio')).toBe('xMidYMax meet');
	});

	test('uses compiled asset anchors when positioning image viewports', () => {
		const container = new MiniElement('div', null) as unknown as HTMLElement;
		const bundle = createBundle({
			assets: {
				gateway: { url: './assets/gateway.svg', anchor: [0.125, 1] }
			},
			scenes: [sceneStop([{ id: 'gateway-a', asset: 'gateway' }])]
		});

		const svg = buildSceneDOM(container, bundle);
		const element = svg.querySelector('[data-id="gateway-a"]');
		const image = element?.querySelector('image');

		expect(image?.getAttribute('x')).toBe('-8');
		expect(image?.getAttribute('y')).toBe('-64');
	});

	test('uses compiled asset anchors when resolving content bounds', () => {
		const container = new MiniElement('div', null) as unknown as HTMLElement;
		const bundle = createBundle({
			floor: { size: [1, 1], origin: [0, 0], visible: false, layer: 'main' },
			layout: {
				fit: 'contain',
				align: [0.5, 0.5],
				padding: { x: 0, y: 0 },
				bounds: 'content'
			},
			assets: {
				gateway: { url: './assets/gateway.svg', anchor: [0, 1] }
			},
			scenes: [sceneStop([{ id: 'gateway-a', asset: 'gateway' }])]
		});

		const svg = buildSceneDOM(container, bundle);
		const element = svg.querySelector('[data-id="gateway-a"]');

		expect(element?.getAttribute('transform')).toBe('translate(0 64) scale(1)');
	});

	test('renders built-in text assets as safe multiline svg text', () => {
		const container = new MiniElement('div', null) as unknown as HTMLElement;
		const bundle = createBundle({
			assets: undefined,
			scenes: [
				sceneStop([
					{
						id: 'gateway-label',
						asset: 'text',
						text: {
							value: 'Authentication\nGateway',
							align: 'middle',
							fontSize: 12,
							fontWeight: 700,
							lineHeight: 1.2,
							fill: '#111111'
						}
					}
				])
			]
		});

		const svg = buildSceneDOM(container, bundle);
		const element = svg.querySelector('[data-id="gateway-label"]');
		const text = element?.querySelector('text');
		const lines = text?.querySelectorAll('tspan') ?? [];

		expect(element?.getAttribute('data-asset')).toBe('text');
		expect(text?.getAttribute('text-anchor')).toBe('middle');
		expect(text?.getAttribute('font-size')).toBe('12');
		expect(text?.getAttribute('font-weight')).toBe('700');
		expect(text?.getAttribute('fill')).toBe('#111111');
		expect(lines.map((line) => line.textContent)).toEqual([
			'Authentication',
			'Gateway'
		]);
		expect(lines[1]?.getAttribute('dy')).toBe('14.399999999999999');
	});

	test('rejects unsafe URL assets before assigning image href', () => {
		const container = new MiniElement('div', null) as unknown as HTMLElement;
		const bundle = createBundle({
			assets: {
				icon: { url: 'javascript:alert(1)' }
			},
			scenes: [sceneStop([{ id: 'icon-a', asset: 'icon' }])]
		});

		expect(() => buildSceneDOM(container, bundle)).toThrow();
	});

	test('orders elements globally by perspective depth and then id', () => {
		const container = new MiniElement('div', null) as unknown as HTMLElement;
		const bundle = createBundle({
			layers: [
				{ name: 'main', order: 0 },
				{ name: 'later', order: 1 }
			],
			assets: {
				block: { url: './assets/block.svg' }
			},
			scenes: [
				sceneStop([
					{ id: 'z-last', asset: 'block', pos: [1, 0] },
					{ id: 'a-first', asset: 'block', pos: [0, 1], layer: 'later' },
					{ id: 'front', asset: 'block', pos: [0, 0] }
				])
			]
		});

		const svg = buildSceneDOM(container, bundle);
		const layer = svg.querySelector('.iso-depth-layer');
		const ids = layer?.childNodes.map((node) => node.getAttribute('data-id'));

		expect(ids).toEqual(['front', 'a-first', 'z-last']);
	});

	test('renders a generated floor grid when floor is visible', () => {
		const container = new MiniElement('div', null) as unknown as HTMLElement;
		const bundle = createBundle({
			assets: {
				block: { url: './assets/block.svg' }
			},
			scenes: [sceneStop([{ id: 'block-a', asset: 'block' }])]
		});

		const svg = buildSceneDOM(container, bundle);
		const floor = svg.querySelector('.iso-floor-grid');

		expect(floor?.querySelector('.iso-floor-slab')?.localName).toBe('polygon');
		expect(floor?.querySelectorAll('line').length).toBeGreaterThan(0);
	});

	test('uses labeled image accessibility when a label is configured', () => {
		const container = new MiniElement('div', null) as unknown as HTMLElement;
		const bundle = createBundle({
			assets: {
				block: { url: './assets/block.svg' }
			},
			scenes: [sceneStop([{ id: 'block-a', asset: 'block' }])]
		});

		const svg = buildSceneDOM(container, bundle, {
			label: 'Deployment topology'
		});

		expect(svg.getAttribute('role')).toBe('img');
		expect(svg.getAttribute('aria-label')).toBe('Deployment topology');
		expect(svg.getAttribute('aria-hidden')).toBeNull();
	});

	test('includes reduced-motion CSS defaults', () => {
		const container = new MiniElement('div', null) as unknown as HTMLElement;
		const bundle = createBundle({
			assets: {
				block: { url: './assets/block.svg' }
			},
			scenes: [sceneStop([{ id: 'block-a', asset: 'block' }])]
		});

		const svg = buildSceneDOM(container, bundle);
		const style = svg.querySelector('style');

		expect(style?.textContent).toContain('prefers-reduced-motion: reduce');
		expect(style?.textContent).toContain('animation-duration:1ms');
	});

	test('computes a tight fit-to-container viewBox from compiled union bounds', () => {
		const container = new MiniElement('div', null) as unknown as HTMLElement;
		const bundle = createBundle({
			floor: { size: [1, 1], origin: [0, 0], visible: true, layer: 'main' },
			layout: {
				fit: 'contain',
				align: [0.5, 0.5],
				padding: { x: 10, y: 12 },
				bounds: 'union'
			},
			assets: {
				block: { url: './assets/block.svg' }
			},
			scenes: [
				sceneStop([{ id: 'block-a', asset: 'block', pos: [0, 0], size: 1 }]),
				sceneStop([{ id: 'block-a', asset: 'block', pos: [2, 0], size: 1 }], 1)
			]
		});

		const svg = buildSceneDOM(container, bundle);

		expect(svg.getAttribute('viewBox')).toBe('0 0 148 120');
		expect(svg.getAttribute('viewBox')).not.toContain('800');
		expect(svg.getAttribute('viewBox')).not.toContain('600');
	});

	test('renders line connectors after floor and before objects with stable hooks', () => {
		const container = new MiniElement('div', null) as unknown as HTMLElement;
		const bundle = createBundle({
			assets: {
				block: { url: './assets/block.svg' }
			},
			scenes: [
				sceneStop([{ id: 'block-a', asset: 'block' }], 0, [
					connector({
						id: 'request-flow',
						route: [
							[0, 0],
							[2, 0],
							[2, 1]
						],
						layer: 'main',
						style: {
							variant: 'line',
							pattern: 'dashed',
							stroke: '#ef4444',
							strokeWidth: 4,
							opacity: 0.75,
							dash: [12, 8],
							outlineWidth: 0,
							lane: 'none'
						},
						end: 'arrow',
						direction: 'reverse',
						ambient: [{ name: 'flow' }]
					})
				])
			]
		});

		const svg = buildSceneDOM(container, bundle);
		const group = svg.querySelector('.iso-connector-request-flow');
		const shaft = group?.querySelector('.iso-connector-shaft');
		const end = group?.querySelector('.iso-connector-end');
		const rootChildren = svg.childNodes;

		expect(group?.localName).toBe('g');
		expect(group?.getAttribute('class')).toContain('iso-connector');
		expect(group?.getAttribute('class')).toContain(
			'iso-connector-variant-line'
		);
		expect(group?.getAttribute('class')).toContain(
			'iso-connector-pattern-dashed'
		);
		expect(group?.getAttribute('class')).toContain(
			'iso-connector-direction-reverse'
		);
		expect(group?.getAttribute('class')).toContain('iso-layer-main');
		expect(group?.getAttribute('data-id')).toBe('request-flow');
		expect(group?.getAttribute('data-layer')).toBe('main');
		expect(shaft?.getAttribute('d')).toMatch(/^M [^L]+ L /);
		expect(shaft?.getAttribute('stroke')).toBe('#ef4444');
		expect(shaft?.getAttribute('stroke-width')).toBe('4');
		expect(shaft?.getAttribute('stroke-dasharray')).toBe('12 8');
		expect(shaft?.getAttribute('class')).toContain('iso-ambient-flow');
		expect(shaft?.getAttribute('marker-end')).toBeNull();
		expect(end?.localName).toBe('polygon');

		const floor = svg.querySelector('.iso-floor-grid');
		const depthLayer = svg.querySelector('.iso-depth-layer');
		expect(floor).toBeDefined();
		expect(group).toBeDefined();
		expect(depthLayer).toBeDefined();
		if (!floor || !group || !depthLayer) {
			throw new Error('Expected floor, connector, and depth groups');
		}
		const floorIndex = rootChildren.indexOf(floor);
		const connectorIndex = rootChildren.indexOf(group);
		const depthIndex = rootChildren.indexOf(depthLayer);
		expect(floorIndex).toBeLessThan(connectorIndex);
		expect(connectorIndex).toBeLessThan(depthIndex);
	});

	test('renders dashed and dotted routes as a single fixed dash shaft path', () => {
		const container = new MiniElement('div', null) as unknown as HTMLElement;
		const bundle = createBundle({
			scenes: [
				sceneStop([], 0, [
					connector({
						id: 'dashed-flow',
						style: {
							variant: 'line',
							pattern: 'dashed',
							stroke: '#2563eb',
							strokeWidth: 3,
							opacity: 1,
							dash: [12, 8],
							outlineWidth: 0,
							lane: 'none'
						},
						start: 'none',
						end: 'none'
					}),
					connector({
						id: 'dotted-flow',
						style: {
							variant: 'line',
							pattern: 'dotted',
							stroke: '#2563eb',
							strokeWidth: 3,
							opacity: 1,
							dash: [0, 8],
							outlineWidth: 0,
							lane: 'none'
						},
						start: 'none',
						end: 'none'
					})
				])
			]
		});

		const svg = buildSceneDOM(container, bundle);
		const dashed = svg.querySelector('.iso-connector-dashed-flow');
		const dotted = svg.querySelector('.iso-connector-dotted-flow');

		expect(dashed?.querySelectorAll('.iso-connector-shaft').length).toBe(1);
		expect(dotted?.querySelectorAll('.iso-connector-shaft').length).toBe(1);
		expect(
			dashed
				?.querySelector('.iso-connector-shaft')
				?.getAttribute('stroke-dasharray')
		).toBe('12 8');
		expect(
			dotted
				?.querySelector('.iso-connector-shaft')
				?.getAttribute('stroke-dasharray')
		).toBe('0 8');
	});

	test('renders road connector outline body and center lane paths', () => {
		const container = new MiniElement('div', null) as unknown as HTMLElement;
		const bundle = createBundle({
			scenes: [
				sceneStop([], 0, [
					connector({
						id: 'service-road',
						style: {
							variant: 'road',
							pattern: 'solid',
							stroke: '#334155',
							strokeWidth: 14,
							opacity: 1,
							outline: '#ffffff',
							outlineWidth: 2,
							lane: 'center-dashed'
						},
						start: 'bar',
						end: 'dot'
					})
				])
			]
		});

		const svg = buildSceneDOM(container, bundle);
		const group = svg.querySelector('.iso-connector-service-road');

		expect(group?.getAttribute('class')).toContain(
			'iso-connector-variant-road'
		);
		expect(group?.querySelector('.iso-connector-outline')?.localName).toBe(
			'path'
		);
		expect(group?.querySelector('.iso-connector-shaft')?.localName).toBe(
			'path'
		);
		expect(group?.querySelector('.iso-connector-lane')?.localName).toBe('path');
		expect(
			group
				?.querySelector('.iso-connector-lane')
				?.getAttribute('stroke-dasharray')
		).toBe('8 8');
		expect(group?.querySelector('.iso-connector-start')?.localName).toBe(
			'line'
		);
		expect(group?.querySelector('.iso-connector-end')?.localName).toBe(
			'circle'
		);
	});

	test('expands the viewBox to include connector routes outside floor bounds', () => {
		const bundle = createBundle({
			floor: { size: [1, 1], origin: [0, 0], visible: true, layer: 'main' },
			layout: {
				fit: 'contain',
				align: [0.5, 0.5],
				padding: { x: 10, y: 10 },
				bounds: 'union'
			},
			scenes: [
				sceneStop([], 0, [
					connector({
						id: 'external-flow',
						route: [
							[0, 0],
							[8, 0]
						],
						end: 'arrow'
					})
				])
			]
		});

		expect(getResolvedViewBox(bundle).width).toBeGreaterThan(260);
	});
});

type ElementInput = {
	id: string;
	asset: string;
	pos?: [number, number];
	size?: number;
	layer?: string;
	presence?: 'present' | 'entering' | 'exiting' | 'removed';
	enter?: RuntimeBundle['scenes'][number]['elements'][number]['enter'];
	text?: RuntimeBundle['scenes'][number]['elements'][number]['text'];
};

type ConnectorInput = Partial<
	RuntimeBundle['scenes'][number]['connectors'][number]
>;

function sceneStop(
	elements: ElementInput[],
	progress = 0,
	connectors: ConnectorInput[] = []
): RuntimeBundle['scenes'][number] {
	return {
		id: `scene-${progress}`,
		progress,
		connectors: connectors.map((input) => connector(input)),
		elements: elements.map((element) => ({
			pos: [0, 0],
			size: 1,
			layer: 'main',
			presence: 'present',
			...element
		}))
	};
}

function connector(
	overrides: ConnectorInput = {}
): RuntimeBundle['scenes'][number]['connectors'][number] {
	return {
		id: 'request-flow',
		route: [
			[0, 0],
			[2, 0],
			[2, 1]
		],
		layer: 'main',
		presence: 'present',
		style: {
			variant: 'line',
			pattern: 'solid',
			stroke: '#2563eb',
			strokeWidth: 3,
			opacity: 1,
			outlineWidth: 0,
			lane: 'none'
		},
		start: 'none',
		end: 'arrow',
		direction: 'route',
		...overrides
	};
}

function createBundle(overrides: Record<string, unknown>): RuntimeBundle {
	const assets = normalizeTestAssets(overrides.assets);
	return {
		_format: 'isostate-runtime-bundle',
		_version: '0.1.0',
		_digest: '',
		grid: { cellSize: 64 },
		floor: { size: [4, 4], origin: [0, 0], visible: true, layer: 'main' },
		layout: {
			fit: 'contain',
			align: [0.5, 0.5],
			padding: { x: 16, y: 16 },
			bounds: 'union'
		},
		theme: 'default',
		layers: [{ name: 'main', order: 0 }],
		scenes: [],
		...overrides,
		assets
	} as unknown as RuntimeBundle;
}

function normalizeTestAssets(
	raw: unknown
): Record<string, { url: string; anchor?: [number, number] }> {
	if (!raw || typeof raw !== 'object') return {};
	const assets: Record<string, { url: string; anchor?: [number, number] }> = {};
	for (const [id, value] of Object.entries(raw)) {
		if (value && typeof value === 'object' && 'url' in value) {
			const asset = value as { url: unknown; anchor?: [number, number] };
			assets[id] = {
				url: String(asset.url),
				...(asset.anchor ? { anchor: asset.anchor } : {})
			};
		} else {
			assets[id] = { url: `./assets/${id}.svg` };
		}
	}
	return assets;
}

function matchesSelector(node: MiniElement, selector: string): boolean {
	if (selector === '*') return true;
	if (selector.startsWith('[') && selector.endsWith(']')) {
		const [name, value] = selector.slice(1, -1).split('=');
		return node.getAttribute(name) === value?.replaceAll('"', '');
	}
	if (selector.startsWith('.')) {
		return (node.getAttribute('class') ?? '')
			.split(/\s+/)
			.includes(selector.slice(1));
	}
	return node.localName === selector;
}
