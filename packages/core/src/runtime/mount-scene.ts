import { AnimationEngine } from "../animation/animation-engine.ts";
import type { ControllerConfig } from "../animation/controller.ts";
import { AnimationController } from "../animation/controller.ts";
import { buildSceneDOM, getResolvedViewBox } from "../rendering/rendering-engine.ts";
import { resolveTheme } from "../types/asset-registry.ts";
import { RenderError } from "../types/errors.ts";
import type { CompiledFloor, CompiledLayout, RuntimeBundle } from "../types/runtime-bundle.ts";
import { sha256 } from "../utils/sha256.ts";

const RUNTIME_BUNDLE_FORMAT = "isostate-runtime-bundle";
const RUNTIME_VERSION = "0.4.0";
const HEX_DIGEST_PATTERN = /^[a-f0-9]{64}$/;

export interface MountSceneOptions {
	/** Controller options, `false` to disable, or omitted to leave controller uninitialized. */
	controller?: ControllerConfig | false;
	/** Accessible label for the mounted SVG root. */
	label?: string;
	/** CSS custom properties applied on top of the bundle theme. */
	themeVars?: Record<string, string>;
}

/** Runtime configuration resolved from a mounted scene bundle. */
export interface ResolvedRuntimeConfig {
	grid: { cellSize: number };
	floor: CompiledFloor;
	layout: CompiledLayout;
	viewBox: { minX: number; minY: number; width: number; height: number };
	camera: { viewBox: { minX: number; minY: number; width: number; height: number }; isZoomed: boolean };
	theme: string;
	themeVars: Record<string, string>;
	scenes: Array<{ id: string; progress: number }>;
	layerOrder: Array<{ name: string; order: number }>;
}

/** Handles returned by `mountScene()` for controlling and disposing a scene. */
export interface MountedScene {
	/** Root SVG element appended to the mount target. */
	svg: SVGSVGElement;
	/** Animation engine used by the mounted scene and controller. */
	engine: AnimationEngine;
	/** Optional controller created when `options.controller` is provided. */
	controller?: AnimationController;
	/** Inspect effective runtime settings after defaults and bundle metadata are applied. */
	getResolvedConfig(): ResolvedRuntimeConfig;
	/** Remove DOM and event listeners owned by this mount. Safe to call more than once. */
	destroy(): void;
}

/** Mount a compiled runtime bundle into an HTML element. */
export function mountScene(target: HTMLElement, bundle: RuntimeBundle, options: MountSceneOptions = {}): MountedScene {
	assertMountTarget(target);
	validateRuntimeBundle(bundle);

	const engine = new AnimationEngine();
	engine.init(bundle);

	const svg = buildSceneDOM(target, bundle, {
		label: options.label,
		themeVars: options.themeVars,
	});

	let controller: AnimationController | undefined;
	if (options.controller !== undefined && options.controller !== false) {
		controller = new AnimationController();
		controller.init(
			bundle,
			{
				...options.controller,
				container: options.controller.container ?? target,
				sceneElement: svg,
			},
			{
				engine,
				sceneElement: svg,
			},
		);
	}

	let destroyed = false;

	return {
		svg,
		engine,
		controller,
		getResolvedConfig: () => getResolvedConfig(bundle, options),
		destroy: () => {
			if (destroyed) return;
			destroyed = true;
			controller?.destroy();
			engine.destroy();
			if (svg.parentNode === target) {
				target.removeChild(svg);
			} else {
				svg.parentNode?.removeChild(svg);
			}
		},
	};
}

function assertMountTarget(target: HTMLElement): void {
	if (!target || typeof target.appendChild !== "function" || typeof target.removeChild !== "function") {
		throw new RenderError("INVALID_MOUNT_TARGET", "mountScene() requires a DOM HTMLElement target");
	}
}

function validateRuntimeBundle(bundle: RuntimeBundle): void {
	if (!bundle || typeof bundle !== "object") {
		throw new RenderError("BUNDLE_FORMAT_MISSING", "Runtime bundle must be a plain object");
	}

	if (bundle._format !== RUNTIME_BUNDLE_FORMAT) {
		throw new RenderError("BUNDLE_FORMAT_MISSING", "Runtime bundle format is missing or unsupported", {
			expected: RUNTIME_BUNDLE_FORMAT,
		});
	}

	if (!Array.isArray(bundle.scenes) || bundle.scenes.length === 0) {
		throw new RenderError("BUNDLE_FORMAT_MISSING", "Runtime bundle must include compiled scenes[]");
	}

	if (majorVersion(bundle._version) !== majorVersion(RUNTIME_VERSION)) {
		throw new RenderError(
			"BUNDLE_VERSION_MISMATCH",
			`Runtime bundle version ${bundle._version} is not compatible with runtime ${RUNTIME_VERSION}`,
			{ bundleVersion: bundle._version, runtimeVersion: RUNTIME_VERSION },
		);
	}

	if (!bundle._digest) {
		throw new RenderError("BUNDLE_DIGEST_MISSING", "Runtime bundle digest is missing");
	}

	if (typeof bundle._digest !== "string" || !HEX_DIGEST_PATTERN.test(bundle._digest)) {
		throw new RenderError("BUNDLE_DIGEST_MISMATCH", "Runtime bundle digest is malformed");
	}

	const { _digest, ...bundleWithoutDigest } = bundle;
	const actualDigest = sha256(canonicalStringify(bundleWithoutDigest));
	if (actualDigest !== _digest) {
		throw new RenderError("BUNDLE_DIGEST_MISMATCH", "Runtime bundle digest does not match bundle content", {
			expected: _digest,
			actual: actualDigest,
		});
	}
}

function getResolvedConfig(bundle: RuntimeBundle, options: MountSceneOptions = {}): ResolvedRuntimeConfig {
	return {
		grid: { cellSize: bundle.grid.cellSize },
		floor: { ...bundle.floor },
		layout: {
			...bundle.layout,
			padding: { ...bundle.layout.padding },
			align: [...bundle.layout.align],
		},
		viewBox: getResolvedViewBox(bundle),
		camera: {
			viewBox: getResolvedViewBox(bundle),
			isZoomed: false,
		},
		theme: bundle.theme,
		themeVars: getResolvedThemeVars(bundle, options.themeVars),
		scenes: bundle.scenes.map((scene) => ({
			id: scene.id,
			progress: scene.progress,
		})),
		layerOrder: bundle.layers
			.map((layer) => ({ name: layer.name, order: layer.order }))
			.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
	};
}

function getResolvedThemeVars(bundle: RuntimeBundle, overrides: Record<string, string> = {}): Record<string, string> {
	return {
		...(resolveTheme(bundle.theme) ?? {}),
		...(bundle.themeVars ?? {}),
		...overrides,
	};
}

function majorVersion(version: string): number {
	const major = Number.parseInt(String(version).split(".")[0] ?? "", 10);
	return Number.isFinite(major) ? major : Number.NaN;
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function canonicalStringify(value: unknown): string {
	return JSON.stringify(normalizeValue(value));
}

function normalizeValue<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((item) => (item === undefined ? null : normalizeValue(item))) as T;
	}

	if (!isPlainObject(value)) return value;

	const normalized: Record<string, JsonValue> = {};
	for (const key of Object.keys(value).sort()) {
		const child = (value as Record<string, unknown>)[key];
		if (child !== undefined) {
			normalized[key] = normalizeValue(child) as JsonValue;
		}
	}

	return normalized as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
