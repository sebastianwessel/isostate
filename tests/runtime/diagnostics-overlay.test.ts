import { beforeEach, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import {
	attachDiagnosticsOverlay,
	mountScene
} from '../../packages/core/src/index';
import type { RuntimeBundle } from '../../packages/core/src/types/index.ts';

describe('attachDiagnosticsOverlay', () => {
	beforeEach(() => {
		installDomShim();
	});

	test('renders one [data-iso-diagnostics] group as the last SVG child with grid, anchors, and routes matching fixture counts', () => {
		const mounted = mountConnectedScene(createConnectorBundle());

		attachDiagnosticsOverlay(mounted);

		const svg = mounted.svg as unknown as TestElement;
		const groups = svg.querySelectorAll('[data-iso-diagnostics]');
		expect(groups.length).toBe(1);
		expect(svg.children[svg.children.length - 1]).toBe(groups[0]);

		const group = groups[0];
		// Floor is 2x2 cells: 3 vertical + 3 horizontal grid lines.
		expect(group.querySelectorAll('path').length).toBe(6);
		// One fixture element with presence !== 'removed'.
		expect(group.querySelectorAll('circle').length).toBe(1);
		// One fixture connector with a 2-point route.
		expect(group.querySelectorAll('rect').length).toBe(2);
	});

	test('coordinates: true adds intersection labels; defaults omit them', () => {
		const mounted = mountConnectedScene(createBundle());

		const withoutCoordinates = attachDiagnosticsOverlay(mounted);
		const svg = mounted.svg as unknown as TestElement;
		let group = svg.querySelector('[data-iso-diagnostics]') as TestElement;
		// Readout is the only <text>; no coordinate labels.
		expect(group.querySelectorAll('text').length).toBe(1);
		withoutCoordinates.destroy();

		attachDiagnosticsOverlay(mounted, { coordinates: true });
		group = svg.querySelector('[data-iso-diagnostics]') as TestElement;
		// Floor is 2x2 cells: 3x3 = 9 intersections, plus the readout text.
		expect(group.querySelectorAll('text').length).toBe(10);
	});

	test('readout shows scene id and progress with a controller; progress-change re-renders it', async () => {
		const mounted = mountConnectedScene(createBundle(), {
			controller: { transitionDuration: 0 }
		});

		attachDiagnosticsOverlay(mounted);
		const svg = mounted.svg as unknown as TestElement;
		const group = svg.querySelector('[data-iso-diagnostics]') as TestElement;
		const readoutBefore = lastText(group);
		expect(readoutBefore).toBe('scene start · progress 0');

		mounted.controller?.setProgress(1);
		await nextFrame();

		const readoutAfter = lastText(group);
		expect(readoutAfter).toBe('scene end · progress 1');
		mounted.destroy();
	});

	test('update() re-renders without a controller', () => {
		const mounted = mountConnectedScene(createBundle());
		const handle = attachDiagnosticsOverlay(mounted);
		const svg = mounted.svg as unknown as TestElement;
		const group = svg.querySelector('[data-iso-diagnostics]') as TestElement;

		expect(lastText(group)).toBe('progress 0');

		mounted.engine.setProgress(0.5);
		// No controller subscription: the DOM does not change on its own.
		expect(lastText(group)).toBe('progress 0');

		handle.update();
		expect(lastText(group)).toBe('progress 0.5');
	});

	test('second attach replaces the first: only one group present, and the first handle becomes a no-op', () => {
		const mounted = mountConnectedScene(createBundle());
		const first = attachDiagnosticsOverlay(mounted, { coordinates: true });
		const svg = mounted.svg as unknown as TestElement;
		const firstGroup = svg.querySelector('[data-iso-diagnostics]');

		const second = attachDiagnosticsOverlay(mounted);

		const groups = svg.querySelectorAll('[data-iso-diagnostics]');
		expect(groups.length).toBe(1);
		expect(groups[0]).not.toBe(firstGroup);

		// The first handle's update()/destroy() are now no-ops.
		const groupBefore = svg.querySelector('[data-iso-diagnostics]');
		first.update();
		expect(svg.querySelector('[data-iso-diagnostics]')).toBe(groupBefore);
		first.destroy();
		expect(svg.querySelectorAll('[data-iso-diagnostics]').length).toBe(1);

		second.destroy();
	});

	test('destroy() removes the group and stops re-rendering', async () => {
		const mounted = mountConnectedScene(createBundle(), {
			controller: { transitionDuration: 0 }
		});
		const handle = attachDiagnosticsOverlay(mounted);
		const svg = mounted.svg as unknown as TestElement;

		handle.destroy();
		expect(svg.querySelector('[data-iso-diagnostics]')).toBeNull();

		mounted.controller?.setProgress(1);
		await nextFrame();
		expect(svg.querySelector('[data-iso-diagnostics]')).toBeNull();

		// Safe to call twice.
		expect(() => handle.destroy()).not.toThrow();
		mounted.destroy();
	});

	test('attach on a destroyed mount throws MOUNT_DESTROYED', () => {
		const mounted = mountConnectedScene(createBundle());
		mounted.destroy();

		try {
			attachDiagnosticsOverlay(mounted);
			throw new Error('Expected attachDiagnosticsOverlay to throw');
		} catch (error) {
			expect((error as { code?: string }).code).toBe('MOUNT_DESTROYED');
		}
	});

	test('overlay elements never carry data-id', () => {
		const mounted = mountConnectedScene(createConnectorBundle());
		attachDiagnosticsOverlay(mounted, { coordinates: true });

		const svg = mounted.svg as unknown as TestElement;
		const group = svg.querySelector('[data-iso-diagnostics]') as TestElement;

		for (const node of group.querySelectorAll('*')) {
			expect(node.getAttribute('data-id')).toBeNull();
		}
		expect(group.getAttribute('data-id')).toBeNull();
	});

	test('mounted.destroy() removes the overlay implicitly', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const mounted = mountScene(target, createBundle());
		attachDiagnosticsOverlay(mounted);

		mounted.destroy();

		// The overlay group lives inside the SVG, so removing the SVG from the
		// document removes the group with it — no separate cleanup is needed.
		expect(target.querySelector('[data-iso-diagnostics]')).toBeNull();
		expect(target.querySelector('svg')).toBeNull();
	});
});

function lastText(group: TestElement): string | undefined {
	const texts = group.querySelectorAll('text');
	return texts[texts.length - 1]?.textContent;
}

function mountConnectedScene(
	bundle: RuntimeBundle,
	options: Parameters<typeof mountScene>[2] = {}
) {
	const target = document.createElement('div');
	document.body.appendChild(target);
	return mountScene(target, bundle, options);
}

function createBundle(options: { version?: string } = {}): RuntimeBundle {
	return withDigest({
		_format: 'isostate-runtime-bundle',
		_version: options.version ?? '0.4.0',
		_digest: '',
		grid: { cellSize: 72 },
		floor: { size: [2, 2], origin: [0, 0], visible: true, layer: 'base' },
		layout: {
			fit: 'contain',
			align: [0.5, 0.5],
			padding: { x: 18, y: 12 },
			bounds: 'union'
		},
		theme: 'light',
		themeVars: { '--color-top': '#f8fafc' },
		layers: [{ name: 'base', order: 0 }],
		assets: {
			block: {
				category: 'building',
				url: './assets/block.svg'
			}
		},
		scenes: [
			{
				id: 'start',
				progress: 0,
				connectors: [],
				elements: [
					{
						id: 'block-1',
						asset: 'block',
						layer: 'base',
						pos: [0, 0],
						size: 1,
						presence: 'present'
					}
				]
			},
			{
				id: 'end',
				progress: 1,
				connectors: [],
				elements: [
					{
						id: 'block-1',
						asset: 'block',
						layer: 'base',
						pos: [2, 0],
						size: 1,
						presence: 'present'
					}
				]
			}
		]
	});
}

function createConnectorBundle(): RuntimeBundle {
	return withDigest({
		...createBundle(),
		scenes: [
			{
				id: 'start',
				progress: 0,
				elements: [
					{
						id: 'block-1',
						asset: 'block',
						layer: 'base',
						pos: [0, 0],
						size: 1,
						presence: 'present'
					},
					{
						id: 'badge',
						asset: 'block',
						layer: 'base',
						pos: [1, 1],
						size: 1,
						presence: 'removed'
					}
				],
				connectors: [
					{
						id: 'request-flow',
						route: [
							[0, 0],
							[1, 0]
						],
						layer: 'base',
						presence: 'present',
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
						end: 'arrow',
						direction: 'route',
						ambient: []
					}
				]
			},
			{
				id: 'end',
				progress: 1,
				elements: [
					{
						id: 'block-1',
						asset: 'block',
						layer: 'base',
						pos: [0, 0],
						size: 1,
						presence: 'present'
					},
					{
						id: 'badge',
						asset: 'block',
						layer: 'base',
						pos: [1, 1],
						size: 1,
						presence: 'removed'
					}
				],
				connectors: [
					{
						id: 'request-flow',
						route: [
							[0, 2],
							[1, 2]
						],
						layer: 'base',
						presence: 'present',
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
						end: 'arrow',
						direction: 'route',
						ambient: []
					}
				]
			}
		]
	});
}

function nextFrame(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function withDigest(bundle: RuntimeBundle): RuntimeBundle {
	const { _digest, ...unsigned } = bundle;
	return {
		...bundle,
		_digest: createHash('sha256')
			.update(JSON.stringify(normalizeValue(unsigned)))
			.digest('hex')
	};
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function normalizeValue<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((item) =>
			item === undefined ? null : normalizeValue(item)
		) as T;
	}

	if (!value || typeof value !== 'object') return value;

	const normalized: Record<string, JsonValue> = {};
	for (const key of Object.keys(value).sort()) {
		const child = (value as Record<string, unknown>)[key];
		if (child !== undefined) {
			normalized[key] = normalizeValue(child) as JsonValue;
		}
	}

	return normalized as T;
}

// ── DOM shim (mount-scene pattern, extended with isConnected for destroy checks) ─

function installDomShim(): void {
	const documentShim = new TestDocument();
	const body = documentShim.createElement('body');
	documentShim.body = body;
	body.parentNode = documentShim.documentElement;
	body.parentElement = documentShim.documentElement;
	documentShim.documentElement.children.push(body);

	Object.assign(globalThis, {
		document: documentShim,
		window: {
			addEventListener: () => undefined,
			removeEventListener: () => undefined
		},
		requestAnimationFrame: (callback: FrameRequestCallback) =>
			setTimeout(() => callback(performance.now()), 0) as unknown as number,
		cancelAnimationFrame: (id: number) => clearTimeout(id)
	});
}

class TestDocument {
	documentElement = new TestElement('html', null);
	body!: TestElement;

	createElement(localName: string): TestElement {
		return new TestElement(localName, null);
	}

	createElementNS(namespaceURI: string, localName: string): TestElement {
		return new TestElement(localName, namespaceURI);
	}

	importNode(node: TestElement, deep = false): TestElement {
		return node.cloneNode(deep);
	}

	addEventListener(): void {}

	removeEventListener(): void {}
}

class TestClassList {
	private values = new Set<string>();

	add(...names: string[]): void {
		for (const name of names) this.values.add(name);
	}

	remove(...names: string[]): void {
		for (const name of names) this.values.delete(name);
	}

	contains(name: string): boolean {
		return this.values.has(name);
	}

	toString(): string {
		return [...this.values].join(' ');
	}
}

class TestElement {
	readonly children: TestElement[] = [];
	readonly attributes: Array<{ name: string; value: string }> = [];
	readonly classList = new TestClassList();
	readonly style = new TestStyle();
	private listeners = new Map<string, EventListener[]>();
	parentNode: TestElement | null = null;
	parentElement: TestElement | null = null;
	textContent = '';

	constructor(
		readonly localName: string,
		readonly namespaceURI: string | null
	) {}

	/**
	 * Real-DOM-faithful connectivity: a node is connected when walking its
	 * `parentNode` chain reaches the shim document's root (`documentElement`),
	 * mirroring `Node.isConnected`.
	 */
	get isConnected(): boolean {
		let node: TestElement | null = this;
		while (node) {
			if (
				node ===
				(globalThis.document as unknown as TestDocument).documentElement
			) {
				return true;
			}
			node = node.parentNode;
		}
		return false;
	}

	get firstChild(): TestElement | null {
		return this.children[0] ?? null;
	}

	get childNodes(): TestElement[] {
		return this.children;
	}

	appendChild<T extends TestElement>(child: T): T {
		child.parentNode?.removeChild(child);
		child.parentNode = this;
		child.parentElement = this;
		this.children.push(child);
		return child;
	}

	insertBefore<T extends TestElement>(child: T, before: TestElement): T {
		child.parentNode?.removeChild(child);
		child.parentNode = this;
		child.parentElement = this;
		const index = this.children.indexOf(before);
		if (index === -1) {
			this.children.push(child);
		} else {
			this.children.splice(index, 0, child);
		}
		return child;
	}

	removeChild<T extends TestElement>(child: T): T {
		const index = this.children.indexOf(child);
		if (index >= 0) this.children.splice(index, 1);
		child.parentNode = null;
		child.parentElement = null;
		return child;
	}

	setAttribute(name: string, value: string): void {
		const existing = this.attributes.find((attr) => attr.name === name);
		if (existing) {
			existing.value = value;
		} else {
			this.attributes.push({ name, value });
		}
	}

	setAttributeNS(_namespace: string, name: string, value: string): void {
		this.setAttribute(name, value);
	}

	getAttribute(name: string): string | null {
		return this.attributes.find((attr) => attr.name === name)?.value ?? null;
	}

	querySelector(selector: string): TestElement | null {
		return this.querySelectorAll(selector)[0] ?? null;
	}

	querySelectorAll(selector: string): TestElement[] {
		const matches: TestElement[] = [];
		const visit = (node: TestElement): void => {
			for (const child of node.children) {
				if (matchesSelector(child, selector)) matches.push(child);
				visit(child);
			}
		};
		visit(this);
		return matches;
	}

	cloneNode(deep = false): TestElement {
		const clone = new TestElement(this.localName, this.namespaceURI);
		for (const attr of this.attributes)
			clone.setAttribute(attr.name, attr.value);
		clone.textContent = this.textContent;
		if (deep) {
			for (const child of this.children)
				clone.appendChild(child.cloneNode(true));
		}
		return clone;
	}

	addEventListener(type: string, listener: EventListener): void {
		this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
	}

	removeEventListener(type: string, listener: EventListener): void {
		this.listeners.set(
			type,
			(this.listeners.get(type) ?? []).filter((item) => item !== listener)
		);
	}

	dispatchEvent(event: Event): boolean {
		for (const listener of this.listeners.get(event.type) ?? []) {
			listener.call(this, event);
		}
		return true;
	}

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
}

class TestStyle {
	private properties = new Map<string, string>();
	width = '';
	height = '';
	display = '';
	transform = '';
	pointerEvents = '';
	opacity = '';
	animation = '';
	visibility = '';
	animationPlayState = '';

	setProperty(name: string, value: string): void {
		this.properties.set(name, value);
	}

	getPropertyValue(name: string): string {
		return this.properties.get(name) ?? '';
	}
}

function matchesSelector(node: TestElement, selector: string): boolean {
	if (selector === '*') return true;
	if (selector === node.localName) return true;
	if (selector === 'parsererror') return node.localName === 'parsererror';
	if (selector.startsWith('[class*="')) {
		const fragment = selector.slice(9, -2);
		return node.classList.toString().includes(fragment);
	}
	if (selector.startsWith('[') && selector.endsWith(']')) {
		const inner = selector.slice(1, -1);
		const [name, value] = inner.split('=');
		if (value === undefined) {
			return node.getAttribute(name) !== null;
		}
		return node.getAttribute(name) === value.replaceAll('"', '');
	}
	return false;
}
