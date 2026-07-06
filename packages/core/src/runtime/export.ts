import {
	getConnectorState,
	getElementState,
	hideElementAfterExit,
	unhideElementOnReadd,
	updateElementTransforms,
} from "../rendering/rendering-engine.ts";
import { RenderError } from "../types/errors.ts";
import type { RuntimeConnectorState, RuntimeElementState } from "../types/node.ts";
import type { MountedScene } from "./mount-scene.ts";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";
const DIAGNOSTICS_OVERLAY_SELECTOR = "[data-iso-diagnostics]";

/** Options accepted by {@link exportSceneSvg} and, via extension, {@link exportScenePng}. */
export interface SnapshotOptions {
	/** Progress to render before serializing. Omitted = current progress. */
	progress?: number;
	/** Inline external `<image>` hrefs as `data:` URIs. Default: `true`. */
	inlineAssets?: boolean;
	/** Solid background color (any CSS color). Default: none (transparent). */
	background?: string;
}

/** Options accepted by {@link exportScenePng}. */
export interface PngSnapshotOptions extends SnapshotOptions {
	/** Device-pixel multiplier applied to the viewBox size. Default: `2`. */
	scale?: number;
}

/**
 * Serialize a mounted scene to a standalone SVG document string.
 *
 * The exported SVG carries the runtime stylesheet and current visual state
 * as-is. Ambient/entry/exit CSS animations are not restarted or awaited by
 * the export; the snapshot reflects the un-animated base state at the
 * resolved progress.
 */
export async function exportSceneSvg(mounted: MountedScene, options: SnapshotOptions = {}): Promise<string> {
	assertNotDestroyed(mounted);
	assertValidSnapshotOptions(options);

	return withRestoredProgress(mounted, options.progress, async () => {
		const clone = prepareClone(mounted.svg, options);
		if (options.inlineAssets ?? true) {
			await inlineImageAssets(clone);
		}
		return serializeSvg(clone);
	});
}

/** Rasterize a mounted scene to a PNG blob. */
export async function exportScenePng(mounted: MountedScene, options: PngSnapshotOptions = {}): Promise<Blob> {
	assertNotDestroyed(mounted);
	assertValidPngSnapshotOptions(options);
	const scale = options.scale ?? 2;

	return withRestoredProgress(mounted, options.progress, async () => {
		const clone = prepareClone(mounted.svg, options);
		// PNG export always inlines assets: external hrefs taint or fail canvas rasterization.
		await inlineImageAssets(clone);
		const svgString = serializeSvg(clone);
		const viewBox = readViewBox(clone);
		return rasterize(svgString, viewBox, scale);
	});
}

// ── Shared step 1-3: destroyed check, option validation, progress restore ──

function assertNotDestroyed(mounted: MountedScene): void {
	if (!mounted.svg.isConnected) {
		throw new RenderError("EXPORT_TARGET_DESTROYED", "Cannot export a scene whose mount was destroyed");
	}
}

function assertValidSnapshotOptions(options: SnapshotOptions): void {
	if (options.progress !== undefined && !isValidProgress(options.progress)) {
		throw new RenderError("EXPORT_INVALID_OPTIONS", "progress must be a finite number within [0, 1]", {
			progress: options.progress,
		});
	}
}

function assertValidPngSnapshotOptions(options: PngSnapshotOptions): void {
	assertValidSnapshotOptions(options);
	if (options.scale !== undefined && !isValidScale(options.scale)) {
		throw new RenderError("EXPORT_INVALID_OPTIONS", "scale must be a finite number greater than 0", {
			scale: options.scale,
		});
	}
	if (options.inlineAssets === false) {
		throw new RenderError(
			"EXPORT_INVALID_OPTIONS",
			"exportScenePng() always inlines assets; inlineAssets: false is unsupported for PNG export",
		);
	}
}

function isValidProgress(progress: number): boolean {
	return Number.isFinite(progress) && progress >= 0 && progress <= 1;
}

function isValidScale(scale: number): boolean {
	return Number.isFinite(scale) && scale > 0;
}

/**
 * Runs `run` at the requested `progress`, restoring the engine's prior
 * progress afterwards on every code path (success or rejection). When
 * `progress` is omitted, `run` executes at the scene's current progress and
 * no restoration is needed.
 */
async function withRestoredProgress<T>(
	mounted: MountedScene,
	progress: number | undefined,
	run: () => Promise<T>,
): Promise<T> {
	if (progress === undefined) {
		return run();
	}

	const previousProgress = mounted.engine.getProgress();
	try {
		mounted.engine.setProgress(progress);
		applyControllerFrame(mounted);
		return await run();
	} finally {
		mounted.engine.setProgress(previousProgress);
		applyControllerFrame(mounted);
	}
}

/**
 * Applies the engine's current frame to the live SVG so DOM state (element
 * transforms, generated content, connector routes, and lifecycle visibility)
 * matches the engine's resolved progress. Mirrors the non-animated portion of
 * `AnimationController`'s frame-apply path: transforms/content via
 * `updateElementTransforms()`, plus visibility driven by the resolved
 * lifecycle state. CSS entry/exit animation classes are intentionally not
 * (re)triggered here, matching the spec's requirement that ambient/entry
 * animations are irrelevant to export output.
 */
function applyControllerFrame(mounted: MountedScene): void {
	const svg = mounted.svg;
	const elementUpdates = mounted.engine.getFrameUpdates().map(
		(update): RuntimeElementState => ({
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
		}),
	);
	const connectorUpdates = mounted.engine.getConnectorFrameUpdates().map(
		(update): RuntimeConnectorState => ({
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
		}),
	);

	updateElementTransforms(svg, elementUpdates, connectorUpdates);
	applyElementVisibility(svg, elementUpdates);
	applyConnectorVisibility(svg, connectorUpdates);
}

function applyElementVisibility(svg: SVGSVGElement, elements: RuntimeElementState[]): void {
	for (const element of elements) {
		const state = getElementState(svg, element.id);
		if (!state) continue;
		if (element.presence === "removed") {
			state.isHidden = true;
			hideElementAfterExit(state.node);
		} else if (state.isHidden) {
			state.isHidden = false;
			unhideElementOnReadd(state.node);
		}
	}
}

function applyConnectorVisibility(svg: SVGSVGElement, connectors: RuntimeConnectorState[]): void {
	for (const connector of connectors) {
		const state = getConnectorState(svg, connector.id);
		if (!state) continue;
		if (connector.presence === "removed") {
			state.isHidden = true;
			hideElementAfterExit(state.node);
		} else if (state.isHidden) {
			state.isHidden = false;
			unhideElementOnReadd(state.node);
		}
	}
}

// ── Step 4-5: clone and prepare ────────────────────────────────────────────

function prepareClone(svg: SVGSVGElement, options: SnapshotOptions): SVGSVGElement {
	const clone = svg.cloneNode(true) as SVGSVGElement;
	const viewBox = readViewBox(clone);

	clone.setAttribute("width", String(viewBox.width));
	clone.setAttribute("height", String(viewBox.height));
	clone.setAttribute("xmlns", SVG_NAMESPACE);
	clone.setAttribute("xmlns:xlink", XLINK_NAMESPACE);

	if (options.background) {
		const rect = document.createElementNS(SVG_NAMESPACE, "rect");
		rect.setAttribute("x", String(viewBox.minX));
		rect.setAttribute("y", String(viewBox.minY));
		rect.setAttribute("width", String(viewBox.width));
		rect.setAttribute("height", String(viewBox.height));
		rect.setAttribute("fill", options.background);
		insertAsFirstChild(clone, rect);
	}

	const diagnosticsOverlay = clone.querySelector(DIAGNOSTICS_OVERLAY_SELECTOR);
	diagnosticsOverlay?.parentNode?.removeChild(diagnosticsOverlay);

	return clone;
}

function insertAsFirstChild(parent: SVGSVGElement, child: SVGElement): void {
	if (parent.firstChild) {
		parent.insertBefore(child, parent.firstChild);
	} else {
		parent.appendChild(child);
	}
}

function readViewBox(svg: SVGSVGElement): { minX: number; minY: number; width: number; height: number } {
	const raw = svg.getAttribute("viewBox");
	const parts = (raw ?? "").trim().split(/\s+/).map(Number);
	if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
		return { minX: 0, minY: 0, width: 0, height: 0 };
	}
	const [minX, minY, width, height] = parts as [number, number, number, number];
	return { minX, minY, width, height };
}

// ── Step 6: asset inlining ──────────────────────────────────────────────────

async function inlineImageAssets(clone: SVGSVGElement): Promise<void> {
	const images = [...clone.querySelectorAll("image")] as SVGImageElement[];
	await Promise.all(images.map((image) => inlineImageHref(image)));
}

async function inlineImageHref(image: SVGImageElement): Promise<void> {
	const href = image.getAttribute("href") ?? image.getAttributeNS(XLINK_NAMESPACE, "href");
	if (!href || href.startsWith("data:")) return;

	const dataUri = await fetchAsDataUri(href);
	image.setAttribute("href", dataUri);
	image.setAttributeNS(XLINK_NAMESPACE, "href", dataUri);
}

async function fetchAsDataUri(url: string): Promise<string> {
	let response: Response;
	try {
		response = await fetch(url);
	} catch {
		throw new RenderError("EXPORT_ASSET_FETCH_FAILED", `Failed to fetch asset for inlining: ${url}`, { url });
	}
	if (!response.ok) {
		throw new RenderError("EXPORT_ASSET_FETCH_FAILED", `Failed to fetch asset for inlining: ${url}`, { url });
	}

	const contentType = response.headers.get("content-type") ?? "application/octet-stream";
	const buffer = await response.arrayBuffer();
	return `data:${contentType};base64,${arrayBufferToBase64(buffer)}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	let binary = "";
	const bytes = new Uint8Array(buffer);
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

// ── Step 7: SVG serialization ───────────────────────────────────────────────

function serializeSvg(clone: SVGSVGElement): string {
	const serializer = new XMLSerializer();
	return `<?xml version="1.0" encoding="UTF-8"?>\n${serializer.serializeToString(clone)}`;
}

// ── Step 8: PNG rasterization ────────────────────────────────────────────────

async function rasterize(svgString: string, viewBox: { width: number; height: number }, scale: number): Promise<Blob> {
	const width = Math.ceil(viewBox.width * scale);
	const height = Math.ceil(viewBox.height * scale);

	const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
	const objectUrl = URL.createObjectURL(svgBlob);
	try {
		const image = await loadImage(objectUrl);

		const canvas = document.createElement("canvas") as HTMLCanvasElement;
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d");
		if (!context) {
			throw new RenderError("EXPORT_RASTERIZE_FAILED", "Canvas 2D context is unavailable");
		}
		context.drawImage(image, 0, 0, width, height);

		const blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(resolve, "image/png");
		});
		if (!blob) {
			throw new RenderError("EXPORT_RASTERIZE_FAILED", "Canvas failed to encode PNG output");
		}
		return blob;
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () =>
			reject(new RenderError("EXPORT_RASTERIZE_FAILED", "Failed to load rasterization source image"));
		image.src = src;
	});
}
