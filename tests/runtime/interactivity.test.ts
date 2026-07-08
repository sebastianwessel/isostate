import { beforeEach, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mountScene } from '../../packages/core/src/index';
import type { RuntimeBundle } from '../../packages/core/src/types/index.ts';

describe('interactivity', () => {
	beforeEach(() => {
		installDomShim();
	});

	test('interactive omitted: no iso-interactive class and no events after a click', () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createBundle());
		const svg = mounted.svg as unknown as TestElement;

		expect(svg.classList.contains('iso-interactive')).toBe(false);

		const clickHandler = mockListener();
		mounted.on('element-click', clickHandler.listener);

		const nodeEl = findByDataId(svg, 'block-1');
		dispatchDelegated(svg, 'click', nodeEl);

		expect(clickHandler.calls.length).toBe(0);
	});

	test('interactive: true sets the iso-interactive class on the SVG', () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createBundle(), { interactive: true });
		const svg = mounted.svg as unknown as TestElement;

		expect(svg.classList.contains('iso-interactive')).toBe(true);
	});

	test('click on a node inside an element group fires element-click with the element id', () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createBundle(), { interactive: true });
		const svg = mounted.svg as unknown as TestElement;
		const clickHandler = mockListener();
		mounted.on('element-click', clickHandler.listener);

		const nodeEl = findByDataId(svg, 'block-1');
		dispatchDelegated(svg, 'click', nodeEl);

		expect(clickHandler.calls.length).toBe(1);
		expect(clickHandler.calls[0]?.id).toBe('block-1');
		expect(clickHandler.calls[0]?.originalEvent).toBeDefined();
	});

	test('click on floor, connector, or defs fires nothing', () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createConnectorBundle(), {
			interactive: true
		});
		const svg = mounted.svg as unknown as TestElement;
		const clickHandler = mockListener();
		mounted.on('element-click', clickHandler.listener);

		const floorEl = svg.querySelector('.iso-floor-grid') as TestElement;
		expect(floorEl).toBeTruthy();
		dispatchDelegated(svg, 'click', floorEl);

		const connectorEl = findByDataId(svg, 'request-flow');
		expect(connectorEl).toBeTruthy();
		dispatchDelegated(svg, 'click', connectorEl);

		const styleEl = svg.querySelector('style') as TestElement;
		expect(styleEl).toBeTruthy();
		dispatchDelegated(svg, 'click', styleEl);

		expect(clickHandler.calls.length).toBe(0);
	});

	test('enter/leave fire once per group crossing and toggle iso-hover', () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createBundle(), { interactive: true });
		const svg = mounted.svg as unknown as TestElement;
		const enterHandler = mockListener();
		const leaveHandler = mockListener();
		mounted.on('element-enter', enterHandler.listener);
		mounted.on('element-leave', leaveHandler.listener);

		const nodeEl = findByDataId(svg, 'block-1');

		dispatchDelegated(svg, 'pointerover', nodeEl, null);
		expect(enterHandler.calls.length).toBe(1);
		expect(enterHandler.calls[0]?.id).toBe('block-1');
		expect(nodeEl.classList.contains('iso-hover')).toBe(true);

		dispatchDelegated(svg, 'pointerout', nodeEl, svg);
		expect(leaveHandler.calls.length).toBe(1);
		expect(leaveHandler.calls[0]?.id).toBe('block-1');
		expect(nodeEl.classList.contains('iso-hover')).toBe(false);
	});

	test('moving between two child nodes of the same group fires nothing', () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createBundle(), { interactive: true });
		const svg = mounted.svg as unknown as TestElement;
		const enterHandler = mockListener();
		const leaveHandler = mockListener();
		mounted.on('element-enter', enterHandler.listener);
		mounted.on('element-leave', leaveHandler.listener);

		const nodeEl = findByDataId(svg, 'block-1');
		const child = new TestElement('rect', 'http://www.w3.org/2000/svg');
		nodeEl.appendChild(child);

		dispatchDelegated(svg, 'pointerover', nodeEl, null);
		expect(enterHandler.calls.length).toBe(1);

		// Moving from the group node to its own child: both resolve to the
		// same element id, so no additional enter/leave should fire.
		dispatchDelegated(svg, 'pointerout', nodeEl, child);
		dispatchDelegated(svg, 'pointerover', child, nodeEl);

		expect(enterHandler.calls.length).toBe(1);
		expect(leaveHandler.calls.length).toBe(0);
	});

	test('hidden (removed-presence) elements fire nothing', () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createRemovedElementBundle(), {
			interactive: true
		});
		const svg = mounted.svg as unknown as TestElement;
		const clickHandler = mockListener();
		const enterHandler = mockListener();
		mounted.on('element-click', clickHandler.listener);
		mounted.on('element-enter', enterHandler.listener);

		const hiddenEl = findByDataId(svg, 'badge');
		dispatchDelegated(svg, 'click', hiddenEl);
		dispatchDelegated(svg, 'pointerover', hiddenEl, null);

		expect(clickHandler.calls.length).toBe(0);
		expect(enterHandler.calls.length).toBe(0);
	});

	test('unsubscribe function stops delivery', () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createBundle(), { interactive: true });
		const svg = mounted.svg as unknown as TestElement;
		const clickHandler = mockListener();
		const unsubscribe = mounted.on('element-click', clickHandler.listener);

		const nodeEl = findByDataId(svg, 'block-1');
		dispatchDelegated(svg, 'click', nodeEl);
		expect(clickHandler.calls.length).toBe(1);

		unsubscribe();
		dispatchDelegated(svg, 'click', nodeEl);
		expect(clickHandler.calls.length).toBe(1);
	});

	test('destroy() removes listeners', () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createBundle(), { interactive: true });
		const svg = mounted.svg as unknown as TestElement;
		const clickHandler = mockListener();
		mounted.on('element-click', clickHandler.listener);

		const nodeEl = findByDataId(svg, 'block-1');
		mounted.destroy();

		// destroy() detaches svg from target and removes delegated listeners;
		// dispatching directly against the retained svg reference must no
		// longer reach the (removed) click subscription.
		dispatchDelegated(svg, 'click', nodeEl);
		expect(clickHandler.calls.length).toBe(0);
	});

	test('on() after destroy throws MOUNT_DESTROYED', () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createBundle(), { interactive: true });

		mounted.destroy();

		expect(() => mounted.on('element-click', () => undefined)).toThrow();
		try {
			mounted.on('element-click', () => undefined);
			throw new Error('Expected on() to throw');
		} catch (error) {
			expect((error as { code?: string }).code).toBe('MOUNT_DESTROYED');
		}
	});

	test('on() is callable without interactive and never fires', () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createBundle());
		const svg = mounted.svg as unknown as TestElement;
		const clickHandler = mockListener();

		expect(() =>
			mounted.on('element-click', clickHandler.listener)
		).not.toThrow();

		const nodeEl = findByDataId(svg, 'block-1');
		dispatchDelegated(svg, 'click', nodeEl);

		expect(clickHandler.calls.length).toBe(0);
	});
});

function mockListener<T>(): {
	listener: (event: T) => void;
	calls: T[];
} {
	const calls: T[] = [];
	return {
		calls,
		listener: (event: T) => {
			calls.push(event);
		}
	};
}

function findByDataId(root: TestElement, id: string): TestElement {
	const match = root
		.querySelectorAll('*')
		.find((node) => node.getAttribute('data-id') === id);
	if (!match) throw new Error(`No node with data-id="${id}" found`);
	return match;
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

function createRemovedElementBundle(): RuntimeBundle {
	return withDigest({
		...createBundle(),
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
					},
					{
						id: 'badge',
						asset: 'block',
						layer: 'base',
						pos: [1, 0],
						size: 1,
						presence: 'removed'
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
						pos: [0, 0],
						size: 1,
						presence: 'present'
					},
					{
						id: 'badge',
						asset: 'block',
						layer: 'base',
						pos: [1, 0],
						size: 1,
						presence: 'removed'
					}
				]
			}
		]
	});
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

function installDomShim(): void {
	const documentShim = new TestDocument();
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

	toggle(name: string, force?: boolean): boolean {
		const shouldAdd = force ?? !this.values.has(name);
		if (shouldAdd) {
			this.values.add(name);
		} else {
			this.values.delete(name);
		}
		return shouldAdd;
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
	if (selector.startsWith('.')) {
		return node.classList.contains(selector.slice(1));
	}
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

/**
 * A minimal Event-like object carrying `type`, `target`, and
 * `relatedTarget` the way a real DOM `PointerEvent`/`MouseEvent` does. Real
 * `Event.target` is read-only and only assigned by the platform's dispatch
 * algorithm, so delegated delivery in tests needs its own event shape rather
 * than a real `Event` instance.
 */
class TestPointerEvent {
	constructor(
		readonly type: string,
		readonly target: TestElement,
		readonly relatedTarget: TestElement | null = null
	) {}
}

/**
 * Dispatch a delegated event the way real DOM event delegation delivers it: a
 * listener registered on an ancestor (e.g. the root SVG) receives the event
 * with `target` set to the innermost node the event originated from, reached
 * by bubbling up the `parentNode` chain from `target` through `dispatchRoot`.
 */
function dispatchDelegated(
	dispatchRoot: TestElement,
	type: string,
	target: TestElement,
	relatedTarget: TestElement | null = null
): void {
	const event = new TestPointerEvent(type, target, relatedTarget);
	let node: TestElement | null = target;
	while (node) {
		node.dispatchEvent(event as unknown as Event);
		if (node === dispatchRoot) break;
		node = node.parentNode;
	}
}
