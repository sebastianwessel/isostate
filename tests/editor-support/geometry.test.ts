import { beforeEach, describe, expect, test } from 'bun:test';
import {
	clientPointToSvgPoint,
	getGridCellPolygon,
	projectGridPoint,
	unprojectScreenPoint,
} from '../../packages/core/src/editor-support/geometry.ts';
import type { RuntimeBundle } from '../../packages/core/src/types/index.ts';

describe('editor-support geometry', () => {
	beforeEach(() => {
		installDomShim();
	});

	test('projectGridPoint projects a grid point to screen space', () => {
		const bundle = createBundle();
		const point = projectGridPoint(bundle, [0, 0]);
		// With cellSize=64, origin at [0,0], floor 2x2, selected bounds
		// and padding {x:18,y:12}, the exact values depend on layout.
		expect(typeof point.x).toBe('number');
		expect(typeof point.y).toBe('number');
		expect(Number.isFinite(point.x)).toBe(true);
		expect(Number.isFinite(point.y)).toBe(true);
	});

	test('unprojectScreenPoint round-trips a projected grid point', () => {
		const bundle = createBundle();
		const original: [number, number] = [3, 2];
		const screen = projectGridPoint(bundle, original);
		const recovered = unprojectScreenPoint(bundle, screen);
		expect(recovered[0]).toBeCloseTo(original[0], 10);
		expect(recovered[1]).toBeCloseTo(original[1], 10);
	});

	test('clientPointToSvgPoint converts client coordinates using CTM', () => {
		const svg = createMockSvg({
			scale: 2,
			x: 10,
			y: 20,
		});
		const result = clientPointToSvgPoint(svg, { clientX: 50, clientY: 80 });
		// screen = (client - translate) / scale
		expect(result.x).toBeCloseTo((50 - 10) / 2, 10);
		expect(result.y).toBeCloseTo((80 - 20) / 2, 10);
	});

	test('clientPointToSvgPoint throws when CTM is missing', () => {
		const svg = createMockSvg({ scale: 1, x: 0, y: 0, noCtm: true });
		expect(() => clientPointToSvgPoint(svg, { clientX: 0, clientY: 0 })).toThrow(
			'SVG CTM is not available'
		);
	});

	test('clientPointToSvgPoint throws when CTM is not invertible', () => {
		const svg = createMockSvg({ scale: 0, x: 0, y: 0 });
		expect(() => clientPointToSvgPoint(svg, { clientX: 0, clientY: 0 })).toThrow(
			'SVG CTM is not invertible'
		);
	});

	test('getGridCellPolygon returns four corners in clockwise order', () => {
		const bundle = createBundle();
		const polygon = getGridCellPolygon(bundle, [1, 1]);
		expect(polygon.length).toBe(4);
		for (const p of polygon) {
			expect(Number.isFinite(p.x)).toBe(true);
			expect(Number.isFinite(p.y)).toBe(true);
		}
	});
});

function createBundle(): RuntimeBundle {
	return {
		_format: 'isostate-runtime-bundle',
		_version: '0.1.2',
		_digest: 'a'.repeat(64),
		grid: { cellSize: 64 },
		floor: { size: [2, 2], origin: [0, 0], visible: true, layer: 'base' },
		layout: {
			fit: 'contain',
			align: [0.5, 0.5],
			padding: { x: 18, y: 12 },
			bounds: 'union',
		},
		theme: 'light',
		layers: [{ name: 'base', order: 0 }],
		scenes: [
			{
				id: 'start',
				progress: 0,
				connectors: [],
				elements: [
					{
						id: 'block-1',
						asset: 'text',
						layer: 'base',
						pos: [0, 0],
						size: 1,
						presence: 'present',
						text: { value: 'A' },
					},
				],
			},
		],
	};
}

function installDomShim(): void {
	const doc = (globalThis as unknown as { document?: Record<string, unknown> }).document ?? {};
	doc.createElementNS = (_ns: string, localName: string) => new TestSvgElement(localName);
	Object.assign(globalThis, { document: doc });
}

class TestSvgElement {
	localName: string;
	getScreenCTM: () => DOMMatrix | null;
	createSVGPoint: () => {
		x: number;
		y: number;
		matrixTransform: (matrix: DOMMatrix) => { x: number; y: number };
	};

	constructor(localName: string) {
		this.localName = localName;
		this.getScreenCTM = () => null;
		this.createSVGPoint = () => ({
			x: 0,
			y: 0,
			matrixTransform: () => ({ x: 0, y: 0 }),
		});
	}
}

function createMockSvg(options: { scale: number; x: number; y: number; noCtm?: boolean }): SVGSVGElement {
	const el = new TestSvgElement('svg');
	if (!options.noCtm) {
		const matrix = {
			a: options.scale,
			b: 0,
			c: 0,
			d: options.scale,
			e: options.x,
			f: options.y,
			inverse: () => {
				if (options.scale === 0) throw new Error('not invertible');
				return {
					a: 1 / options.scale,
					b: 0,
					c: 0,
					d: 1 / options.scale,
					e: -options.x / options.scale,
					f: -options.y / options.scale,
					multiply: (p: { x: number; y: number }) => ({
						x: p.x * (1 / options.scale) + (-options.x / options.scale),
						y: p.y * (1 / options.scale) + (-options.y / options.scale),
					}),
				} as unknown as DOMMatrix;
			},
			multiply: (p: { x: number; y: number }) => ({
				x: p.x * options.scale + options.x,
				y: p.y * options.scale + options.y,
			}),
		} as unknown as DOMMatrix;

		el.getScreenCTM = () => matrix;
		el.createSVGPoint = () => {
			const pt = { x: 0, y: 0, matrixTransform: (m: DOMMatrix) => {
				const result = (m as unknown as { multiply: (p: { x: number; y: number }) => { x: number; y: number } }).multiply(pt);
				return result;
			} };
			return pt;
		};
	}
	return el as unknown as SVGSVGElement;
}
