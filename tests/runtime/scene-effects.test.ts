import { afterEach, beforeEach, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { AnimationEngine } from '../../packages/core/src/animation/animation-engine.ts';
import { AnimationController } from '../../packages/core/src/animation/controller.ts';
import {
	buildSceneDOM,
	getCurrentElementBounds,
	updateElementTransforms
} from '../../packages/core/src/rendering/rendering-engine.ts';
import { roundedPath } from '../../packages/core/src/rendering/scene-effects.ts';
import type {
	RuntimeBundle,
	RuntimeConnectorState,
	RuntimeElementState
} from '../../packages/core/src/types/index.ts';

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
let window: Window;
beforeEach(() => {
	window = new Window();
	globalThis.document = window.document as unknown as Document;
	globalThis.window = window as unknown as typeof globalThis.window;
});
afterEach(() => {
	globalThis.document = originalDocument;
	globalThis.window = originalWindow;
	window.happyDOM.abort();
});
function element(): RuntimeElementState {
	return {
		id: 'worker',
		asset: 'idle',
		pos: [1, 1],
		size: 1,
		layer: 'objects',
		presence: 'present',
		activity: { state: 'processing' }
	};
}
function connector(): RuntimeConnectorState {
	return {
		id: 'request',
		route: [
			[0, 0],
			[2, 0],
			[2, 2]
		],
		layer: 'objects',
		presence: 'present',
		style: {
			variant: 'beam',
			stroke: '#67e8f9',
			strokeWidth: 6,
			pattern: 'solid',
			opacity: 1,
			outline: '#263746',
			outlineWidth: 2,
			lane: 'none',
			cornerRadius: 10,
			glow: '#67e8f9'
		},
		start: 'none',
		end: 'arrow',
		direction: 'route',
		message: { kind: 'packet', count: 3, duration: 1800 }
	};
}
function bundle(): RuntimeBundle {
	return {
		_format: 'isostate-runtime-bundle',
		_version: '0.6.0',
		_digest: '',
		grid: { cellSize: 64 },
		floor: { size: [4, 4], origin: [0, 0], visible: false, layer: 'objects' },
		layout: {
			fit: 'contain',
			align: [0.5, 0.5],
			padding: { x: 20, y: 20 },
			bounds: 'union'
		},
		theme: 'default',
		layers: [{ name: 'objects', order: 0 }],
		assets: {
			idle: {
				url: 'sprite.png',
				sprite: { sheetSize: [128, 64], rect: [0, 0, 64, 64] }
			},
			done: {
				url: 'sprite.png',
				anchor: [0.4, 0.8],
				sprite: { sheetSize: [128, 64], rect: [64, 0, 64, 64] }
			}
		},
		scenes: [
			{
				id: 'a',
				progress: 0,
				elements: [element()],
				connectors: [connector()]
			},
			{
				id: 'b',
				progress: 1,
				elements: [
					{ ...element(), asset: 'done', activity: { state: 'complete' } }
				],
				connectors: [
					{ ...connector(), direction: 'reverse', message: { enabled: false } }
				]
			}
		]
	};
}
function mount() {
	const data = bundle();
	const container = document.createElement('div');
	document.body.appendChild(container);
	return { data, svg: buildSceneDOM(container, data) };
}
test('rounded path trims adjacent segments and retains exact endpoints', () => {
	expect(
		roundedPath(
			[
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
				{ x: 10, y: 10 }
			],
			100
		)
	).toBe('M 0 0 L 5 0 Q 10 0 10 5 L 10 10');
	expect(
		roundedPath(
			[
				{ x: 0, y: 0 },
				{ x: 0, y: 0 },
				{ x: 2, y: 2 }
			],
			20
		)
	).not.toContain('NaN');
});
test('beam tokens share rounded track geometry, stagger and survive rerouting and reversal', () => {
	const { svg } = mount();
	const shaft = svg.querySelector('.iso-connector-shaft')!;
	const tokens = svg.querySelectorAll<SVGGElement>('.iso-message');
	expect(tokens.length).toBe(3);
	expect(shaft.getAttribute('d')).toContain(' Q ');
	expect(tokens[0].style.offsetPath).toBe(`path("${shaft.getAttribute('d')}")`);
	expect(tokens[1].style.animationDelay).toBe('-600ms');
	expect(svg.querySelector('.iso-connector-highlight')).not.toBeNull();
	expect(svg.querySelector('.iso-connector-glow')).not.toBeNull();
	const next = {
		...connector(),
		direction: 'reverse' as const,
		route: [
			[0, 0],
			[3, 0],
			[3, 3]
		] as [number, number][]
	};
	updateElementTransforms(svg, [], [next]);
	expect(svg.querySelector('.iso-message')).toBe(tokens[0]);
	expect(tokens[0].style.animationDirection).toBe('reverse');
	expect(tokens[0].style.offsetPath).toBe(`path("${shaft.getAttribute('d')}")`);
	updateElementTransforms(svg, [], [{ ...next, presence: 'removed' }]);
	expect(tokens[0].style.display).toBe('none');
	updateElementTransforms(svg, [], [next]);
	expect(tokens[0].style.display).toBe('');
	updateElementTransforms(
		svg,
		[],
		[
			{
				...next,
				message: { enabled: false },
				style: { ...next.style, variant: 'line', glow: undefined }
			}
		]
	);
	expect(svg.querySelectorAll('.iso-message').length).toBe(0);
	expect(svg.querySelector('.iso-connector-glow')).toBeNull();
	expect(svg.querySelector('.iso-connector-highlight')).toBeNull();
});
test('asset and activity change only at destination, sprite viewport and anchor update on backward seeking', () => {
	const { data, svg } = mount();
	const engine = new AnimationEngine();
	engine.init(data);
	engine.setProgress(0.9);
	expect(engine.getElementUpdate('worker').asset).toBe('idle');
	expect(engine.getElementUpdate('worker').activity?.state).toBe('processing');
	expect(engine.getConnectorUpdate('request').message?.count).toBe(3);
	engine.setProgress(1);
	expect(engine.getElementUpdate('worker').activity?.state).toBe('complete');
	expect(engine.getConnectorUpdate('request').message).toEqual({
		enabled: false
	});
	const node = svg.querySelector('[data-id="worker"]')!;
	const before = getCurrentElementBounds(svg, 'worker')!;
	updateElementTransforms(
		svg,
		data.scenes[1].elements,
		data.scenes[1].connectors
	);
	expect(svg.querySelector('[data-id="worker"]')).toBe(node);
	expect(node.querySelector('svg')?.getAttribute('viewBox')).toBe('64 0 64 64');
	expect(node.getAttribute('data-asset')).toBe('done');
	expect(node.getAttribute('data-activity')).toBe('complete');
	expect(getCurrentElementBounds(svg, 'worker')?.minX).not.toBe(before.minX);
	engine.setProgress(0);
	expect(engine.getElementUpdate('worker').asset).toBe('idle');
	updateElementTransforms(
		svg,
		data.scenes[0].elements,
		data.scenes[0].connectors
	);
	expect(node.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 64 64');
	expect(node.getAttribute('data-activity')).toBe('processing');
	updateElementTransforms(svg, [{ ...element(), activity: { state: 'idle' } }]);
	expect(node.querySelector('.iso-activity')).toBeNull();
});
test('pause, resume and destroy control all CSS effects, reduced motion freezes messages', () => {
	const { data, svg } = mount();
	const controller = new AnimationController();
	controller.init(data, {}, { sceneElement: svg });
	controller.pause();
	expect(svg.classList.contains('iso-motion-paused')).toBe(true);
	controller.resume();
	expect(svg.classList.contains('iso-motion-paused')).toBe(false);
	controller.destroy();
	expect(svg.classList.contains('iso-motion-stopped')).toBe(true);
	expect(svg.querySelector('style')?.textContent).toContain(
		'.iso-message{animation:none!important;offset-distance:50%}'
	);
	expect(svg.querySelector('style')?.textContent).toContain(
		'.iso-activity *{animation:none!important}'
	);
});
