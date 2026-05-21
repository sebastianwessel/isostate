import { beforeEach, describe, expect, test } from 'bun:test';
import { buildSceneDOM } from '../../packages/core/src/rendering/rendering-engine.ts';
import type { RuntimeBundle } from '../../packages/core/src/types/index.ts';
import { RenderError } from '../../packages/core/src/types/errors.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

class MiniElement {
	childNodes: MiniElement[] = [];
	parentElement: MiniElement | null = null;
	attributes: { name: string; value: string }[] = [];
	style: Record<string, string | ((name: string, value: string) => void)> = {
		setProperty(name: string, value: string): void {
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

describe('asset safety', () => {
	test('throws ASSET_NOT_FOUND for missing assets', () => {
		expect(() =>
			buildSceneDOM(
				new MiniElement('div', null) as unknown as HTMLElement,
				createScene('missing', {})
			)
		).toThrow(RenderError);

		try {
			buildSceneDOM(
				new MiniElement('div', null) as unknown as HTMLElement,
				createScene('missing', {})
			);
		} catch (error) {
			expect((error as RenderError).code).toBe('ASSET_NOT_FOUND');
		}
	});

	test('rejects unsafe asset URLs before assigning image href', () => {
		try {
			buildSceneDOM(
				new MiniElement('div', null) as unknown as HTMLElement,
				createScene('unsafe', { unsafe: { url: 'javascript:alert(1)' } })
			);
			throw new Error('expected asset rejection');
		} catch (error) {
			expect(error).toBeInstanceOf(RenderError);
			expect((error as RenderError).code).toBe('INVALID_ASSET_URL');
			expect((error as RenderError).details).toEqual({ asset: 'unsafe' });
		}
	});
});

function createScene(
	assetName: string,
	assets: Record<string, { url: string }>
): RuntimeBundle {
	return {
		_format: 'isostate-runtime-bundle',
		_version: '0.1.1',
		_digest: '0'.repeat(64),
		grid: { cellSize: 64 },
		floor: {
			size: [1, 1],
			origin: [0, 0],
			visible: true,
			layer: 'main'
		},
		layout: {
			fit: 'contain',
			align: [0.5, 0.5],
			padding: { x: 16, y: 16 },
			bounds: 'union'
		},
		theme: 'light',
		layers: [{ name: 'main', order: 0 }],
		scenes: [
			{
				id: 'initial',
				progress: 0,
				elements: [
					{
						id: 'element-a',
						asset: assetName,
						layer: 'main',
						pos: [0, 0],
						size: 1,
						presence: 'present'
					}
				]
			}
		],
		assets
	} as RuntimeBundle;
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
