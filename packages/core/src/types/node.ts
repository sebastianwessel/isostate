/** Entry animation types */
export type EntryAnimation =
	| "fade-in"
	| "fade-in-grow"
	| "fall-in"
	| "rise-from-ground"
	| "slide-in-left"
	| "slide-in-right"
	| "flip-in"
	| "none";

/** Exit animation types */
export type ExitAnimation =
	| "fade-out"
	| "fade-out-shrink"
	| "fall-through-ground"
	| "rise-away"
	| "slide-out-left"
	| "slide-out-right"
	| "flip-out"
	| "none";

/** Runtime/compiler-derived lifecycle status. Not authored in YAML. */
export type LifecycleStatus = "entering" | "present" | "exiting" | "removed";

/** Runtime set of valid entry animation strings */
export const ENTRY_ANIMATIONS: ReadonlySet<EntryAnimation> = new Set([
	"fade-in",
	"fade-in-grow",
	"fall-in",
	"rise-from-ground",
	"slide-in-left",
	"slide-in-right",
	"flip-in",
	"none",
]);

/** Runtime set of valid exit animation strings */
export const EXIT_ANIMATIONS: ReadonlySet<ExitAnimation> = new Set([
	"fade-out",
	"fade-out-shrink",
	"fall-through-ground",
	"rise-away",
	"slide-out-left",
	"slide-out-right",
	"flip-out",
	"none",
]);

/** Runtime set of valid lifecycle status strings */
export const LIFECYCLE_STATUSES: ReadonlySet<LifecycleStatus> = new Set(["entering", "present", "exiting", "removed"]);

/** Ambient animation configuration */
export interface AmbientAnimation {
	/** Animation class name */
	name: string;
	/** Whether the animation runs infinitely (default: true) */
	infinite?: boolean;
	/** Number of times to play (only relevant when infinite: false) */
	iterations?: number;
}

/** Horizontal anchor used by built-in text elements. */
export type TextAlign = "start" | "middle" | "end";

/** Content and safe SVG text styling for the built-in `asset: text` element. */
export interface TextContent {
	/** Text content. Use newline characters for explicit line breaks. */
	value: string;
	/** Horizontal text anchor within the element cell. Defaults to `middle`. */
	align?: TextAlign;
	/** SVG font-size in CSS pixels before element scaling. Defaults to `12`. */
	fontSize?: number;
	/** SVG font-weight. Defaults to `700`. */
	fontWeight?: number | "normal" | "bold";
	/** Multiplier applied to `fontSize` for multiline spacing. Defaults to `1.2`. */
	lineHeight?: number;
	/** SVG fill color. Defaults to `currentColor`. */
	fill?: string;
}

/** Built-in generated primitive asset ids. These are not declared in header assets. */
export type PrimitiveAssetId = "rectangle" | "circle" | "polygon" | "line";

/** Shared safe SVG style fields for generated primitive assets. */
export interface PrimitiveStyle {
	/** SVG fill color or safe CSS color token. Defaults to `currentColor`. */
	fill?: string;
	/** SVG stroke color or safe CSS color token. Defaults to `none`. */
	stroke?: string;
	/** SVG stroke width in CSS pixels before element scaling. Defaults to `0`. */
	strokeWidth?: number;
	/** Element opacity from `0` to `1`. Defaults to `1`. */
	opacity?: number;
	/** Optional dash/gap pair for stroked primitives. */
	dash?: [number, number];
}

/** Generated projected rectangle/diamond primitive content. */
export interface RectanglePrimitive extends PrimitiveStyle {
	/** Optional corner radius for screen-space rectangles. Defaults to `0`. */
	rx?: number;
}

/** Generated circle primitive content. */
export interface CirclePrimitive extends PrimitiveStyle {}

/** Generated polygon primitive content using normalized local grid coordinates. */
export interface PolygonPrimitive extends PrimitiveStyle {
	/** Polygon points in local normalized grid coordinates from `0` to `1`. */
	points: [number, number][];
}

/** Generated line/polyline primitive content using normalized local grid coordinates. */
export interface LinePrimitive extends Omit<PrimitiveStyle, "fill"> {
	/** Line points in local normalized grid coordinates from `0` to `1`. */
	points: [number, number][];
	/** SVG line cap. Defaults to `round`. */
	lineCap?: "butt" | "round" | "square";
	/** SVG line join. Defaults to `round`. */
	lineJoin?: "miter" | "round" | "bevel";
}

/** Element-level payload for generated primitive assets. */
export interface PrimitiveContent {
	rectangle?: RectanglePrimitive;
	circle?: CirclePrimitive;
	polygon?: PolygonPrimitive;
	line?: LinePrimitive;
}

/** Element placement used in first-scene elements and later add operations. */
export interface ElementPlacement {
	id: string;
	asset: string;
	at: [number, number];
	size?: number;
	layer?: string;
	enter?: EntryAnimation;
	exit?: ExitAnimation;
	ambient?: AmbientAnimation[];
	text?: TextContent;
	primitive?: PrimitiveContent;
}

/** Element patch used by scene update operations. */
export interface ElementPatch {
	id: string;
	at?: [number, number];
	size?: number;
	layer?: string;
	enter?: EntryAnimation;
	exit?: ExitAnimation;
	ambient?: AmbientAnimation[];
	text?: TextContent;
	primitive?: PrimitiveContent;
}

/** Element removal used by scene remove operations. */
export interface ElementRemoval {
	id: string;
	exit?: ExitAnimation;
}

/** Visual connector line pattern for authored connections and runtime connectors. */
export type ConnectorPattern = "solid" | "dashed" | "dotted";

/** Visual connector geometry variant. */
export type ConnectorVariant = "line" | "road";

/** Generated endpoint indicator placed at the start or end of a connector. */
export type ConnectorEndpoint = "none" | "arrow" | "dot" | "circle" | "diamond" | "bar";

/** Direction used for connector endpoint orientation and flow animation. */
export type ConnectorDirection = "route" | "reverse";

/** Authored connector style overrides for a visual connection. */
export interface ConnectorStyle {
	/** Geometry variant. Defaults to `line`. */
	variant?: ConnectorVariant;
	/** Stroke pattern. Defaults to `solid`. */
	pattern?: ConnectorPattern;
	/** SVG stroke color or safe CSS color token. */
	stroke?: string;
	/** Stroke width in SVG user units. */
	strokeWidth?: number;
	/** Connector opacity from `0` to `1`. */
	opacity?: number;
	/** Explicit dash/gap pair in SVG user units. */
	dash?: [number, number];
	/** Optional outline stroke color for road connectors. */
	outline?: string;
	/** Optional outline width in SVG user units. */
	outlineWidth?: number;
	/** Optional road lane treatment. */
	lane?: "none" | "center-dashed";
}

/** Authored endpoint reference for compiler-routed visual connections. */
export interface ConnectorEndpointRef {
	/** Element id to attach to. Mutually exclusive with `at`. */
	element?: string;
	/** Explicit grid point to attach to. Mutually exclusive with `element`. */
	at?: [number, number];
	/** Element side or automatic side selection. Defaults to `auto`. */
	side?: "auto" | "top" | "right" | "bottom" | "left" | "front" | "back";
	/** Normalized side offset from `-0.5` to `0.5`. Defaults to `0`. */
	offset?: number;
}

/** Authored routing options used only by dev-time compiler tooling. */
export interface ConnectorRouting {
	/** Routing mode. Defaults to `orthogonal` for endpoint-routed connections. */
	mode?: "straight" | "orthogonal" | "manual";
	/** Obstacle avoidance selection. Defaults to `objects`. */
	avoid?: "objects" | "none" | string[];
	/** Obstacle clearance in grid cells. Defaults to `0.5`. */
	clearance?: number;
	/** Router grid step in grid cells. */
	gridStep?: number;
	/** Maximum allowed bends for advanced routers. */
	maxBends?: number;
	/** Route scoring preference for advanced routers. */
	prefer?: "direct" | "fewest-bends" | "shortest";
}

/** Connection placement used in first-scene connections and later add operations. */
export interface ConnectionPlacement {
	id: string;
	route?: [number, number][];
	from?: ConnectorEndpointRef;
	to?: ConnectorEndpointRef;
	routing?: ConnectorRouting;
	layer?: string;
	style?: ConnectorStyle;
	start?: ConnectorEndpoint;
	end?: ConnectorEndpoint;
	direction?: ConnectorDirection;
	enter?: EntryAnimation;
	exit?: ExitAnimation;
	ambient?: AmbientAnimation[];
}

/** Connection patch used by scene update operations. */
export interface ConnectionPatch {
	id: string;
	route?: [number, number][];
	from?: ConnectorEndpointRef;
	to?: ConnectorEndpointRef;
	routing?: ConnectorRouting;
	layer?: string;
	style?: ConnectorStyle;
	start?: ConnectorEndpoint;
	end?: ConnectorEndpoint;
	direction?: ConnectorDirection;
	enter?: EntryAnimation;
	exit?: ExitAnimation;
	ambient?: AmbientAnimation[];
}

/** Connection removal used by scene remove operations. */
export interface ConnectionRemoval {
	id: string;
	exit?: ExitAnimation;
}

/** Fully defaulted connector style emitted to browser runtime snapshots. */
export interface RuntimeConnectorStyle {
	variant: ConnectorVariant;
	pattern: ConnectorPattern;
	stroke: string;
	strokeWidth: number;
	opacity: number;
	dash?: [number, number];
	outline?: string;
	outlineWidth: number;
	lane: "none" | "center-dashed";
}

/** Runtime-resolved connector state in a compiled scene stop. */
export interface RuntimeConnectorState {
	id: string;
	route: [number, number][];
	layer: string;
	presence: LifecycleStatus;
	style: RuntimeConnectorStyle;
	start: ConnectorEndpoint;
	end: ConnectorEndpoint;
	direction: ConnectorDirection;
	enter?: EntryAnimation;
	exit?: ExitAnimation;
	ambient?: AmbientAnimation[];
}

/** Runtime-resolved element state in a compiled scene stop. */
export interface RuntimeElementState {
	id: string;
	asset: string;
	pos: [number, number];
	size: number;
	layer: string;
	presence: LifecycleStatus;
	enter?: EntryAnimation;
	exit?: ExitAnimation;
	ambient?: AmbientAnimation[];
	text?: TextContent;
	primitive?: PrimitiveContent;
}

// ── Type guards ──────────────────────────────────────────────────────────────

/** Narrow a raw string to EntryAnimation. Returns undefined if invalid. */
export function guardEntryAnimation(v: unknown): EntryAnimation | undefined {
	if (typeof v !== "string") return undefined;
	return ENTRY_ANIMATIONS.has(v as EntryAnimation) ? (v as EntryAnimation) : undefined;
}

/** Narrow a raw string to ExitAnimation. Returns undefined if invalid. */
export function guardExitAnimation(v: unknown): ExitAnimation | undefined {
	if (typeof v !== "string") return undefined;
	return EXIT_ANIMATIONS.has(v as ExitAnimation) ? (v as ExitAnimation) : undefined;
}

/** Narrow a raw string to LifecycleStatus. Returns undefined if invalid. */
export function guardLifecycleStatus(v: unknown): LifecycleStatus | undefined {
	if (typeof v !== "string") return undefined;
	return LIFECYCLE_STATUSES.has(v as LifecycleStatus) ? (v as LifecycleStatus) : undefined;
}
