import { beforeEach, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import {
	exportScenePng,
	exportSceneSvg,
	mountScene
} from '../../packages/core/src/index';
import type { RuntimeBundle } from '../../packages/core/src/types/index.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

describe('exportSceneSvg / exportScenePng', () => {
	beforeEach(() => {
		installDomShim();
	});

	test('renders the requested progress and restores the prior progress afterwards', async () => {
		const mounted = mountConnectedScene(createBundle());
		mounted.engine.setProgress(0.25);

		const svgString = await exportSceneSvg(mounted, {
			progress: 1,
			inlineAssets: false
		});

		expect(svgString).toContain('data-id="block-1"');
		expect(mounted.engine.getProgress()).toBe(0.25);
	});

	test('restores the prior progress even when the export rejects', async () => {
		const mounted = mountConnectedScene(createBundle());
		mounted.engine.setProgress(0.4);
		installFailingFetch('./assets/block.svg');

		await expect(
			exportSceneSvg(mounted, { progress: 1 })
		).rejects.toMatchObject({
			code: 'EXPORT_ASSET_FETCH_FAILED'
		});
		expect(mounted.engine.getProgress()).toBe(0.4);
	});

	test('exports at the current progress when no progress option is given', async () => {
		const mounted = mountConnectedScene(createBundle());
		mounted.engine.setProgress(1);

		const svgString = await exportSceneSvg(mounted, { inlineAssets: false });

		expect(mounted.engine.getProgress()).toBe(1);
		expect(svgString).toContain('data-id="block-1"');
	});

	test('contains xmlns, explicit width/height, and no background rect by default', async () => {
		const mounted = mountConnectedScene(createBundle());

		const svgString = await exportSceneSvg(mounted, { inlineAssets: false });

		expect(svgString).toContain('xmlns="http://www.w3.org/2000/svg"');
		expect(svgString).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
		expect(svgString).toContain('width="216"');
		expect(svgString).toContain('height="132"');
		expect(svgString).not.toContain('<rect');
	});

	test('inserts a background rect covering the viewBox when background is set', async () => {
		const mounted = mountConnectedScene(createBundle());

		const svgString = await exportSceneSvg(mounted, {
			inlineAssets: false,
			background: '#ffffff'
		});

		expect(svgString).toContain('<rect');
		expect(svgString).toContain('fill="#ffffff"');
		expect(svgString).toContain('width="216"');
		expect(svgString).toContain('height="132"');
	});

	test('removes a diagnostics overlay group from the exported clone, leaving the live scene untouched', async () => {
		const mounted = mountConnectedScene(createBundle());
		const overlay = document.createElementNS(SVG_NS, 'g');
		overlay.setAttribute('data-iso-diagnostics', '');
		mounted.svg.appendChild(overlay);

		const svgString = await exportSceneSvg(mounted, { inlineAssets: false });

		expect(svgString).not.toContain('data-iso-diagnostics');
		expect(mounted.svg.querySelector('[data-iso-diagnostics]')).not.toBeNull();
	});

	test('inlineAssets: true replaces <image> hrefs with data URIs', async () => {
		const mounted = mountConnectedScene(createBundle());
		installFetchStub(async (url) => {
			expect(url).toContain('block.svg');
			return new Response('<svg></svg>', {
				status: 200,
				headers: { 'content-type': 'image/svg+xml' }
			});
		});

		const svgString = await exportSceneSvg(mounted);

		expect(svgString).toContain('data:image/svg+xml;base64,');
		expect(svgString).not.toContain('href="./assets/block.svg"');
	});

	test('a failing fetch rejects the export with EXPORT_ASSET_FETCH_FAILED carrying the url', async () => {
		const mounted = mountConnectedScene(createBundle());
		installFailingFetch('./assets/block.svg');

		await expect(exportSceneSvg(mounted)).rejects.toMatchObject({
			code: 'EXPORT_ASSET_FETCH_FAILED',
			details: { url: expect.stringContaining('block.svg') }
		});
	});

	test('a non-2xx fetch response rejects the export with EXPORT_ASSET_FETCH_FAILED', async () => {
		const mounted = mountConnectedScene(createBundle());
		installFetchStub(async () => new Response('nope', { status: 404 }));

		await expect(exportSceneSvg(mounted)).rejects.toMatchObject({
			code: 'EXPORT_ASSET_FETCH_FAILED'
		});
	});

	test('inlineAssets: false keeps hrefs verbatim', async () => {
		const mounted = mountConnectedScene(createBundle());

		const svgString = await exportSceneSvg(mounted, { inlineAssets: false });

		expect(svgString).toContain('href="./assets/block.svg"');
	});

	test('rejects with EXPORT_TARGET_DESTROYED for a destroyed mount', async () => {
		const mounted = mountConnectedScene(createBundle());
		mounted.destroy();

		await expect(exportSceneSvg(mounted)).rejects.toMatchObject({
			code: 'EXPORT_TARGET_DESTROYED'
		});
	});

	test('rejects with EXPORT_INVALID_OPTIONS for out-of-range progress', async () => {
		const mounted = mountConnectedScene(createBundle());

		await expect(
			exportSceneSvg(mounted, { progress: 2 })
		).rejects.toMatchObject({
			code: 'EXPORT_INVALID_OPTIONS'
		});
		await expect(
			exportSceneSvg(mounted, { progress: -0.1 })
		).rejects.toMatchObject({
			code: 'EXPORT_INVALID_OPTIONS'
		});
		await expect(
			exportSceneSvg(mounted, { progress: Number.NaN })
		).rejects.toMatchObject({
			code: 'EXPORT_INVALID_OPTIONS'
		});
	});

	describe('exportScenePng', () => {
		test('rejects with EXPORT_INVALID_OPTIONS when inlineAssets: false is passed', async () => {
			const mounted = mountConnectedScene(createBundle());

			await expect(
				exportScenePng(mounted, { inlineAssets: false })
			).rejects.toMatchObject({
				code: 'EXPORT_INVALID_OPTIONS'
			});
		});

		test('rejects with EXPORT_INVALID_OPTIONS for a non-positive scale', async () => {
			const mounted = mountConnectedScene(createBundle());

			await expect(exportScenePng(mounted, { scale: 0 })).rejects.toMatchObject(
				{
					code: 'EXPORT_INVALID_OPTIONS'
				}
			);
			await expect(
				exportScenePng(mounted, { scale: -2 })
			).rejects.toMatchObject({
				code: 'EXPORT_INVALID_OPTIONS'
			});
		});

		test('rejects with EXPORT_TARGET_DESTROYED for a destroyed mount', async () => {
			const mounted = mountConnectedScene(createBundle());
			mounted.destroy();

			await expect(exportScenePng(mounted)).rejects.toMatchObject({
				code: 'EXPORT_TARGET_DESTROYED'
			});
		});

		test('rasterizes to a canvas sized from the viewBox and scale, resolving with the encoded PNG blob', async () => {
			const mounted = mountConnectedScene(createBundle());
			installFetchStub(
				async () =>
					new Response('<svg></svg>', {
						status: 200,
						headers: { 'content-type': 'image/svg+xml' }
					})
			);
			installCanvasShim({ toBlobResult: 'success' });

			const blob = await exportScenePng(mounted, { scale: 3 });

			expect(blob).toBeInstanceOf(Blob);
			expect(blob.type).toBe('image/png');
			expect(lastCanvasSize).toEqual({ width: 648, height: 396 });
		});

		test('defaults to scale: 2 when scale is omitted', async () => {
			const mounted = mountConnectedScene(createBundle());
			installFetchStub(
				async () =>
					new Response('<svg></svg>', {
						status: 200,
						headers: { 'content-type': 'image/svg+xml' }
					})
			);
			installCanvasShim({ toBlobResult: 'success' });

			await exportScenePng(mounted);

			expect(lastCanvasSize).toEqual({ width: 432, height: 264 });
		});

		test('rejects with EXPORT_RASTERIZE_FAILED when canvas 2D context creation fails', async () => {
			const mounted = mountConnectedScene(createBundle());
			installFetchStub(
				async () =>
					new Response('<svg></svg>', {
						status: 200,
						headers: { 'content-type': 'image/svg+xml' }
					})
			);
			installCanvasShim({ toBlobResult: 'success', context2d: null });

			await expect(exportScenePng(mounted)).rejects.toMatchObject({
				code: 'EXPORT_RASTERIZE_FAILED'
			});
		});

		test('rejects with EXPORT_RASTERIZE_FAILED when toBlob yields null', async () => {
			const mounted = mountConnectedScene(createBundle());
			installFetchStub(
				async () =>
					new Response('<svg></svg>', {
						status: 200,
						headers: { 'content-type': 'image/svg+xml' }
					})
			);
			installCanvasShim({ toBlobResult: 'null' });

			await expect(exportScenePng(mounted)).rejects.toMatchObject({
				code: 'EXPORT_RASTERIZE_FAILED'
			});
		});
	});
});

/**
 * Mount a bundle into a target appended to the shim document body, so
 * `mounted.svg.isConnected` is `true`, matching an application that mounted
 * into a live page. Tests that verify `EXPORT_TARGET_DESTROYED` call
 * `mounted.destroy()` afterwards to disconnect the SVG again.
 */
function mountConnectedScene(bundle: RuntimeBundle) {
	const target = document.createElement('div');
	document.body.appendChild(target);
	return mountScene(target, bundle);
}

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

// ── fetch stubs ──────────────────────────────────────────────────────────────

function installFetchStub(handler: (url: string) => Promise<Response>): void {
	Object.assign(globalThis, {
		fetch: (input: string | URL) => handler(String(input))
	});
}

function installFailingFetch(matchingUrlFragment: string): void {
	installFetchStub(async (url) => {
		if (url.includes(matchingUrlFragment)) {
			throw new TypeError('network error');
		}
		return new Response('', { status: 200 });
	});
}

// ── canvas / rasterization shim ──────────────────────────────────────────────

let lastCanvasSize: { width: number; height: number } | null = null;

function installCanvasShim(
	options: {
		toBlobResult?: 'success' | 'null';
		context2d?: null | 'default';
	} = {}
): void {
	lastCanvasSize = null;
	const toBlobResult = options.toBlobResult ?? 'success';
	const context2d = 'context2d' in options ? options.context2d : 'default';

	class ShimCanvasRenderingContext2D {
		drawImage(): void {}
	}

	class ShimHTMLCanvasElement {
		width = 0;
		height = 0;

		getContext(kind: string): ShimCanvasRenderingContext2D | null {
			if (kind !== '2d') return null;
			if (context2d === null) return null;
			return new ShimCanvasRenderingContext2D();
		}

		toBlob(callback: (blob: Blob | null) => void, type: string): void {
			lastCanvasSize = { width: this.width, height: this.height };
			if (toBlobResult === 'null') {
				callback(null);
				return;
			}
			callback(new Blob(['png-bytes'], { type }));
		}
	}

	class ShimImage {
		onload: (() => void) | null = null;
		onerror: (() => void) | null = null;

		set src(_value: string) {
			queueMicrotask(() => this.onload?.());
		}
	}

	globalThis.Image = ShimImage as unknown as typeof Image;

	const documentShim = globalThis.document as unknown as {
		createElement: (localName: string) => unknown;
	};
	const originalCreateElement = documentShim.createElement.bind(documentShim);
	documentShim.createElement = (localName: string) => {
		if (localName === 'canvas') return new ShimHTMLCanvasElement();
		return originalCreateElement(localName);
	};
}

// ── DOM shim (mount-scene pattern, extended with real-DOM-faithful behavior) ─

function installDomShim(): void {
	lastCanvasSize = null;
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
		cancelAnimationFrame: (id: number) => clearTimeout(id),
		XMLSerializer: ShimXMLSerializer,
		fetch: () => {
			throw new Error('fetch was not stubbed for this test');
		}
	});
}

/**
 * Minimal XMLSerializer producing an attribute-order-stable, real-DOM-faithful
 * serialization of the shim's element tree (self-closing empty elements,
 * escaped text content, and namespaced attributes rendered verbatim).
 */
class ShimXMLSerializer {
	serializeToString(node: TestElement): string {
		return serializeNode(node);
	}
}

function serializeNode(node: TestElement): string {
	const attrs = node.attributes
		.map((attr) => ` ${attr.name}="${escapeAttr(attr.value)}"`)
		.join('');
	const children = node.children.map(serializeNode).join('');
	const text = escapeText(node.textContent ?? '');
	if (!children && !text) {
		return `<${node.localName}${attrs}/>`;
	}
	return `<${node.localName}${attrs}>${text}${children}</${node.localName}>`;
}

function escapeAttr(value: string): string {
	return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

function escapeText(value: string): string {
	return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
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
	 * mirroring `Node.isConnected` (root is a Document). A node created via
	 * `document.createElement()` and never appended anywhere is not connected,
	 * matching real browser behavior.
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

	getAttributeNS(_namespace: string, name: string): string | null {
		return this.getAttribute(name);
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
