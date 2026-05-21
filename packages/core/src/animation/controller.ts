import {
	animateElement,
	getConnectorState,
	getElementState,
	hideElementAfterExit,
	unhideElementOnReadd,
	updateElementTransforms
} from '../rendering/rendering-engine.ts';
import { ControllerError } from '../types/errors.ts';
import type {
	EntryAnimation,
	ExitAnimation,
	RuntimeConnectorState,
	RuntimeElementState
} from '../types/node.ts';
import type { RuntimeBundle } from '../types/runtime-bundle.ts';
import { type EasingType, resolveEasing } from '../utils/easing.ts';
import { AnimationEngine } from './animation-engine.ts';

// ── Event types ────────────────────────────────────────────────────────────

export interface ControllerEvents {
	'progress-change': (progress: number) => void;
	'scene-change': (index: number) => void;
	paused: () => void;
	resumed: () => void;
}

type EventKey = keyof ControllerEvents;
type EventListener<K extends EventKey> = ControllerEvents[K];
type AnyEventListener = (...args: unknown[]) => void;
type LifecycleTransition = {
	from: RuntimeElementState['presence'];
	to: RuntimeElementState['presence'];
};

// ── Controller config ──────────────────────────────────────────────────────

export interface ControllerConfig {
	/** Scroll container used to derive progress. Defaults to the mount target in `mountScene()`. */
	container?: HTMLElement;
	/** SVG scene updated by this controller. Defaults to the first SVG in `container` for direct controller usage. */
	sceneElement?: SVGSVGElement;
	scrollDirection?: 'vertical' | 'horizontal';
	scrollOffset?: {
		top?: number;
		bottom?: number;
		left?: number;
		right?: number;
	};
	minProgress?: number;
	maxProgress?: number;
	keyboardControls?: boolean;
	touchControls?: boolean;
	scrollSensitivity?: number;
	transitionDuration?: number;
	transitionEasing?: 'linear' | 'ease-in-out' | 'ease-out';
}

type ResolvedControllerConfig = Required<
	Omit<ControllerConfig, 'container' | 'sceneElement'>
> & {
	container?: HTMLElement;
	sceneElement?: SVGSVGElement;
};

const DEFAULT_CONFIG: Required<
	Omit<ControllerConfig, 'container' | 'sceneElement'>
> = {
	scrollDirection: 'vertical',
	scrollOffset: {},
	minProgress: 0,
	maxProgress: 1,
	keyboardControls: false,
	touchControls: false,
	scrollSensitivity: 1.0,
	transitionDuration: 600,
	transitionEasing: 'ease-in-out'
};

interface ControllerRuntime {
	engine?: AnimationEngine;
	sceneElement?: SVGSVGElement;
}

// ── Controller implementation ──────────────────────────────────────────────

/**
 * Animation controller — manages scroll progress, scene navigation,
 * and delegates to the animation engine for frame updates.
 */
export class AnimationController {
	private _engine = new AnimationEngine();
	private _bundle: RuntimeBundle | null = null;
	private _sceneIndex = 0;
	private _progress = 0;
	private _paused = false;
	private _config: ResolvedControllerConfig = DEFAULT_CONFIG;
	private _container: HTMLElement | null = null;
	private _sceneElement: SVGSVGElement | null = null;
	private _ownsEngine = true;
	private _rafId: number | null = null;
	private _pendingProgress: number | null = null;
	private _destroyed = false;
	private _listeners: Map<EventKey, Set<AnyEventListener>> = new Map();

	// Scroll tracking state
	private _minScroll = 0;
	private _maxScroll = 0;
	private _touchStartY = 0;
	private _touchStartX = 0;
	private _isDragging = false;

	// Transition animation state
	private _transitionAnim: ReturnType<typeof requestAnimationFrame> | null =
		null;

	get engine(): AnimationEngine {
		return this._engine;
	}

	get progress(): number {
		return this._progress;
	}

	getProgress(): number {
		this._assertNotDestroyed();
		return this._progress;
	}

	get sceneIndex(): number {
		return this._sceneIndex;
	}

	getSceneIndex(): number {
		this._assertNotDestroyed();
		return this._sceneIndex;
	}

	get scenes(): RuntimeBundle['scenes'] {
		return this._bundle?.scenes ?? [];
	}

	get paused(): boolean {
		return this._paused;
	}

	get currentScene(): RuntimeBundle['scenes'][number] | undefined {
		return this.scenes[this._sceneIndex];
	}

	/**
	 * Initialize the controller with a compiled bundle and optional runtime resources.
	 */
	init(
		bundle: RuntimeBundle,
		config: ControllerConfig = {},
		runtime: ControllerRuntime = {}
	): void {
		this._assertNotDestroyed();
		if (!bundle.scenes || bundle.scenes.length === 0) {
			throw new ControllerError(
				'CONTROLLER_NO_SCENES',
				'init() requires at least one compiled scene stop'
			);
		}

		this._cancelFrame();
		this._bundle = bundle;
		this._engine = runtime.engine ?? new AnimationEngine();
		this._ownsEngine = !runtime.engine;
		this._sceneIndex = 0;
		this._progress = 0;
		this._paused = false;
		this._config = { ...DEFAULT_CONFIG, ...config };
		this._sceneElement = runtime.sceneElement ?? config.sceneElement ?? null;

		this._engine.init(bundle);
		this._bindScroll();
	}

	/**
	 * Set scroll progress (0–1, clamped) and trigger frame update.
	 */
	setProgress(progress: number): void {
		this._assertNotDestroyed();
		if (!Number.isFinite(progress)) {
			throw new ControllerError(
				'CONTROLLER_PROGRESS_OUT_OF_RANGE',
				'setProgress() requires a finite progress value'
			);
		}

		const clamped = Math.max(0, Math.min(1, progress));
		if (clamped === this._progress && !this._paused && this._rafId !== null) {
			return;
		}

		this._progress = clamped;
		if (this._paused) return;
		this._scheduleProgressForward(clamped);
	}

	/**
	 * Navigate to next scene (wraps to 0 if at end).
	 */
	nextScene(): void {
		this._assertNotDestroyed();
		if (this.scenes.length <= 1) return;

		const nextIndex = (this._sceneIndex + 1) % this.scenes.length;
		this._transitionToScene(nextIndex);
	}

	/**
	 * Navigate to previous scene (wraps to last if at beginning).
	 */
	prevScene(): void {
		this._assertNotDestroyed();
		if (this.scenes.length <= 1) return;

		const prevIndex =
			(this._sceneIndex - 1 + this.scenes.length) % this.scenes.length;
		this._transitionToScene(prevIndex);
	}

	/**
	 * Set scene index directly.
	 */
	setSceneIndex(index: number): void {
		this._assertNotDestroyed();
		if (index < 0 || index >= this.scenes.length) {
			throw new ControllerError(
				'CONTROLLER_SCENE_INDEX_OUT_OF_RANGE',
				`Scene index ${index} is out of bounds [0, ${this.scenes.length - 1}]`
			);
		}
		this._transitionToScene(index);
	}

	/**
	 * Pause all animations.
	 */
	pause(): void {
		this._assertNotDestroyed();
		if (this._paused) return;
		this._paused = true;
		this._cancelFrame();
		this._engine.pause();
		this._applyPauseState(true);
		this._emit('paused');
	}

	/**
	 * Resume from paused state.
	 */
	resume(): void {
		this._assertNotDestroyed();
		if (!this._paused) return;
		this._paused = false;
		this._engine.resume();
		this._applyPauseState(false);
		this._scheduleProgressForward(this._progress);
		this._emit('resumed');
	}

	/**
	 * Check if controller is paused.
	 */
	isPaused(): boolean {
		this._assertNotDestroyed();
		return this._paused;
	}

	/**
	 * Destroy controller and clean up all listeners and resources.
	 */
	destroy(): void {
		this._assertNotDestroyed();
		this._unbindScroll();
		this._cancelFrame();
		this._cancelTransition();
		if (this._ownsEngine) this._engine.destroy();
		this._listeners.clear();
		this._bundle = null;
		this._container = null;
		this._pendingProgress = null;
		this._destroyed = true;
	}

	// ── Event system ───────────────────────────────────────────────────────

	on<K extends EventKey>(event: K, listener: ControllerEvents[K]): void {
		this._assertNotDestroyed();
		const set = this._listeners.get(event) ?? new Set();
		set.add(listener as AnyEventListener);
		this._listeners.set(event, set);
	}

	off<K extends EventKey>(event: K, listener: ControllerEvents[K]): void {
		this._assertNotDestroyed();
		const set = this._listeners.get(event);
		if (set) {
			set.delete(listener as AnyEventListener);
		}
	}

	private _emit<K extends EventKey>(
		event: K,
		...args: Parameters<ControllerEvents[K]>
	): void {
		const set = this._listeners.get(event);
		if (set) {
			for (const listener of set) {
				try {
					(listener as AnyEventListener)(...args);
				} catch (error) {
					queueMicrotask(() => {
						throw error;
					});
				}
			}
		}
	}

	// ── Frame update ───────────────────────────────────────────────────────

	private _scheduleProgressForward(progress: number): void {
		this._pendingProgress = progress;
		if (this._rafId !== null) return;

		this._rafId = requestAnimationFrame(() => {
			this._rafId = null;
			const pending = this._pendingProgress;
			this._pendingProgress = null;
			if (pending === null || this._paused || this._destroyed) return;
			this._engine.setProgress(pending);
			this._applyFrameUpdate();
			this._emit('progress-change', pending);
		});
	}

	private _cancelFrame(): void {
		if (this._rafId !== null) {
			cancelAnimationFrame(this._rafId);
			this._rafId = null;
		}
		this._pendingProgress = null;
	}

	private _applyFrameUpdate(): void {
		if (!this._bundle) return;

		const svg = (this._sceneElement ??
			this._container?.querySelector('svg') ??
			null) as SVGSVGElement & {
			_elementMap?: Map<string, unknown>;
			_connectorMap?: Map<string, unknown>;
		};
		if (!svg) return;

		const updates = this._engine.getFrameUpdates().map((update) => ({
			id: update.id,
			asset: update.asset,
			pos: update.pos,
			size: update.size,
			layer: update.layer,
			presence: update.lifecycle,
			enter: update.entry as RuntimeElementState['enter'],
			exit: update.exit as RuntimeElementState['exit'],
			ambient: update.ambient,
			text: update.text,
			primitive: update.primitive
		}));
		const connectors = this._engine
			.getConnectorFrameUpdates()
			.map((update) => ({
				id: update.id,
				route: update.route,
				layer: update.layer,
				presence: update.lifecycle,
				style: update.style,
				start: update.start,
				end: update.end,
				direction: update.direction,
				enter: update.entry as RuntimeConnectorState['enter'],
				exit: update.exit as RuntimeConnectorState['exit'],
				ambient: update.ambient
			}));

		updateElementTransforms(svg, updates, connectors);
		this._applyLifecycleChanges(updates);
		this._applyConnectorLifecycleChanges(connectors);
	}

	private _applyLifecycleChanges(elements: RuntimeElementState[]): void {
		for (const elDef of elements) {
			const transition = this._engine.getLifecycleTransition(elDef.id);
			if (!transition) continue;

			const svgForState = (this._sceneElement ??
				this._container?.querySelector('svg')) as SVGSVGElement | null;
			if (!svgForState) continue;
			const state = getElementState(svgForState, elDef.id);
			if (!state) continue;

			if (transition.to === 'entering' || transition.to === 'present') {
				state.isHidden = false;
				unhideElementOnReadd(state.node);
			}

			if (isForwardEntryTransition(transition)) {
				this._applyEntryAnimation(elDef, state);
			}

			if (isReverseExitTransition(transition)) {
				this._applyExitAnimation(
					{ ...elDef, exit: oppositeExitAnimation(elDef.enter ?? 'fade-in') },
					state
				);
				continue;
			}

			if (isForwardExitTransition(transition)) {
				this._applyExitAnimation(elDef, state);
			}

			if (isReverseEntryTransition(transition)) {
				state.isHidden = false;
				unhideElementOnReadd(state.node);
				this._applyEntryAnimation(
					{ ...elDef, enter: oppositeEntryAnimation(elDef.exit ?? 'fade-out') },
					state
				);
				continue;
			}

			if (transition.to === 'removed') {
				state.isHidden = true;
				hideElementAfterExit(state.node);
			}
		}
	}

	private _applyConnectorLifecycleChanges(
		connectors: RuntimeConnectorState[]
	): void {
		for (const connectorDef of connectors) {
			const transition = this._engine.getConnectorLifecycleTransition(
				connectorDef.id
			);
			if (!transition) continue;

			const svgForState = (this._sceneElement ??
				this._container?.querySelector('svg')) as SVGSVGElement | null;
			if (!svgForState) continue;
			const state = getConnectorState(svgForState, connectorDef.id);
			if (!state) continue;

			if (transition.to === 'entering' || transition.to === 'present') {
				state.isHidden = false;
				unhideElementOnReadd(state.node);
			}

			if (isForwardEntryTransition(transition)) {
				this._applyConnectorEntryAnimation(connectorDef, state);
			}

			if (isReverseExitTransition(transition)) {
				this._applyConnectorExitAnimation(
					{
						...connectorDef,
						exit: oppositeExitAnimation(connectorDef.enter ?? 'fade-in')
					},
					state
				);
				continue;
			}

			if (isForwardExitTransition(transition)) {
				this._applyConnectorExitAnimation(connectorDef, state);
			}

			if (isReverseEntryTransition(transition)) {
				state.isHidden = false;
				unhideElementOnReadd(state.node);
				this._applyConnectorEntryAnimation(
					{
						...connectorDef,
						enter: oppositeEntryAnimation(connectorDef.exit ?? 'fade-out')
					},
					state
				);
				continue;
			}

			if (transition.to === 'removed') {
				state.isHidden = true;
				hideElementAfterExit(state.node);
			}
		}
	}

	private _applyEntryAnimation(
		elDef: RuntimeElementState,
		state: { node: SVGElement; isHidden: boolean }
	): void {
		const entryAnim = elDef.enter ?? 'fade-in';
		if (entryAnim === 'none') return;

		animateElement(state.node, `iso-anim-${entryAnim}`, 'enter');

		state.node.addEventListener(
			'animationend',
			() => {
				state.node.style.animation = '';
			},
			{ once: true }
		);
	}

	private _applyExitAnimation(
		elDef: RuntimeElementState,
		state: { node: SVGElement; isHidden: boolean }
	): void {
		const exitAnim = elDef.exit ?? 'fade-out';
		if (exitAnim === 'none') {
			hideElementAfterExit(state.node);
			return;
		}

		animateElement(state.node, `iso-anim-${exitAnim}`, 'exit');

		state.node.addEventListener(
			'animationend',
			() => {
				hideElementAfterExit(state.node);
			},
			{ once: true }
		);
	}

	private _applyConnectorEntryAnimation(
		connectorDef: RuntimeConnectorState,
		state: { node: SVGElement; isHidden: boolean }
	): void {
		const entryAnim = connectorDef.enter ?? 'fade-in';
		if (entryAnim === 'none') return;

		animateElement(state.node, `iso-anim-${entryAnim}`, 'enter');

		state.node.addEventListener(
			'animationend',
			() => {
				state.node.style.animation = '';
			},
			{ once: true }
		);
	}

	private _applyConnectorExitAnimation(
		connectorDef: RuntimeConnectorState,
		state: { node: SVGElement; isHidden: boolean }
	): void {
		const exitAnim = connectorDef.exit ?? 'fade-out';
		if (exitAnim === 'none') {
			hideElementAfterExit(state.node);
			return;
		}

		animateElement(state.node, `iso-anim-${exitAnim}`, 'exit');

		state.node.addEventListener(
			'animationend',
			() => {
				hideElementAfterExit(state.node);
			},
			{ once: true }
		);
	}

	// ── Scene transitions ──────────────────────────────────────────────────

	private _transitionToScene(index: number): void {
		this._cancelTransition();

		if (index === this._sceneIndex) return;

		this._sceneIndex = index;
		this._emit('scene-change', index);

		const stop = this.scenes[index];
		const from = this._progress;
		const to = stop.progress;
		const duration = this._config.transitionDuration;
		if (duration > 0 && from !== to) {
			this._animateProgress(from, to, duration);
			return;
		}

		this._progress = to;
		this._scheduleProgressForward(to);
	}

	private _animateProgress(from: number, to: number, duration: number): void {
		const easing = resolveEasing(
			(this._config.transitionEasing === 'ease-in-out'
				? 'easeInOutCubic'
				: this._config.transitionEasing === 'ease-out'
					? 'easeOutCubic'
					: 'linear') as EasingType
		);
		const start = performance.now();

		const step = (now: number) => {
			const elapsed = now - start;
			const t = Math.min(elapsed / duration, 1);
			const easedT = easing(t);
			const currentProgress = from + (to - from) * easedT;

			this.setProgress(currentProgress);

			if (t < 1) {
				this._transitionAnim = requestAnimationFrame(step);
			} else {
				this._transitionAnim = null;
			}
		};

		this._transitionAnim = requestAnimationFrame(step);
	}

	private _cancelTransition(): void {
		if (this._transitionAnim !== null) {
			cancelAnimationFrame(this._transitionAnim);
			this._transitionAnim = null;
		}
	}

	// ── Scroll binding ─────────────────────────────────────────────────────

	private _bindScroll(): void {
		const container = this._config.container;
		if (!container) return;

		this._container = container;
		this._calculateScrollBounds();

		container.addEventListener('scroll', this._onScroll, { passive: true });
		window.addEventListener('resize', this._onResize, { passive: true });

		if (this._config.keyboardControls) {
			document.addEventListener('keydown', this._onKeyDown);
		}

		if (this._config.touchControls) {
			container.addEventListener('touchstart', this._onTouchStart, {
				passive: true
			});
			container.addEventListener('touchmove', this._onTouchMove, {
				passive: false
			});
			container.addEventListener('touchend', this._onTouchEnd);
		}
	}

	private _unbindScroll(): void {
		const container = this._config.container;
		if (!container) return;

		container.removeEventListener('scroll', this._onScroll);
		window.removeEventListener('resize', this._onResize);
		document.removeEventListener('keydown', this._onKeyDown);
		container.removeEventListener('touchstart', this._onTouchStart);
		container.removeEventListener('touchmove', this._onTouchMove);
		container.removeEventListener('touchend', this._onTouchEnd);
	}

	private _calculateScrollBounds(): void {
		const container = this._config.container;
		if (!container) return;

		const offset = this._config.scrollOffset ?? {};
		if (this._config.scrollDirection === 'horizontal') {
			this._minScroll = offset.left ?? 0;
			this._maxScroll =
				container.scrollWidth - container.clientWidth - (offset.right ?? 0);
			return;
		}

		this._minScroll = offset.top ?? 0;
		this._maxScroll =
			container.scrollHeight - container.clientHeight - (offset.bottom ?? 0);
	}

	private _onScroll = (): void => {
		if (this._paused || this._destroyed) return;

		const container = this._config.container;
		if (!container) return;

		const currentScroll =
			this._config.scrollDirection === 'horizontal'
				? container.scrollLeft
				: container.scrollTop;

		const range = this._maxScroll - this._minScroll;
		if (range <= 0) return;

		const rawProgress = (currentScroll - this._minScroll) / range;
		const clampedProgress = Math.max(
			this._config.minProgress ?? 0,
			Math.min(this._config.maxProgress ?? 1, rawProgress)
		);

		const sensitivity = this._config.scrollSensitivity ?? 1;
		if (clampedProgress !== this._progress) {
			this.setProgress(clampedProgress * sensitivity);
		}
	};

	private _onResize = (): void => {
		if (this._destroyed) return;
		this._calculateScrollBounds();
	};

	private _onKeyDown = (e: KeyboardEvent): void => {
		if (this._destroyed) return;
		if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
			e.preventDefault();
			this.nextScene();
		} else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
			e.preventDefault();
			this.prevScene();
		}
	};

	private _onTouchStart = (e: TouchEvent): void => {
		if (this._destroyed) return;
		this._isDragging = true;
		const touch = e.touches[0];
		if (this._config.scrollDirection === 'horizontal') {
			this._touchStartX = touch.clientX;
		} else {
			this._touchStartY = touch.clientY;
		}
	};

	private _onTouchMove = (e: TouchEvent): void => {
		if (this._destroyed) return;
		if (!this._isDragging) return;

		const touch = e.touches[0];
		const delta =
			this._config.scrollDirection === 'horizontal'
				? this._touchStartX - touch.clientX
				: this._touchStartY - touch.clientY;

		const sensitivity = this._config.scrollSensitivity ?? 1.0;
		const progressDelta = (delta / 300) * sensitivity;
		const newProgress = Math.max(
			0,
			Math.min(1, this._progress + progressDelta)
		);

		this.setProgress(newProgress);
	};

	private _onTouchEnd = (): void => {
		if (this._destroyed) return;
		this._isDragging = false;
	};

	// ── Pause state ────────────────────────────────────────────────────────

	private _applyPauseState(pause: boolean): void {
		const container = this._config.container;
		if (!container) return;

		const svg = container.querySelector('svg');
		if (!svg) return;

		const playState = pause ? 'paused' : 'running';
		const ambientElements = svg.querySelectorAll('[class*="iso-ambient-"]');
		for (let i = 0; i < ambientElements.length; i++) {
			const el = ambientElements[i] as HTMLElement;
			el.style.animationPlayState = playState;
		}
	}

	private _assertNotDestroyed(): void {
		if (!this._destroyed) return;
		throw new ControllerError(
			'CONTROLLER_DESTROYED',
			'AnimationController has been destroyed'
		);
	}
}

function isForwardEntryTransition(transition: LifecycleTransition): boolean {
	return transition.from === 'removed' && transition.to === 'entering';
}

function isForwardExitTransition(transition: LifecycleTransition): boolean {
	return transition.to === 'exiting';
}

function isReverseExitTransition(transition: LifecycleTransition): boolean {
	return transition.to === 'removed' && transition.from !== 'exiting';
}

function isReverseEntryTransition(transition: LifecycleTransition): boolean {
	return transition.from === 'exiting' && transition.to !== 'removed';
}

function oppositeExitAnimation(entry: EntryAnimation): ExitAnimation {
	switch (entry) {
		case 'fade-in':
			return 'fade-out';
		case 'fade-in-grow':
			return 'fade-out-shrink';
		case 'fall-in':
			return 'rise-away';
		case 'rise-from-ground':
			return 'fall-through-ground';
		case 'slide-in-left':
			return 'slide-out-left';
		case 'slide-in-right':
			return 'slide-out-right';
		case 'flip-in':
			return 'flip-out';
		case 'none':
			return 'none';
	}
}

function oppositeEntryAnimation(exit: ExitAnimation): EntryAnimation {
	switch (exit) {
		case 'fade-out':
			return 'fade-in';
		case 'fade-out-shrink':
			return 'fade-in-grow';
		case 'fall-through-ground':
			return 'rise-from-ground';
		case 'rise-away':
			return 'fall-in';
		case 'slide-out-left':
			return 'slide-in-left';
		case 'slide-out-right':
			return 'slide-in-right';
		case 'flip-out':
			return 'flip-in';
		case 'none':
			return 'none';
	}
}
