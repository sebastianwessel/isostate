import {
	animateElement,
	applySceneViewBox,
	getConnectorState,
	getCurrentElementBounds,
	getElementState,
	getGridAreaBounds,
	getResolvedProjectionLayout,
	getResolvedViewBox,
	hideElementAfterExit,
	unhideElementOnReadd,
	updateElementTransforms,
	type ViewBoxRect,
} from "../rendering/rendering-engine.ts";
import { ControllerError } from "../types/errors.ts";
import type {
	CameraGridArea,
	CameraZoomOptions,
	EntryAnimation,
	ExitAnimation,
	RuntimeCameraTarget,
	RuntimeConnectorState,
	RuntimeElementState,
} from "../types/node.ts";
import type { RuntimeBundle } from "../types/runtime-bundle.ts";
import { type EasingType, resolveEasing } from "../utils/easing.ts";
import { calculateVisualSize, projectToScreen } from "../utils/projection.ts";
import { AnimationEngine } from "./animation-engine.ts";

// ── Event types ────────────────────────────────────────────────────────────

/** Events emitted by `AnimationController.on()`. */
export interface ControllerEvents {
	/** Fired whenever resolved scroll/scene progress changes. */
	"progress-change": (progress: number) => void;
	/** Fired when the active scene index changes. */
	"scene-change": (index: number) => void;
	/** Fired after the camera viewBox or zoom target changes. */
	"camera-change": (state: CameraState) => void;
	/** Fired when scroll-driven progress tracking is paused. */
	paused: () => void;
	/** Fired when scroll-driven progress tracking resumes. */
	resumed: () => void;
}

type EventKey = keyof ControllerEvents;
type AnyEventListener = (...args: unknown[]) => void;
type LifecycleTransition = {
	from: RuntimeElementState["presence"];
	to: RuntimeElementState["presence"];
};
type RequiredCameraFocus = {
	target: RuntimeCameraTarget;
	padding?: number;
	duration?: number;
	easing?: "linear" | "ease-in-out" | "ease-out";
};

// ── Controller config ──────────────────────────────────────────────────────

export interface ControllerConfig {
	/** Scroll container used to derive progress. Defaults to the mount target in `mountScene()`. */
	container?: HTMLElement;
	/** SVG scene updated by this controller. Defaults to the first SVG in `container` for direct controller usage. */
	sceneElement?: SVGSVGElement;
	/** Scroll axis used to derive progress. Defaults to `vertical`. */
	scrollDirection?: "vertical" | "horizontal";
	/** Extra scroll offsets, in pixels, applied when deriving progress from `container`. */
	scrollOffset?: {
		top?: number;
		bottom?: number;
		left?: number;
		right?: number;
	};
	/** Minimum resolved progress. Defaults to `0`. */
	minProgress?: number;
	/** Maximum resolved progress. Defaults to `1`. */
	maxProgress?: number;
	/** Enable arrow-key scene navigation. Defaults to `false`. */
	keyboardControls?: boolean;
	/** Enable touch swipe scene navigation. Defaults to `false`. */
	touchControls?: boolean;
	/** Multiplier applied to wheel/touch scroll deltas. Defaults to `1.0`. */
	scrollSensitivity?: number;
	/** Camera transition duration in milliseconds. Defaults to `600`. */
	transitionDuration?: number;
	/** Camera transition easing curve. Defaults to `ease-in-out`. */
	transitionEasing?: "linear" | "ease-in-out" | "ease-out";
}

export type { CameraGridArea, CameraZoomOptions };

/** Current camera viewBox and zoom target, as reported by `AnimationController.getCameraState()`. */
export interface CameraState {
	/** Current SVG viewBox. */
	viewBox: ViewBoxRect;
	/** Focus target that produced the current viewBox, if any. */
	target?: RuntimeCameraTarget;
	/** Whether the camera differs from the compiled full scene view. */
	isZoomed: boolean;
}

type ResolvedControllerConfig = Required<Omit<ControllerConfig, "container" | "sceneElement">> & {
	container?: HTMLElement;
	sceneElement?: SVGSVGElement;
};

const DEFAULT_CONFIG: Required<Omit<ControllerConfig, "container" | "sceneElement">> = {
	scrollDirection: "vertical",
	scrollOffset: {},
	minProgress: 0,
	maxProgress: 1,
	keyboardControls: false,
	touchControls: false,
	scrollSensitivity: 1.0,
	transitionDuration: 600,
	transitionEasing: "ease-in-out",
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
	private _cameraAnim: ReturnType<typeof requestAnimationFrame> | null = null;
	private _cameraState: CameraState | null = null;

	// Scroll tracking state
	private _minScroll = 0;
	private _maxScroll = 0;
	private _lastTouchY = 0;
	private _lastTouchX = 0;
	private _isDragging = false;

	// Transition animation state
	private _transitionAnim: ReturnType<typeof requestAnimationFrame> | null = null;

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

	get scenes(): RuntimeBundle["scenes"] {
		return this._bundle?.scenes ?? [];
	}

	get paused(): boolean {
		return this._paused;
	}

	get currentScene(): RuntimeBundle["scenes"][number] | undefined {
		return this.scenes[this._sceneIndex];
	}

	/**
	 * Initialize the controller with a compiled bundle and optional runtime resources.
	 */
	init(bundle: RuntimeBundle, config: ControllerConfig = {}, runtime: ControllerRuntime = {}): void {
		this._assertNotDestroyed();
		if (!bundle.scenes || bundle.scenes.length === 0) {
			throw new ControllerError("CONTROLLER_NO_SCENES", "init() requires at least one compiled scene stop");
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
		this._cameraState = {
			viewBox: getResolvedViewBox(bundle),
			target: { type: "reset" },
			isZoomed: false,
		};

		this._engine.init(bundle);
		this._bindScroll();
	}

	/**
	 * Set scroll progress (0–1, clamped) and trigger frame update.
	 */
	setProgress(progress: number): void {
		this._assertNotDestroyed();
		if (!Number.isFinite(progress)) {
			throw new ControllerError("CONTROLLER_PROGRESS_OUT_OF_RANGE", "setProgress() requires a finite progress value");
		}

		const clamped = Math.max(0, Math.min(1, progress));
		if (clamped === this._progress && !this._paused && this._rafId !== null) {
			return;
		}

		this._progress = clamped;
		this._cancelCameraAnimation();
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

		const prevIndex = (this._sceneIndex - 1 + this.scenes.length) % this.scenes.length;
		this._transitionToScene(prevIndex);
	}

	/**
	 * Set scene index directly.
	 */
	setSceneIndex(index: number): void {
		this._assertNotDestroyed();
		if (index < 0 || index >= this.scenes.length) {
			throw new ControllerError(
				"CONTROLLER_SCENE_INDEX_OUT_OF_RANGE",
				`Scene index ${index} is out of bounds [0, ${this.scenes.length - 1}]`,
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
		this._emit("paused");
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
		this._emit("resumed");
	}

	/**
	 * Check if controller is paused.
	 */
	isPaused(): boolean {
		this._assertNotDestroyed();
		return this._paused;
	}

	zoomToElement(id: string, options: CameraZoomOptions = {}): void {
		this._assertNotDestroyed();
		const svg = this._getSceneSvg();
		if (!this._bundle || !svg) {
			throw new ControllerError("CAMERA_NOT_INITIALIZED", "zoomToElement() requires an initialized scene SVG");
		}
		const elementBounds = getCurrentElementBounds(svg, id);
		if (!elementBounds) {
			if (getElementState(svg, id)) {
				throw new ControllerError("CAMERA_TARGET_NOT_VISIBLE", `Camera target element "${id}" is currently removed`, {
					elementId: id,
				});
			}
			throw new ControllerError("CAMERA_TARGET_NOT_FOUND", `Camera target element "${id}" was not found`, {
				elementId: id,
			});
		}
		this._applyCameraDestination(
			expandViewBox(elementBounds, this._resolveCameraPadding(options)),
			{ type: "element", id },
			options,
		);
	}

	zoomToArea(area: CameraGridArea, options: CameraZoomOptions = {}): void {
		this._assertNotDestroyed();
		if (!this._bundle || !this._getSceneSvg()) {
			throw new ControllerError("CAMERA_NOT_INITIALIZED", "zoomToArea() requires an initialized scene SVG");
		}
		this._assertValidCameraArea(area);
		const bounds = getGridAreaBounds(this._bundle, area);
		this._applyCameraDestination(
			expandViewBox(bounds, this._resolveCameraPadding(options)),
			{
				type: "area",
				at: [...area.at],
				size: [...area.size],
			},
			options,
		);
	}

	resetZoom(options: CameraZoomOptions = {}): void {
		this._assertNotDestroyed();
		if (!this._bundle || !this._getSceneSvg()) {
			throw new ControllerError("CAMERA_NOT_INITIALIZED", "resetZoom() requires an initialized scene SVG");
		}
		this._applyCameraDestination(getResolvedViewBox(this._bundle), { type: "reset" }, options);
	}

	getCameraState(): CameraState {
		this._assertNotDestroyed();
		if (!this._cameraState) {
			throw new ControllerError("CAMERA_NOT_INITIALIZED", "Camera state is not initialized");
		}
		return copyCameraState(this._cameraState);
	}

	/**
	 * Destroy controller and clean up all listeners and resources.
	 */
	destroy(): void {
		this._assertNotDestroyed();
		this._unbindScroll();
		this._cancelFrame();
		this._cancelTransition();
		this._cancelCameraAnimation();
		if (this._ownsEngine) this._engine.destroy();
		this._listeners.clear();
		this._bundle = null;
		this._container = null;
		this._pendingProgress = null;
		this._cameraState = null;
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

	private _emit<K extends EventKey>(event: K, ...args: Parameters<ControllerEvents[K]>): void {
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
			this._emit("progress-change", pending);
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

		const svg = (this._sceneElement ?? this._container?.querySelector("svg") ?? null) as SVGSVGElement & {
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
			enter: update.entry as RuntimeElementState["enter"],
			exit: update.exit as RuntimeElementState["exit"],
			ambient: update.ambient,
			text: update.text,
			primitive: update.primitive,
		}));
		const connectors = this._engine.getConnectorFrameUpdates().map((update) => ({
			id: update.id,
			route: update.route,
			layer: update.layer,
			presence: update.lifecycle,
			style: update.style,
			start: update.start,
			end: update.end,
			direction: update.direction,
			enter: update.entry as RuntimeConnectorState["enter"],
			exit: update.exit as RuntimeConnectorState["exit"],
			ambient: update.ambient,
		}));

		updateElementTransforms(svg, updates, connectors);
		this._applyLifecycleChanges(updates);
		this._applyConnectorLifecycleChanges(connectors);
		this._applyCameraForProgress(this._progress);
	}

	private _applyCameraForProgress(progress: number): void {
		const svg = this._getSceneSvg();
		if (!this._bundle || !svg) return;
		const sceneStops = this.scenes;
		if (sceneStops.length === 0) return;
		const { previous, next } = surroundingStops(sceneStops, progress);
		const previousCamera = this._effectiveCameraAt(previous.index);
		const nextCamera = this._effectiveCameraAt(next.index);
		const previousViewBox = this._resolveCameraViewBox(previousCamera, { forInterpolation: true });
		const nextViewBox = this._resolveCameraViewBox(nextCamera, { forInterpolation: true });
		const range = next.scene.progress - previous.scene.progress;
		const rawT = range <= 0 ? 0 : (progress - previous.scene.progress) / range;
		const t = resolveCameraEasing(nextCamera.easing)(Math.max(0, Math.min(1, rawT)));
		const viewBox = lerpViewBox(previousViewBox, nextViewBox, t);
		const target = t < 1 ? previousCamera.target : nextCamera.target;
		this._setCameraViewBox(svg, viewBox, target);
	}

	private _effectiveCameraAt(index: number): RequiredCameraFocus {
		for (let i = index; i >= 0; i--) {
			const camera = this.scenes[i]?.camera;
			if (camera) {
				return {
					target: camera.target,
					padding: camera.padding,
					duration: camera.duration,
					easing: camera.easing,
				};
			}
		}
		return { target: { type: "reset" } };
	}

	private _resolveCameraViewBox(
		camera: RequiredCameraFocus,
		options: { forInterpolation?: boolean } = {},
	): ViewBoxRect {
		if (!this._bundle) throw new ControllerError("CAMERA_NOT_INITIALIZED", "Camera requires an initialized bundle");
		if (camera.target.type === "reset") return getResolvedViewBox(this._bundle);
		if (camera.target.type === "area") {
			return expandViewBox(
				getGridAreaBounds(this._bundle, { at: camera.target.at, size: camera.target.size }),
				camera.padding ?? 32,
			);
		}
		const svg = this._getSceneSvg();
		if (!svg) throw new ControllerError("CAMERA_NOT_INITIALIZED", "Camera requires an initialized scene SVG");
		const bounds = options.forInterpolation
			? this._resolveElementBoundsForInterpolation(svg, camera.target.id)
			: getCurrentElementBounds(svg, camera.target.id);
		if (!bounds) {
			throw new ControllerError(
				"CAMERA_TARGET_NOT_FOUND",
				`Camera target element "${camera.target.id}" was not found`,
				{
					elementId: camera.target.id,
				},
			);
		}
		return expandViewBox(bounds, camera.padding ?? 32);
	}

	/**
	 * Resolve element bounds for scroll/setProgress camera interpolation.
	 *
	 * Unlike `getCurrentElementBounds()`, this tolerates an element whose
	 * resolved presence is transiently "removed" because progress has not yet
	 * reached the stop that introduces it (the engine still carries valid
	 * authored geometry for it via nearest-geometry fallback). It falls back to
	 * that geometry instead of reporting the target as missing so a scene that
	 * both adds an element and focuses the camera on it in the same stop can be
	 * interpolated into smoothly. A genuinely unknown element id still resolves
	 * to `undefined` so callers can throw `CAMERA_TARGET_NOT_FOUND`.
	 */
	private _resolveElementBoundsForInterpolation(svg: SVGSVGElement, id: string): ViewBoxRect | undefined {
		const direct = getCurrentElementBounds(svg, id);
		if (direct) return direct;

		const state = getElementState(svg, id);
		if (!state || !this._bundle) return undefined;

		const layout = getResolvedProjectionLayout(this._bundle);
		const element = state.current;
		const screen = projectToScreen(
			element.pos[0] + element.size,
			element.pos[1] + element.size,
			layout.cellSize,
			layout.selectedBounds.minX,
			layout.selectedBounds.minY,
			layout.padding.x,
			layout.padding.y,
		);
		const visualSize = calculateVisualSize(element.size, layout.cellSize);
		const [anchorX, anchorY] = state.anchor;
		return {
			minX: roundCameraNumber(screen.screenX - visualSize * anchorX),
			minY: roundCameraNumber(screen.screenY - visualSize * anchorY),
			width: roundCameraNumber(Math.max(1, visualSize)),
			height: roundCameraNumber(Math.max(1, visualSize)),
		};
	}

	private _applyCameraDestination(viewBox: ViewBoxRect, target: RuntimeCameraTarget, options: CameraZoomOptions): void {
		const svg = this._getSceneSvg();
		if (!svg) throw new ControllerError("CAMERA_NOT_INITIALIZED", "Camera requires an initialized scene SVG");
		this._cancelCameraAnimation();
		const duration = this._resolveCameraDuration(options);
		if (duration === 0) {
			this._setCameraViewBox(svg, viewBox, target);
			return;
		}
		const from = currentSvgViewBox(svg) ?? this._cameraState?.viewBox ?? viewBox;
		const easing = resolveCameraEasing(options.easing ?? this._config.transitionEasing);
		const start = performance.now();
		const step = (now: number) => {
			const t = Math.min((now - start) / duration, 1);
			this._setCameraViewBox(svg, lerpViewBox(from, viewBox, easing(t)), target);
			if (t < 1) {
				this._cameraAnim = requestAnimationFrame(step);
			} else {
				this._cameraAnim = null;
			}
		};
		this._cameraAnim = requestAnimationFrame(step);
	}

	private _setCameraViewBox(svg: SVGSVGElement, viewBox: ViewBoxRect, target?: RuntimeCameraTarget): void {
		applySceneViewBox(svg, viewBox);
		const full = this._bundle ? getResolvedViewBox(this._bundle) : viewBox;
		this._cameraState = {
			viewBox,
			target,
			isZoomed: !sameViewBox(viewBox, full),
		};
		this._emit("camera-change", this.getCameraState());
	}

	private _getSceneSvg(): SVGSVGElement | null {
		return (this._sceneElement ?? this._container?.querySelector("svg") ?? null) as SVGSVGElement | null;
	}

	private _resolveCameraPadding(options: CameraZoomOptions): number {
		const padding = options.padding ?? 32;
		if (!Number.isFinite(padding) || padding < 0 || padding > 2048) {
			throw new ControllerError("INVALID_CAMERA_OPTIONS", "Camera padding must be between 0 and 2048");
		}
		return padding;
	}

	private _resolveCameraDuration(options: CameraZoomOptions): number {
		const duration = options.duration ?? this._config.transitionDuration;
		if (!Number.isInteger(duration) || duration < 0 || duration > 10000) {
			throw new ControllerError("INVALID_CAMERA_OPTIONS", "Camera duration must be an integer from 0 to 10000");
		}
		return duration;
	}

	private _assertValidCameraArea(area: CameraGridArea): void {
		if (
			!Array.isArray(area.at) ||
			area.at.length !== 2 ||
			!area.at.every((value) => Number.isFinite(value) && value >= 0) ||
			!Array.isArray(area.size) ||
			area.size.length !== 2 ||
			!area.size.every((value) => Number.isFinite(value) && value > 0)
		) {
			throw new ControllerError("INVALID_CAMERA_OPTIONS", "Camera area must use non-negative at and positive size");
		}
	}

	private _applyLifecycleChanges(elements: RuntimeElementState[]): void {
		for (const elDef of elements) {
			const transition = this._engine.getLifecycleTransition(elDef.id);
			if (!transition) continue;

			const svgForState = (this._sceneElement ?? this._container?.querySelector("svg")) as SVGSVGElement | null;
			if (!svgForState) continue;
			const state = getElementState(svgForState, elDef.id);
			if (!state) continue;

			if (transition.to === "entering" || transition.to === "present") {
				state.isHidden = false;
				unhideElementOnReadd(state.node);
			}

			if (isForwardEntryTransition(transition)) {
				this._applyEntryAnimation(elDef, state);
			}

			if (isReverseExitTransition(transition)) {
				this._applyExitAnimation({ ...elDef, exit: oppositeExitAnimation(elDef.enter ?? "fade-in") }, state);
				continue;
			}

			if (isForwardExitTransition(transition)) {
				this._applyExitAnimation(elDef, state);
			}

			if (isReverseEntryTransition(transition)) {
				state.isHidden = false;
				unhideElementOnReadd(state.node);
				this._applyEntryAnimation({ ...elDef, enter: oppositeEntryAnimation(elDef.exit ?? "fade-out") }, state);
				continue;
			}

			if (transition.to === "removed") {
				state.isHidden = true;
				hideElementAfterExit(state.node);
			}
		}
	}

	private _applyConnectorLifecycleChanges(connectors: RuntimeConnectorState[]): void {
		for (const connectorDef of connectors) {
			const transition = this._engine.getConnectorLifecycleTransition(connectorDef.id);
			if (!transition) continue;

			const svgForState = (this._sceneElement ?? this._container?.querySelector("svg")) as SVGSVGElement | null;
			if (!svgForState) continue;
			const state = getConnectorState(svgForState, connectorDef.id);
			if (!state) continue;

			if (transition.to === "entering" || transition.to === "present") {
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
						exit: oppositeExitAnimation(connectorDef.enter ?? "fade-in"),
					},
					state,
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
						enter: oppositeEntryAnimation(connectorDef.exit ?? "fade-out"),
					},
					state,
				);
				continue;
			}

			if (transition.to === "removed") {
				state.isHidden = true;
				hideElementAfterExit(state.node);
			}
		}
	}

	private _applyEntryAnimation(elDef: RuntimeElementState, state: { node: SVGElement; isHidden: boolean }): void {
		const entryAnim = elDef.enter ?? "fade-in";
		if (entryAnim === "none") return;

		animateElement(state.node, `iso-anim-${entryAnim}`, "enter");
		const expectedAnimation = state.node.style.animation;

		state.node.addEventListener(
			"animationend",
			() => {
				if (state.node.style.animation === expectedAnimation) {
					state.node.style.animation = "";
				}
			},
			{ once: true },
		);
	}

	private _applyExitAnimation(elDef: RuntimeElementState, state: { node: SVGElement; isHidden: boolean }): void {
		const exitAnim = elDef.exit ?? "fade-out";
		if (exitAnim === "none") {
			hideElementAfterExit(state.node);
			return;
		}

		animateElement(state.node, `iso-anim-${exitAnim}`, "exit");
		const expectedAnimation = state.node.style.animation;

		state.node.addEventListener(
			"animationend",
			() => {
				if (state.node.style.animation === expectedAnimation) {
					hideElementAfterExit(state.node);
				}
			},
			{ once: true },
		);
	}

	private _applyConnectorEntryAnimation(
		connectorDef: RuntimeConnectorState,
		state: { node: SVGElement; isHidden: boolean },
	): void {
		const entryAnim = connectorDef.enter ?? "fade-in";
		if (entryAnim === "none") return;

		animateElement(state.node, `iso-anim-${entryAnim}`, "enter");
		const expectedAnimation = state.node.style.animation;

		state.node.addEventListener(
			"animationend",
			() => {
				if (state.node.style.animation === expectedAnimation) {
					state.node.style.animation = "";
				}
			},
			{ once: true },
		);
	}

	private _applyConnectorExitAnimation(
		connectorDef: RuntimeConnectorState,
		state: { node: SVGElement; isHidden: boolean },
	): void {
		const exitAnim = connectorDef.exit ?? "fade-out";
		if (exitAnim === "none") {
			hideElementAfterExit(state.node);
			return;
		}

		animateElement(state.node, `iso-anim-${exitAnim}`, "exit");
		const expectedAnimation = state.node.style.animation;

		state.node.addEventListener(
			"animationend",
			() => {
				if (state.node.style.animation === expectedAnimation) {
					hideElementAfterExit(state.node);
				}
			},
			{ once: true },
		);
	}

	// ── Scene transitions ──────────────────────────────────────────────────

	private _transitionToScene(index: number): void {
		this._cancelTransition();

		const stop = this.scenes[index];
		const from = this._progress;
		const to = stop.progress;

		if (index === this._sceneIndex && from === to) return;

		this._sceneIndex = index;
		this._emit("scene-change", index);

		const duration = this._config.transitionDuration;
		if (duration > 0 && from !== to) {
			this._animateProgress(from, to, duration);
			return;
		}

		this._progress = to;
		this._cancelCameraAnimation();
		this._scheduleProgressForward(to);
	}

	private _animateProgress(from: number, to: number, duration: number): void {
		const easing = resolveEasing(
			(this._config.transitionEasing === "ease-in-out"
				? "easeInOutCubic"
				: this._config.transitionEasing === "ease-out"
					? "easeOutCubic"
					: "linear") as EasingType,
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

	private _cancelCameraAnimation(): void {
		if (this._cameraAnim !== null) {
			cancelAnimationFrame(this._cameraAnim);
			this._cameraAnim = null;
		}
	}

	// ── Scroll binding ─────────────────────────────────────────────────────

	private _bindScroll(): void {
		if (this._config.keyboardControls) {
			document.addEventListener("keydown", this._onKeyDown);
		}

		const container = this._config.container;
		if (!container) return;

		this._container = container;
		this._calculateScrollBounds();

		container.addEventListener("scroll", this._onScroll, { passive: true });
		window.addEventListener("resize", this._onResize, { passive: true });

		if (this._config.touchControls) {
			container.addEventListener("touchstart", this._onTouchStart, {
				passive: true,
			});
			container.addEventListener("touchmove", this._onTouchMove, {
				passive: false,
			});
			container.addEventListener("touchend", this._onTouchEnd);
		}
	}

	private _unbindScroll(): void {
		document.removeEventListener("keydown", this._onKeyDown);

		const container = this._config.container;
		if (!container) return;

		container.removeEventListener("scroll", this._onScroll);
		window.removeEventListener("resize", this._onResize);
		container.removeEventListener("touchstart", this._onTouchStart);
		container.removeEventListener("touchmove", this._onTouchMove);
		container.removeEventListener("touchend", this._onTouchEnd);
	}

	private _calculateScrollBounds(): void {
		const container = this._config.container;
		if (!container) return;

		const offset = this._config.scrollOffset ?? {};
		if (this._config.scrollDirection === "horizontal") {
			this._minScroll = offset.left ?? 0;
			this._maxScroll = container.scrollWidth - container.clientWidth - (offset.right ?? 0);
			return;
		}

		this._minScroll = offset.top ?? 0;
		this._maxScroll = container.scrollHeight - container.clientHeight - (offset.bottom ?? 0);
	}

	private _onScroll = (): void => {
		if (this._paused || this._destroyed) return;

		const container = this._config.container;
		if (!container) return;

		const currentScroll = this._config.scrollDirection === "horizontal" ? container.scrollLeft : container.scrollTop;

		const range = this._maxScroll - this._minScroll;
		if (range <= 0) return;

		const rawProgress = (currentScroll - this._minScroll) / range;
		const sensitivity = this._config.scrollSensitivity ?? 1;
		const scaledProgress = rawProgress * sensitivity;
		const clampedProgress = Math.max(
			this._config.minProgress ?? 0,
			Math.min(this._config.maxProgress ?? 1, scaledProgress),
		);

		if (clampedProgress !== this._progress) {
			this.setProgress(clampedProgress);
		}
	};

	private _onResize = (): void => {
		if (this._destroyed) return;
		this._calculateScrollBounds();
	};

	private _onKeyDown = (e: KeyboardEvent): void => {
		if (this._destroyed) return;
		if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
			e.preventDefault();
			this.nextScene();
		} else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
			e.preventDefault();
			this.prevScene();
		}
	};

	private _onTouchStart = (e: TouchEvent): void => {
		if (this._destroyed) return;
		this._isDragging = true;
		const touch = e.touches[0];
		if (this._config.scrollDirection === "horizontal") {
			this._lastTouchX = touch.clientX;
		} else {
			this._lastTouchY = touch.clientY;
		}
	};

	private _onTouchMove = (e: TouchEvent): void => {
		if (this._destroyed) return;
		if (!this._isDragging) return;

		const touch = e.touches[0];
		const isHorizontal = this._config.scrollDirection === "horizontal";
		const delta = isHorizontal ? this._lastTouchX - touch.clientX : this._lastTouchY - touch.clientY;
		if (isHorizontal) {
			this._lastTouchX = touch.clientX;
		} else {
			this._lastTouchY = touch.clientY;
		}

		const sensitivity = this._config.scrollSensitivity ?? 1.0;
		const progressDelta = (delta / 300) * sensitivity;
		const newProgress = Math.max(0, Math.min(1, this._progress + progressDelta));

		this.setProgress(newProgress);
	};

	private _onTouchEnd = (): void => {
		if (this._destroyed) return;
		this._isDragging = false;
	};

	// ── Pause state ────────────────────────────────────────────────────────

	private _applyPauseState(pause: boolean): void {
		const svg = this._getSceneSvg();
		if (!svg) return;

		const playState = pause ? "paused" : "running";
		const ambientElements = svg.querySelectorAll('[class*="iso-ambient-"]');
		for (let i = 0; i < ambientElements.length; i++) {
			const el = ambientElements[i] as HTMLElement;
			el.style.animationPlayState = playState;
		}
	}

	private _assertNotDestroyed(): void {
		if (!this._destroyed) return;
		throw new ControllerError("CONTROLLER_DESTROYED", "AnimationController has been destroyed");
	}
}

function isForwardEntryTransition(transition: LifecycleTransition): boolean {
	return transition.from === "removed" && transition.to === "entering";
}

function isForwardExitTransition(transition: LifecycleTransition): boolean {
	return transition.to === "exiting";
}

function isReverseExitTransition(transition: LifecycleTransition): boolean {
	return transition.to === "removed" && transition.from !== "exiting";
}

function isReverseEntryTransition(transition: LifecycleTransition): boolean {
	return transition.from === "exiting" && transition.to !== "removed";
}

function oppositeExitAnimation(entry: EntryAnimation): ExitAnimation {
	switch (entry) {
		case "fade-in":
			return "fade-out";
		case "fade-in-grow":
			return "fade-out-shrink";
		case "fall-in":
			return "rise-away";
		case "rise-from-ground":
			return "fall-through-ground";
		case "slide-in-left":
			return "slide-out-left";
		case "slide-in-right":
			return "slide-out-right";
		case "flip-in":
			return "flip-out";
		case "none":
			return "none";
	}
}

function oppositeEntryAnimation(exit: ExitAnimation): EntryAnimation {
	switch (exit) {
		case "fade-out":
			return "fade-in";
		case "fade-out-shrink":
			return "fade-in-grow";
		case "fall-through-ground":
			return "rise-from-ground";
		case "rise-away":
			return "fall-in";
		case "slide-out-left":
			return "slide-in-left";
		case "slide-out-right":
			return "slide-in-right";
		case "flip-out":
			return "flip-in";
		case "none":
			return "none";
	}
}

function surroundingStops(
	scenes: RuntimeBundle["scenes"],
	progress: number,
): {
	previous: { scene: RuntimeBundle["scenes"][number]; index: number };
	next: { scene: RuntimeBundle["scenes"][number]; index: number };
} {
	let previousIndex = 0;
	let nextIndex = scenes.length - 1;
	for (let i = 0; i < scenes.length; i++) {
		if (scenes[i].progress <= progress) previousIndex = i;
		if (scenes[i].progress >= progress) {
			nextIndex = i;
			break;
		}
	}
	return {
		previous: { scene: scenes[previousIndex], index: previousIndex },
		next: { scene: scenes[nextIndex], index: nextIndex },
	};
}

function expandViewBox(viewBox: ViewBoxRect, padding: number): ViewBoxRect {
	return {
		minX: roundCameraNumber(viewBox.minX - padding),
		minY: roundCameraNumber(viewBox.minY - padding),
		width: roundCameraNumber(Math.max(1, viewBox.width + padding * 2)),
		height: roundCameraNumber(Math.max(1, viewBox.height + padding * 2)),
	};
}

function lerpViewBox(from: ViewBoxRect, to: ViewBoxRect, t: number): ViewBoxRect {
	return {
		minX: roundCameraNumber(from.minX + (to.minX - from.minX) * t),
		minY: roundCameraNumber(from.minY + (to.minY - from.minY) * t),
		width: roundCameraNumber(from.width + (to.width - from.width) * t),
		height: roundCameraNumber(from.height + (to.height - from.height) * t),
	};
}

function sameViewBox(a: ViewBoxRect, b: ViewBoxRect): boolean {
	return a.minX === b.minX && a.minY === b.minY && a.width === b.width && a.height === b.height;
}

function currentSvgViewBox(svg: SVGSVGElement): ViewBoxRect | undefined {
	const raw = svg.getAttribute("viewBox");
	if (!raw) return undefined;
	const parts = raw.trim().split(/\s+/).map(Number);
	if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return undefined;
	return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
}

function resolveCameraEasing(easing: "linear" | "ease-in-out" | "ease-out" | undefined): (t: number) => number {
	return resolveEasing(easing === "ease-in-out" ? "easeInOutCubic" : easing === "ease-out" ? "easeOutCubic" : "linear");
}

function copyCameraState(state: CameraState): CameraState {
	return {
		viewBox: { ...state.viewBox },
		target:
			state.target?.type === "area"
				? { type: "area", at: [...state.target.at], size: [...state.target.size] }
				: state.target
					? { ...state.target }
					: undefined,
		isZoomed: state.isZoomed,
	};
}

function roundCameraNumber(value: number): number {
	return Math.round(value * 1000) / 1000;
}
