import { afterEach, describe, expect, test } from 'bun:test';
import { AnimationController } from '../../packages/core/src/animation/controller.ts';
import type { RuntimeBundle } from '../../packages/core/src/types/index.ts';
import type { ControllerError } from '../../packages/core/src/types/errors.ts';

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
		_version: '0.1.1',
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
});
