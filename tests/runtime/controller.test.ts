import { afterEach, describe, expect, test } from 'bun:test';
import { AnimationController } from '../../packages/core/src/animation/controller.ts';
import { buildSceneDOM } from '../../packages/core/src/rendering/rendering-engine.ts';
import type { ControllerError } from '../../packages/core/src/types/errors.ts';
import type { RuntimeBundle } from '../../packages/core/src/types/index.ts';

type RafCallback = (time: number) => void;

const originalRaf = globalThis.requestAnimationFrame;
const originalCancelRaf = globalThis.cancelAnimationFrame;
const originalWindow = globalThis.window;

let rafCallbacks = new Map<number, RafCallback>();
let nextRafId = 1;

function installRaf(): void {
	rafCallbacks = new Map();
	nextRafId = 1;
	globalThis.requestAnimationFrame = ((callback: RafCallback): number => {
		const id = nextRafId++;
		rafCallbacks.set(id, callback);
		return id;
	}) as typeof requestAnimationFrame;
	globalThis.cancelAnimationFrame = ((id: number): void => {
		rafCallbacks.delete(id);
	}) as typeof cancelAnimationFrame;
}

function flushRaf(time = 16): void {
	const callbacks = [...rafCallbacks.entries()];
	rafCallbacks.clear();
	for (const [, callback] of callbacks) {
		callback(time);
	}
}

function restoreGlobals(): void {
	globalThis.requestAnimationFrame = originalRaf;
	globalThis.cancelAnimationFrame = originalCancelRaf;
	globalThis.window = originalWindow;
}

function bundle(): RuntimeBundle {
	return {
		_format: 'isostate-runtime-bundle',
		_version: '0.1.2',
		_digest: '',
		grid: { cellSize: 64 },
		floor: { size: [2, 2], origin: [0, 0], visible: true, layer: 'base' },
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
				elements: [
					{
						id: 'box-a',
						asset: 'box',
						layer: 'base',
						pos: [0, 0],
						size: 1,
						presence: 'present'
					}
				]
			},
			{
				id: 'final',
				progress: 1,
				elements: [
					{
						id: 'box-a',
						asset: 'box',
						layer: 'base',
						pos: [2, 2],
						size: 1,
						presence: 'present'
					}
				]
			}
		]
	};
}

function cameraBundle(): RuntimeBundle {
	const base = bundle();
	return {
		...base,
		floor: { size: [4, 4], origin: [0, 0], visible: true, layer: 'base' },
		layout: {
			fit: 'contain',
			align: [0.5, 0.5],
			padding: { x: 16, y: 16 },
			bounds: 'union'
		},
		scenes: [
			{
				...base.scenes[0],
				id: 'overview',
				progress: 0,
				camera: { target: { type: 'reset' } }
			},
			{
				...base.scenes[0],
				id: 'focus',
				progress: 0.5,
				camera: {
					target: { type: 'area', at: [0, 0], size: [2, 2] },
					padding: 0,
					easing: 'linear'
				}
			},
			{
				...base.scenes[1],
				id: 'hold-focus',
				progress: 1
			}
		]
	};
}

function cameraAddElementBundle(): RuntimeBundle {
	const base = bundle();
	return {
		...base,
		floor: { size: [4, 4], origin: [0, 0], visible: true, layer: 'base' },
		layout: {
			fit: 'contain',
			align: [0.5, 0.5],
			padding: { x: 16, y: 16 },
			bounds: 'union'
		},
		scenes: [
			{
				...base.scenes[0],
				id: 'overview',
				progress: 0
			},
			{
				id: 'focus-widget',
				progress: 1,
				elements: [
					...base.scenes[0].elements,
					{
						id: 'widget',
						asset: 'box',
						layer: 'base',
						pos: [2, 2],
						size: 1,
						presence: 'entering',
						enter: 'fade-in'
					}
				],
				camera: { target: { type: 'element', id: 'widget' } }
			}
		]
	};
}

function cameraRemovedElementBundle(): RuntimeBundle {
	const base = bundle();
	return {
		...base,
		scenes: [
			{ ...base.scenes[0], id: 'present', progress: 0 },
			{
				id: 'removed',
				progress: 1,
				elements: [
					{
						...base.scenes[0].elements[0],
						presence: 'removed'
					}
				]
			}
		]
	};
}

function buildRealSvg(bundle: RuntimeBundle): SVGSVGElement {
	const container = document.createElement('div');
	return buildSceneDOM(container, bundle);
}

function fakeSvg(): SVGSVGElement {
	const attributes = new Map<string, string>();
	return {
		setAttribute(name: string, value: string): void {
			attributes.set(name, value);
		},
		getAttribute(name: string): string | null {
			return attributes.get(name) ?? null;
		},
		querySelector(): Element | null {
			return null;
		},
		querySelectorAll(): Element[] {
			return [];
		}
	} as unknown as SVGSVGElement;
}

function errorCode(error: unknown): string | undefined {
	return (error as ControllerError | undefined)?.code;
}

describe('AnimationController', () => {
	afterEach(() => {
		restoreGlobals();
	});

	test('batches progress forwarding with requestAnimationFrame', () => {
		installRaf();
		const controller = new AnimationController();
		controller.init(bundle(), { transitionDuration: 0 });

		controller.setProgress(0.2);
		controller.setProgress(0.8);

		expect(controller.getProgress()).toBe(0.8);
		expect(controller.engine.getProgress()).toBe(0);

		flushRaf();

		expect(controller.engine.getProgress()).toBe(0.8);
		expect(controller.engine.getElementUpdate('box-a').pos).toEqual([1.6, 1.6]);
	});

	test('manual scrubbing cancels scene navigation without interrupting ordinary navigation frames', () => {
		installRaf();
		const controller = new AnimationController();
		controller.init(bundle(), { transitionDuration: 600, transitionEasing: 'linear' });
		const start = performance.now();
		controller.setSceneIndex(1);
		flushRaf(start + 150);
		flushRaf(start + 300);
		expect(controller.getProgress()).toBeGreaterThan(0.4);
		expect(controller.getProgress()).toBeLessThan(0.6);

		controller.setProgress(0.1);
		flushRaf(start + 900);
		flushRaf(start + 1000);
		expect(controller.getProgress()).toBe(0.1);
		expect(controller.engine.getElementUpdate('box-a').pos).toEqual([0.2, 0.2]);
		expect(rafCallbacks.size).toBe(0);
		controller.destroy();
	});

	test('pause freezes scene navigation at the current progress until resume', () => {
		installRaf();
		const controller = new AnimationController();
		controller.init(bundle(), { transitionDuration: 600, transitionEasing: 'linear' });
		const start = performance.now();
		controller.setSceneIndex(1);
		flushRaf(start + 150);
		flushRaf(start + 300);
		controller.pause();
		const progress = controller.getProgress();
		flushRaf(start + 900);
		expect(controller.getProgress()).toBe(progress);
		expect(rafCallbacks.size).toBe(0);
		controller.resume();
		flushRaf(start + 1000);
		expect(controller.engine.getProgress()).toBe(progress);
		controller.destroy();
	});

	test.each(['element', 'connector'] as const)('plays directional %s lifecycle effects when seeking across add and remove stops', (kind) => {
		installRaf();
		const source = bundle();
		const element = { ...source.scenes[0].elements[0], enter: 'fall-in' as const, exit: 'slide-out-right' as const };
		source.scenes = [
			{ id: 'before', progress: 0, elements: [] },
			{ id: 'add', progress: 0.25, elements: [{ ...element, presence: 'entering' }] },
			{ id: 'hold', progress: 0.5, elements: [{ ...element, presence: 'present' }] },
			{ id: 'exit', progress: 0.75, elements: [{ ...element, presence: 'exiting' }] },
			{ id: 'after', progress: 0.9, elements: [] },
			{ id: 'later', progress: 1, elements: [] }
		];
		if (kind === 'connector') {
			for (const scene of source.scenes) {
				scene.connectors = scene.elements.map((state) => ({
					id: state.id,
					layer: state.layer,
					presence: state.presence,
					enter: state.enter,
					exit: state.exit,
					route: [[0, 0], [2, 0]],
					style: { variant: 'line', pattern: 'solid', stroke: '#123456', strokeWidth: 2, opacity: 1, outlineWidth: 0, lane: 'none' },
					start: 'none', end: 'arrow', direction: 'route'
				}));
				scene.elements = [];
			}
		}
		const svg = buildRealSvg(source);
		const controller = new AnimationController();
		controller.init(source, { sceneElement: svg });
		const node = svg.querySelector('[data-id="box-a"]') as SVGElement;

		controller.setProgress(0.6);
		flushRaf();
		expect(node.style.animation).toContain('iso-anim-fall-in');
		expect(node.style.visibility).toBe('visible');

		controller.setProgress(1);
		flushRaf();
		expect(node.style.animation).toContain('iso-anim-slide-out-right');
		expect(node.style.visibility).toBe('visible');
		node.dispatchEvent(new Event('animationend'));
		expect(node.style.visibility).toBe('hidden');

		controller.setProgress(0.6);
		flushRaf();
		expect(node.style.animation).toContain('iso-anim-slide-in-right');
		expect(node.style.visibility).toBe('visible');

		controller.setProgress(0);
		flushRaf();
		expect(node.style.animation).toContain('iso-anim-rise-away');
		controller.destroy();
	});

	test('restarts entry after an adjacent removal and reverses the re-add when scrubbing backward', () => {
		installRaf();
		const source = bundle();
		const element = { ...source.scenes[0].elements[0], enter: 'fall-in' as const, exit: 'slide-out-right' as const };
		source.scenes = [
			{ id: 'before', progress: 0, elements: [element] },
			{ id: 'remove', progress: 0.5, elements: [{ ...element, presence: 'exiting' }] },
			{ id: 'readd', progress: 1, elements: [{ ...element, presence: 'entering' }] }
		];
		const svg = buildRealSvg(source);
		const controller = new AnimationController();
		controller.init(source, { sceneElement: svg });
		const node = svg.querySelector('[data-id="box-a"]') as SVGElement;
		// Scrub before the initial entry finishes: its stale cleanup must not cancel the exit.
		controller.setProgress(0.5);
		flushRaf();
		node.dispatchEvent(new Event('animationend'));
		expect(node.style.visibility).toBe('hidden');

		controller.setProgress(1);
		flushRaf();
		expect(node.style.visibility).toBe('visible');
		expect(node.style.animation).toContain('iso-anim-fall-in');

		controller.setProgress(0.75);
		flushRaf();
		expect(node.style.animation).toContain('iso-anim-rise-away');
		controller.destroy();
	});

	test('maps scroll position to batched progress', () => {
		installRaf();
		const listeners = new Map<string, EventListener>();
		const container = {
			scrollTop: 50,
			scrollLeft: 0,
			scrollHeight: 200,
			clientHeight: 100,
			addEventListener(type: string, listener: EventListener): void {
				listeners.set(type, listener);
			},
			removeEventListener(type: string): void {
				listeners.delete(type);
			},
			querySelector(): SVGSVGElement | null {
				return null;
			}
		};
		globalThis.window = {
			addEventListener() {},
			removeEventListener() {}
		} as unknown as Window & typeof globalThis;
		const controller = new AnimationController();
		controller.init(bundle(), {
			container: container as unknown as HTMLElement
		});

		listeners.get('scroll')?.(new Event('scroll'));

		expect(controller.getProgress()).toBe(0.5);
		expect(controller.engine.getProgress()).toBe(0);

		flushRaf();

		expect(controller.engine.getProgress()).toBe(0.5);
	});

	test('pause stores progress without forwarding until resume', () => {
		installRaf();
		const controller = new AnimationController();
		controller.init(bundle());
		controller.setProgress(0.25);
		flushRaf();

		controller.pause();
		controller.setProgress(0.75);
		flushRaf();

		expect(controller.getProgress()).toBe(0.75);
		expect(controller.engine.getProgress()).toBe(0.25);

		controller.resume();
		flushRaf();

		expect(controller.engine.getProgress()).toBe(0.75);
	});

	test('scene navigation moves across compiled scene stops', () => {
		installRaf();
		const controller = new AnimationController();
		controller.init(bundle(), { transitionDuration: 0 });
		controller.setProgress(0.2);
		flushRaf();

		controller.nextScene();
		expect(controller.getSceneIndex()).toBe(1);
		expect(controller.getProgress()).toBe(1);
		flushRaf();
		expect(controller.engine.getProgress()).toBe(1);

		controller.nextScene();
		expect(controller.getSceneIndex()).toBe(0);
		expect(controller.getProgress()).toBe(0);

		controller.prevScene();
		expect(controller.getSceneIndex()).toBe(1);
		expect(controller.getProgress()).toBe(1);
	});

	test('interpolates authored camera timeline with progress in both directions', () => {
		installRaf();
		const controller = new AnimationController();
		const svg = fakeSvg();
		const cameraEvents: string[] = [];
		controller.init(
			cameraBundle(),
			{ transitionDuration: 0, sceneElement: svg },
			{ sceneElement: svg }
		);
		controller.on('camera-change', (state) => {
			cameraEvents.push(
				`${state.viewBox.minX} ${state.viewBox.minY} ${state.viewBox.width} ${state.viewBox.height}`
			);
		});

		controller.setProgress(0.25);
		flushRaf();
		const forward = svg.getAttribute('viewBox');

		controller.setProgress(0.75);
		flushRaf();
		const held = svg.getAttribute('viewBox');

		controller.setProgress(0.25);
		flushRaf();

		expect(forward).toBe('40 24 208 128');
		expect(held).toBe('80 48 128 64');
		expect(svg.getAttribute('viewBox')).toBe(forward);
		expect(cameraEvents).toContain('40 24 208 128');
	});

	test('resetZoom is a temporary override until progress rejoins authored camera timeline', () => {
		installRaf();
		const controller = new AnimationController();
		const svg = fakeSvg();
		controller.init(
			cameraBundle(),
			{ transitionDuration: 0, sceneElement: svg },
			{ sceneElement: svg }
		);
		controller.setProgress(0.5);
		flushRaf();
		expect(svg.getAttribute('viewBox')).toBe('80 48 128 64');

		controller.resetZoom({ duration: 0 });
		expect(svg.getAttribute('viewBox')).toBe('0 0 288 192');

		controller.setProgress(0.5);
		flushRaf();
		expect(svg.getAttribute('viewBox')).toBe('80 48 128 64');
	});

	test('destroy cancels pending frames, clears subscribers, and rejects later calls', () => {
		installRaf();
		const controller = new AnimationController();
		let progressEvents = 0;
		controller.init(bundle());
		controller.on('progress-change', () => {
			progressEvents++;
		});
		controller.setProgress(0.9);

		controller.destroy();
		flushRaf();

		expect(progressEvents).toBe(0);
		expect(controller.engine.bundle).toBeNull();
		expect(() => controller.setProgress(0.1)).toThrow();
		try {
			controller.setProgress(0.1);
		} catch (error) {
			expect(errorCode(error)).toBe('CONTROLLER_DESTROYED');
		}
	});

	test('uses controller error codes for missing scenes, index, and progress failures', () => {
		installRaf();
		const controller = new AnimationController();
		const empty = { ...bundle(), scenes: [] };

		try {
			controller.init(empty);
		} catch (error) {
			expect(errorCode(error)).toBe('CONTROLLER_NO_SCENES');
		}

		controller.init(bundle());

		try {
			controller.setSceneIndex(2);
		} catch (error) {
			expect(errorCode(error)).toBe('CONTROLLER_SCENE_INDEX_OUT_OF_RANGE');
		}

		try {
			controller.setProgress(Number.NaN);
		} catch (error) {
			expect(errorCode(error)).toBe('CONTROLLER_PROGRESS_OUT_OF_RANGE');
		}

		controller.setProgress(2);
		expect(controller.getProgress()).toBe(1);
	});

	test('does not crash when a scene adds an element and focuses the camera on it in the same stop', () => {
		installRaf();
		const bundleWithNewCameraTarget = cameraAddElementBundle();
		const svg = buildRealSvg(bundleWithNewCameraTarget);
		const controller = new AnimationController();
		controller.init(
			bundleWithNewCameraTarget,
			{ transitionDuration: 0, sceneElement: svg },
			{ sceneElement: svg }
		);

		expect(() => {
			for (let progress = 0; progress <= 1; progress += 0.1) {
				controller.setProgress(progress);
				flushRaf();
			}
		}).not.toThrow();

		expect(svg.getAttribute('viewBox')).toBeTruthy();
	});

	test('touch swipe applies incremental displacement instead of double-counting cumulative delta', () => {
		installRaf();
		const listeners = new Map<string, (event: TouchEvent) => void>();
		const container = {
			scrollTop: 0,
			scrollLeft: 0,
			scrollHeight: 100,
			clientHeight: 100,
			addEventListener(
				type: string,
				listener: (event: TouchEvent) => void
			): void {
				listeners.set(type, listener);
			},
			removeEventListener(type: string): void {
				listeners.delete(type);
			},
			querySelector(): SVGSVGElement | null {
				return null;
			}
		};
		globalThis.window = {
			addEventListener() {},
			removeEventListener() {}
		} as unknown as Window & typeof globalThis;
		const controller = new AnimationController();
		controller.init(bundle(), {
			container: container as unknown as HTMLElement,
			touchControls: true
		});

		const touch = (clientY: number): TouchEvent =>
			({ touches: [{ clientY, clientX: 0 }] }) as unknown as TouchEvent;

		listeners.get('touchstart')?.(touch(300));
		listeners.get('touchmove')?.(touch(280));
		listeners.get('touchmove')?.(touch(260));
		listeners.get('touchmove')?.(touch(240));
		listeners.get('touchmove')?.(touch(220));
		listeners.get('touchmove')?.(touch(200));

		// Total displacement is 100px over default 300px scale => 100/300 progress.
		expect(controller.getProgress()).toBeCloseTo(100 / 300, 5);
	});

	test('keyboardControls binds keydown navigation without a scroll container', () => {
		installRaf();
		const controller = new AnimationController();
		controller.init(bundle(), {
			transitionDuration: 0,
			keyboardControls: true
		});

		const event = new (
			globalThis.window as unknown as { KeyboardEvent: typeof KeyboardEvent }
		).KeyboardEvent('keydown', { key: 'ArrowRight' });
		document.dispatchEvent(event);

		expect(controller.getSceneIndex()).toBe(1);
		expect(controller.getProgress()).toBe(1);

		controller.destroy();
	});

	test('applies scrollSensitivity before min/maxProgress clamping and keeps the dedupe guard in sync', () => {
		installRaf();
		const listeners = new Map<string, EventListener>();
		const container = {
			scrollTop: 0,
			scrollLeft: 0,
			scrollHeight: 200,
			clientHeight: 100,
			addEventListener(type: string, listener: EventListener): void {
				listeners.set(type, listener);
			},
			removeEventListener(type: string): void {
				listeners.delete(type);
			},
			querySelector(): SVGSVGElement | null {
				return null;
			}
		};
		globalThis.window = {
			addEventListener() {},
			removeEventListener() {}
		} as unknown as Window & typeof globalThis;
		const controller = new AnimationController();
		controller.init(bundle(), {
			container: container as unknown as HTMLElement,
			minProgress: 0.2,
			maxProgress: 0.8,
			scrollSensitivity: 1.5
		});

		container.scrollTop = 100; // 100% of scrollable range
		listeners.get('scroll')?.(new Event('scroll'));
		expect(controller.getProgress()).toBe(0.8);

		// A different scroll position that shares the same pre-sensitivity
		// clamped fraction as a stale post-sensitivity progress must still update.
		container.scrollTop = 50; // 50% of range
		listeners.get('scroll')?.(new Event('scroll'));
		expect(controller.getProgress()).toBeCloseTo(0.75, 5);
	});

	test('setProgress() moves the scene index so nextScene()/prevScene() continue from the seek', () => {
		installRaf();
		const controller = new AnimationController();
		controller.init(cameraBundle(), { transitionDuration: 0 });
		const changes: number[] = [];
		controller.on('scene-change', (index) => {
			changes.push(index);
		});

		controller.setProgress(0.5);
		flushRaf();
		expect(controller.getSceneIndex()).toBe(1);

		controller.nextScene();
		expect(controller.getSceneIndex()).toBe(2);
		expect(controller.getProgress()).toBe(1);

		controller.setProgress(0.7);
		flushRaf();
		expect(controller.getSceneIndex()).toBe(1);

		controller.prevScene();
		expect(controller.getSceneIndex()).toBe(0);
		expect(controller.getProgress()).toBe(0);

		controller.setProgress(0.2);
		expect(controller.getSceneIndex()).toBe(0);
		expect(changes).toEqual([1, 2, 1, 0]);
	});

	test('setSceneIndex() resets progress and camera even when the target index matches the stale scene index', () => {
		installRaf();
		const controller = new AnimationController();
		controller.init(bundle(), { transitionDuration: 0 });

		controller.setProgress(0.9);
		flushRaf();
		expect(controller.getSceneIndex()).toBe(0);
		expect(controller.getProgress()).toBe(0.9);

		let sceneChangeEvents = 0;
		controller.on('scene-change', () => {
			sceneChangeEvents++;
		});

		controller.setSceneIndex(0);
		flushRaf();

		expect(controller.getProgress()).toBe(0);
		expect(sceneChangeEvents).toBe(1);
	});

	test('nextScene() with transitionDuration 0 cancels an in-flight camera override animation', () => {
		installRaf();
		const svg = fakeSvg();
		const controller = new AnimationController();
		controller.init(
			cameraBundle(),
			{ transitionDuration: 0, sceneElement: svg },
			{ sceneElement: svg }
		);
		flushRaf();

		controller.zoomToArea({ at: [0, 0], size: [1, 1] }, { duration: 1000 });
		// A camera override animation is now in-flight: exactly one rAF callback
		// (the camera step) is pending.
		expect(rafCallbacks.size).toBe(1);

		controller.nextScene();

		// nextScene() with transitionDuration 0 must cancel the pending camera
		// override rAF unconditionally, leaving only the progress-forward frame
		// scheduled by _scheduleProgressForward().
		expect(rafCallbacks.size).toBe(1);
		flushRaf();

		// The applied viewBox must be the destination scene's progress-derived
		// camera, not a value still animating toward the cancelled override.
		expect(svg.getAttribute('viewBox')).toBe('80 48 128 64');
	});

	test('pause() and resume() toggle ambient CSS animations when a sceneElement is configured without a scroll container', () => {
		installRaf();
		const svg = buildRealSvg(bundle());
		const controller = new AnimationController();
		controller.init(
			bundle(),
			{ transitionDuration: 0, sceneElement: svg },
			{ sceneElement: svg }
		);

		// bundle() has no ambient elements; add a synthetic ambient class to assert the play-state toggle path runs.
		const target = svg.querySelector('[data-id="box-a"]') as Element | null;
		target?.classList.add('iso-ambient-pulse');

		controller.pause();
		expect(
			(target as unknown as { style: CSSStyleDeclaration } | null)?.style
				.animationPlayState
		).toBe('paused');

		controller.resume();
		expect(
			(target as unknown as { style: CSSStyleDeclaration } | null)?.style
				.animationPlayState
		).toBe('running');
	});

	test('zoomToElement distinguishes unknown ids from removed elements', () => {
		installRaf();
		const removedBundle = cameraRemovedElementBundle();
		const svg = buildRealSvg(removedBundle);
		const controller = new AnimationController();
		controller.init(
			removedBundle,
			{ transitionDuration: 0, sceneElement: svg },
			{ sceneElement: svg }
		);

		try {
			controller.zoomToElement('does-not-exist');
			throw new Error('expected throw');
		} catch (error) {
			expect(errorCode(error)).toBe('CAMERA_TARGET_NOT_FOUND');
		}

		controller.setProgress(1);
		flushRaf();

		try {
			controller.zoomToElement('box-a');
			throw new Error('expected throw');
		} catch (error) {
			expect(errorCode(error)).toBe('CAMERA_TARGET_NOT_VISIBLE');
		}
	});
});
