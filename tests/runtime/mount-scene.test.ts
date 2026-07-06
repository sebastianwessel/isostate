import { beforeEach, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mountScene } from '../../packages/core/src/index';
import type { RuntimeBundle } from '../../packages/core/src/types/index.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

describe('mountScene', () => {
	beforeEach(() => {
		installDomShim();
	});

	test('mounts a valid runtime bundle into a target', () => {
		const target = document.createElement('div');
		const bundle = createBundle();

		const mounted = mountScene(target, bundle);

		expect(mounted.svg.localName).toBe('svg');
		expect(target.querySelector('svg')).toBe(mounted.svg);
		expect(mounted.engine.bundle?.scenes.length).toBe(2);
		expect(mounted.controller).toBeUndefined();
	});

	test('returns resolved runtime config', () => {
		const target = document.createElement('div');
		const bundle = createBundle();

		const mounted = mountScene(target, bundle);

		const config = mounted.getResolvedConfig();
		expect(config).toEqual({
			grid: { cellSize: 72 },
			floor: {
				size: [2, 2],
				origin: [0, 0],
				visible: true,
				layer: 'base'
			},
			layout: {
				fit: 'contain',
				align: [0.5, 0.5],
				padding: { x: 18, y: 12 },
				bounds: 'union'
			},
			viewBox: { minX: 0, minY: 0, width: 216, height: 132 },
			camera: {
				viewBox: { minX: 0, minY: 0, width: 216, height: 132 },
				isZoomed: false
			},
			theme: 'light',
			themeVars: config.themeVars,
			scenes: [
				{ id: 'start', progress: 0 },
				{ id: 'end', progress: 1 }
			],
			layerOrder: [{ name: 'base', order: 0 }]
		});
		expect(config.themeVars).toEqual(
			expect.objectContaining({
				'--color-top': '#f8fafc',
				'--color-accent': '#3b82f6'
			})
		);
	});

	test('breaks equal-order layerOrder ties by code-point order, not locale collation', () => {
		// 'Zone'.localeCompare('aisle') is positive under the default ICU locale,
		// while code-point order places capital letters before lowercase ones.
		// getResolvedConfig must use code-point order so layerOrder is
		// byte-deterministic regardless of host locale.
		expect('Zone'.localeCompare('aisle')).toBeGreaterThan(0);

		const target = document.createElement('div');
		const bundle = withDigest({
			...createBundle(),
			layers: [
				{ name: 'base', order: 0 },
				{ name: 'Zone', order: 1 },
				{ name: 'aisle', order: 1 }
			]
		});

		const mounted = mountScene(target, bundle);

		expect(mounted.getResolvedConfig().layerOrder).toEqual([
			{ name: 'base', order: 0 },
			{ name: 'Zone', order: 1 },
			{ name: 'aisle', order: 1 }
		]);
	});

	test('destroy cleans up owned resources', () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createBundle());

		mounted.destroy();
		mounted.destroy();

		expect(target.querySelector('svg')).toBeNull();
		expect(mounted.engine.bundle).toBeNull();
	});

	test('destroy remains safe and completes cleanup when the controller was already destroyed', () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createBundle(), { controller: {} });

		mounted.controller?.destroy();

		expect(() => mounted.destroy()).not.toThrow();
		expect(target.querySelector('svg')).toBeNull();
		expect(mounted.engine.bundle).toBeNull();
	});

	test('rejects invalid bundle format', () => {
		const bundle = createBundle();
		const invalid = { ...bundle, _format: 'wrong-format' };

		expectBundleError(
			() => mountScene(document.createElement('div'), invalid),
			{
				code: 'BUNDLE_FORMAT_MISSING'
			}
		);
	});

	test('rejects incompatible major versions', () => {
		const bundle = createBundle({ version: '1.0.0' });

		expectBundleError(() => mountScene(document.createElement('div'), bundle), {
			code: 'BUNDLE_VERSION_MISMATCH'
		});
	});

	test('rejects digest mismatches', () => {
		const bundle = createBundle();
		const invalid = { ...bundle, theme: 'dark', _digest: '0'.repeat(64) };

		expectBundleError(
			() => mountScene(document.createElement('div'), invalid),
			{
				code: 'BUNDLE_DIGEST_MISMATCH'
			}
		);
	});

	test('rejects missing digests', () => {
		const bundle = createBundle();
		const { _digest, ...invalid } = bundle;

		expectBundleError(
			() =>
				mountScene(
					document.createElement('div'),
					invalid as unknown as RuntimeBundle
				),
			{
				code: 'BUNDLE_DIGEST_MISSING'
			}
		);
	});

	test('supports explicit controller disabling', () => {
		const mounted = mountScene(document.createElement('div'), createBundle(), {
			controller: false
		});

		expect(mounted.controller).toBeUndefined();
	});

	test('initializes a controller when configured', () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createBundle(), {
			controller: {}
		});

		expect(mounted.controller).toBeDefined();
		expect(mounted.controller?.scenes.length).toBe(2);
		expect(mounted.controller?.engine).toBe(mounted.engine);
		mounted.destroy();
	});

	test('getResolvedConfig reports live camera state from the controller', () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createBundle(), {
			controller: {}
		});

		expect(mounted.getResolvedConfig().camera.isZoomed).toBe(false);

		mounted.controller?.zoomToArea(
			{ at: [0, 0], size: [1, 1] },
			{ duration: 0 }
		);
		const zoomed = mounted.getResolvedConfig().camera;
		expect(zoomed.isZoomed).toBe(true);
		expect(zoomed.target).toEqual({ type: 'area', at: [0, 0], size: [1, 1] });

		mounted.controller?.destroy();
		expect(mounted.getResolvedConfig().camera.isZoomed).toBe(false);
		mounted.destroy();
	});

	test('controller applies default entry and exit animations on lifecycle changes', async () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createLifecycleBundle(), {
			controller: { transitionDuration: 0 }
		});
		const badge = mounted.svg.querySelector('[data-id="badge"]');

		expect(badge?.style.visibility).toBe('hidden');

		mounted.controller?.setProgress(0.5);
		await nextFrame();

		expect(badge?.style.visibility).toBe('visible');
		expect(badge?.style.animation).toContain('iso-anim-fade-in');

		mounted.controller?.setProgress(1);
		await nextFrame();

		expect(badge?.style.animation).toContain('iso-anim-fade-out');
		mounted.destroy();
	});

	test('controller applies opposite lifecycle animations when scrubbing backward', async () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createLifecycleBundle(), {
			controller: { transitionDuration: 0 }
		});
		const badge = mounted.svg.querySelector('[data-id="badge"]');

		mounted.controller?.setProgress(0.5);
		await nextFrame();
		expect(badge?.style.animation).toContain('iso-anim-fade-in');

		mounted.controller?.setProgress(0);
		await nextFrame();
		expect(badge?.style.animation).toContain('iso-anim-fade-out');

		mounted.controller?.setProgress(1);
		await nextFrame();
		expect(badge?.style.animation).toContain('iso-anim-fade-out');

		mounted.controller?.setProgress(0.5);
		await nextFrame();
		expect(badge?.style.animation).toContain('iso-anim-fade-in');
		mounted.destroy();
	});

	test('controller ignores stale exit animationend after an element re-enters', async () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createLifecycleBundle(), {
			controller: { transitionDuration: 0 }
		});
		const badge = mounted.svg.querySelector(
			'[data-id="badge"]'
		) as TestElement | null;

		mounted.controller?.setProgress(0.5);
		await nextFrame();
		expect(badge?.style.visibility).toBe('visible');

		mounted.controller?.setProgress(0);
		await nextFrame();
		expect(badge?.style.animation).toContain('iso-anim-fade-out');

		mounted.controller?.setProgress(0.5);
		await nextFrame();
		expect(badge?.style.visibility).toBe('visible');
		expect(badge?.style.animation).toContain('iso-anim-fade-in');

		badge?.dispatchEvent(new Event('animationend'));

		expect(badge?.style.visibility).toBe('visible');
		mounted.destroy();
	});

	test('controller keeps hidden later elements at their authored position when scrubbing backward', async () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createLifecycleBundle(), {
			controller: { transitionDuration: 0 }
		});
		const badge = mounted.svg.querySelector('[data-id="badge"]');
		const authoredTransform = badge?.getAttribute('transform');

		mounted.controller?.setProgress(0.5);
		await nextFrame();
		mounted.controller?.setProgress(0);
		await nextFrame();

		expect(badge?.getAttribute('transform')).toBe(authoredTransform);
		expect(badge?.getAttribute('transform')).not.toBe(
			mounted.svg
				.querySelector('[data-id="block-1"]')
				?.getAttribute('transform')
		);
		mounted.destroy();
	});

	test('controller updates mounted connector routes on progress changes', async () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createConnectorBundle(), {
			controller: { transitionDuration: 0 }
		});
		const connector = mounted.svg.querySelector('[data-id="request-flow"]');
		const initialPath = connector?.querySelector('path')?.getAttribute('d');

		mounted.controller?.setProgress(0.5);
		await nextFrame();

		const updatedPath = connector?.querySelector('path')?.getAttribute('d');
		expect(updatedPath).not.toBe(initialPath);
		expect(updatedPath).toContain('M ');
		expect(updatedPath).toContain(' L ');
		mounted.destroy();
	});

	test('controller updates generated text and primitive payloads on progress changes', async () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createGeneratedContentBundle(), {
			controller: { transitionDuration: 0 }
		});
		const label = mounted.svg.querySelector('[data-id="label"]');
		const zone = mounted.svg.querySelector('[data-id="zone"]');

		expect(label?.querySelector('tspan')?.textContent).toBe('Start');
		expect(zone?.querySelector('polygon')?.getAttribute('fill')).toBe(
			'#2563eb'
		);

		mounted.controller?.setProgress(1);
		await nextFrame();

		expect(label?.querySelector('tspan')?.textContent).toBe('End');
		expect(zone?.querySelector('polygon')?.getAttribute('fill')).toBe(
			'#fbbf24'
		);
		mounted.destroy();
	});

	test('applies runtime theme overrides without mutating bundle digests', () => {
		const target = document.createElement('div');
		const mounted = mountScene(target, createBundle(), {
			themeVars: { '--color-accent': '#ff0000' }
		});

		expect(mounted.getResolvedConfig().themeVars['--color-accent']).toBe(
			'#ff0000'
		);
		expect(mounted.svg.style.getPropertyValue('--color-accent')).toBe(
			'#ff0000'
		);
	});
});

function createBundle(options: { version?: string } = {}): RuntimeBundle {
	return withDigest({
		_format: 'isostate-runtime-bundle',
		_version: options.version ?? '0.1.2',
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

function createGeneratedContentBundle(): RuntimeBundle {
	return withDigest({
		...createBundle(),
		assets: undefined,
		layers: [
			{ name: 'base', order: 0 },
			{ name: 'labels', order: 1 }
		],
		scenes: [
			{
				id: 'start',
				progress: 0,
				connectors: [],
				elements: [
					{
						id: 'zone',
						asset: 'rectangle',
						layer: 'base',
						pos: [0, 0],
						size: 1,
						presence: 'present',
						primitive: {
							rectangle: {
								fill: '#2563eb',
								opacity: 0.2
							}
						}
					},
					{
						id: 'label',
						asset: 'text',
						layer: 'labels',
						pos: [0, 0],
						size: 1,
						presence: 'present',
						text: { value: 'Start' }
					}
				]
			},
			{
				id: 'end',
				progress: 1,
				connectors: [],
				elements: [
					{
						id: 'zone',
						asset: 'rectangle',
						layer: 'base',
						pos: [0, 0],
						size: 1,
						presence: 'present',
						primitive: {
							rectangle: {
								fill: '#fbbf24',
								opacity: 0.2
							}
						}
					},
					{
						id: 'label',
						asset: 'text',
						layer: 'labels',
						pos: [0, 0],
						size: 1,
						presence: 'present',
						text: { value: 'End' }
					}
				]
			}
		]
	});
}

function createLifecycleBundle(): RuntimeBundle {
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
					}
				]
			},
			{
				id: 'badge-in',
				progress: 0.5,
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
						presence: 'entering'
					}
				]
			},
			{
				id: 'badge-out',
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
						presence: 'exiting'
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
				elements: [],
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
						ambient: [{ name: 'flow' }]
					}
				]
			},
			{
				id: 'end',
				progress: 1,
				elements: [],
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
						ambient: [{ name: 'flow' }]
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

function expectBundleError(
	action: () => unknown,
	expected: { code: string }
): void {
	try {
		action();
		throw new Error('Expected mountScene to throw');
	} catch (error) {
		expect((error as { code?: string }).code).toBe(expected.code);
	}
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
		// Real Node.appendChild moves an already-attached node.
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
		const [name, value] = selector.slice(1, -1).split('=');
		return node.getAttribute(name) === value?.replaceAll('"', '');
	}
	return false;
}
