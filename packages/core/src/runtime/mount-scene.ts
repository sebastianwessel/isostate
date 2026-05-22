import { AnimationEngine } from "../animation/animation-engine.ts";
import type { ControllerConfig } from "../animation/controller.ts";
import { AnimationController } from "../animation/controller.ts";
import { buildSceneDOM, getResolvedViewBox } from "../rendering/rendering-engine.ts";
import { resolveTheme } from "../types/asset-registry.ts";
import { RenderError } from "../types/errors.ts";
import type { CompiledFloor, CompiledLayout, RuntimeBundle } from "../types/runtime-bundle.ts";

const RUNTIME_BUNDLE_FORMAT = "isostate-runtime-bundle";
const RUNTIME_VERSION = "0.3.0";
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

function sha256(input: string): string {
	const bytes = utf8Bytes(input);
	const bitLength = bytes.length * 8;
	bytes.push(0x80);
	while (bytes.length % 64 !== 56) bytes.push(0);
	for (let i = 7; i >= 0; i--) {
		bytes.push(Math.floor(bitLength / 2 ** (i * 8)) & 0xff);
	}

	const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
	const k = [
		0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
		0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
		0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
		0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
		0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
		0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
		0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
		0xc67178f2,
	];

	const w = new Array<number>(64);
	for (let offset = 0; offset < bytes.length; offset += 64) {
		for (let i = 0; i < 16; i++) {
			const j = offset + i * 4;
			w[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
		}
		for (let i = 16; i < 64; i++) {
			const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
			const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
			w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
		}

		let [a, b, c, d, e, f, g, hh] = h;
		for (let i = 0; i < 64; i++) {
			const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
			const ch = (e & f) ^ (~e & g);
			const temp1 = (hh + s1 + ch + k[i] + w[i]) >>> 0;
			const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
			const maj = (a & b) ^ (a & c) ^ (b & c);
			const temp2 = (s0 + maj) >>> 0;
			hh = g;
			g = f;
			f = e;
			e = (d + temp1) >>> 0;
			d = c;
			c = b;
			b = a;
			a = (temp1 + temp2) >>> 0;
		}

		h[0] = (h[0] + a) >>> 0;
		h[1] = (h[1] + b) >>> 0;
		h[2] = (h[2] + c) >>> 0;
		h[3] = (h[3] + d) >>> 0;
		h[4] = (h[4] + e) >>> 0;
		h[5] = (h[5] + f) >>> 0;
		h[6] = (h[6] + g) >>> 0;
		h[7] = (h[7] + hh) >>> 0;
	}

	return h.map((value) => value.toString(16).padStart(8, "0")).join("");
}

function utf8Bytes(input: string): number[] {
	return Array.from(new TextEncoder().encode(input));
}

function rotr(value: number, bits: number): number {
	return (value >>> bits) | (value << (32 - bits));
}
