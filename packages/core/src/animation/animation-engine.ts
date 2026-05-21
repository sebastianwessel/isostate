import type {
	AmbientAnimation,
	LifecycleStatus,
	RuntimeConnectorState,
	RuntimeConnectorStyle,
	RuntimeElementState
} from '../types/node.ts';
import type { RuntimeBundle } from '../types/runtime-bundle.ts';

export type LifecycleKey = 'entering' | 'present' | 'exiting' | 'removed';

/** Internal state tracked per element across frames. */
interface ElementFrame {
	id: string;
	asset: string;
	pos: [number, number];
	size: number;
	lifecycle: LifecycleStatus;
	ambient: AmbientAnimation[];
	layer: string;
	entry?: string;
	exit?: string;
}

/** Internal state tracked per connector across frames. */
interface ConnectorFrame {
	id: string;
	route: [number, number][];
	layer: string;
	lifecycle: LifecycleStatus;
	style: RuntimeConnectorStyle;
	start: RuntimeConnectorState['start'];
	end: RuntimeConnectorState['end'];
	direction: RuntimeConnectorState['direction'];
	ambient: AmbientAnimation[];
	entry?: string;
	exit?: string;
}

/** Interpolation result for a frame update. */
export interface FrameUpdate {
	id: string;
	asset: string;
	lifecycle: LifecycleKey;
	ambient: AmbientAnimation[];
	pos: [number, number];
	size: number;
	layer: string;
	entry?: string;
	exit?: string;
}

/** Interpolation result for a connector frame update. */
export interface ConnectorFrameUpdate {
	id: string;
	route: [number, number][];
	layer: string;
	lifecycle: LifecycleKey;
	style: RuntimeConnectorStyle;
	start: RuntimeConnectorState['start'];
	end: RuntimeConnectorState['end'];
	direction: RuntimeConnectorState['direction'];
	ambient: AmbientAnimation[];
	entry?: string;
	exit?: string;
}

/**
 * Animation engine — resolves progress against compiled RuntimeBundle scene stops.
 *
 * The engine does not manipulate DOM. It computes interpolation data and lifecycle
 * transitions that the controller applies to the rendering engine.
 */
export class AnimationEngine {
	private _bundle: RuntimeBundle | null = null;
	private _progress = 0;
	private _paused = false;
	private _prevFrameMap = new Map<string, ElementFrame>();
	private _elementFrameMap = new Map<string, ElementFrame>();
	private _prevConnectorFrameMap = new Map<string, ConnectorFrame>();
	private _connectorFrameMap = new Map<string, ConnectorFrame>();

	get bundle(): RuntimeBundle | null {
		return this._bundle;
	}

	get progress(): number {
		return this._progress;
	}

	getProgress(): number {
		return this._progress;
	}

	get paused(): boolean {
		return this._paused;
	}

	isPaused(): boolean {
		return this._paused;
	}

	get elementsCount(): number {
		return this._elementFrameMap.size;
	}

	get connectorsCount(): number {
		return this._connectorFrameMap.size;
	}

	/** Initialize with a compiled runtime bundle. */
	init(bundle: RuntimeBundle): void {
		this._bundle = bundle;
		this._progress = 0;
		this._paused = false;
		this._prevFrameMap.clear();
		this._elementFrameMap.clear();
		this._prevConnectorFrameMap.clear();
		this._connectorFrameMap.clear();

		const initial = resolveFrameMap(bundle, 0);
		this._elementFrameMap = initial;
		this._prevFrameMap = cloneFrameMap(initial);
		const initialConnectors = resolveConnectorFrameMap(bundle, 0);
		this._connectorFrameMap = initialConnectors;
		this._prevConnectorFrameMap = cloneConnectorFrameMap(initialConnectors);
	}

	/** Set current scroll progress (0-1) and compute frame update. */
	setProgress(progress: number): void {
		const clamped = Math.max(0, Math.min(1, progress));
		if (this._paused) return;
		this._progress = clamped;
		if (!this._bundle) return;

		this._prevFrameMap = cloneFrameMap(this._elementFrameMap);
		this._elementFrameMap = resolveFrameMap(this._bundle, clamped);
		this._prevConnectorFrameMap = cloneConnectorFrameMap(
			this._connectorFrameMap
		);
		this._connectorFrameMap = resolveConnectorFrameMap(this._bundle, clamped);
	}

	/** Get interpolated FrameUpdate for an element id or runtime element. */
	getElementUpdate(
		element: string | Pick<RuntimeElementState, 'id'>
	): FrameUpdate {
		const id = typeof element === 'string' ? element : element.id;
		const frame = this._elementFrameMap.get(id);
		if (!frame) {
			return {
				id,
				asset: '',
				lifecycle: 'removed',
				ambient: [],
				pos: [0, 0],
				size: 1,
				layer: ''
			};
		}
		return frameToUpdate(frame);
	}

	getFrameUpdates(): FrameUpdate[] {
		return [...this._elementFrameMap.values()].map(frameToUpdate);
	}

	/** Get interpolated ConnectorFrameUpdate for a connector id or runtime connector. */
	getConnectorUpdate(
		connector: string | Pick<RuntimeConnectorState, 'id'>
	): ConnectorFrameUpdate {
		const id = typeof connector === 'string' ? connector : connector.id;
		const frame = this._connectorFrameMap.get(id);
		if (!frame) return connectorFrameToUpdate(removedConnectorFrame(id));
		return connectorFrameToUpdate(frame);
	}

	getConnectorFrameUpdates(): ConnectorFrameUpdate[] {
		return [...this._connectorFrameMap.values()].map(connectorFrameToUpdate);
	}

	/** Compute lifecycle transition between previous and current frame. */
	getLifecycleTransition(elId: string): {
		from: LifecycleKey;
		to: LifecycleKey;
	} | null {
		const prev = this._prevFrameMap.get(elId);
		const current = this._elementFrameMap.get(elId);
		const from = (prev?.lifecycle ?? 'removed') as LifecycleKey;
		const to = (current?.lifecycle ?? 'removed') as LifecycleKey;
		if (from === to) return null;
		return {
			from,
			to
		};
	}

	/** Compute lifecycle transition between previous and current connector frame. */
	getConnectorLifecycleTransition(connectorId: string): {
		from: LifecycleKey;
		to: LifecycleKey;
	} | null {
		const prev = this._prevConnectorFrameMap.get(connectorId);
		const current = this._connectorFrameMap.get(connectorId);
		const from = (prev?.lifecycle ?? 'removed') as LifecycleKey;
		const to = (current?.lifecycle ?? 'removed') as LifecycleKey;
		if (from === to) return null;
		return {
			from,
			to
		};
	}

	getCurrentState(): RuntimeBundle['scenes'][number] | null {
		const bundle = this._bundle;
		if (!bundle) return null;
		const pair = findSurroundingStops(bundle.scenes, this._progress);
		return pair?.nextStop ?? bundle.scenes[0] ?? null;
	}

	pause(): void {
		this._paused = true;
	}

	resume(): void {
		this._paused = false;
	}

	destroy(): void {
		this._bundle = null;
		this._progress = 0;
		this._paused = false;
		this._elementFrameMap.clear();
		this._prevFrameMap.clear();
		this._connectorFrameMap.clear();
		this._prevConnectorFrameMap.clear();
	}
}

// ── Interpolation helpers ──────────────────────────────────────────────────

function resolveFrameMap(
	bundle: RuntimeBundle,
	progress: number
): Map<string, ElementFrame> {
	const pair = findSurroundingStops(bundle.scenes, progress);
	const result = new Map<string, ElementFrame>();
	if (!pair) return result;

	const ids = new Set<string>();
	for (const stop of bundle.scenes) {
		for (const element of stop.elements ?? []) ids.add(element.id);
	}
	for (const element of pair.prevStop.elements ?? []) ids.add(element.id);
	for (const element of pair.nextStop.elements ?? []) ids.add(element.id);

	for (const id of ids) {
		const frame = interpolateElement(id, pair.prevStop, pair.nextStop, pair.t);
		result.set(id, frame);
	}

	return result;
}

function resolveConnectorFrameMap(
	bundle: RuntimeBundle,
	progress: number
): Map<string, ConnectorFrame> {
	const pair = findSurroundingStops(bundle.scenes, progress);
	const result = new Map<string, ConnectorFrame>();
	if (!pair) return result;

	const ids = new Set<string>();
	for (const stop of bundle.scenes) {
		for (const connector of stop.connectors ?? []) ids.add(connector.id);
	}
	for (const connector of pair.prevStop.connectors ?? []) ids.add(connector.id);
	for (const connector of pair.nextStop.connectors ?? []) ids.add(connector.id);

	for (const id of ids) {
		const frame = interpolateConnector(
			id,
			pair.prevStop,
			pair.nextStop,
			pair.t
		);
		result.set(id, frame);
	}

	return result;
}

function findSurroundingStops(
	stops: RuntimeBundle['scenes'],
	progress: number
): {
	prevStop: RuntimeBundle['scenes'][number];
	nextStop: RuntimeBundle['scenes'][number];
	t: number;
	nextIndex: number;
} | null {
	if (stops.length === 0) return null;
	const sorted = [...stops].sort((a, b) => a.progress - b.progress);
	if (sorted.length === 1 || progress <= sorted[0].progress) {
		return { prevStop: sorted[0], nextStop: sorted[0], t: 0, nextIndex: 0 };
	}

	const lastIndex = sorted.length - 1;
	if (progress >= sorted[lastIndex].progress) {
		return {
			prevStop: sorted[lastIndex - 1] ?? sorted[lastIndex],
			nextStop: sorted[lastIndex],
			t: 1,
			nextIndex: lastIndex
		};
	}

	for (let i = 1; i < sorted.length; i++) {
		const nextStop = sorted[i];
		if (nextStop.progress >= progress) {
			const prevStop = sorted[i - 1];
			const range = nextStop.progress - prevStop.progress;
			const t = range > 0 ? (progress - prevStop.progress) / range : 0;
			return { prevStop, nextStop, t, nextIndex: i };
		}
	}

	return null;
}

function interpolateElement(
	id: string,
	prevStop: RuntimeBundle['scenes'][number],
	nextStop: RuntimeBundle['scenes'][number],
	t: number
): ElementFrame {
	const prev = findElement(prevStop, id);
	const next = findElement(nextStop, id);
	const source = next ?? prev;
	if (!source) {
		return removedFrame(id);
	}

	if (!prev || prev.presence === 'removed') {
		return frameFromElement(
			source,
			source.presence === 'removed' || t < 1 ? 'removed' : source.presence
		);
	}

	if (!next || next.presence === 'removed') {
		return frameFromElement(prev, t < 1 ? prev.presence : 'removed');
	}

	const lifecycle = t < 1 ? prev.presence : next.presence;
	return {
		id,
		asset: next.asset,
		pos: interpolatePos(prev.pos, next.pos, t),
		size: prev.size + (next.size - prev.size) * t,
		lifecycle,
		ambient: cloneAmbient(next.ambient),
		layer: t < 1 ? prev.layer : next.layer,
		entry: next.enter ?? prev.enter,
		exit: next.exit ?? prev.exit
	};
}

function interpolateConnector(
	id: string,
	prevStop: RuntimeBundle['scenes'][number],
	nextStop: RuntimeBundle['scenes'][number],
	t: number
): ConnectorFrame {
	const prev = findConnector(prevStop, id);
	const next = findConnector(nextStop, id);
	const source = next ?? prev;
	if (!source) return removedConnectorFrame(id);

	if (!prev || prev.presence === 'removed') {
		return frameFromConnector(
			source,
			source.presence === 'removed' || t < 1 ? 'removed' : source.presence
		);
	}

	if (!next || next.presence === 'removed') {
		return frameFromConnector(prev, t < 1 ? prev.presence : 'removed');
	}

	const lifecycle = t < 1 ? prev.presence : next.presence;
	return {
		id,
		route: interpolateRoute(prev.route, next.route, t),
		layer: t < 1 ? prev.layer : next.layer,
		lifecycle,
		style: cloneConnectorStyle(next.style),
		start: next.start,
		end: next.end,
		direction: next.direction,
		ambient: cloneAmbient(next.ambient),
		entry: next.enter ?? prev.enter,
		exit: next.exit ?? prev.exit
	};
}

function findElement(
	stop: RuntimeBundle['scenes'][number],
	id: string
): RuntimeElementState | undefined {
	return (stop.elements ?? []).find((element) => element.id === id);
}

function findConnector(
	stop: RuntimeBundle['scenes'][number],
	id: string
): RuntimeConnectorState | undefined {
	return (stop.connectors ?? []).find((connector) => connector.id === id);
}

function frameFromElement(
	element: RuntimeElementState,
	lifecycle: LifecycleStatus = element.presence
): ElementFrame {
	return {
		id: element.id,
		asset: element.asset,
		pos: [...element.pos],
		size: element.size,
		lifecycle,
		ambient: cloneAmbient(element.ambient),
		layer: element.layer,
		entry: element.enter,
		exit: element.exit
	};
}

function frameFromConnector(
	connector: RuntimeConnectorState,
	lifecycle: LifecycleStatus = connector.presence
): ConnectorFrame {
	return {
		id: connector.id,
		route: cloneRoute(connector.route),
		layer: connector.layer,
		lifecycle,
		style: cloneConnectorStyle(connector.style),
		start: connector.start,
		end: connector.end,
		direction: connector.direction,
		ambient: cloneAmbient(connector.ambient),
		entry: connector.enter,
		exit: connector.exit
	};
}

function removedFrame(id: string): ElementFrame {
	return {
		id,
		asset: '',
		pos: [0, 0],
		size: 1,
		lifecycle: 'removed',
		ambient: [],
		layer: ''
	};
}

function removedConnectorFrame(id: string): ConnectorFrame {
	return {
		id,
		route: [],
		layer: '',
		lifecycle: 'removed',
		style: {
			variant: 'line',
			pattern: 'solid',
			stroke: '#2563eb',
			strokeWidth: 3,
			opacity: 1,
			outlineWidth: 0,
			lane: 'none'
		},
		start: 'none',
		end: 'none',
		direction: 'route',
		ambient: []
	};
}

function interpolatePos(
	prev: [number, number],
	next: [number, number],
	t: number
): [number, number] {
	return [prev[0] + (next[0] - prev[0]) * t, prev[1] + (next[1] - prev[1]) * t];
}

function interpolateRoute(
	prev: [number, number][],
	next: [number, number][],
	t: number
): [number, number][] {
	if (prev.length !== next.length) return cloneRoute(t < 1 ? prev : next);
	return prev.map((point, index) => interpolatePos(point, next[index], t));
}

function cloneRoute(route: [number, number][]): [number, number][] {
	return route.map((point) => [point[0], point[1]]);
}

function cloneConnectorStyle(
	style: RuntimeConnectorStyle
): RuntimeConnectorStyle {
	return {
		...style,
		...(style.dash ? { dash: [...style.dash] as [number, number] } : {})
	};
}

function cloneAmbient(
	ambient: AmbientAnimation[] | undefined
): AmbientAnimation[] {
	return (ambient ?? []).map((item) => ({ ...item }));
}

function frameToUpdate(frame: ElementFrame): FrameUpdate {
	return {
		id: frame.id,
		asset: frame.asset,
		lifecycle: frame.lifecycle as LifecycleKey,
		ambient: cloneAmbient(frame.ambient),
		pos: [...frame.pos],
		size: frame.size,
		layer: frame.layer,
		entry: frame.entry,
		exit: frame.exit
	};
}

function connectorFrameToUpdate(frame: ConnectorFrame): ConnectorFrameUpdate {
	return {
		id: frame.id,
		route: cloneRoute(frame.route),
		layer: frame.layer,
		lifecycle: frame.lifecycle as LifecycleKey,
		style: cloneConnectorStyle(frame.style),
		start: frame.start,
		end: frame.end,
		direction: frame.direction,
		ambient: cloneAmbient(frame.ambient),
		entry: frame.entry,
		exit: frame.exit
	};
}

function cloneFrameMap(
	map: Map<string, ElementFrame>
): Map<string, ElementFrame> {
	const clone = new Map<string, ElementFrame>();
	for (const [id, frame] of map) {
		clone.set(id, {
			...frame,
			pos: [...frame.pos],
			ambient: cloneAmbient(frame.ambient)
		});
	}
	return clone;
}

function cloneConnectorFrameMap(
	map: Map<string, ConnectorFrame>
): Map<string, ConnectorFrame> {
	const clone = new Map<string, ConnectorFrame>();
	for (const [id, frame] of map) {
		clone.set(id, {
			...frame,
			route: cloneRoute(frame.route),
			style: cloneConnectorStyle(frame.style),
			ambient: cloneAmbient(frame.ambient)
		});
	}
	return clone;
}
