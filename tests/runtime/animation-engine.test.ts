import { describe, expect, test } from 'bun:test';
import { AnimationEngine } from '../../packages/core/src/animation/animation-engine.ts';
import type { RuntimeBundle } from '../../packages/core/src/types/index.ts';

function bundle(): RuntimeBundle {
	return {
		_format: 'isostate-runtime-bundle',
		_version: '0.1.0',
		_digest: '',
		grid: { cellSize: 64 },
		floor: { size: [4, 4], origin: [0, 0], visible: true, layer: 'base' },
		layout: {
			fit: 'contain',
			align: [0.5, 0.5],
			padding: { x: 16, y: 16 },
			bounds: 'union'
		},
		theme: 'default',
		layers: [{ name: 'base', order: 0 }],
		assets: {
			box: { url: './assets/box.svg' }
		},
		scenes: [
			{
				id: 'initial',
				progress: 0,
				connectors: [],
				elements: [
					{
						id: 'office',
						asset: 'box',
						layer: 'base',
						pos: [0, 0],
						size: 1,
						presence: 'present',
						ambient: [{ name: 'pulse' }]
					}
				]
			},
			{
				id: 'expanded',
				progress: 0.5,
				connectors: [],
				elements: [
					{
						id: 'office',
						asset: 'box',
						layer: 'base',
						pos: [4, 2],
						size: 3,
						presence: 'present',
						ambient: [{ name: 'glow' }]
					}
				]
			},
			{
				id: 'removed',
				progress: 1,
				connectors: [],
				elements: [
					{
						id: 'office',
						asset: 'box',
						layer: 'base',
						pos: [4, 2],
						size: 3,
						presence: 'exiting',
						exit: 'fade-out-shrink'
					}
				]
			}
		]
	};
}

describe('AnimationEngine', () => {
	test('interpolates position and size between compiled scene stops', () => {
		const engine = new AnimationEngine();
		engine.init(bundle());

		engine.setProgress(0.25);

		const update = engine.getElementUpdate('office');
		expect(update.pos).toEqual([2, 1]);
		expect(update.size).toBe(2);
		expect(update.lifecycle).toBe('present');
	});

	test('captures lifecycle transitions from compiled presence fields', () => {
		const engine = new AnimationEngine();
		engine.init(bundle());

		engine.setProgress(0.5);
		expect(engine.getLifecycleTransition('office')).toBeNull();

		engine.setProgress(1);
		expect(engine.getLifecycleTransition('office')).toEqual({
			from: 'present',
			to: 'exiting'
		});
		expect(engine.getElementUpdate('office').exit).toBe('fade-out-shrink');
	});

	test('removes later-added elements when scrubbing back before their scene', () => {
		const engine = new AnimationEngine();
		engine.init(bundleWithAddedElement());

		engine.setProgress(1);
		expect(engine.getElementUpdate('badge').lifecycle).toBe('entering');
		expect(engine.getLifecycleTransition('badge')).toEqual({
			from: 'removed',
			to: 'entering'
		});

		engine.setProgress(0.25);
		expect(engine.getElementUpdate('badge').lifecycle).toBe('removed');
		expect(engine.getLifecycleTransition('badge')).toEqual({
			from: 'entering',
			to: 'removed'
		});

		engine.setProgress(0);
		expect(engine.getElementUpdate('badge').lifecycle).toBe('removed');
	});

	test('uses discrete ambient values from the destination stop', () => {
		const engine = new AnimationEngine();
		engine.init(bundle());

		engine.setProgress(0.25);
		expect(engine.getElementUpdate('office').ambient).toEqual([
			{ name: 'glow' }
		]);

		engine.setProgress(1);
		expect(engine.getElementUpdate('office').ambient).toEqual([]);
	});

	test('pause freezes the current frame until resume', () => {
		const engine = new AnimationEngine();
		engine.init(bundle());
		engine.setProgress(0.25);
		engine.pause();

		engine.setProgress(0.5);

		expect(engine.getProgress()).toBe(0.25);
		expect(engine.getElementUpdate('office').pos).toEqual([2, 1]);

		engine.resume();
		engine.setProgress(0.5);
		expect(engine.getElementUpdate('office').pos).toEqual([4, 2]);
	});

	test('interpolates connector routes point-by-point in grid space', () => {
		const engine = new AnimationEngine();
		engine.init(bundleWithConnectors());

		engine.setProgress(0.5);

		const update = engine.getConnectorUpdate('request-flow');
		expect(update.route).toEqual([
			[0, 1],
			[2, 1]
		]);
		expect(update.lifecycle).toBe('present');
		expect(update.ambient).toEqual([{ name: 'flow' }]);
	});

	test('holds connector route when point counts differ until destination stop', () => {
		const engine = new AnimationEngine();
		engine.init(bundleWithConnectors({ differentPointCounts: true }));

		engine.setProgress(0.5);
		expect(engine.getConnectorUpdate('request-flow').route).toEqual([
			[0, 0],
			[2, 0]
		]);

		engine.setProgress(1);
		expect(engine.getConnectorUpdate('request-flow').route).toEqual([
			[0, 2],
			[1, 3],
			[2, 2]
		]);
	});

	test('mirrors element lifecycle for connector add remove and backward scrubbing', () => {
		const engine = new AnimationEngine();
		engine.init(bundleWithConnectorLifecycle());

		engine.setProgress(0.5);
		expect(engine.getConnectorUpdate('request-flow').lifecycle).toBe(
			'entering'
		);
		expect(engine.getConnectorLifecycleTransition('request-flow')).toEqual({
			from: 'removed',
			to: 'entering'
		});

		engine.setProgress(1);
		expect(engine.getConnectorUpdate('request-flow').lifecycle).toBe('exiting');
		expect(engine.getConnectorLifecycleTransition('request-flow')).toEqual({
			from: 'entering',
			to: 'exiting'
		});

		engine.setProgress(0);
		expect(engine.getConnectorUpdate('request-flow').lifecycle).toBe('removed');
		expect(engine.getConnectorLifecycleTransition('request-flow')).toEqual({
			from: 'exiting',
			to: 'removed'
		});
	});
});

function bundleWithAddedElement(): RuntimeBundle {
	const base = bundle();
	return {
		...base,
		scenes: [
			base.scenes[0],
			{
				id: 'badge-added',
				progress: 1,
				connectors: [],
				elements: [
					...base.scenes[0].elements,
					{
						id: 'badge',
						asset: 'box',
						layer: 'base',
						pos: [1, 1],
						size: 1,
						presence: 'entering',
						enter: 'fade-in'
					}
				]
			}
		]
	};
}

function bundleWithConnectors(
	options: { differentPointCounts?: boolean } = {}
): RuntimeBundle {
	const base = bundle();
	return {
		...base,
		layers: [
			{ name: 'base', order: 0 },
			{ name: 'connectors', order: 1 }
		],
		scenes: [
			{
				...base.scenes[0],
				connectors: [
					connector({
						route: [
							[0, 0],
							[2, 0]
						],
						ambient: [{ name: 'flow' }]
					})
				]
			},
			{
				...base.scenes[0],
				id: 'routed',
				progress: 1,
				connectors: [
					connector({
						route: options.differentPointCounts
							? [
									[0, 2],
									[1, 3],
									[2, 2]
								]
							: [
									[0, 2],
									[2, 2]
								],
						ambient: [{ name: 'flow' }]
					})
				]
			}
		]
	};
}

function bundleWithConnectorLifecycle(): RuntimeBundle {
	const base = bundle();
	return {
		...base,
		scenes: [
			{ ...base.scenes[0], connectors: [] },
			{
				...base.scenes[0],
				id: 'connector-in',
				progress: 0.5,
				connectors: [connector({ presence: 'entering', enter: 'fade-in' })]
			},
			{
				...base.scenes[0],
				id: 'connector-out',
				progress: 1,
				connectors: [connector({ presence: 'exiting', exit: 'fade-out' })]
			}
		]
	};
}

function connector(
	overrides: Partial<RuntimeBundle['scenes'][number]['connectors'][number]> = {}
): RuntimeBundle['scenes'][number]['connectors'][number] {
	return {
		id: 'request-flow',
		route: [
			[0, 0],
			[2, 0]
		],
		layer: 'connectors',
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
		...overrides
	};
}
