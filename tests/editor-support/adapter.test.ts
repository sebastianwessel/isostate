import { beforeEach, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { createEditorRuntimeAdapter } from '../../packages/core/src/editor-support/adapter.ts';
import { mountScene } from '../../packages/core/src/index';
import type { RuntimeBundle } from '../../packages/core/src/types/index.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

describe('editor-support adapter', () => {
	beforeEach(() => {
		installDomShim();
	});

	test('createEditorRuntimeAdapter wraps a mounted scene', () => {
		const target = document.createElement('div');
		const bundle = createBundle();
		const mounted = mountScene(target, bundle);
		const adapter = createEditorRuntimeAdapter(mounted);

		expect(adapter.mounted).toBe(mounted);
		expect(adapter.getLayerOrder()).toEqual([{ name: 'base', order: 0 }]);
		expect(adapter.getResolvedViewBox()).toEqual({
			minX: 0,
			minY: 0,
			width: expect.any(Number),
			height: expect.any(Number),
		});

		mounted.destroy();
	});

	test('getObjects returns current frame metadata', () => {
		const target = document.createElement('div');
		const bundle = createBundle();
		const mounted = mountScene(target, bundle);
		const adapter = createEditorRuntimeAdapter(mounted);

		const objects = adapter.getObjects('start');
		expect(objects.length).toBe(1);
		expect(objects[0]?.id).toBe('block-1');
		expect(objects[0]?.kind).toBe('element');
		expect(objects[0]?.present).toBe(true);
		expect(objects[0]?.grid).toEqual({ kind: 'element', at: [0, 0], size: 1 });

		mounted.destroy();
	});

	test('getObjects returns empty array for non-current scene', () => {
		const target = document.createElement('div');
		const bundle = createBundle();
		const mounted = mountScene(target, bundle);
		const adapter = createEditorRuntimeAdapter(mounted);

		expect(adapter.getObjects('nonexistent')).toEqual([]);
		mounted.destroy();
	});

	test('getObject returns metadata by id', () => {
		const target = document.createElement('div');
		const bundle = createBundle();
		const mounted = mountScene(target, bundle);
		const adapter = createEditorRuntimeAdapter(mounted);

		const obj = adapter.getObject('block-1');
		expect(obj).toBeDefined();
		expect(obj?.id).toBe('block-1');
		expect(obj?.kind).toBe('element');
		expect(obj?.present).toBe(true);

		mounted.destroy();
	});

	test('getObject returns undefined for unknown id', () => {
		const target = document.createElement('div');
		const bundle = createBundle();
		const mounted = mountScene(target, bundle);
		const adapter = createEditorRuntimeAdapter(mounted);

		expect(adapter.getObject('missing')).toBeUndefined();
		mounted.destroy();
	});

	test('geometry helpers delegate through the adapter', () => {
		const target = document.createElement('div');
		const bundle = createBundle();
		const mounted = mountScene(target, bundle);
		const adapter = createEditorRuntimeAdapter(mounted);

		const projected = adapter.projectGridPoint([0, 0]);
		expect(Number.isFinite(projected.x)).toBe(true);
		expect(Number.isFinite(projected.y)).toBe(true);

		const recovered = adapter.unprojectScreenPoint(projected);
		expect(recovered[0]).toBeCloseTo(0, 10);
		expect(recovered[1]).toBeCloseTo(0, 10);

		const polygon = adapter.getGridCellPolygon([0, 0]);
		expect(polygon.length).toBe(4);

		mounted.destroy();
	});

	test('getSelectionBounds returns union of visible objects', () => {
		const target = document.createElement('div');
		const bundle = createBundle();
		const mounted = mountScene(target, bundle);
		const adapter = createEditorRuntimeAdapter(mounted);

		const bounds = adapter.getSelectionBounds(['block-1']);
		expect(bounds).toBeDefined();
		expect(bounds?.width).toBeGreaterThan(0);
		expect(bounds?.height).toBeGreaterThan(0);

		mounted.destroy();
	});

	test('getSelectionBounds returns undefined for empty or missing ids', () => {
		const target = document.createElement('div');
		const bundle = createBundle();
		const mounted = mountScene(target, bundle);
		const adapter = createEditorRuntimeAdapter(mounted);

		expect(adapter.getSelectionBounds([])).toBeUndefined();
		expect(adapter.getSelectionBounds(['missing'])).toBeUndefined();

		mounted.destroy();
	});

	test('destroy does not break subsequent adapter calls', () => {
		const target = document.createElement('div');
		const bundle = createBundle();
		const mounted = mountScene(target, bundle);
		const adapter = createEditorRuntimeAdapter(mounted);

		adapter.destroy();
		// After adapter destroy, the mounted scene should still be usable
		expect(adapter.getLayerOrder().length).toBe(1);

		mounted.destroy();
	});
});

function createBundle(): RuntimeBundle {
	return withDigest({
		_format: 'isostate-runtime-bundle',
		_version: '0.1.2',
		_digest: '',
		grid: { cellSize: 72 },
		floor: { size: [2, 2], origin: [0, 0], visible: true, layer: 'base' },
		layout: {
			fit: 'contain',
			align: [0.5, 0.5],
			padding: { x: 18, y: 12 },
			bounds: 'union',
		},
		theme: 'light',
		themeVars: { '--color-top': '#f8fafc' },
		layers: [{ name: 'base', order: 0 }],
		assets: {
			block: {
				category: 'building',
				url: './assets/block.svg',
			},
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
						presence: 'present',
					},
				],
			},
		],
	});
}

function withDigest(bundle: RuntimeBundle): RuntimeBundle {
	const { _digest, ...unsigned } = bundle;
	return {
		...bundle,
		_digest: createHash('sha256')
			.update(JSON.stringify(normalizeValue(unsigned)))
			.digest('hex'),
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

function installDomShim(): void {
	const documentShim = new TestDocument();
	Object.assign(globalThis, {
		document: documentShim,
		window: {
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
		},
		requestAnimationFrame: (callback: FrameRequestCallback) =>
			setTimeout(() => callback(performance.now()), 0) as unknown as number,
		cancelAnimationFrame: (id: number) => clearTimeout(id),
	});
}

class TestDocument {
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

	get firstChild(): TestElement | null {
		return this.children[0] ?? null;
	}

	appendChild<T extends TestElement>(child: T): T {
		child.parentNode = this;
		child.parentElement = this;
		this.children.push(child);
		return child;
	}

	insertBefore<T extends TestElement>(child: T, before: TestElement): T {
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
			toJSON: () => ({}),
		} as DOMRect;
	}

	createSVGPoint(): { x: number; y: number; matrixTransform: (m: DOMMatrix) => { x: number; y: number } } {
		return {
			x: 0,
			y: 0,
			matrixTransform: (m: DOMMatrix) => {
				return {
					x: m.a * 0 + m.c * 0 + m.e,
					y: m.b * 0 + m.d * 0 + m.f,
				};
			},
		};
	}

	getScreenCTM(): DOMMatrix | null {
		return {
			a: 1,
			b: 0,
			c: 0,
			d: 1,
			e: 0,
			f: 0,
			inverse: () => this.getScreenCTM()!,
		} as unknown as DOMMatrix;
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
		const [name, value] = selector.slice(1, -1).split('=');
		return node.getAttribute(name) === value?.replaceAll('"', '');
	}
	return false;
}
