import { getResolvedProjectionLayout, getResolvedViewBox } from "../rendering/rendering-engine.ts";
import { RenderError } from "../types/errors.ts";
import type { RuntimeBundle } from "../types/runtime-bundle.ts";
import { projectToScreen } from "../utils/projection.ts";
import type { MountedScene } from "./mount-scene.ts";

const SVG_NS = "http://www.w3.org/2000/svg";
const DIAGNOSTICS_ATTR = "data-iso-diagnostics";

const GRID_STROKE = "var(--iso-diag-grid, rgba(37, 99, 235, 0.35))";
const TEXT_FILL = "var(--iso-diag-text, #1e3a8a)";
const ANCHOR_FILL = "var(--iso-diag-anchor, #dc2626)";
const ROUTE_FILL = "var(--iso-diag-route, #059669)";

/** Options accepted by {@link attachDiagnosticsOverlay}. */
export interface DiagnosticsOverlayOptions {
	/** Draw grid lines across the floor extent. Default: true. */
	grid?: boolean;
	/** Draw cell coordinate labels at whole-cell intersections. Default: false. */
	coordinates?: boolean;
	/** Mark element anchor points. Default: true. */
	anchors?: boolean;
	/** Mark connector route points. Default: true. */
	routes?: boolean;
	/** Show the scene id / progress readout panel. Default: true. */
	readout?: boolean;
}

/** Handle returned by {@link attachDiagnosticsOverlay} to refresh or remove the overlay. */
export interface DiagnosticsOverlayHandle {
	/** Re-render the overlay from current scene state. */
	update(): void;
	/** Remove the overlay and its subscriptions. Safe to call twice. */
	destroy(): void;
}

/** Tracks the single live overlay per mounted SVG so a second attach can retire the first. */
interface OverlayRegistry {
	current?: { token: symbol; handle: DiagnosticsOverlayHandle };
}

const registryBySvg = new WeakMap<SVGSVGElement, OverlayRegistry>();

/**
 * Attach a development-time diagnostics overlay (grid, coordinates, element
 * anchors, connector route points, and a scene/progress readout) to a mounted
 * scene. See `specs/02-capabilities/diagnostics-overlay.md` for the full
 * normative behavior.
 */
export function attachDiagnosticsOverlay(
	mounted: MountedScene,
	options: DiagnosticsOverlayOptions = {},
): DiagnosticsOverlayHandle {
	assertMounted(mounted);

	const registry = registryBySvg.get(mounted.svg) ?? {};
	registryBySvg.set(mounted.svg, registry);

	// Replace any previously attached overlay: retire its token so its
	// `update()`/`destroy()` become no-ops, then remove its DOM group.
	registry.current?.handle.destroy();

	const token = Symbol("diagnostics-overlay");
	const group = document.createElementNS(SVG_NS, "g") as SVGGElement;
	group.setAttribute(DIAGNOSTICS_ATTR, "");
	mounted.svg.appendChild(group);

	const render = (): void => renderOverlay(group, mounted, options);
	render();

	const unsubscribe = subscribeToLiveUpdates(mounted, render);
	const isCurrent = (): boolean => registry.current?.token === token;

	const handle: DiagnosticsOverlayHandle = {
		update(): void {
			if (!isCurrent()) return;
			render();
		},
		destroy(): void {
			if (!isCurrent()) return;
			unsubscribe();
			group.parentNode?.removeChild(group);
			registry.current = undefined;
		},
	};

	registry.current = { token, handle };
	return handle;
}

function assertMounted(mounted: MountedScene): void {
	if (!mounted.svg.isConnected) {
		throw new RenderError("MOUNT_DESTROYED", "Cannot attach a diagnostics overlay to a destroyed mount");
	}
}

/**
 * When the mount has a controller, re-render on `progress-change` and
 * `camera-change` so the overlay tracks live scroll/camera state. Without a
 * controller, consumers call `update()` manually — returns a no-op teardown.
 */
function subscribeToLiveUpdates(mounted: MountedScene, render: () => void): () => void {
	const controller = mounted.controller;
	if (!controller) return () => undefined;

	const onProgressChange = (): void => render();
	const onCameraChange = (): void => render();
	controller.on("progress-change", onProgressChange);
	controller.on("camera-change", onCameraChange);

	return () => {
		controller.off("progress-change", onProgressChange);
		controller.off("camera-change", onCameraChange);
	};
}

// ── Rendering ────────────────────────────────────────────────────────────────

function renderOverlay(group: SVGGElement, mounted: MountedScene, options: DiagnosticsOverlayOptions): void {
	clearChildren(group);

	const bundle = mounted.engine.bundle;
	if (!bundle) return;

	const layout = getResolvedProjectionLayout(bundle);
	const project = (x: number, y: number): { x: number; y: number } => {
		const screen = projectToScreen(
			x,
			y,
			layout.cellSize,
			layout.selectedBounds.minX,
			layout.selectedBounds.minY,
			layout.padding.x,
			layout.padding.y,
		);
		return { x: screen.screenX, y: screen.screenY };
	};

	const showGrid = options.grid ?? true;
	const showCoordinates = options.coordinates ?? false;
	const showAnchors = options.anchors ?? true;
	const showRoutes = options.routes ?? true;
	const showReadout = options.readout ?? true;

	if (showGrid) appendGrid(group, bundle, project);
	if (showCoordinates) appendCoordinates(group, bundle, project);
	if (showAnchors) appendAnchors(group, mounted, project);
	if (showRoutes) appendRoutes(group, mounted, project);
	if (showReadout) appendReadout(group, mounted, bundle);
}

function appendGrid(
	group: SVGGElement,
	bundle: RuntimeBundle,
	project: (x: number, y: number) => { x: number; y: number },
): void {
	const [originX, originY] = bundle.floor.origin;
	const [columns, rows] = bundle.floor.size;

	for (let x = 0; x <= columns; x++) {
		appendGridLine(group, project(originX + x, originY), project(originX + x, originY + rows));
	}
	for (let y = 0; y <= rows; y++) {
		appendGridLine(group, project(originX, originY + y), project(originX + columns, originY + y));
	}
}

function appendGridLine(group: SVGGElement, start: { x: number; y: number }, end: { x: number; y: number }): void {
	const path = document.createElementNS(SVG_NS, "path") as SVGPathElement;
	path.setAttribute("d", `M ${start.x} ${start.y} L ${end.x} ${end.y}`);
	path.setAttribute("stroke", GRID_STROKE);
	path.setAttribute("stroke-width", "1");
	path.setAttribute("fill", "none");
	path.setAttribute("vector-effect", "non-scaling-stroke");
	group.appendChild(path);
}

function appendCoordinates(
	group: SVGGElement,
	bundle: RuntimeBundle,
	project: (x: number, y: number) => { x: number; y: number },
): void {
	const [originX, originY] = bundle.floor.origin;
	const [columns, rows] = bundle.floor.size;

	for (let x = 0; x <= columns; x++) {
		for (let y = 0; y <= rows; y++) {
			const gridX = originX + x;
			const gridY = originY + y;
			const point = project(gridX, gridY);
			const text = document.createElementNS(SVG_NS, "text") as SVGTextElement;
			text.setAttribute("x", String(point.x));
			text.setAttribute("y", String(point.y));
			text.setAttribute("font-size", "8");
			text.setAttribute("fill", TEXT_FILL);
			text.textContent = `${gridX},${gridY}`;
			group.appendChild(text);
		}
	}
}

function appendAnchors(
	group: SVGGElement,
	mounted: MountedScene,
	project: (x: number, y: number) => { x: number; y: number },
): void {
	for (const element of mounted.engine.getFrameUpdates()) {
		if (element.lifecycle === "removed") continue;
		// The element's anchor is the node's local transform origin, which the
		// renderer always places at `projectToScreen(pos + size, ...)` — see
		// `applyElementTransform()` in rendering-engine.ts. No separate anchor
		// ratio math is needed here to locate the point itself.
		const point = project(element.pos[0] + element.size, element.pos[1] + element.size);
		const circle = document.createElementNS(SVG_NS, "circle") as SVGCircleElement;
		circle.setAttribute("cx", String(point.x));
		circle.setAttribute("cy", String(point.y));
		circle.setAttribute("r", "3");
		circle.setAttribute("fill", ANCHOR_FILL);
		group.appendChild(circle);
	}
}

function appendRoutes(
	group: SVGGElement,
	mounted: MountedScene,
	project: (x: number, y: number) => { x: number; y: number },
): void {
	for (const connector of mounted.engine.getConnectorFrameUpdates()) {
		if (connector.lifecycle === "removed") continue;
		for (const [x, y] of connector.route) {
			const point = project(x, y);
			const rect = document.createElementNS(SVG_NS, "rect") as SVGRectElement;
			rect.setAttribute("x", String(point.x - 2));
			rect.setAttribute("y", String(point.y - 2));
			rect.setAttribute("width", "4");
			rect.setAttribute("height", "4");
			rect.setAttribute("fill", ROUTE_FILL);
			group.appendChild(rect);
		}
	}
}

function appendReadout(group: SVGGElement, mounted: MountedScene, bundle: RuntimeBundle): void {
	const viewBox = mounted.controller ? mounted.controller.getCameraState().viewBox : getResolvedViewBox(bundle);
	const progress = mounted.controller ? mounted.controller.getProgress() : mounted.engine.getProgress();
	// Resolved from the engine's own progress-to-stop mapping (not
	// `controller.currentScene`, which only advances on explicit scene
	// navigation and would go stale under scroll-driven progress changes).
	const sceneId = mounted.controller ? mounted.engine.getCurrentState()?.id : undefined;

	const text = document.createElementNS(SVG_NS, "text") as SVGTextElement;
	text.setAttribute("x", String(viewBox.minX + 4));
	text.setAttribute("y", String(viewBox.minY + 10));
	text.setAttribute("font-size", "10");
	text.setAttribute("fill", TEXT_FILL);
	text.textContent = sceneId
		? `scene ${sceneId} · progress ${roundProgress(progress)}`
		: `progress ${roundProgress(progress)}`;
	group.appendChild(text);
}

function roundProgress(progress: number): number {
	return Math.round(progress * 1000) / 1000;
}

function clearChildren(node: SVGElement): void {
	while (node.firstChild) node.removeChild(node.firstChild);
}
