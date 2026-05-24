import { describe, expect, test } from 'bun:test';
import type {
	LayerDefinition,
	LifecycleStatus,
	ConnectionPlacement,
	ConnectionPatch,
	ConnectionRemoval,
	RuntimeBundle,
	RuntimeConnectorState,
	RuntimeConnectorStyle,
	CompiledSprite,
	PrimitiveContent,
	SceneDocument,
	SpriteSheetAssetCatalogEntry,
	SceneStep,
	TextContent
} from '../../packages/core/src/types/index.ts';
import type {
	CompiledFloor,
	CompiledLayout
} from '../../packages/core/src/dsl/index.ts';

describe('public type contracts', () => {
	test('sprite sheet asset contracts expose placeable nested sprite ids', () => {
		const sheet = {
			id: 'app-icons',
			type: 'sprite-sheet',
			path: 'sprites/app-icons.png',
			sheetSize: [512, 256],
			tileSize: [64, 64],
			sprites: {
				server: [0, 0],
				database: { at: [1, 0], anchor: [0.5, 0.92] },
				'wide-service': { rect: [128, 0, 96, 64] }
			}
		} satisfies SpriteSheetAssetCatalogEntry;
		const compiled = {
			sheetSize: [512, 256],
			rect: [64, 0, 64, 64]
		} satisfies CompiledSprite;

		expect(sheet.sprites.server).toEqual([0, 0]);
		expect(compiled.rect).toEqual([64, 0, 64, 64]);
	});

	test('LifecycleStatus excludes internal absent sentinel', () => {
		const statuses = [
			'entering',
			'present',
			'exiting',
			'removed'
		] satisfies LifecycleStatus[];

		// @ts-expect-error absent is an internal validator sentinel, not public API.
		const absent: LifecycleStatus = 'absent';

		expect(statuses).toEqual(['entering', 'present', 'exiting', 'removed']);
		expect(absent as string).toBe('absent');
	});

	test('LayerDefinition is render order only', () => {
		const layer = {
			name: 'arrow-server-db',
			order: 3
		} satisfies LayerDefinition;

		// @ts-expect-error layer keyframes are not authored in v1.
		const invalidLayer: LayerDefinition = { name: 'overlay', keyframes: {} };

		expect(layer.order).toBe(3);
		expect('keyframes' in invalidLayer).toBe(true);
	});

	test('SceneDocument uses header plus scene delta steps', () => {
		const labelText = {
			value: 'Authentication\nGateway',
			align: 'middle',
			fontSize: 12,
			fontWeight: 700,
			lineHeight: 1.2,
			fill: '#111111'
		} satisfies TextContent;
		const zonePrimitive = {
			rectangle: {
				fill: '#2563eb',
				stroke: '#1d4ed8',
				strokeWidth: 1,
				opacity: 0.16
			}
		} satisfies PrimitiveContent;

		const initial = {
			id: 'initial',
			elements: [
				{ id: 'app-server', asset: 'iso-server', at: [2, 2] },
				{ id: 'app-label', asset: 'text', at: [2, 1], text: labelText },
				{
					id: 'service-zone',
					asset: 'rectangle',
					at: [1, 1],
					primitive: zonePrimitive
				}
			],
			connections: [
				{
					id: 'app-db-link',
					route: [
						[2, 2],
						[3, 2]
					]
				} satisfies ConnectionPlacement
			]
		} satisfies SceneStep;

		const delta = {
			id: 'scaled',
			add: {
				elements: [{ id: 'database', asset: 'iso-database', at: [3, 2] }],
				connections: [
					{
						id: 'app-cache-link',
						from: { element: 'app-server' },
						to: { element: 'database' }
					} satisfies ConnectionPlacement
				]
			},
			update: [
				// @ts-expect-error old flat update arrays are not the authored v1 shape.
				{ id: 'app-server', at: [1, 2], size: 2 }
			]
		} satisfies SceneStep;

		const patched = {
			id: 'patched',
			update: {
				elements: [
					{ id: 'app-server', at: [1, 2], size: 2 },
					{ id: 'app-label', text: { value: 'Scaled\nServer' } }
				],
				connections: [
					{
						id: 'app-db-link',
						style: { pattern: 'dashed' }
					} satisfies ConnectionPatch
				]
			},
			remove: {
				elements: [{ id: 'old-cache', exit: 'fade-out' }],
				connections: [
					{ id: 'old-link', exit: 'fade-out' } satisfies ConnectionRemoval
				]
			}
		} satisfies SceneStep;

		const document = {
			header: {
				assets: [{ id: 'iso-server' }, { id: 'iso-database' }],
				floor: { size: [5, 4] },
				layers: [{ name: 'structures' }]
			},
			scenes: [initial, delta, patched]
		} satisfies SceneDocument;

		expect(document.scenes.map((scene) => scene.id)).toEqual([
			'initial',
			'scaled',
			'patched'
		]);
	});

	test('Runtime connector contracts emit concrete route and style data only', () => {
		const style = {
			variant: 'line',
			pattern: 'dashed',
			stroke: '#2563eb',
			strokeWidth: 3,
			opacity: 1,
			dash: [12, 8],
			outlineWidth: 0,
			lane: 'none'
		} satisfies RuntimeConnectorStyle;

		const connector = {
			id: 'app-db-link',
			route: [
				[1.5, 2],
				[3, 2]
			],
			layer: 'connectors',
			presence: 'present',
			style,
			start: 'none',
			end: 'arrow',
			direction: 'route',
			enter: 'fade-in',
			exit: 'fade-out'
		} satisfies RuntimeConnectorState;

		// @ts-expect-error runtime connectors never carry authored endpoints.
		connector.from;
		// @ts-expect-error runtime connectors never carry authored routing config.
		connector.routing;

		expect(connector.route[0]).toEqual([1.5, 2]);
	});

	test('RuntimeBundle exposes scenes, floor, and layout as canonical runtime data', () => {
		const floor = {
			size: [5, 4],
			origin: [0, 0],
			visible: true,
			layer: 'ground'
		} satisfies CompiledFloor;

		const layout = {
			fit: 'contain',
			align: [0.5, 0.5],
			padding: { x: 16, y: 16 },
			bounds: 'union'
		} satisfies CompiledLayout;

		const bundle = {
			_format: 'isostate-runtime-bundle',
			_version: '0.1.2',
			_digest: '0'.repeat(64),
			grid: { cellSize: 64 },
			floor,
			layout,
			theme: 'light',
			scenes: [
				{
					id: 'initial',
					progress: 0,
					elements: [
						{
							id: 'app-server',
							asset: 'iso-server',
							pos: [2, 2],
							size: 1,
							layer: 'structures',
							presence: 'present',
							text: {
								value: 'Server',
								align: 'middle'
							}
						}
					],
					connectors: []
				}
			],
			layers: [{ name: 'structures', order: 0 }]
		} satisfies RuntimeBundle;

		// @ts-expect-error old authored state lists are compatibility output only.
		bundle.states;
		// @ts-expect-error old top-level element keyframes are not canonical runtime data.
		bundle.elements;

		expect(bundle.scenes[0]?.elements[0]?.pos).toEqual([2, 2]);
	});
});
