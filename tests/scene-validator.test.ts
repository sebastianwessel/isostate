import { describe, expect, test } from 'bun:test';
import {
	parseScene,
	resolveSceneSnapshots,
	validateScene
} from '../packages/core/src/dsl/index';
import type { SceneDocument } from '../packages/core/src/types/index';

function validDocument(): SceneDocument {
	return parseScene(`
header:
  assetBaseUrl: ./assets
  assets:
    - id: building-office
    - id: tree-oak
    - id: road-path
  floor:
    size: [5, 4]
    layer: ground
    asset: road-path
  layers:
    - name: ground
    - name: connectors
    - name: structures
scenes:
  - id: initial
    elements:
      - id: office-1
        asset: building-office
        at: [2, 2]
        size: 2
        layer: structures
        enter: rise-from-ground
        ambient:
          - name: pulse
    connections:
      - id: office-road
        route: [[2, 4], [4, 4]]
        layer: connectors
        style:
          variant: road
          lane: center-dashed
  - id: expanded
    add:
      elements:
        - id: tree-1
          asset: tree-oak
          at: [3, 1]
      connections:
        - id: tree-flow
          from:
            element: office-1
            side: right
          to:
            element: tree-1
            side: left
          style:
            pattern: dotted
          ambient:
            - name: flow
    update:
      elements:
        - id: office-1
          at: [3, 2]
  - id: removed
    remove:
      elements:
        - id: tree-1
          exit: fade-out
      connections:
        - id: tree-flow
          exit: fade-out
`);
}

function firstInitialElement(document: SceneDocument) {
	const element = document.scenes[0]?.elements?.[0];
	if (!element) {
		throw new Error('Expected validDocument to include an initial element');
	}
	return element;
}

function expectErrorCode(document: SceneDocument, code: string) {
	const report = validateScene(document);
	expect(report.isValid).toBe(false);
	expect(report.errors.find((error) => error.code === code)).toBeDefined();
}

describe('validateScene', () => {
	test('passes validation on a valid header and scene-delta timeline', () => {
		const report = validateScene(validDocument());

		expect(report.isValid).toBe(true);
		expect(report.errors).toEqual([]);
	});

	test('validates header assets, floor, and layers', () => {
		expectErrorCode(
			parseScene(`
header:
  assets: []
  floor:
    size: [1, 1]
  layers:
    - name: ground
scenes:
  - id: initial
    elements: []
`),
			'NO_ASSETS'
		);

		expectErrorCode(
			parseScene(`
header:
  assetBaseUrl: ./assets
  assets:
    - id: building-office
    - id: building-office
  floor:
    size: [1, 1]
  layers:
    - name: ground
scenes:
  - id: initial
    elements: []
`),
			'DUPLICATE_ASSET_ID'
		);

		expectErrorCode(
			parseScene(`
header:
  assetBaseUrl: ./assets
  assets:
    - id: building-office
      anchor: [1.25, 1]
  floor:
    size: [1, 1]
  layers:
    - name: ground
scenes:
  - id: initial
    elements: []
`),
			'INVALID_ASSET_ANCHOR'
		);

		expectErrorCode(
			parseScene(`
header:
  assets: []
  floor:
    size: [0, 1]
  layers:
    - name: ground
scenes:
  - id: initial
    elements: []
`),
			'INVALID_FLOOR_SIZE'
		);

		expectErrorCode(
			parseScene(`
header:
  assets: []
  floor:
    size: [1, 1]
    layer: missing-layer
  layers:
    - name: ground
scenes:
  - id: initial
    elements: []
`),
			'LAYER_NOT_FOUND'
		);

		expectErrorCode(
			parseScene(`
header:
  assets:
    - id: building-office
  floor:
    size: [1, 1]
    asset: road-path
  layers:
    - name: ground
scenes:
  - id: initial
    elements: []
`),
			'ASSET_NOT_DECLARED'
		);
	});

	test('validates scene step shape', () => {
		expectErrorCode(
			parseScene(`
header:
  assets:
    - id: building-office
  floor:
    size: [1, 1]
  layers:
    - name: ground
scenes: []
`),
			'NO_SCENES'
		);

		expectErrorCode(
			parseScene(`
header:
  assets:
    - id: building-office
  floor:
    size: [1, 1]
  layers:
    - name: ground
scenes:
  - id: initial
    elements: []
  - id: initial
    add:
      elements: []
`),
			'DUPLICATE_SCENE_ID'
		);
		expectErrorCode(
			parseScene(`
header:
  assets:
    - id: building-office
  floor:
    size: [1, 1]
  layers:
    - name: ground
scenes:
  - id: initial
    add:
      elements:
        - id: tree-1
          asset: tree-oak
          at: [0, 0]
`),
			'INVALID_INITIAL_SCENE'
		);

		expectErrorCode(
			parseScene(`
header:
  assets:
    - id: building-office
  floor:
    size: [1, 1]
  layers:
    - name: ground
scenes:
  - id: initial
    elements: []
  - id: next
    elements: []
`),
			'INVALID_SCENE_DELTA'
		);

		expectErrorCode(
			parseScene(`
header:
  assets:
    - id: building-office
  floor:
    size: [1, 1]
  layers:
    - name: ground
scenes:
  - id: initial
    elements: []
  - id: next
    connections:
      - id: late-link
        route: [[0, 0], [1, 1]]
`),
			'INVALID_SCENE_DELTA'
		);
	});

	test('validates element delta legality', () => {
		const alreadyPresent = validDocument();
		alreadyPresent.scenes[1].add = {
			elements: [{ id: 'office-1', asset: 'tree-oak', at: [0, 0] }]
		};
		expectErrorCode(alreadyPresent, 'ELEMENT_ALREADY_PRESENT');

		const missingUpdate = validDocument();
		missingUpdate.scenes[1].update = {
			elements: [{ id: 'missing', at: [0, 0] }]
		};
		expectErrorCode(missingUpdate, 'ELEMENT_NOT_PRESENT');

		const missingRemove = validDocument();
		missingRemove.scenes[1].remove = { elements: [{ id: 'missing' }] };
		expectErrorCode(missingRemove, 'ELEMENT_NOT_PRESENT');

		const conflict = validDocument();
		conflict.scenes[1].remove = { elements: [{ id: 'office-1' }] };
		expectErrorCode(conflict, 'ELEMENT_DELTA_CONFLICT');
	});

	test('validates connection ids, endpoints, and endpoint removal', () => {
		const duplicate = validDocument();
		duplicate.scenes[0].connections?.push({
			id: 'office-road',
			route: [
				[0, 0],
				[1, 0]
			]
		});
		expectErrorCode(duplicate, 'DUPLICATE_CONNECTOR_ID');

		const collision = validDocument();
		collision.scenes[0].connections?.push({
			id: 'office-1',
			route: [
				[0, 0],
				[1, 0]
			]
		});
		expectErrorCode(collision, 'DUPLICATE_SCENE_OBJECT_ID');

		const missingEndpoint = validDocument();
		missingEndpoint.scenes[1].add?.connections?.push({
			id: 'missing-link',
			from: { element: 'missing' },
			to: { element: 'office-1' }
		});
		expectErrorCode(missingEndpoint, 'CONNECTOR_ENDPOINT_NOT_FOUND');

		const endpointRemoved = validDocument();
		endpointRemoved.scenes[2].remove = { elements: [{ id: 'tree-1' }] };
		expectErrorCode(endpointRemoved, 'CONNECTION_ENDPOINT_REMOVED');
	});

	test('validates connection route, routing, style, direction, and flow ambient', () => {
		const invalidManualRoute = validDocument();
		invalidManualRoute.scenes[0].connections?.push({
			id: 'bad-route',
			route: [[0, 0]]
		});
		expectErrorCode(invalidManualRoute, 'INVALID_CONNECTOR_ROUTE');

		const diagonalManualRoute = validDocument();
		diagonalManualRoute.scenes[0].connections?.push({
			id: 'diagonal-route',
			route: [
				[0, 0],
				[1, 1]
			]
		});
		expectErrorCode(diagonalManualRoute, 'INVALID_CONNECTOR_ROUTE');

		const invalidRouting = validDocument();
		invalidRouting.scenes[0].connections?.push({
			id: 'bad-routing',
			route: [
				[0, 0],
				[1, 0]
			],
			routing: { mode: 'orthogonal' }
		});
		expectErrorCode(invalidRouting, 'INVALID_CONNECTOR_ROUTING');

		const invalidStyle = validDocument();
		invalidStyle.scenes[0].connections?.push({
			id: 'bad-style',
			route: [
				[0, 0],
				[1, 0]
			],
			style: { pattern: 'zigzag' as never }
		});
		expectErrorCode(invalidStyle, 'INVALID_CONNECTOR_STYLE');

		const invalidDirection = validDocument();
		invalidDirection.scenes[0].connections?.push({
			id: 'bad-direction',
			route: [
				[0, 0],
				[1, 0]
			],
			direction: 'sideways' as never
		});
		expectErrorCode(invalidDirection, 'INVALID_CONNECTOR_DIRECTION');

		const flowOnConnection = validDocument();
		flowOnConnection.scenes[0].connections?.push({
			id: 'flow-link',
			route: [
				[0, 0],
				[1, 0]
			],
			ambient: [{ name: 'flow' }]
		});
		expect(validateScene(flowOnConnection).isValid).toBe(true);
	});

	test('validates element references, primitives, and animations', () => {
		const undeclaredAsset = validDocument();
		firstInitialElement(undeclaredAsset).asset = 'missing-asset';
		expectErrorCode(undeclaredAsset, 'ASSET_NOT_DECLARED');

		const missingUrl = validDocument();
		missingUrl.header.assetBaseUrl = undefined;
		expectErrorCode(missingUrl, 'ASSET_URL_REQUIRED');

		const layerMissing = validDocument();
		firstInitialElement(layerMissing).layer = 'missing-layer';
		expectErrorCode(layerMissing, 'LAYER_NOT_FOUND');

		const invalidPosition = validDocument();
		firstInitialElement(invalidPosition).at = [-1, 0];
		expectErrorCode(invalidPosition, 'INVALID_POSITION');

		const invalidSize = validDocument();
		firstInitialElement(invalidSize).size = 0;
		expectErrorCode(invalidSize, 'INVALID_SIZE');

		const unknownEnter = validDocument();
		firstInitialElement(unknownEnter).enter = 'unknown' as never;
		expectErrorCode(unknownEnter, 'UNKNOWN_ANIMATION');

		const unknownAmbient = validDocument();
		firstInitialElement(unknownAmbient).ambient = [{ id: 'unknown' }];
		expectErrorCode(unknownAmbient, 'UNKNOWN_AMBIENT_ANIMATION');

		const invalidAmbientIterations = validDocument();
		firstInitialElement(invalidAmbientIterations).ambient = [
			{ id: 'pulse', infinite: false, iterations: 0 }
		];
		expectErrorCode(invalidAmbientIterations, 'INVALID_AMBIENT_ITERATIONS');
	});

	test('validates built-in text elements without requiring external assets', () => {
		const document = parseScene(`
header:
  assets: []
  floor:
    size: [4, 4]
  layers:
    - name: labels
scenes:
  - id: initial
    elements:
      - id: label-1
        asset: text
        at: [1, 1]
        layer: labels
        text:
          value: |
            Authentication
            Gateway
          align: middle
          fontSize: 12
          fontWeight: 700
          lineHeight: 1.2
          fill: "#111111"
  - id: renamed
    update:
      elements:
        - id: label-1
          text:
            value: "Auth\\nGateway"
`);

		const report = validateScene(document);
		const snapshots = resolveSceneSnapshots(document);

		expect(report.isValid).toBe(true);
		expect(report.errors).toEqual([]);
		expect(snapshots[0].elements[0]).toEqual(
			expect.objectContaining({
				asset: 'text',
				text: expect.objectContaining({
					value: 'Authentication\nGateway\n',
					align: 'middle'
				})
			})
		);
		expect(snapshots[1].elements[0].text?.value).toBe('Auth\nGateway');
	});

	test('rejects invalid text asset authoring', () => {
		const missingText = validDocument();
		firstInitialElement(missingText).asset = 'text';
		expectErrorCode(missingText, 'TEXT_CONTENT_REQUIRED');

		const textOnSvgAsset = validDocument();
		firstInitialElement(textOnSvgAsset).text = { value: 'Label' };
		expectErrorCode(textOnSvgAsset, 'TEXT_CONTENT_FOR_NON_TEXT_ASSET');

		const emptyText = validDocument();
		firstInitialElement(emptyText).asset = 'text';
		firstInitialElement(emptyText).text = { value: '' };
		expectErrorCode(emptyText, 'INVALID_TEXT_CONTENT');

		const unsafeFill = validDocument();
		firstInitialElement(unsafeFill).asset = 'text';
		firstInitialElement(unsafeFill).text = {
			value: 'Label',
			fill: 'url(javascript:alert(1))'
		};
		expectErrorCode(unsafeFill, 'INVALID_TEXT_STYLE');
	});

	test('warns for unused declarations and floor-bound content', () => {
		const doc = validDocument();
		doc.header.assets.push({ id: 'unused-asset' });
		doc.header.layers.push({ name: 'unused-layer' });
		firstInitialElement(doc).at = [10, 2];

		const report = validateScene(doc);

		expect(report.isValid).toBe(true);
		expect(
			report.warnings.find((w) => w.code === 'UNREFERENCED_ASSET')
		).toBeDefined();
		expect(
			report.warnings.find((w) => w.code === 'UNREFERENCED_LAYER')
		).toBeDefined();
		expect(
			report.warnings.find((w) => w.code === 'ELEMENT_OUTSIDE_FLOOR')
		).toBeDefined();
	});
});

describe('resolveSceneSnapshots', () => {
	test('expands scene deltas into resolved snapshots', () => {
		const snapshots = resolveSceneSnapshots(validDocument());

		expect(snapshots.map((snapshot) => snapshot.progress)).toEqual([0, 0.5, 1]);
		expect(snapshots[0].elements).toEqual([
			expect.objectContaining({
				id: 'office-1',
				pos: [2, 2],
				presence: 'present'
			})
		]);
		expect(snapshots[0].connectors).toEqual([
			expect.objectContaining({
				id: 'office-road',
				route: [
					[2, 4],
					[4, 4]
				],
				presence: 'present'
			})
		]);
		expect(snapshots[1].elements).toEqual([
			expect.objectContaining({
				id: 'office-1',
				pos: [3, 2],
				presence: 'present'
			}),
			expect.objectContaining({
				id: 'tree-1',
				pos: [3, 1],
				presence: 'entering'
			})
		]);
		expect(snapshots[1].connectors).toEqual([
			expect.objectContaining({ id: 'office-road', presence: 'present' }),
			expect.objectContaining({
				id: 'tree-flow',
				presence: 'entering',
				route: expect.any(Array)
			})
		]);
		expect(snapshots[2].elements).toEqual([
			expect.objectContaining({ id: 'office-1', presence: 'present' }),
			expect.objectContaining({ id: 'tree-1', presence: 'exiting' })
		]);
		expect(snapshots[2].connectors).toEqual([
			expect.objectContaining({ id: 'office-road', presence: 'present' }),
			expect.objectContaining({ id: 'tree-flow', presence: 'exiting' })
		]);
	});
});
