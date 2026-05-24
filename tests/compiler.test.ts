import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
	compileScene,
	fromJs,
	fromJson,
	toJs,
	toJson
} from '../packages/core/src/dsl/compiler';
import { parseScene } from '../packages/core/src/dsl/scene-parser';
import type { SceneDocument } from '../packages/core/src/types/index';

function createDocument(overrides: Partial<SceneDocument> = {}): SceneDocument {
	return {
		header: {
			version: '0.1',
			assetBaseUrl: './assets',
			assets: [
				{ id: 'building-office', anchor: [0.125, 1] },
				{ id: 'tree-oak' },
				{ id: 'floor-tile' }
			],
			grid: { cellSize: 72 },
			floor: {
				size: [5, 4],
				asset: 'floor-tile',
				visible: true
			},
			theme: 'light',
			className: 'demo-surface',
			layers: [
				{ name: 'ground' },
				{ name: 'connectors', order: 2 },
				{ name: 'structures', order: 3 }
			]
		},
		scenes: [
			{
				id: 'initial',
				elements: [
					{
						id: 'office-1',
						asset: 'building-office',
						at: [2, 2],
						size: 2,
						layer: 'structures',
						enter: 'rise-from-ground'
					}
				],
				connections: [
					{
						id: 'office-road',
						route: [
							[0, 0],
							[2, 0]
						],
						layer: 'connectors',
						style: { variant: 'road', lane: 'center-dashed' }
					}
				]
			},
			{
				id: 'expanded',
				camera: {
					target: { element: 'tree-1' },
					padding: 48,
					duration: 600,
					easing: 'ease-in-out'
				},
				update: { elements: [{ id: 'office-1', at: [3, 2], size: 3 }] },
				add: {
					elements: [
						{
							id: 'tree-1',
							asset: 'tree-oak',
							at: [1, 1],
							ambient: [{ name: 'pulse' }]
						}
					],
					connections: [
						{
							id: 'tree-flow',
							from: { element: 'office-1', side: 'left' },
							to: { element: 'tree-1', side: 'right' },
							style: { pattern: 'dotted' },
							ambient: [{ name: 'flow' }]
						}
					]
				}
			},
			{
				id: 'removed',
				camera: {
					target: { reset: true },
					duration: 300
				},
				remove: {
					elements: [{ id: 'tree-1', exit: 'fade-out' }],
					connections: [{ id: 'tree-flow', exit: 'fade-out' }]
				}
			}
		],
		...overrides
	};
}

describe('compileScene', () => {
	test('compiles sprite sheets into flat runtime asset entries', () => {
		const document = parseScene(
			readFileSync(
				'tests/fixtures/sprite-sheet-assets/compact.isostate.yaml',
				'utf8'
			)
		);
		const expectedAssets = JSON.parse(
			readFileSync(
				'tests/fixtures/sprite-sheet-assets/expected-compact-assets.json',
				'utf8'
			)
		);

		const bundle = compileScene(document);

		expect(bundle.assets).toEqual(expectedAssets);
		expect(toJson(bundle)).toContain('"sprite"');
		expect(fromJson(toJson(bundle))).toEqual(bundle);
		expect(fromJs(toJs(bundle))).toEqual(bundle);
	});

	test('emits deterministic runtime bundles with canonical scenes and URL assets', () => {
		const first = compileScene(createDocument());
		const second = compileScene(createDocument());

		expect(first).toEqual(second);
		expect(toJson(first)).toBe(toJson(second));
		expect(first._format).toBe('isostate-runtime-bundle');
		expect(first._version).toBe('0.3.0');
		expect(first._digest).toMatch(/^[a-f0-9]{64}$/);
		expect(first.className).toBe('demo-surface');
		expect(first.grid).toEqual({ cellSize: 72 });
		expect(first.floor).toEqual({
			size: [5, 4],
			origin: [0, 0],
			visible: true,
			layer: 'ground',
			asset: 'floor-tile'
		});
		expect(first.layout).toEqual({
			fit: 'contain',
			align: [0.5, 0.5],
			padding: { x: 64, y: 64 },
			bounds: 'union'
		});
		expect(first.layers).toEqual([
			{ name: 'ground', order: 0 },
			{ name: 'connectors', order: 2 },
			{ name: 'structures', order: 3 }
		]);
		expect(first.assets?.['building-office']).toEqual({
			url: './assets/building-office.svg',
			anchor: [0.125, 1]
		});
		expect(first.scenes.map((scene) => scene.progress)).toEqual([0, 0.5, 1]);
		expect(first.scenes[1].elements).toEqual([
			expect.objectContaining({
				id: 'office-1',
				pos: [3, 2],
				size: 3,
				layer: 'structures',
				presence: 'present'
			}),
			expect.objectContaining({
				id: 'tree-1',
				pos: [1, 1],
				size: 1,
				layer: 'structures',
				presence: 'entering',
				enter: 'fade-in',
				ambient: [{ name: 'pulse' }]
			})
		]);
		expect(first.scenes[0].connectors).toEqual([
			expect.objectContaining({
				id: 'office-road',
				route: [
					[0, 0],
					[2, 0]
				],
				layer: 'connectors',
				presence: 'present',
				style: expect.objectContaining({
					variant: 'road',
					lane: 'center-dashed',
					strokeWidth: 14
				})
			})
		]);
		expect(first.scenes[1].connectors).toEqual([
			expect.objectContaining({ id: 'office-road', presence: 'present' }),
			expect.objectContaining({
				id: 'tree-flow',
				presence: 'entering',
				route: expect.any(Array),
				style: expect.objectContaining({
					pattern: 'dotted',
					dash: [0, 8]
				})
			})
		]);
		expect(first.scenes[1].connectors[1]).not.toHaveProperty('from');
		expect(first.scenes[1].connectors[1]).not.toHaveProperty('to');
		expect(first.scenes[1].connectors[1]).not.toHaveProperty('routing');
		expect(first.scenes[1].camera).toEqual({
			target: { type: 'element', id: 'tree-1' },
			padding: 48,
			duration: 600,
			easing: 'ease-in-out'
		});
		expect(first.scenes[2].camera).toEqual({
			target: { type: 'reset' },
			duration: 300
		});
		expect(
			first.scenes[2].elements.find((element) => element.id === 'tree-1')
		).toEqual(
			expect.objectContaining({
				presence: 'exiting',
				exit: 'fade-out'
			})
		);
		expect(
			first.scenes[2].connectors.find(
				(connector) => connector.id === 'tree-flow'
			)
		).toEqual(
			expect.objectContaining({
				presence: 'exiting',
				exit: 'fade-out'
			})
		);
		expect(first).not.toHaveProperty('states');
		expect(first).not.toHaveProperty('elements');
		expect(first.assets).toEqual({
			'building-office': {
				url: './assets/building-office.svg',
				anchor: [0.125, 1]
			},
			'floor-tile': { url: './assets/floor-tile.svg' },
			'tree-oak': { url: './assets/tree-oak.svg' }
		});
	});

	test('changes digest when semantic bundle content changes', () => {
		const base = compileScene(createDocument());
		const changed = compileScene(
			createDocument({
				header: {
					...createDocument().header,
					theme: 'dark'
				}
			})
		);

		expect(changed._digest).not.toBe(base._digest);
	});

	test('always emits URL assets for external referenced assets', () => {
		const bundle = compileScene(createDocument());

		expect(bundle.assets).toEqual({
			'building-office': {
				url: './assets/building-office.svg',
				anchor: [0.125, 1]
			},
			'floor-tile': { url: './assets/floor-tile.svg' },
			'tree-oak': { url: './assets/tree-oak.svg' }
		});
		expect(bundle._digest).toMatch(/^[a-f0-9]{64}$/);
	});

	test('derives floor size from resolved scene element footprints', () => {
		const baseDocument = createDocument();
		const bundle = compileScene(
			createDocument({
				header: {
					...baseDocument.header,
					floor: { visible: true }
				},
				scenes: [
					{
						id: 'initial',
						elements: [
							{
								id: 'office-1',
								asset: 'building-office',
								at: [2, 2],
								size: 1
							}
						],
						connections: [
							{
								id: 'long-road',
								route: [
									[0, 0],
									[8, 6]
								]
							}
						]
					}
				]
			})
		);

		expect(bundle.floor.size).toEqual([8, 6]);
		expect(bundle.floor.origin).toEqual([0, 0]);
	});

	test('compiles endpoint-routed orthogonal connections to grid-axis segments', () => {
		const baseDocument = createDocument();
		const bundle = compileScene(
			createDocument({
				header: {
					...baseDocument.header,
					floor: { visible: true }
				},
				scenes: [
					{
						id: 'initial',
						elements: [
							{
								id: 'source',
								asset: 'building-office',
								at: [0, 0],
								size: 1
							},
							{
								id: 'target',
								asset: 'tree-oak',
								at: [3, 3],
								size: 1
							}
						],
						connections: [
							{
								id: 'source-to-target',
								from: { element: 'source', side: 'right' },
								to: { element: 'target', side: 'left' },
								routing: { mode: 'orthogonal', avoid: 'none' }
							}
						]
					}
				]
			})
		);

		const route = bundle.scenes[0].connectors[0].route;
		expect(route.length).toBeGreaterThan(2);
		for (let index = 1; index < route.length; index += 1) {
			const previous = route[index - 1];
			const current = route[index];
			expect(previous[0] === current[0] || previous[1] === current[1]).toBe(
				true
			);
		}
	});

	test('adds outside stubs for element side ports before entering the object edge', () => {
		const baseDocument = createDocument();
		const bundle = compileScene(
			createDocument({
				header: {
					...baseDocument.header,
					floor: { visible: true }
				},
				scenes: [
					{
						id: 'initial',
						elements: [
							{
								id: 'source',
								asset: 'building-office',
								at: [0, 0],
								size: 1
							},
							{
								id: 'target',
								asset: 'tree-oak',
								at: [3, 3],
								size: 1
							}
						],
						connections: [
							{
								id: 'source-to-target',
								from: { element: 'source', side: 'bottom' },
								to: { element: 'target', side: 'right' },
								routing: { mode: 'orthogonal', avoid: 'none' }
							}
						]
					}
				]
			})
		);

		expect(bundle.scenes[0].connectors[0].route).toEqual([
			[0.5, 1],
			[0.5, 1.5],
			[4.5, 1.5],
			[4.5, 3.5],
			[4, 3.5]
		]);
	});

	test('emits browser-loadable asset URLs from assetBaseUrl and path', () => {
		const baseDocument = createDocument();
		const bundle = compileScene(
			createDocument({
				header: {
					...baseDocument.header,
					assetBaseUrl: './assets',
					assets: [
						{ id: 'building-office', path: 'buildings/office' },
						{ id: 'tree-oak', path: 'nature/tree-oak.svg' },
						{ id: 'floor-tile' }
					]
				}
			})
		);

		expect(bundle.assets).toEqual({
			'building-office': { url: './assets/buildings/office.svg' },
			'floor-tile': { url: './assets/floor-tile.svg' },
			'tree-oak': { url: './assets/nature/tree-oak.svg' }
		});
	});

	test('preserves built-in text content and skips asset resolution for text', () => {
		const baseDocument = createDocument();
		const bundle = compileScene(
			createDocument({
				header: {
					...baseDocument.header,
					assets: [{ id: 'building-office' }],
					floor: { visible: true },
					layers: [{ name: 'labels' }]
				},
				scenes: [
					{
						id: 'initial',
						elements: [
							{
								id: 'label-1',
								asset: 'text',
								at: [1, 1],
								layer: 'labels',
								text: {
									value: 'Authentication\nGateway',
									align: 'middle',
									fontSize: 12,
									fontWeight: 700,
									lineHeight: 1.2,
									fill: '#111111'
								}
							}
						]
					}
				]
			})
		);

		expect(bundle.assets).toBeUndefined();
		expect(bundle.scenes[0].elements[0]).toEqual(
			expect.objectContaining({
				asset: 'text',
				text: {
					align: 'middle',
					fill: '#111111',
					fontSize: 12,
					fontWeight: 700,
					lineHeight: 1.2,
					value: 'Authentication\nGateway'
				}
			})
		);
	});

	test('preserves built-in primitive content and skips asset resolution for primitives', () => {
		const baseDocument = createDocument();
		const bundle = compileScene(
			createDocument({
				header: {
					...baseDocument.header,
					assets: [],
					floor: { visible: true },
					layers: [{ name: 'ground' }]
				},
				scenes: [
					{
						id: 'initial',
						elements: [
							{
								id: 'service-zone',
								asset: 'rectangle',
								at: [1, 1],
								size: 2,
								layer: 'ground',
								primitive: {
									rectangle: {
										fill: '#2563eb',
										stroke: '#1d4ed8',
										strokeWidth: 1,
										opacity: 0.16
									}
								}
							}
						]
					}
				]
			})
		);

		expect(bundle.assets).toBeUndefined();
		expect(bundle.scenes[0].elements[0]).toEqual(
			expect.objectContaining({
				asset: 'rectangle',
				primitive: {
					rectangle: expect.objectContaining({ fill: '#2563eb' })
				}
			})
		);
	});

	test('compiles sparse nested update deltas and zero-size patches', () => {
		const baseDocument = createDocument();
		const bundle = compileScene(
			createDocument({
				header: {
					...baseDocument.header,
					assets: [],
					floor: { visible: true },
					layers: [{ name: 'labels' }]
				},
				scenes: [
					{
						id: 'initial',
						elements: [
							{
								id: 'label-1',
								asset: 'text',
								at: [1, 1],
								layer: 'labels',
								text: {
									value: 'Checkout',
									align: 'middle',
									fill: '#111111'
								}
							}
						]
					},
					{
						id: 'updated',
						update: {
							elements: [
								{
									id: 'label-1',
									at: [2, 1],
									size: 0,
									text: { fill: '#eeeeee' }
								}
							]
						}
					}
				]
			})
		);

		expect(bundle.scenes[1].elements[0]).toEqual(
			expect.objectContaining({
				pos: [2, 1],
				size: 0,
				text: {
					value: 'Checkout',
					align: 'middle',
					fill: '#eeeeee'
				}
			})
		);
	});

	test('throws ASSET_URL_REQUIRED for referenced assets without assetBaseUrl', () => {
		const baseDocument = createDocument();

		expect(() =>
			compileScene(
				createDocument({
					header: {
						...baseDocument.header,
						assetBaseUrl: undefined
					}
				})
			)
		).toThrow(
			expect.objectContaining({
				code: 'ASSET_URL_REQUIRED',
				details: { asset: 'building-office' }
			})
		);
	});
});

describe('runtime bundle serialization', () => {
	test('serializes canonical JSON with lexicographically sorted object keys', () => {
		const bundle = compileScene(createDocument());
		const json = toJson(bundle);

		expect(json.indexOf('"_digest"')).toBeLessThan(json.indexOf('"_format"'));
		expect(json.indexOf('"_format"')).toBeLessThan(json.indexOf('"_version"'));
		expect(fromJson(json)).toEqual(bundle);
		expect(() => fromJson(JSON.stringify(bundle))).toThrow(
			/non-canonical serialization/
		);
	});

	test('serializes exact JS default exports and parses only canonical output', () => {
		const bundle = compileScene(createDocument());
		const js = toJs(bundle);

		expect(js.startsWith('export default {"_digest"')).toBe(true);
		expect(js.endsWith('};')).toBe(true);
		expect(fromJs(js)).toEqual(bundle);
		expect(fromJs(toJs(bundle, { minify: false }))).toEqual(bundle);
		expect(() =>
			fromJs(`const bundle = ${toJson(bundle)}; export default bundle;`)
		).toThrow(/expected exact default export/);
		expect(() => fromJs(`export default ${toJson(bundle)} ;`)).toThrow(
			/non-canonical bundle export/
		);
	});
});
