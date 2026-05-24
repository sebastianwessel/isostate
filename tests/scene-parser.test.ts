import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { parseScene } from '../packages/core/src/dsl/scene-parser';
import { ParseError } from '../packages/core/src/types/errors';

function expectParseErrorCode(dsl: string, code: string) {
	try {
		parseScene(dsl);
		throw new Error('Expected parseScene to throw');
	} catch (error) {
		expect(error).toBeInstanceOf(ParseError);
		expect((error as ParseError).code).toBe(code);
	}
}

describe('parseScene', () => {
	test('parses sprite sheet asset declarations', () => {
		const scene = parseScene(
			readFileSync(
				'tests/fixtures/sprite-sheet-assets/verbose-rect.isostate.yaml',
				'utf8'
			)
		);

		expect(scene.header.assets[0]).toEqual({
			id: 'app-icons',
			type: 'sprite-sheet',
			path: 'sprites/app-icons.webp',
			sheetSize: [512, 256],
			tileSize: [64, 64],
			anchor: [0.5, 0.95],
			sprites: {
				server: { at: [0, 0] },
				'wide-service': { rect: [128, 0, 96, 64], anchor: [0.5, 1] }
			}
		});
	});

	test('parses a header plus scene-delta document', () => {
		const scene = parseScene(`
header:
  version: '1.0'
  name: sample-scene
  className: demo-surface
  assetBaseUrl: ./assets
  assets:
    - id: building-office
      path: building-office
      anchor: [0.125, 1]
    - id: tree-oak
      path: nature/tree-oak.svg
  grid:
    cellSize: 72
  floor:
    size: [6, 4]
    origin: [1, 2]
    layer: ground
    visible: true
    asset: floor-tile
  theme: light
  layers:
    - name: ground
    - name: structures
      order: 10
scenes:
  - id: initial
    elements:
      - id: office-1
        asset: building-office
        at: [2, 2]
        size: 2
        layer: structures
        enter: rise-from-ground
        exit: fall-through-ground
        ambient:
          - name: pulse
            infinite: false
            iterations: 3
    connections:
      - id: office-link
        route: [[2, 3], [4, 3]]
        layer: ground
        style:
          pattern: dashed
        end: arrow
  - id: expanded
    add:
      elements:
        - id: tree-1
          asset: tree-oak
          at: [4, 1]
      connections:
        - id: tree-link
          from:
            element: office-1
            side: right
          to:
            element: tree-1
            side: left
    update:
      elements:
        - id: office-1
          at: [3, 2]
          size: 3
      connections:
        - id: office-link
          style:
            pattern: dotted
    remove:
      elements:
        - id: tree-1
          exit: fade-out
      connections:
        - id: tree-link
          exit: fade-out
`);

		expect(scene.header.name).toBe('sample-scene');
		expect(scene.header.className).toBe('demo-surface');
		expect(scene.header.assetBaseUrl).toBe('./assets');
		expect(scene.header.assets).toEqual([
			{ id: 'building-office', path: 'building-office', anchor: [0.125, 1] },
			{ id: 'tree-oak', path: 'nature/tree-oak.svg' }
		]);
		expect(scene.header.grid?.cellSize).toBe(72);
		expect(scene.header.floor.size).toEqual([6, 4]);
		expect(scene.header.layers).toEqual([
			{ name: 'ground' },
			{ name: 'structures', order: 10 }
		]);
		expect(scene.scenes).toHaveLength(2);
		expect(scene.scenes[0].elements?.[0]).toEqual({
			id: 'office-1',
			asset: 'building-office',
			at: [2, 2],
			size: 2,
			layer: 'structures',
			enter: 'rise-from-ground',
			exit: 'fall-through-ground',
			ambient: [{ name: 'pulse', infinite: false, iterations: 3 }]
		});
		expect(scene.scenes[0].connections?.[0]).toEqual({
			id: 'office-link',
			route: [
				[2, 3],
				[4, 3]
			],
			layer: 'ground',
			style: { pattern: 'dashed' },
			end: 'arrow'
		});
		expect(scene.scenes[1].update?.elements?.[0]).toEqual({
			id: 'office-1',
			at: [3, 2],
			size: 3
		});
		expect(scene.scenes[1].add?.connections?.[0]).toEqual({
			id: 'tree-link',
			from: { element: 'office-1', side: 'right' },
			to: { element: 'tree-1', side: 'left' }
		});
	});

	test('parses scene camera targets', () => {
		const scene = parseScene(`
header:
  assets:
    - id: gateway
  layers:
    - name: ground
scenes:
  - id: initial
    elements:
      - id: api-gateway
        asset: gateway
        at: [1, 1]
    camera:
      target:
        area:
          at: [0, 0]
          size: [4, 3]
  - id: focus-api
    update:
      elements:
        - id: api-gateway
          at: [2, 1]
    camera:
      target:
        element: api-gateway
      padding: 48
      duration: 600
      easing: ease-in-out
  - id: overview
    camera:
      target:
        reset: true
      duration: 300
`);

		expect(scene.scenes[0].camera).toEqual({
			target: { area: { at: [0, 0], size: [4, 3] } }
		});
		expect(scene.scenes[1].camera).toEqual({
			target: { element: 'api-gateway' },
			padding: 48,
			duration: 600,
			easing: 'ease-in-out'
		});
		expect(scene.scenes[2].camera).toEqual({
			target: { reset: true },
			duration: 300
		});
	});

	test('parses sparse nested update deltas and zero-size patches', () => {
		const scene = parseScene(`
header:
  assets: []
  layers:
    - name: labels
scenes:
  - id: start
    elements:
      - id: title
        asset: text
        at: [1, 1]
        text:
          value: Checkout
          fill: "#111111"
  - id: move-title
    update:
      elements:
        - id: title
          at: [2, 1]
          size: 0
          text:
            fill: "#eeeeee"
`);

		expect(scene.scenes[1].update?.elements?.[0]).toEqual({
			id: 'title',
			at: [2, 1],
			size: 0,
			text: { fill: '#eeeeee' }
		});
	});

	test('rejects old top-level states and elements fields', () => {
		expectParseErrorCode(
			`
states: []
header:
  assets: []
  floor:
    size: [1, 1]
  layers: []
scenes: []
`,
			'UNKNOWN_FIELD'
		);

		expectParseErrorCode(
			`
elements: []
header:
  assets: []
  floor:
    size: [1, 1]
  layers: []
scenes: []
`,
			'UNKNOWN_FIELD'
		);
	});

	test('allows floor size to be omitted for compiler-derived bounds', () => {
		const scene = parseScene(`
header:
  assets:
    - id: building-office
  floor:
    layer: ground
  layers:
    - name: ground
    - name: structures
scenes:
  - id: initial
    elements:
      - id: office-1
        asset: building-office
        at: [2, 1]
        size: 3
        layer: structures
`);

		expect(scene.header.floor?.size).toBeUndefined();
		expect(scene.header.floor?.layer).toBe('ground');
	});

	test('parses built-in text asset content with multiline labels and style', () => {
		const scene = parseScene(`
header:
  assets:
    - id: gateway
  layers:
    - name: labels
scenes:
  - id: initial
    elements:
      - id: gateway-label
        asset: text
        at: [2, 3]
        layer: labels
        text:
          value: |
            Authentication
            Gateway
          align: middle
          fontSize: 12
          fontWeight: 700
          lineHeight: 1.2
          placement: caption
          fill: "#111111"
  - id: renamed
    update:
      elements:
        - id: gateway-label
          text:
            value: "Auth\\nGateway"
`);

		expect(scene.scenes[0].elements?.[0]).toEqual({
			id: 'gateway-label',
			asset: 'text',
			at: [2, 3],
			layer: 'labels',
			text: {
				value: 'Authentication\nGateway\n',
				align: 'middle',
				fontSize: 12,
				fontWeight: 700,
				lineHeight: 1.2,
				placement: 'caption',
				fill: '#111111'
			}
		});
		expect(scene.scenes[1].update?.elements?.[0]).toEqual({
			id: 'gateway-label',
			text: { value: 'Auth\nGateway' }
		});
	});

	test('parses built-in primitive asset content', () => {
		const scene = parseScene(`
header:
  assets: []
  layers:
    - name: ground
scenes:
  - id: initial
    elements:
      - id: service-zone
        asset: rectangle
        at: [1, 1]
        size: 3
        layer: ground
        primitive:
          rectangle:
            fill: "#2563eb"
            stroke: "#1d4ed8"
            strokeWidth: 1
            opacity: 0.16
      - id: route-line
        asset: line
        at: [1, 3]
        layer: ground
        primitive:
          line:
            points: [[0, 0.5], [1, 0.5]]
            stroke: "#111827"
            strokeWidth: 2
            lineCap: round
`);

		expect(scene.scenes[0].elements?.[0]).toEqual({
			id: 'service-zone',
			asset: 'rectangle',
			at: [1, 1],
			size: 3,
			layer: 'ground',
			primitive: {
				rectangle: {
					fill: '#2563eb',
					stroke: '#1d4ed8',
					strokeWidth: 1,
					opacity: 0.16
				}
			}
		});
		expect(scene.scenes[0].elements?.[1]?.primitive?.line?.points).toEqual([
			[0, 0.5],
			[1, 0.5]
		]);
	});

	test('rejects old array-style scene operations', () => {
		expectParseErrorCode(
			`
header:
  assets:
    - id: tree-oak
  layers:
    - name: structures
scenes:
  - id: initial
    elements: []
  - id: next
    add:
      - id: tree-1
        asset: tree-oak
        at: [1, 1]
`,
			'DSL_SCHEMA_TYPE_ERROR'
		);

		expectParseErrorCode(
			`
header:
  assets:
    - id: tree-oak
  layers:
    - name: structures
scenes:
  - id: initial
    elements: []
  - id: next
    update:
      - id: tree-1
        at: [1, 1]
`,
			'DSL_SCHEMA_TYPE_ERROR'
		);

		expectParseErrorCode(
			`
header:
  assets:
    - id: tree-oak
  layers:
    - name: structures
scenes:
  - id: initial
    elements: []
  - id: next
    remove:
      - id: tree-1
`,
			'DSL_SCHEMA_TYPE_ERROR'
		);
	});

	test('rejects authored scene progress and layout internals', () => {
		expectParseErrorCode(
			`
header:
  assets:
    - id: building-office
  layers:
    - name: structures
scenes:
  - id: initial
    at: 0
    elements: []
`,
			'UNKNOWN_FIELD'
		);

		expectParseErrorCode(
			`
header:
  assets:
    - id: building-office
  layout:
    fit: contain
  layers:
    - name: structures
scenes:
  - id: initial
    elements: []
`,
			'UNKNOWN_FIELD'
		);
	});

	test('rejects old element pos, keyframes, and lifecycle.status fields', () => {
		expectParseErrorCode(
			`
header:
  assets:
    - id: tree-oak
  floor:
    size: [2, 2]
  layers:
    - name: structures
scenes:
  - id: initial
    elements:
      - id: tree-1
        asset: tree-oak
        pos: [1, 1]
`,
			'UNKNOWN_FIELD'
		);

		expectParseErrorCode(
			`
header:
  assets:
    - id: tree-oak
  floor:
    size: [2, 2]
  layers:
    - name: structures
scenes:
  - id: initial
    elements:
      - id: tree-1
        asset: tree-oak
        at: [1, 1]
        keyframes: {}
`,
			'UNKNOWN_FIELD'
		);

		expectParseErrorCode(
			`
header:
  assets:
    - id: tree-oak
  floor:
    size: [2, 2]
  layers:
    - name: structures
scenes:
  - id: initial
    elements:
      - id: tree-1
        asset: tree-oak
        at: [1, 1]
        lifecycle:
          status: present
`,
			'UNKNOWN_FIELD'
		);
	});

	test('rejects unknown fields inside nested schema objects', () => {
		expectParseErrorCode(
			`
header:
  assets:
    - id: tree-oak
      typo: true
  floor:
    size: [2, 2]
  layers:
    - name: structures
scenes:
  - id: initial
    elements: []
`,
			'UNKNOWN_FIELD'
		);

		expectParseErrorCode(
			`
header:
  assets:
    - id: tree-oak
  floor:
    size: [2, 2]
  layers:
    - name: structures
scenes:
  - id: initial
    elements:
      - id: tree-1
        asset: tree-oak
        at: [1, 1]
        ambient:
          - name: pulse
            speed: fast
`,
			'UNKNOWN_FIELD'
		);
	});

	test('rejects invalid identifiers and malformed primitive containers', () => {
		expectParseErrorCode(
			`
header:
  assets:
    - id: TreeOak
  floor:
    size: [2, 2]
  layers:
    - name: structures
scenes:
  - id: initial
    elements: []
`,
			'INVALID_IDENTIFIER'
		);

		expectParseErrorCode(
			`
header:
  assets:
    - id: tree-oak
  floor:
    size: [2]
  layers:
    - name: structures
scenes:
  - id: initial
    elements: []
`,
			'DSL_SCHEMA_TYPE_ERROR'
		);
	});
});
