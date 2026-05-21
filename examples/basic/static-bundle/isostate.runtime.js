/**
 * Animation engine — resolves progress against compiled RuntimeBundle scene stops.
 *
 * The engine does not manipulate DOM. It computes interpolation data and lifecycle
 * transitions that the controller applies to the rendering engine.
 */
class AnimationEngine {
    _bundle = null;
    _progress = 0;
    _paused = false;
    _prevFrameMap = new Map();
    _elementFrameMap = new Map();
    _prevConnectorFrameMap = new Map();
    _connectorFrameMap = new Map();
    get bundle() {
        return this._bundle;
    }
    get progress() {
        return this._progress;
    }
    getProgress() {
        return this._progress;
    }
    get paused() {
        return this._paused;
    }
    isPaused() {
        return this._paused;
    }
    get elementsCount() {
        return this._elementFrameMap.size;
    }
    get connectorsCount() {
        return this._connectorFrameMap.size;
    }
    /** Initialize with a compiled runtime bundle. */
    init(bundle) {
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
    setProgress(progress) {
        const clamped = Math.max(0, Math.min(1, progress));
        if (this._paused)
            return;
        this._progress = clamped;
        if (!this._bundle)
            return;
        this._prevFrameMap = cloneFrameMap(this._elementFrameMap);
        this._elementFrameMap = resolveFrameMap(this._bundle, clamped);
        this._prevConnectorFrameMap = cloneConnectorFrameMap(this._connectorFrameMap);
        this._connectorFrameMap = resolveConnectorFrameMap(this._bundle, clamped);
    }
    /** Get interpolated FrameUpdate for an element id or runtime element. */
    getElementUpdate(element) {
        const id = typeof element === "string" ? element : element.id;
        const frame = this._elementFrameMap.get(id);
        if (!frame) {
            return {
                id,
                asset: "",
                lifecycle: "removed",
                ambient: [],
                pos: [0, 0],
                size: 1,
                layer: "",
            };
        }
        return frameToUpdate(frame);
    }
    getFrameUpdates() {
        return [...this._elementFrameMap.values()].map(frameToUpdate);
    }
    /** Get interpolated ConnectorFrameUpdate for a connector id or runtime connector. */
    getConnectorUpdate(connector) {
        const id = typeof connector === "string" ? connector : connector.id;
        const frame = this._connectorFrameMap.get(id);
        if (!frame)
            return connectorFrameToUpdate(removedConnectorFrame(id));
        return connectorFrameToUpdate(frame);
    }
    getConnectorFrameUpdates() {
        return [...this._connectorFrameMap.values()].map(connectorFrameToUpdate);
    }
    /** Compute lifecycle transition between previous and current frame. */
    getLifecycleTransition(elId) {
        const prev = this._prevFrameMap.get(elId);
        const current = this._elementFrameMap.get(elId);
        const from = (prev?.lifecycle ?? "removed");
        const to = (current?.lifecycle ?? "removed");
        if (from === to)
            return null;
        return {
            from,
            to,
        };
    }
    /** Compute lifecycle transition between previous and current connector frame. */
    getConnectorLifecycleTransition(connectorId) {
        const prev = this._prevConnectorFrameMap.get(connectorId);
        const current = this._connectorFrameMap.get(connectorId);
        const from = (prev?.lifecycle ?? "removed");
        const to = (current?.lifecycle ?? "removed");
        if (from === to)
            return null;
        return {
            from,
            to,
        };
    }
    getCurrentState() {
        const bundle = this._bundle;
        if (!bundle)
            return null;
        const pair = findSurroundingStops(bundle.scenes, this._progress);
        return pair?.nextStop ?? bundle.scenes[0] ?? null;
    }
    pause() {
        this._paused = true;
    }
    resume() {
        this._paused = false;
    }
    destroy() {
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
function resolveFrameMap(bundle, progress) {
    const pair = findSurroundingStops(bundle.scenes, progress);
    const result = new Map();
    if (!pair)
        return result;
    const ids = new Set();
    for (const stop of bundle.scenes) {
        for (const element of stop.elements ?? [])
            ids.add(element.id);
    }
    for (const element of pair.prevStop.elements ?? [])
        ids.add(element.id);
    for (const element of pair.nextStop.elements ?? [])
        ids.add(element.id);
    for (const id of ids) {
        const frame = withRemovedElementGeometry(interpolateElement(id, pair.prevStop, pair.nextStop, pair.t), bundle.scenes, id, progress);
        result.set(id, frame);
    }
    return result;
}
function resolveConnectorFrameMap(bundle, progress) {
    const pair = findSurroundingStops(bundle.scenes, progress);
    const result = new Map();
    if (!pair)
        return result;
    const ids = new Set();
    for (const stop of bundle.scenes) {
        for (const connector of stop.connectors ?? [])
            ids.add(connector.id);
    }
    for (const connector of pair.prevStop.connectors ?? [])
        ids.add(connector.id);
    for (const connector of pair.nextStop.connectors ?? [])
        ids.add(connector.id);
    for (const id of ids) {
        const frame = interpolateConnector(id, pair.prevStop, pair.nextStop, pair.t);
        result.set(id, frame);
    }
    return result;
}
function findSurroundingStops(stops, progress) {
    if (stops.length === 0)
        return null;
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
            nextIndex: lastIndex,
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
function interpolateElement(id, prevStop, nextStop, t) {
    const prev = findElement(prevStop, id);
    const next = findElement(nextStop, id);
    const source = next ?? prev;
    if (!source) {
        return removedFrame(id);
    }
    if (!prev || prev.presence === "removed") {
        return frameFromElement(source, source.presence === "removed" || t < 1 ? "removed" : source.presence);
    }
    if (!next || next.presence === "removed") {
        return frameFromElement(prev, t < 1 ? prev.presence : "removed");
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
        exit: next.exit ?? prev.exit,
        text: cloneText(next.text ?? prev.text),
        primitive: clonePrimitive(next.primitive ?? prev.primitive),
    };
}
function interpolateConnector(id, prevStop, nextStop, t) {
    const prev = findConnector(prevStop, id);
    const next = findConnector(nextStop, id);
    const source = next ?? prev;
    if (!source)
        return removedConnectorFrame(id);
    if (!prev || prev.presence === "removed") {
        return frameFromConnector(source, source.presence === "removed" || t < 1 ? "removed" : source.presence);
    }
    if (!next || next.presence === "removed") {
        return frameFromConnector(prev, t < 1 ? prev.presence : "removed");
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
        exit: next.exit ?? prev.exit,
    };
}
function findElement(stop, id) {
    return (stop.elements ?? []).find((element) => element.id === id);
}
function findConnector(stop, id) {
    return (stop.connectors ?? []).find((connector) => connector.id === id);
}
function withRemovedElementGeometry(frame, stops, id, progress) {
    if (frame.lifecycle !== "removed")
        return frame;
    const reference = findNearestElementGeometry(stops, id, progress);
    if (!reference)
        return frame;
    return {
        ...frame,
        asset: reference.asset,
        pos: [...reference.pos],
        size: reference.size,
        ambient: cloneAmbient(reference.ambient),
        layer: reference.layer,
        entry: reference.enter,
        exit: reference.exit,
        text: cloneText(reference.text),
        primitive: clonePrimitive(reference.primitive),
    };
}
function findNearestElementGeometry(stops, id, progress) {
    const sorted = [...stops].sort((a, b) => a.progress - b.progress);
    const next = sorted
        .filter((stop) => stop.progress >= progress)
        .flatMap((stop) => stop.elements ?? [])
        .find((element) => element.id === id && element.presence !== "removed");
    if (next)
        return next;
    for (let index = sorted.length - 1; index >= 0; index -= 1) {
        if (sorted[index].progress > progress)
            continue;
        const previous = (sorted[index].elements ?? []).find((element) => element.id === id && element.presence !== "removed");
        if (previous)
            return previous;
    }
    return undefined;
}
function frameFromElement(element, lifecycle = element.presence) {
    return {
        id: element.id,
        asset: element.asset,
        pos: [...element.pos],
        size: element.size,
        lifecycle,
        ambient: cloneAmbient(element.ambient),
        layer: element.layer,
        entry: element.enter,
        exit: element.exit,
        text: cloneText(element.text),
        primitive: clonePrimitive(element.primitive),
    };
}
function frameFromConnector(connector, lifecycle = connector.presence) {
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
        exit: connector.exit,
    };
}
function removedFrame(id) {
    return {
        id,
        asset: "",
        pos: [0, 0],
        size: 1,
        lifecycle: "removed",
        ambient: [],
        layer: "",
    };
}
function removedConnectorFrame(id) {
    return {
        id,
        route: [],
        layer: "",
        lifecycle: "removed",
        style: {
            variant: "line",
            pattern: "solid",
            stroke: "#2563eb",
            strokeWidth: 3,
            opacity: 1,
            outlineWidth: 0,
            lane: "none",
        },
        start: "none",
        end: "none",
        direction: "route",
        ambient: [],
    };
}
function interpolatePos(prev, next, t) {
    return [prev[0] + (next[0] - prev[0]) * t, prev[1] + (next[1] - prev[1]) * t];
}
function interpolateRoute(prev, next, t) {
    if (prev.length !== next.length)
        return cloneRoute(t < 1 ? prev : next);
    return prev.map((point, index) => interpolatePos(point, next[index], t));
}
function cloneRoute(route) {
    return route.map((point) => [point[0], point[1]]);
}
function cloneConnectorStyle(style) {
    return {
        ...style,
        ...(style.dash ? { dash: [...style.dash] } : {}),
    };
}
function cloneAmbient(ambient) {
    return (ambient ?? []).map((item) => ({ ...item }));
}
function frameToUpdate(frame) {
    return {
        id: frame.id,
        asset: frame.asset,
        lifecycle: frame.lifecycle,
        ambient: cloneAmbient(frame.ambient),
        pos: [...frame.pos],
        size: frame.size,
        layer: frame.layer,
        entry: frame.entry,
        exit: frame.exit,
        text: cloneText(frame.text),
        primitive: clonePrimitive(frame.primitive),
    };
}
function connectorFrameToUpdate(frame) {
    return {
        id: frame.id,
        route: cloneRoute(frame.route),
        layer: frame.layer,
        lifecycle: frame.lifecycle,
        style: cloneConnectorStyle(frame.style),
        start: frame.start,
        end: frame.end,
        direction: frame.direction,
        ambient: cloneAmbient(frame.ambient),
        entry: frame.entry,
        exit: frame.exit,
    };
}
function cloneFrameMap(map) {
    const clone = new Map();
    for (const [id, frame] of map) {
        clone.set(id, {
            ...frame,
            pos: [...frame.pos],
            ambient: cloneAmbient(frame.ambient),
            text: cloneText(frame.text),
            primitive: clonePrimitive(frame.primitive),
        });
    }
    return clone;
}
function cloneText(text) {
    return text ? { ...text } : undefined;
}
function clonePrimitive(primitive) {
    if (!primitive)
        return undefined;
    return {
        ...(primitive.rectangle
            ? {
                rectangle: {
                    ...primitive.rectangle,
                    dash: cloneDash(primitive.rectangle.dash),
                },
            }
            : {}),
        ...(primitive.circle
            ? {
                circle: {
                    ...primitive.circle,
                    dash: cloneDash(primitive.circle.dash),
                },
            }
            : {}),
        ...(primitive.polygon
            ? {
                polygon: {
                    ...primitive.polygon,
                    dash: cloneDash(primitive.polygon.dash),
                    points: cloneRoute(primitive.polygon.points),
                },
            }
            : {}),
        ...(primitive.line
            ? {
                line: {
                    ...primitive.line,
                    dash: cloneDash(primitive.line.dash),
                    points: cloneRoute(primitive.line.points),
                },
            }
            : {}),
    };
}
function cloneDash(dash) {
    return dash ? [dash[0], dash[1]] : undefined;
}
function cloneConnectorFrameMap(map) {
    const clone = new Map();
    for (const [id, frame] of map) {
        clone.set(id, {
            ...frame,
            route: cloneRoute(frame.route),
            style: cloneConnectorStyle(frame.style),
            ambient: cloneAmbient(frame.ambient),
        });
    }
    return clone;
}

// ── Built-in themes ────────────────────────────────────────────────────────
const BUILTIN_THEMES = {
    light: {
        "--color-top": "#e2e8f0",
        "--color-front": "#94a3b8",
        "--color-side": "#64748b",
        "--color-back": "#475569",
        "--color-leaf": "#15803d",
        "--color-trunk": "#78350f",
        "--color-accent": "#3b82f6",
    },
    dark: {
        "--color-top": "#334155",
        "--color-front": "#1e293b",
        "--color-side": "#0f172a",
        "--color-back": "#020617",
        "--color-leaf": "#166534",
        "--color-trunk": "#451a03",
        "--color-accent": "#60a5fa",
    },
    brand: {
        "--color-top": "#c7d2fe",
        "--color-front": "#818cf8",
        "--color-side": "#6366f1",
        "--color-back": "#4338ca",
        "--color-leaf": "#22c55e",
        "--color-trunk": "#854d0e",
        "--color-accent": "#f59e0b",
    },
};
/**
 * Resolve a theme name to its CSS variable map.
 * Returns undefined if the theme is not found.
 */
function resolveTheme(name) {
    return BUILTIN_THEMES[name];
}
/**
 * Compose a new theme by extending an existing one with overrides.
 */
function composeTheme(baseName, overrides) {
    const base = BUILTIN_THEMES[baseName];
    if (!base) {
        return { name: baseName, vars: { ...overrides } };
    }
    return { name: baseName, vars: { ...base, ...overrides } };
}
// ── Asset registry implementation ──────────────────────────────────────────
/**
 * Default asset registry implementation.
 * Maps asset ids to definitions and supports category filtering.
 */
class AssetRegistryImpl {
    _assets = new Map();
    register(asset) {
        this._assets.set(asset.id, asset);
    }
    get(id) {
        return this._assets.get(id);
    }
    getAll(category) {
        if (category) {
            return [...this._assets.values()].filter((a) => a.category === category);
        }
        return [...this._assets.values()];
    }
    has(id) {
        return this._assets.has(id);
    }
    remove(id) {
        this._assets.delete(id);
    }
}
function createAssetRegistry(assets = []) {
    const registry = new AssetRegistryImpl();
    for (const asset of assets) {
        registry.register(asset);
    }
    return registry;
}
/** Create a fresh registry populated with the built-in demo assets. */
function createDefaultRegistry() {
    return createAssetRegistry([
        {
            id: "iso-platform",
            category: "infrastructure",
        },
        {
            id: "iso-server",
            category: "equipment",
        },
        {
            id: "iso-database",
            category: "equipment",
        },
        {
            id: "iso-connector",
            category: "decoration",
        },
        {
            id: "iso-cloud",
            category: "decoration",
        },
    ]);
}

/** Base class for all structured errors */
class IsostateError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = this.constructor.name;
    }
}
/** DSL parsing error */
class ParseError extends IsostateError {
}
/** DSL validation error */
class ValidationErrorClass extends IsostateError {
}
/** Rendering engine error */
class RenderError extends IsostateError {
}
/** Animation engine error */
class AnimationError extends IsostateError {
}
/** Animation controller error */
class ControllerError extends IsostateError {
}

/** Default cell size in pixels */
const DEFAULT_CELL_SIZE = 64;
/**
 * Calculate raw scene-space coordinates from isometric grid position.
 * Layout is applied separately by subtracting resolved bounds and adding padding.
 */
function projectToRaw(gridX, gridY, cellSize) {
    return {
        rawX: cellSize * (gridX - gridY) * 0.5,
        rawY: cellSize * (gridX + gridY) * 0.25,
    };
}
/**
 * Calculate screen coordinates from raw isometric projection and resolved bounds.
 */
function projectToScreen(gridX, gridY, cellSize, boundsMinX = 0, boundsMinY = 0, paddingX = 0, paddingY = 0) {
    const { rawX, rawY } = projectToRaw(gridX, gridY, cellSize);
    return {
        screenX: rawX - boundsMinX + paddingX,
        screenY: rawY - boundsMinY + paddingY,
    };
}
/** Calculate the screen size for an element based on its grid size. */
function calculateVisualSize(gridSize, cellSize) {
    return cellSize * gridSize;
}
/** Calculate the element transform string for positioning and scaling. */
function calculateTransform(screenX, screenY, visualSize, cellSize) {
    const scale = visualSize / cellSize;
    return `translate(${screenX}px, ${screenY}px) scale(${scale})`;
}

/** Build built-in entry, exit, ambient, and reduced-motion CSS keyframes. */
function buildKeyframeCSS() {
    return [
        "@keyframes iso-anim-fade-in{from{opacity:0}to{opacity:1}}",
        "@keyframes iso-anim-fade-in-grow{from{opacity:0;scale:.01}to{opacity:1;scale:1}}",
        "@keyframes iso-anim-fall-in{from{opacity:0;translate:0 -40px}to{opacity:1;translate:0 0}}",
        "@keyframes iso-anim-rise-from-ground{from{opacity:0;translate:0 40px}to{opacity:1;translate:0 0}}",
        "@keyframes iso-anim-slide-in-left{from{opacity:0;translate:-60px 0}to{opacity:1;translate:0 0}}",
        "@keyframes iso-anim-slide-in-right{from{opacity:0;translate:60px 0}to{opacity:1;translate:0 0}}",
        "@keyframes iso-anim-flip-in{from{opacity:1;scale:0 1}to{opacity:1;scale:1 1}}",
        "@keyframes iso-anim-fade-out{from{opacity:1}to{opacity:0}}",
        "@keyframes iso-anim-fade-out-shrink{from{opacity:1;scale:1}to{opacity:0;scale:.01}}",
        "@keyframes iso-anim-fall-through-ground{from{opacity:1;translate:0 0}to{opacity:0;translate:0 40px}}",
        "@keyframes iso-anim-rise-away{from{opacity:1;translate:0 0}to{opacity:0;translate:0 -40px}}",
        "@keyframes iso-anim-slide-out-left{from{opacity:1;translate:0 0}to{opacity:0;translate:-60px 0}}",
        "@keyframes iso-anim-slide-out-right{from{opacity:1;translate:0 0}to{opacity:0;translate:60px 0}}",
        "@keyframes iso-anim-flip-out{from{opacity:1;scale:1 1}to{opacity:0;scale:0 1}}",
        "@keyframes iso-anim-pulse{0%,100%{opacity:.7}50%{opacity:1}}",
        "@keyframes iso-anim-float{0%,100%{translate:0 0}50%{translate:0 -6px}}",
        "@keyframes iso-anim-shake{0%,25%,75%,100%{translate:0 0}50%{translate:3px 0}}",
        "@keyframes iso-anim-glow{0%,100%{filter:drop-shadow(0 0 2px rgba(255,255,255,.5))}50%{filter:drop-shadow(0 0 8px rgba(255,255,255,.9))}}",
        "@keyframes iso-anim-spin{from{rotate:0deg}to{rotate:360deg}}",
        "@keyframes iso-anim-blink{0%,49%{opacity:1}50%,100%{opacity:0}}",
        "@keyframes iso-connector-flow-route{from{stroke-dashoffset:0}to{stroke-dashoffset:calc(-1px * var(--iso-flow-distance,20))}}",
        "@keyframes iso-connector-flow-reverse{from{stroke-dashoffset:0}to{stroke-dashoffset:calc(1px * var(--iso-flow-distance,20))}}",
        ".iso-connector-pattern-dashed .iso-connector-shaft,.iso-connector-pattern-dotted .iso-connector-shaft{--iso-flow-distance:20}",
        ".iso-connector-direction-route .iso-connector-shaft.iso-ambient-flow{animation:iso-connector-flow-route 900ms linear infinite}",
        ".iso-connector-direction-reverse .iso-connector-shaft.iso-ambient-flow{animation:iso-connector-flow-reverse 900ms linear infinite}",
        "@media (prefers-reduced-motion: reduce){.iso-element,.iso-connector{animation-duration:1ms!important}.iso-ambient-pulse,.iso-ambient-float,.iso-ambient-shake,.iso-ambient-glow,.iso-ambient-spin,.iso-ambient-blink,.iso-ambient-flow{animation:none!important}}",
    ].join("\n");
}

const NS$1 = "http://www.w3.org/2000/svg";
function createAssetResolver(bundle) {
    const embedded = new Map();
    const bundleAssets = bundle?.assets;
    if (bundleAssets && typeof bundleAssets === "object") {
        for (const [name, asset] of Object.entries(bundleAssets)) {
            if (asset && typeof asset === "object" && typeof asset.url === "string") {
                embedded.set(name, { url: asset.url, anchor: asset.anchor });
            }
        }
    }
    return (name) => embedded.get(name);
}
function createAssetNode(asset, assetName, cellSize) {
    return createUrlAssetNode(asset.url, assetName, cellSize, asset.anchor);
}
function createTextAssetNode(textContent, assetName, cellSize) {
    if (!textContent?.value) {
        throw new RenderError("TEXT_CONTENT_MISSING", `Text content is missing for built-in asset: ${assetName}`, {
            asset: assetName,
        });
    }
    const group = document.createElementNS(NS$1, "g");
    const text = document.createElementNS(NS$1, "text");
    const align = textContent.align ?? "middle";
    const fontSize = textContent.fontSize ?? 12;
    const lineHeight = textContent.lineHeight ?? 1.2;
    const anchorX = textAnchorX(align, cellSize);
    text.setAttribute("x", String(anchorX));
    text.setAttribute("y", String(-cellSize));
    text.setAttribute("text-anchor", align);
    text.setAttribute("dominant-baseline", "text-before-edge");
    text.setAttribute("font-family", "Arial, Helvetica, sans-serif");
    text.setAttribute("font-size", String(fontSize));
    text.setAttribute("font-weight", String(textContent.fontWeight ?? 700));
    text.setAttribute("fill", textContent.fill ?? "currentColor");
    const lines = normalizeTextLines(textContent.value);
    for (const [index, line] of lines.entries()) {
        const tspan = document.createElementNS(NS$1, "tspan");
        tspan.setAttribute("x", String(anchorX));
        tspan.setAttribute("dy", index === 0 ? "0" : String(fontSize * lineHeight));
        tspan.textContent = line;
        text.appendChild(tspan);
    }
    group.appendChild(text);
    return group;
}
function createPrimitiveAssetNode(assetName, primitive, cellSize) {
    const group = document.createElementNS(NS$1, "g");
    switch (assetName) {
        case "rectangle":
            appendProjectedPolygon(group, rectanglePoints(), primitive?.rectangle, cellSize);
            return group;
        case "polygon":
            appendProjectedPolygon(group, primitive?.polygon?.points, primitive?.polygon, cellSize);
            return group;
        case "line":
            appendProjectedPolyline(group, primitive?.line, primitive?.line, cellSize);
            return group;
        case "circle":
            appendCircle(group, primitive?.circle, cellSize);
            return group;
        default:
            throw new RenderError("PRIMITIVE_ASSET_UNKNOWN", `Unknown built-in primitive asset: ${assetName}`, {
                asset: assetName,
            });
    }
}
function textAnchorX(align, cellSize) {
    if (align === "start")
        return -cellSize / 2;
    if (align === "end")
        return cellSize / 2;
    return 0;
}
function normalizeTextLines(value) {
    const normalized = value.replace(/\r\n?/g, "\n").replace(/\n$/, "");
    return normalized.split("\n");
}
function rectanglePoints() {
    return [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
    ];
}
function appendProjectedPolygon(group, points, style, cellSize) {
    if (!points)
        return;
    const polygon = document.createElementNS(NS$1, "polygon");
    polygon.setAttribute("points", points.map((point) => projectLocalPoint(point, cellSize)).join(" "));
    applyPrimitiveStyle(polygon, style, { fill: "currentColor", stroke: "none" });
    group.appendChild(polygon);
}
function appendProjectedPolyline(group, line, style, cellSize) {
    if (!line?.points)
        return;
    const polyline = document.createElementNS(NS$1, "polyline");
    polyline.setAttribute("points", line.points.map((point) => projectLocalPoint(point, cellSize)).join(" "));
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke-linecap", line.lineCap ?? "round");
    polyline.setAttribute("stroke-linejoin", line.lineJoin ?? "round");
    applyPrimitiveStyle(polyline, style, {
        fill: "none",
        stroke: "currentColor",
    });
    group.appendChild(polyline);
}
function appendCircle(group, style, cellSize) {
    const center = projectLocalPoint([0.5, 0.5], cellSize);
    const circle = document.createElementNS(NS$1, "circle");
    const [cx, cy] = center.split(",").map(Number);
    circle.setAttribute("cx", String(cx));
    circle.setAttribute("cy", String(cy));
    circle.setAttribute("r", String(cellSize * 0.2));
    applyPrimitiveStyle(circle, style, {
        fill: "currentColor",
        stroke: "none",
    });
    group.appendChild(circle);
}
function projectLocalPoint(point, cellSize) {
    const projected = projectToRaw(point[0], point[1], cellSize);
    const anchor = projectToRaw(1, 1, cellSize);
    return `${projected.rawX - anchor.rawX},${projected.rawY - anchor.rawY}`;
}
function applyPrimitiveStyle(node, style, defaults) {
    node.setAttribute("fill", style?.fill ?? defaults.fill);
    node.setAttribute("stroke", style?.stroke ?? defaults.stroke);
    node.setAttribute("stroke-width", String(style?.strokeWidth ?? 0));
    node.setAttribute("opacity", String(style?.opacity ?? 1));
    if (style?.dash)
        node.setAttribute("stroke-dasharray", style.dash.join(" "));
}
function createUrlAssetNode(url, assetName, cellSize, anchor) {
    if (!isSafeAssetUrl(url)) {
        throw new RenderError("INVALID_ASSET_URL", `Asset URL is unsafe: ${assetName}`, { asset: assetName });
    }
    const group = document.createElementNS(NS$1, "g");
    const image = document.createElementNS(NS$1, "image");
    const resolvedUrl = resolveBrowserAssetUrl(url);
    const [anchorX, anchorY] = anchor ?? [0.5, 1];
    image.setAttribute("href", resolvedUrl);
    image.setAttributeNS("http://www.w3.org/1999/xlink", "href", resolvedUrl);
    image.setAttribute("x", String(-cellSize * anchorX));
    image.setAttribute("y", String(-cellSize * anchorY));
    image.setAttribute("width", String(cellSize));
    image.setAttribute("height", String(cellSize));
    image.setAttribute("preserveAspectRatio", "xMidYMax meet");
    group.appendChild(image);
    return group;
}
function resolveBrowserAssetUrl(url) {
    try {
        const baseURI = document.baseURI;
        return typeof baseURI === "string" ? new URL(url, baseURI).href : url;
    }
    catch {
        return url;
    }
}
function isSafeAssetUrl(url) {
    const normalized = url.trim().toLowerCase();
    return normalized.length > 0 && !normalized.startsWith("javascript:");
}

const CSS_CUSTOM_PROPERTY_PATTERN = /^--[a-zA-Z0-9-_]+$/;
function applyThemeToElement(element, themeVars) {
    for (const [name, value] of Object.entries(themeVars)) {
        if (!CSS_CUSTOM_PROPERTY_PATTERN.test(name)) {
            throw new RenderError("INVALID_THEME_VAR", `Invalid CSS custom property name: ${name}`);
        }
        element.style.setProperty(name, value);
    }
}

const NS = "http://www.w3.org/2000/svg";
const BUILT_IN_TEXT_ASSET_ID = "text";
const BUILT_IN_PRIMITIVE_ASSET_IDS = new Set(["rectangle", "circle", "polygon", "line"]);
const DEFAULT_CONNECTOR_DASH = {
    dashed: [12, 8],
    dotted: [0, 8],
};
const ENDPOINT_RADIUS_GRID = 0.14;
const ARROW_LENGTH_GRID = 0.35;
const ARROW_WIDTH_GRID = 0.28;
const BAR_WIDTH_GRID = 0.4;
// ── Public API ────────────────────────────────────────────────────────────
/** Build the SVG DOM for a compiled runtime bundle and mount it into a container. */
function buildSceneDOM(container, bundle, config) {
    const layout = resolveSceneLayout(bundle);
    const initialStop = bundle.scenes[0];
    const allElements = collectElementDefinitions(bundle);
    const allConnectors = collectConnectorDefinitions(bundle);
    const initialById = new Map((initialStop?.elements ?? []).map((element) => [element.id, element]));
    const initialConnectorsById = new Map((initialStop?.connectors ?? []).map((connector) => [connector.id, connector]));
    const svg = createRootSvg(layout, config?.label, bundle.className);
    const assetResolver = createAssetResolver(bundle);
    svg.appendChild(createCssDefs());
    applyThemeToElement(svg, {
        ...(resolveTheme(bundle.theme) ?? {}),
        ...(bundle.themeVars ?? {}),
        ...(config?.themeVars ?? {}),
    });
    const sortedLayers = sortLayers(bundle.layers);
    const layerMap = createLayerMap(sortedLayers);
    if (bundle.floor.visible) {
        svg.appendChild(createFloorGrid(bundle, layout));
    }
    const connectorMap = new Map();
    for (const def of allConnectors) {
        const initial = initialConnectorsById.get(def.id) ?? {
            ...def,
            presence: "removed",
        };
        const state = createConnectorInstance(initial, layout);
        if (initial.presence === "removed") {
            state.isHidden = true;
            hideElementAfterExit(state.node);
        }
        applyConnectorAmbientClasses(state, initial.ambient ?? []);
        svg.appendChild(state.node);
        connectorMap.set(def.id, state);
    }
    const depthGroup = document.createElementNS(NS, "g");
    depthGroup.classList.add("iso-depth-layer");
    depthGroup.setAttribute("data-layer", "depth");
    svg.appendChild(depthGroup);
    const labelGroup = document.createElementNS(NS, "g");
    labelGroup.classList.add("iso-layer", "iso-layer-labels");
    labelGroup.setAttribute("data-layer", "labels");
    svg.appendChild(labelGroup);
    const elementMap = new Map();
    const sortedElements = sortElementsForPerspective(allElements);
    for (const def of sortedElements) {
        const declaredLayer = layerMap.get(def.layer);
        if (!declaredLayer) {
            throw new RenderError("MISSING_LAYER", `Unknown layer for "${def.id}": ${def.layer}`);
        }
        const initial = initialById.get(def.id) ?? {
            ...def,
            presence: "removed",
        };
        const instance = createElementInstance(initial, layout, assetResolver);
        instance.node.classList.add(`iso-layer-${def.layer}`);
        instance.node.setAttribute("data-layer", def.layer);
        if (initial.presence === "removed") {
            instance.isHidden = true;
            hideElementAfterExit(instance.node);
        }
        applyAmbientClasses(instance, initial.ambient ?? []);
        const parent = isTextAsset(def.asset) ? labelGroup : depthGroup;
        parent.appendChild(instance.node);
        elementMap.set(def.id, instance);
    }
    svg._layerMap = layerMap;
    svg._elementMap = elementMap;
    svg._connectorMap = connectorMap;
    container.appendChild(svg);
    return svg;
}
/** Update transforms and ambient classes for a live set of interpolated runtime values. */
function updateElementTransforms(svg, elements, connectors = []) {
    const layout = svg._layout;
    if (!layout)
        return;
    const map = svg._elementMap;
    if (map) {
        for (const def of elements) {
            const state = map.get(def.id);
            if (!state)
                continue;
            updateGeneratedElementContent(state.node, def, layout);
            applyElementTransform(state.node, def, layout);
            applyAmbientClasses(state, def.ambient ?? []);
        }
    }
    const connectorMap = svg._connectorMap;
    if (!connectorMap)
        return;
    for (const def of connectors) {
        const state = connectorMap.get(def.id);
        if (!state)
            continue;
        applyConnectorState(state, def, layout);
    }
}
/** Read the internal ElementState for an element by its id. */
function getElementState(svg, id) {
    return svg._elementMap?.get(id);
}
/** Read the internal ConnectorState for a connector by its id. */
function getConnectorState(svg, id) {
    return svg._connectorMap?.get(id);
}
function getResolvedViewBox(bundle) {
    return resolveSceneLayout(bundle).viewBox;
}
// ── Lifecycle helpers ─────────────────────────────────────────────────────
/** Hide an element after its exit animation completes. */
function hideElementAfterExit(node) {
    node.style.visibility = "hidden";
    node.style.pointerEvents = "none";
}
/** Show an element on re-addition. */
function unhideElementOnReadd(node) {
    node.style.visibility = "visible";
    node.style.pointerEvents = "auto";
}
// ── Layout helpers ────────────────────────────────────────────────────────
function resolveSceneLayout(bundle) {
    const cellSize = bundle.grid.cellSize;
    const padding = bundle.layout.padding;
    const contentBounds = calculateContentBounds(bundle, cellSize);
    const floorBounds = calculateFloorBounds(bundle, cellSize);
    const selectedBounds = selectBounds(bundle.layout.bounds, contentBounds, floorBounds);
    const width = selectedBounds.maxX - selectedBounds.minX + padding.x * 2;
    const height = selectedBounds.maxY - selectedBounds.minY + padding.y * 2;
    const viewBox = {
        minX: 0,
        minY: 0,
        width: roundDimension(width || cellSize),
        height: roundDimension(height || cellSize),
    };
    return {
        cellSize,
        padding,
        contentBounds,
        floorBounds,
        selectedBounds,
        viewBox,
    };
}
function calculateContentBounds(bundle, cellSize) {
    let bounds = emptyBounds();
    for (const stop of bundle.scenes) {
        for (const element of stop.elements ?? []) {
            if (element.presence === "removed")
                continue;
            const { rawX, rawY } = projectToRaw(element.pos[0] + element.size, element.pos[1] + element.size, cellSize);
            const visualSize = calculateVisualSize(element.size, cellSize);
            const [anchorX, anchorY] = assetAnchorForBounds(bundle, element);
            bounds = includeBounds(bounds, {
                minX: rawX - visualSize * anchorX,
                minY: rawY - visualSize * anchorY,
                maxX: rawX + visualSize * (1 - anchorX),
                maxY: rawY + visualSize * (1 - anchorY),
            });
        }
        for (const connector of stop.connectors ?? []) {
            if (connector.presence === "removed")
                continue;
            bounds = includeBounds(bounds, calculateConnectorBounds(connector, cellSize));
        }
    }
    return normalizeBounds(bounds, cellSize);
}
function assetAnchorForBounds(bundle, element) {
    return bundle.assets?.[element.asset]?.anchor ?? [0.5, 1];
}
function calculateConnectorBounds(connector, cellSize) {
    let bounds = emptyBounds();
    for (const [x, y] of connector.route) {
        const { rawX, rawY } = projectToRaw(x, y, cellSize);
        bounds = includePoint(bounds, rawX, rawY);
    }
    const endpointPadding = Math.max(ARROW_LENGTH_GRID, BAR_WIDTH_GRID, ENDPOINT_RADIUS_GRID * 2) * cellSize;
    const strokePadding = connector.style.strokeWidth / 2 + (connector.style.outlineWidth ?? 0);
    const padding = endpointPadding + strokePadding;
    return {
        minX: bounds.minX - padding,
        minY: bounds.minY - padding,
        maxX: bounds.maxX + padding,
        maxY: bounds.maxY + padding,
    };
}
function calculateFloorBounds(bundle, cellSize) {
    const origin = bundle.floor.origin;
    const [width, height] = bundle.floor.size;
    const points = [
        origin,
        [origin[0] + width, origin[1]],
        [origin[0], origin[1] + height],
        [origin[0] + width, origin[1] + height],
    ];
    let bounds = emptyBounds();
    for (const [x, y] of points) {
        const { rawX, rawY } = projectToRaw(x, y, cellSize);
        bounds = includePoint(bounds, rawX, rawY);
    }
    return normalizeBounds(bounds, cellSize);
}
function selectBounds(mode, content, floor) {
    if (mode === "content")
        return content;
    if (mode === "floor")
        return floor;
    return includeBounds(content, floor);
}
function emptyBounds() {
    return {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
    };
}
function normalizeBounds(bounds, cellSize) {
    if (Number.isFinite(bounds.minX))
        return bounds;
    return { minX: 0, minY: 0, maxX: cellSize, maxY: cellSize };
}
function includePoint(bounds, x, y) {
    return {
        minX: Math.min(bounds.minX, x),
        minY: Math.min(bounds.minY, y),
        maxX: Math.max(bounds.maxX, x),
        maxY: Math.max(bounds.maxY, y),
    };
}
function includeBounds(bounds, next) {
    return {
        minX: Math.min(bounds.minX, next.minX),
        minY: Math.min(bounds.minY, next.minY),
        maxX: Math.max(bounds.maxX, next.maxX),
        maxY: Math.max(bounds.maxY, next.maxY),
    };
}
function roundDimension(value) {
    return Math.round(value * 1000) / 1000;
}
// ── Private helpers ───────────────────────────────────────────────────────
function createRootSvg(layout, label, className) {
    const svg = document.createElementNS(NS, "svg");
    svg.classList.add("iso-scene");
    for (const token of className?.trim().split(/\s+/) ?? []) {
        if (token)
            svg.classList.add(token);
    }
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", `${layout.viewBox.minX} ${layout.viewBox.minY} ${layout.viewBox.width} ${layout.viewBox.height}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.display = "block";
    if (label) {
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", label);
    }
    else {
        svg.setAttribute("aria-hidden", "true");
    }
    svg._layout = layout;
    svg._viewBoxW = layout.viewBox.width;
    svg._viewBoxH = layout.viewBox.height;
    return svg;
}
function createCssDefs() {
    const styleEl = document.createElementNS(NS, "style");
    styleEl.textContent = buildKeyframeCSS();
    return styleEl;
}
function createFloorGrid(bundle, layout) {
    const group = document.createElementNS(NS, "g");
    group.classList.add("iso-floor-grid", `iso-layer-${bundle.floor.layer}`);
    group.setAttribute("data-layer", bundle.floor.layer);
    const [originX, originY] = bundle.floor.origin;
    const [columns, rows] = bundle.floor.size;
    const corners = [
        projectGridPoint(originX, originY, layout),
        projectGridPoint(originX + columns, originY, layout),
        projectGridPoint(originX + columns, originY + rows, layout),
        projectGridPoint(originX, originY + rows, layout),
    ];
    const slab = document.createElementNS(NS, "polygon");
    slab.classList.add("iso-floor-slab");
    slab.setAttribute("points", corners.map(pointToString).join(" "));
    slab.setAttribute("fill", "#dbe6f4");
    slab.setAttribute("fill-opacity", "0.22");
    slab.setAttribute("stroke", "#b9c9df");
    slab.setAttribute("stroke-width", "1");
    group.appendChild(slab);
    for (let x = 0; x <= columns; x++) {
        group.appendChild(createFloorLine(projectGridPoint(originX + x, originY, layout), projectGridPoint(originX + x, originY + rows, layout)));
    }
    for (let y = 0; y <= rows; y++) {
        group.appendChild(createFloorLine(projectGridPoint(originX, originY + y, layout), projectGridPoint(originX + columns, originY + y, layout)));
    }
    return group;
}
function createFloorLine(start, end) {
    const line = document.createElementNS(NS, "line");
    line.setAttribute("x1", String(start.x));
    line.setAttribute("y1", String(start.y));
    line.setAttribute("x2", String(end.x));
    line.setAttribute("y2", String(end.y));
    line.setAttribute("stroke", "#2563eb");
    line.setAttribute("stroke-width", "1");
    line.setAttribute("stroke-dasharray", "5 5");
    line.setAttribute("stroke-opacity", "0.2");
    return line;
}
function projectGridPoint(x, y, layout) {
    const screen = projectToScreen(x, y, layout.cellSize, layout.selectedBounds.minX, layout.selectedBounds.minY, layout.padding.x, layout.padding.y);
    return { x: screen.screenX, y: screen.screenY };
}
function pointToString(point) {
    return `${point.x},${point.y}`;
}
function createLayerMap(layers) {
    return new Map(layers.map((layer) => [layer.name, layer]));
}
function sortLayers(layers) {
    return [...layers]
        .map((layer, index) => ({ name: layer.name, order: layer.order ?? index }))
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}
function sortElementsForPerspective(elements) {
    return elements.slice().sort((a, b) => {
        const bucket = renderBucket(a) - renderBucket(b);
        if (bucket !== 0)
            return bucket;
        const depth = a.pos[0] + a.pos[1] - (b.pos[0] + b.pos[1]);
        if (depth !== 0)
            return depth;
        return a.id.localeCompare(b.id);
    });
}
function renderBucket(element) {
    if (isPrimitiveAsset(element.asset))
        return 0;
    if (isTextAsset(element.asset))
        return 2;
    return 1;
}
function collectElementDefinitions(bundle) {
    const byId = new Map();
    for (const stop of bundle.scenes) {
        for (const element of stop.elements ?? []) {
            if (!byId.has(element.id) || byId.get(element.id)?.presence === "removed") {
                byId.set(element.id, element);
            }
        }
    }
    return [...byId.values()];
}
function collectConnectorDefinitions(bundle) {
    const byId = new Map();
    for (const stop of bundle.scenes) {
        for (const connector of stop.connectors ?? []) {
            if (!byId.has(connector.id) || byId.get(connector.id)?.presence === "removed") {
                byId.set(connector.id, connector);
            }
        }
    }
    return [...byId.values()];
}
/** Create a single element SVG instance applying entry animation. */
function createElementInstance(def, layout, resolveAsset) {
    const node = def.asset === BUILT_IN_TEXT_ASSET_ID
        ? createTextAssetNode(def.text, def.asset, layout.cellSize)
        : isPrimitiveAsset(def.asset)
            ? createPrimitiveAssetNode(def.asset, def.primitive, layout.cellSize)
            : createResolvedAssetNode(def, resolveAsset, layout.cellSize);
    node.classList.add("iso-element", `iso-element-${def.id}`);
    node.setAttribute("data-id", def.id);
    node.setAttribute("data-asset", def.asset);
    node.style.overflow = "visible";
    node.style.pointerEvents = "auto";
    applyElementTransform(node, def, layout);
    const entryAnim = def.enter;
    if (entryAnim && entryAnim !== "none" && def.presence !== "removed") {
        const keyName = `iso-anim-${entryAnim}`;
        animateElement(node, keyName, "enter");
        node.addEventListener("animationend", () => {
            node.style.animation = "";
        }, { once: true });
        return { node, isHidden: false, entryKey: entryAnim, ambient: new Set() };
    }
    return { node, isHidden: false, ambient: new Set() };
}
function isTextAsset(assetId) {
    return assetId === BUILT_IN_TEXT_ASSET_ID;
}
function isPrimitiveAsset(assetId) {
    return BUILT_IN_PRIMITIVE_ASSET_IDS.has(assetId);
}
function createResolvedAssetNode(def, resolveAsset, cellSize) {
    const asset = resolveAsset(def.asset);
    if (!asset) {
        throw new RenderError("ASSET_NOT_FOUND", `Asset not found: ${def.asset}`, {
            asset: def.asset,
            elementId: def.id,
        });
    }
    return createAssetNode(asset, def.asset, cellSize);
}
function updateGeneratedElementContent(node, def, layout) {
    if (!isTextAsset(def.asset) && !isPrimitiveAsset(def.asset))
        return;
    const replacement = isTextAsset(def.asset)
        ? createTextAssetNode(def.text, def.asset, layout.cellSize)
        : createPrimitiveAssetNode(def.asset, def.primitive, layout.cellSize);
    clearChildren(node);
    while (replacement.firstChild) {
        const child = replacement.firstChild;
        replacement.removeChild(child);
        node.appendChild(child);
    }
}
function createConnectorInstance(def, layout) {
    const node = document.createElementNS(NS, "g");
    const shaft = document.createElementNS(NS, "path");
    const state = { node, shaft, isHidden: false, ambient: new Set() };
    applyConnectorState(state, def, layout);
    const entryAnim = def.enter;
    if (entryAnim && entryAnim !== "none" && def.presence !== "removed") {
        animateElement(node, `iso-anim-${entryAnim}`, "enter");
        node.addEventListener("animationend", () => {
            node.style.animation = "";
        }, { once: true });
    }
    return state;
}
function applyConnectorState(state, def, layout) {
    applyConnectorGroupAttrs(state.node, def);
    clearChildren(state.node);
    const d = routePath(def.route, layout);
    if (shouldRenderOutline(def)) {
        const outline = document.createElementNS(NS, "path");
        outline.classList.add("iso-connector-outline");
        applyConnectorPathAttrs(outline, def, d, {
            stroke: def.style.outline ?? def.style.stroke,
            strokeWidth: def.style.strokeWidth + def.style.outlineWidth * 2,
            includeDash: false,
        });
        state.node.appendChild(outline);
    }
    state.shaft = document.createElementNS(NS, "path");
    state.shaft.classList.add("iso-connector-shaft");
    applyConnectorPathAttrs(state.shaft, def, d, {
        stroke: def.style.stroke,
        strokeWidth: def.style.strokeWidth,
        includeDash: true,
    });
    state.node.appendChild(state.shaft);
    if (def.style.variant === "road" && def.style.lane === "center-dashed") {
        const lane = document.createElementNS(NS, "path");
        lane.classList.add("iso-connector-lane");
        applyConnectorPathAttrs(lane, def, d, {
            stroke: "#ffffff",
            strokeWidth: Math.max(1, def.style.strokeWidth * 0.12),
            includeDash: false,
        });
        lane.setAttribute("stroke-dasharray", "8 8");
        state.node.appendChild(lane);
    }
    appendEndpoint(state.node, def, "start", layout);
    appendEndpoint(state.node, def, "end", layout);
    applyConnectorAmbientClasses(state, def.ambient ?? []);
}
function clearChildren(node) {
    while (node.firstChild)
        node.removeChild(node.firstChild);
}
function applyConnectorGroupAttrs(node, def) {
    node.setAttribute("class", [
        "iso-connector",
        `iso-connector-${def.id}`,
        `iso-connector-variant-${def.style.variant}`,
        `iso-connector-pattern-${def.style.pattern}`,
        `iso-connector-direction-${def.direction}`,
        `iso-layer-${def.layer}`,
    ].join(" "));
    node.setAttribute("data-id", def.id);
    node.setAttribute("data-layer", def.layer);
    node.style.overflow = "visible";
    node.style.pointerEvents = "auto";
}
function shouldRenderOutline(def) {
    return Boolean(def.style.outline && def.style.outlineWidth > 0);
}
function applyConnectorPathAttrs(path, def, d, options) {
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", options.stroke);
    path.setAttribute("stroke-width", String(options.strokeWidth));
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("opacity", String(def.style.opacity));
    if (options.includeDash && def.style.pattern !== "solid") {
        const dash = def.style.dash ?? DEFAULT_CONNECTOR_DASH[def.style.pattern];
        path.setAttribute("stroke-dasharray", dash.join(" "));
    }
}
function routePath(route, layout) {
    return route
        .map((point, index) => {
        const projected = projectGridPoint(point[0], point[1], layout);
        return `${index === 0 ? "M" : "L"} ${projected.x} ${projected.y}`;
    })
        .join(" ");
}
function appendEndpoint(group, def, kind, layout) {
    const endpoint = def[kind];
    if (endpoint === "none" || def.route.length < 2)
        return;
    const node = createEndpointNode(endpoint, def, kind, layout);
    node.classList.add(`iso-connector-${kind}`);
    group.appendChild(node);
}
function createEndpointNode(endpoint, def, kind, layout) {
    switch (endpoint) {
        case "arrow":
            return createArrowEndpoint(def, kind, layout);
        case "dot":
            return createCircleEndpoint(def, kind, layout, true);
        case "circle":
            return createCircleEndpoint(def, kind, layout, false);
        case "diamond":
            return createDiamondEndpoint(def, kind, layout);
        case "bar":
            return createBarEndpoint(def, kind, layout);
        case "none":
            throw new RenderError("CONNECTOR_ENDPOINT_NONE", "Cannot create geometry for endpoint none");
    }
}
function createArrowEndpoint(def, kind, layout) {
    const tip = endpointPoint(def, kind);
    const direction = endpointDirection(def, kind);
    const perpendicular = [-direction[1], direction[0]];
    const base = [tip[0] - direction[0] * ARROW_LENGTH_GRID, tip[1] - direction[1] * ARROW_LENGTH_GRID];
    const halfWidth = ARROW_WIDTH_GRID / 2;
    const points = [
        tip,
        [base[0] + perpendicular[0] * halfWidth, base[1] + perpendicular[1] * halfWidth],
        [base[0] - perpendicular[0] * halfWidth, base[1] - perpendicular[1] * halfWidth],
    ].map((point) => projectGridPoint(point[0], point[1], layout));
    const polygon = document.createElementNS(NS, "polygon");
    polygon.setAttribute("points", points.map(pointToString).join(" "));
    polygon.setAttribute("fill", def.style.stroke);
    polygon.setAttribute("opacity", String(def.style.opacity));
    return polygon;
}
function createCircleEndpoint(def, kind, layout, filled) {
    const point = endpointPoint(def, kind);
    const projected = projectGridPoint(point[0], point[1], layout);
    const circle = document.createElementNS(NS, "circle");
    circle.setAttribute("cx", String(projected.x));
    circle.setAttribute("cy", String(projected.y));
    circle.setAttribute("r", String(ENDPOINT_RADIUS_GRID * layout.cellSize));
    circle.setAttribute("stroke", def.style.stroke);
    circle.setAttribute("stroke-width", String(Math.max(1, def.style.strokeWidth)));
    circle.setAttribute("opacity", String(def.style.opacity));
    circle.setAttribute("fill", filled ? def.style.stroke : "none");
    return circle;
}
function createDiamondEndpoint(def, kind, layout) {
    const center = endpointPoint(def, kind);
    const radius = ENDPOINT_RADIUS_GRID;
    const points = [
        [center[0], center[1] - radius],
        [center[0] + radius, center[1]],
        [center[0], center[1] + radius],
        [center[0] - radius, center[1]],
    ];
    const polygon = document.createElementNS(NS, "polygon");
    polygon.setAttribute("points", points
        .map((point) => projectGridPoint(point[0], point[1], layout))
        .map(pointToString)
        .join(" "));
    polygon.setAttribute("fill", def.style.stroke);
    polygon.setAttribute("opacity", String(def.style.opacity));
    return polygon;
}
function createBarEndpoint(def, kind, layout) {
    const center = endpointPoint(def, kind);
    const direction = endpointDirection(def, kind);
    const perpendicular = [-direction[1], direction[0]];
    const half = BAR_WIDTH_GRID / 2;
    const a = projectGridPoint(center[0] + perpendicular[0] * half, center[1] + perpendicular[1] * half, layout);
    const b = projectGridPoint(center[0] - perpendicular[0] * half, center[1] - perpendicular[1] * half, layout);
    const line = document.createElementNS(NS, "line");
    line.setAttribute("x1", String(a.x));
    line.setAttribute("y1", String(a.y));
    line.setAttribute("x2", String(b.x));
    line.setAttribute("y2", String(b.y));
    line.setAttribute("stroke", def.style.stroke);
    line.setAttribute("stroke-width", String(Math.max(1, def.style.strokeWidth)));
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("opacity", String(def.style.opacity));
    return line;
}
function endpointPoint(def, kind) {
    return kind === "start" ? def.route[0] : def.route[def.route.length - 1];
}
function endpointDirection(def, kind) {
    const point = kind === "start"
        ? vectorBetween(def.route[0], def.route[1])
        : vectorBetween(def.route[def.route.length - 2], def.route[def.route.length - 1]);
    const effective = def.direction === "reverse" ? [-point[0], -point[1]] : point;
    return normalizeVector(effective);
}
function vectorBetween(start, end) {
    return [end[0] - start[0], end[1] - start[1]];
}
function normalizeVector(vector) {
    const length = Math.hypot(vector[0], vector[1]);
    if (length === 0)
        return [1, 0];
    return [vector[0] / length, vector[1] / length];
}
function applyElementTransform(node, def, layout) {
    const screen = projectToScreen(def.pos[0] + def.size, def.pos[1] + def.size, layout.cellSize, layout.selectedBounds.minX, layout.selectedBounds.minY, layout.padding.x, layout.padding.y);
    const visualSize = calculateVisualSize(def.size, layout.cellSize);
    const scale = visualSize / layout.cellSize;
    node.setAttribute("transform", `translate(${screen.screenX} ${screen.screenY}) scale(${scale})`);
}
function applyAmbientClasses(state, ambient) {
    const next = new Set((ambient ?? []).map((item) => item.name));
    for (const name of state.ambient) {
        if (!next.has(name))
            state.node.classList.remove(`iso-ambient-${name}`);
    }
    for (const name of next) {
        if (!state.ambient.has(name))
            state.node.classList.add(`iso-ambient-${name}`);
    }
    state.ambient = next;
}
function applyConnectorAmbientClasses(state, ambient) {
    const next = new Set((ambient ?? []).map((item) => item.name));
    for (const name of state.ambient) {
        if (!next.has(name))
            state.shaft.classList.remove(`iso-ambient-${name}`);
    }
    for (const name of next) {
        if (!state.ambient.has(name))
            state.shaft.classList.add(`iso-ambient-${name}`);
    }
    state.ambient = next;
}
/** Apply a CSS keyframe animation to an element. */
function animateElement(node, keyframeName, type = "enter") {
    node.style.opacity = "1";
    node.style.animation = "none";
    node.getBoundingClientRect();
    const duration = type === "exit" ? "var(--iso-anim-duration-exit, 300ms)" : "var(--iso-anim-duration-enter, 400ms)";
    const easing = type === "exit" ? "var(--iso-anim-easing-exit, ease-in)" : "var(--iso-anim-easing-enter, ease-out)";
    node.style.animation = `${keyframeName} ${duration} ${easing} forwards`;
}

/**
 * Linear easing (no interpolation).
 */
function linear(t) {
    return t;
}
/**
 * Cubic ease-in: starts slowly, accelerates.
 */
function easeInCubic(t) {
    return t * t * t;
}
/**
 * Cubic ease-out: starts fast, decelerates.
 */
function easeOutCubic(t) {
    return 1 - (1 - t) ** 3;
}
/**
 * Cubic ease-in-out: slow start, fast middle, slow end.
 */
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
/**
 * Resolve an easing type string to a function.
 */
function resolveEasing(type) {
    switch (type) {
        case "linear":
            return linear;
        case "easeInCubic":
            return easeInCubic;
        case "easeOutCubic":
            return easeOutCubic;
        case "easeInOutCubic":
            return easeInOutCubic;
    }
}

const DEFAULT_CONFIG = {
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
// ── Controller implementation ──────────────────────────────────────────────
/**
 * Animation controller — manages scroll progress, scene navigation,
 * and delegates to the animation engine for frame updates.
 */
class AnimationController {
    _engine = new AnimationEngine();
    _bundle = null;
    _sceneIndex = 0;
    _progress = 0;
    _paused = false;
    _config = DEFAULT_CONFIG;
    _container = null;
    _sceneElement = null;
    _ownsEngine = true;
    _rafId = null;
    _pendingProgress = null;
    _destroyed = false;
    _listeners = new Map();
    // Scroll tracking state
    _minScroll = 0;
    _maxScroll = 0;
    _touchStartY = 0;
    _touchStartX = 0;
    _isDragging = false;
    // Transition animation state
    _transitionAnim = null;
    get engine() {
        return this._engine;
    }
    get progress() {
        return this._progress;
    }
    getProgress() {
        this._assertNotDestroyed();
        return this._progress;
    }
    get sceneIndex() {
        return this._sceneIndex;
    }
    getSceneIndex() {
        this._assertNotDestroyed();
        return this._sceneIndex;
    }
    get scenes() {
        return this._bundle?.scenes ?? [];
    }
    get paused() {
        return this._paused;
    }
    get currentScene() {
        return this.scenes[this._sceneIndex];
    }
    /**
     * Initialize the controller with a compiled bundle and optional runtime resources.
     */
    init(bundle, config = {}, runtime = {}) {
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
        this._engine.init(bundle);
        this._bindScroll();
    }
    /**
     * Set scroll progress (0–1, clamped) and trigger frame update.
     */
    setProgress(progress) {
        this._assertNotDestroyed();
        if (!Number.isFinite(progress)) {
            throw new ControllerError("CONTROLLER_PROGRESS_OUT_OF_RANGE", "setProgress() requires a finite progress value");
        }
        const clamped = Math.max(0, Math.min(1, progress));
        if (clamped === this._progress && !this._paused && this._rafId !== null) {
            return;
        }
        this._progress = clamped;
        if (this._paused)
            return;
        this._scheduleProgressForward(clamped);
    }
    /**
     * Navigate to next scene (wraps to 0 if at end).
     */
    nextScene() {
        this._assertNotDestroyed();
        if (this.scenes.length <= 1)
            return;
        const nextIndex = (this._sceneIndex + 1) % this.scenes.length;
        this._transitionToScene(nextIndex);
    }
    /**
     * Navigate to previous scene (wraps to last if at beginning).
     */
    prevScene() {
        this._assertNotDestroyed();
        if (this.scenes.length <= 1)
            return;
        const prevIndex = (this._sceneIndex - 1 + this.scenes.length) % this.scenes.length;
        this._transitionToScene(prevIndex);
    }
    /**
     * Set scene index directly.
     */
    setSceneIndex(index) {
        this._assertNotDestroyed();
        if (index < 0 || index >= this.scenes.length) {
            throw new ControllerError("CONTROLLER_SCENE_INDEX_OUT_OF_RANGE", `Scene index ${index} is out of bounds [0, ${this.scenes.length - 1}]`);
        }
        this._transitionToScene(index);
    }
    /**
     * Pause all animations.
     */
    pause() {
        this._assertNotDestroyed();
        if (this._paused)
            return;
        this._paused = true;
        this._cancelFrame();
        this._engine.pause();
        this._applyPauseState(true);
        this._emit("paused");
    }
    /**
     * Resume from paused state.
     */
    resume() {
        this._assertNotDestroyed();
        if (!this._paused)
            return;
        this._paused = false;
        this._engine.resume();
        this._applyPauseState(false);
        this._scheduleProgressForward(this._progress);
        this._emit("resumed");
    }
    /**
     * Check if controller is paused.
     */
    isPaused() {
        this._assertNotDestroyed();
        return this._paused;
    }
    /**
     * Destroy controller and clean up all listeners and resources.
     */
    destroy() {
        this._assertNotDestroyed();
        this._unbindScroll();
        this._cancelFrame();
        this._cancelTransition();
        if (this._ownsEngine)
            this._engine.destroy();
        this._listeners.clear();
        this._bundle = null;
        this._container = null;
        this._pendingProgress = null;
        this._destroyed = true;
    }
    // ── Event system ───────────────────────────────────────────────────────
    on(event, listener) {
        this._assertNotDestroyed();
        const set = this._listeners.get(event) ?? new Set();
        set.add(listener);
        this._listeners.set(event, set);
    }
    off(event, listener) {
        this._assertNotDestroyed();
        const set = this._listeners.get(event);
        if (set) {
            set.delete(listener);
        }
    }
    _emit(event, ...args) {
        const set = this._listeners.get(event);
        if (set) {
            for (const listener of set) {
                try {
                    listener(...args);
                }
                catch (error) {
                    queueMicrotask(() => {
                        throw error;
                    });
                }
            }
        }
    }
    // ── Frame update ───────────────────────────────────────────────────────
    _scheduleProgressForward(progress) {
        this._pendingProgress = progress;
        if (this._rafId !== null)
            return;
        this._rafId = requestAnimationFrame(() => {
            this._rafId = null;
            const pending = this._pendingProgress;
            this._pendingProgress = null;
            if (pending === null || this._paused || this._destroyed)
                return;
            this._engine.setProgress(pending);
            this._applyFrameUpdate();
            this._emit("progress-change", pending);
        });
    }
    _cancelFrame() {
        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        this._pendingProgress = null;
    }
    _applyFrameUpdate() {
        if (!this._bundle)
            return;
        const svg = (this._sceneElement ?? this._container?.querySelector("svg") ?? null);
        if (!svg)
            return;
        const updates = this._engine.getFrameUpdates().map((update) => ({
            id: update.id,
            asset: update.asset,
            pos: update.pos,
            size: update.size,
            layer: update.layer,
            presence: update.lifecycle,
            enter: update.entry,
            exit: update.exit,
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
            enter: update.entry,
            exit: update.exit,
            ambient: update.ambient,
        }));
        updateElementTransforms(svg, updates, connectors);
        this._applyLifecycleChanges(updates);
        this._applyConnectorLifecycleChanges(connectors);
    }
    _applyLifecycleChanges(elements) {
        for (const elDef of elements) {
            const transition = this._engine.getLifecycleTransition(elDef.id);
            if (!transition)
                continue;
            const svgForState = (this._sceneElement ?? this._container?.querySelector("svg"));
            if (!svgForState)
                continue;
            const state = getElementState(svgForState, elDef.id);
            if (!state)
                continue;
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
    _applyConnectorLifecycleChanges(connectors) {
        for (const connectorDef of connectors) {
            const transition = this._engine.getConnectorLifecycleTransition(connectorDef.id);
            if (!transition)
                continue;
            const svgForState = (this._sceneElement ?? this._container?.querySelector("svg"));
            if (!svgForState)
                continue;
            const state = getConnectorState(svgForState, connectorDef.id);
            if (!state)
                continue;
            if (transition.to === "entering" || transition.to === "present") {
                state.isHidden = false;
                unhideElementOnReadd(state.node);
            }
            if (isForwardEntryTransition(transition)) {
                this._applyConnectorEntryAnimation(connectorDef, state);
            }
            if (isReverseExitTransition(transition)) {
                this._applyConnectorExitAnimation({
                    ...connectorDef,
                    exit: oppositeExitAnimation(connectorDef.enter ?? "fade-in"),
                }, state);
                continue;
            }
            if (isForwardExitTransition(transition)) {
                this._applyConnectorExitAnimation(connectorDef, state);
            }
            if (isReverseEntryTransition(transition)) {
                state.isHidden = false;
                unhideElementOnReadd(state.node);
                this._applyConnectorEntryAnimation({
                    ...connectorDef,
                    enter: oppositeEntryAnimation(connectorDef.exit ?? "fade-out"),
                }, state);
                continue;
            }
            if (transition.to === "removed") {
                state.isHidden = true;
                hideElementAfterExit(state.node);
            }
        }
    }
    _applyEntryAnimation(elDef, state) {
        const entryAnim = elDef.enter ?? "fade-in";
        if (entryAnim === "none")
            return;
        animateElement(state.node, `iso-anim-${entryAnim}`, "enter");
        state.node.addEventListener("animationend", () => {
            state.node.style.animation = "";
        }, { once: true });
    }
    _applyExitAnimation(elDef, state) {
        const exitAnim = elDef.exit ?? "fade-out";
        if (exitAnim === "none") {
            hideElementAfterExit(state.node);
            return;
        }
        animateElement(state.node, `iso-anim-${exitAnim}`, "exit");
        state.node.addEventListener("animationend", () => {
            hideElementAfterExit(state.node);
        }, { once: true });
    }
    _applyConnectorEntryAnimation(connectorDef, state) {
        const entryAnim = connectorDef.enter ?? "fade-in";
        if (entryAnim === "none")
            return;
        animateElement(state.node, `iso-anim-${entryAnim}`, "enter");
        state.node.addEventListener("animationend", () => {
            state.node.style.animation = "";
        }, { once: true });
    }
    _applyConnectorExitAnimation(connectorDef, state) {
        const exitAnim = connectorDef.exit ?? "fade-out";
        if (exitAnim === "none") {
            hideElementAfterExit(state.node);
            return;
        }
        animateElement(state.node, `iso-anim-${exitAnim}`, "exit");
        state.node.addEventListener("animationend", () => {
            hideElementAfterExit(state.node);
        }, { once: true });
    }
    // ── Scene transitions ──────────────────────────────────────────────────
    _transitionToScene(index) {
        this._cancelTransition();
        if (index === this._sceneIndex)
            return;
        this._sceneIndex = index;
        this._emit("scene-change", index);
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
    _animateProgress(from, to, duration) {
        const easing = resolveEasing((this._config.transitionEasing === "ease-in-out"
            ? "easeInOutCubic"
            : this._config.transitionEasing === "ease-out"
                ? "easeOutCubic"
                : "linear"));
        const start = performance.now();
        const step = (now) => {
            const elapsed = now - start;
            const t = Math.min(elapsed / duration, 1);
            const easedT = easing(t);
            const currentProgress = from + (to - from) * easedT;
            this.setProgress(currentProgress);
            if (t < 1) {
                this._transitionAnim = requestAnimationFrame(step);
            }
            else {
                this._transitionAnim = null;
            }
        };
        this._transitionAnim = requestAnimationFrame(step);
    }
    _cancelTransition() {
        if (this._transitionAnim !== null) {
            cancelAnimationFrame(this._transitionAnim);
            this._transitionAnim = null;
        }
    }
    // ── Scroll binding ─────────────────────────────────────────────────────
    _bindScroll() {
        const container = this._config.container;
        if (!container)
            return;
        this._container = container;
        this._calculateScrollBounds();
        container.addEventListener("scroll", this._onScroll, { passive: true });
        window.addEventListener("resize", this._onResize, { passive: true });
        if (this._config.keyboardControls) {
            document.addEventListener("keydown", this._onKeyDown);
        }
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
    _unbindScroll() {
        const container = this._config.container;
        if (!container)
            return;
        container.removeEventListener("scroll", this._onScroll);
        window.removeEventListener("resize", this._onResize);
        document.removeEventListener("keydown", this._onKeyDown);
        container.removeEventListener("touchstart", this._onTouchStart);
        container.removeEventListener("touchmove", this._onTouchMove);
        container.removeEventListener("touchend", this._onTouchEnd);
    }
    _calculateScrollBounds() {
        const container = this._config.container;
        if (!container)
            return;
        const offset = this._config.scrollOffset ?? {};
        if (this._config.scrollDirection === "horizontal") {
            this._minScroll = offset.left ?? 0;
            this._maxScroll = container.scrollWidth - container.clientWidth - (offset.right ?? 0);
            return;
        }
        this._minScroll = offset.top ?? 0;
        this._maxScroll = container.scrollHeight - container.clientHeight - (offset.bottom ?? 0);
    }
    _onScroll = () => {
        if (this._paused || this._destroyed)
            return;
        const container = this._config.container;
        if (!container)
            return;
        const currentScroll = this._config.scrollDirection === "horizontal" ? container.scrollLeft : container.scrollTop;
        const range = this._maxScroll - this._minScroll;
        if (range <= 0)
            return;
        const rawProgress = (currentScroll - this._minScroll) / range;
        const clampedProgress = Math.max(this._config.minProgress ?? 0, Math.min(this._config.maxProgress ?? 1, rawProgress));
        const sensitivity = this._config.scrollSensitivity ?? 1;
        if (clampedProgress !== this._progress) {
            this.setProgress(clampedProgress * sensitivity);
        }
    };
    _onResize = () => {
        if (this._destroyed)
            return;
        this._calculateScrollBounds();
    };
    _onKeyDown = (e) => {
        if (this._destroyed)
            return;
        if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
            e.preventDefault();
            this.nextScene();
        }
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            this.prevScene();
        }
    };
    _onTouchStart = (e) => {
        if (this._destroyed)
            return;
        this._isDragging = true;
        const touch = e.touches[0];
        if (this._config.scrollDirection === "horizontal") {
            this._touchStartX = touch.clientX;
        }
        else {
            this._touchStartY = touch.clientY;
        }
    };
    _onTouchMove = (e) => {
        if (this._destroyed)
            return;
        if (!this._isDragging)
            return;
        const touch = e.touches[0];
        const delta = this._config.scrollDirection === "horizontal"
            ? this._touchStartX - touch.clientX
            : this._touchStartY - touch.clientY;
        const sensitivity = this._config.scrollSensitivity ?? 1.0;
        const progressDelta = (delta / 300) * sensitivity;
        const newProgress = Math.max(0, Math.min(1, this._progress + progressDelta));
        this.setProgress(newProgress);
    };
    _onTouchEnd = () => {
        if (this._destroyed)
            return;
        this._isDragging = false;
    };
    // ── Pause state ────────────────────────────────────────────────────────
    _applyPauseState(pause) {
        const container = this._config.container;
        if (!container)
            return;
        const svg = container.querySelector("svg");
        if (!svg)
            return;
        const playState = pause ? "paused" : "running";
        const ambientElements = svg.querySelectorAll('[class*="iso-ambient-"]');
        for (let i = 0; i < ambientElements.length; i++) {
            const el = ambientElements[i];
            el.style.animationPlayState = playState;
        }
    }
    _assertNotDestroyed() {
        if (!this._destroyed)
            return;
        throw new ControllerError("CONTROLLER_DESTROYED", "AnimationController has been destroyed");
    }
}
function isForwardEntryTransition(transition) {
    return transition.from === "removed" && transition.to === "entering";
}
function isForwardExitTransition(transition) {
    return transition.to === "exiting";
}
function isReverseExitTransition(transition) {
    return transition.to === "removed" && transition.from !== "exiting";
}
function isReverseEntryTransition(transition) {
    return transition.from === "exiting" && transition.to !== "removed";
}
function oppositeExitAnimation(entry) {
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
function oppositeEntryAnimation(exit) {
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

const RUNTIME_BUNDLE_FORMAT = "isostate-runtime-bundle";
const RUNTIME_VERSION = "0.1.0";
const HEX_DIGEST_PATTERN = /^[a-f0-9]{64}$/;
/** Mount a compiled runtime bundle into an HTML element. */
function mountScene(target, bundle, options = {}) {
    assertMountTarget(target);
    validateRuntimeBundle(bundle);
    const engine = new AnimationEngine();
    engine.init(bundle);
    const svg = buildSceneDOM(target, bundle, {
        label: options.label,
        themeVars: options.themeVars,
    });
    let controller;
    if (options.controller !== undefined && options.controller !== false) {
        controller = new AnimationController();
        controller.init(bundle, {
            ...options.controller,
            container: options.controller.container ?? target,
            sceneElement: svg,
        }, {
            engine,
            sceneElement: svg,
        });
    }
    let destroyed = false;
    return {
        svg,
        engine,
        controller,
        getResolvedConfig: () => getResolvedConfig(bundle, options),
        destroy: () => {
            if (destroyed)
                return;
            destroyed = true;
            controller?.destroy();
            engine.destroy();
            if (svg.parentNode === target) {
                target.removeChild(svg);
            }
            else {
                svg.parentNode?.removeChild(svg);
            }
        },
    };
}
function assertMountTarget(target) {
    if (!target || typeof target.appendChild !== "function" || typeof target.removeChild !== "function") {
        throw new RenderError("INVALID_MOUNT_TARGET", "mountScene() requires a DOM HTMLElement target");
    }
}
function validateRuntimeBundle(bundle) {
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
        throw new RenderError("BUNDLE_VERSION_MISMATCH", `Runtime bundle version ${bundle._version} is not compatible with runtime ${RUNTIME_VERSION}`, { bundleVersion: bundle._version, runtimeVersion: RUNTIME_VERSION });
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
function getResolvedConfig(bundle, options = {}) {
    return {
        grid: { cellSize: bundle.grid.cellSize },
        floor: { ...bundle.floor },
        layout: {
            ...bundle.layout,
            padding: { ...bundle.layout.padding },
            align: [...bundle.layout.align],
        },
        viewBox: getResolvedViewBox(bundle),
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
function getResolvedThemeVars(bundle, overrides = {}) {
    return {
        ...(resolveTheme(bundle.theme) ?? {}),
        ...(bundle.themeVars ?? {}),
        ...overrides,
    };
}
function majorVersion(version) {
    const major = Number.parseInt(String(version).split(".")[0] ?? "", 10);
    return Number.isFinite(major) ? major : Number.NaN;
}
function canonicalStringify(value) {
    return JSON.stringify(normalizeValue(value));
}
function normalizeValue(value) {
    if (Array.isArray(value)) {
        return value.map((item) => (item === undefined ? null : normalizeValue(item)));
    }
    if (!isPlainObject(value))
        return value;
    const normalized = {};
    for (const key of Object.keys(value).sort()) {
        const child = value[key];
        if (child !== undefined) {
            normalized[key] = normalizeValue(child);
        }
    }
    return normalized;
}
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function sha256(input) {
    const bytes = utf8Bytes(input);
    const bitLength = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56)
        bytes.push(0);
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
    const w = new Array(64);
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
function utf8Bytes(input) {
    return Array.from(new TextEncoder().encode(input));
}
function rotr(value, bits) {
    return (value >>> bits) | (value << (32 - bits));
}

/** Runtime set of valid entry animation strings */
const ENTRY_ANIMATIONS = new Set([
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
const EXIT_ANIMATIONS = new Set([
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
const LIFECYCLE_STATUSES = new Set(["entering", "present", "exiting", "removed"]);
// ── Type guards ──────────────────────────────────────────────────────────────
/** Narrow a raw string to EntryAnimation. Returns undefined if invalid. */
function guardEntryAnimation(v) {
    if (typeof v !== "string")
        return undefined;
    return ENTRY_ANIMATIONS.has(v) ? v : undefined;
}
/** Narrow a raw string to ExitAnimation. Returns undefined if invalid. */
function guardExitAnimation(v) {
    if (typeof v !== "string")
        return undefined;
    return EXIT_ANIMATIONS.has(v) ? v : undefined;
}
/** Narrow a raw string to LifecycleStatus. Returns undefined if invalid. */
function guardLifecycleStatus(v) {
    if (typeof v !== "string")
        return undefined;
    return LIFECYCLE_STATUSES.has(v) ? v : undefined;
}

export { AnimationController, AnimationEngine, AnimationError, AssetRegistryImpl, ControllerError, DEFAULT_CELL_SIZE, ParseError, RenderError, ValidationErrorClass, applyThemeToElement, buildSceneDOM, calculateTransform, calculateVisualSize, composeTheme, createAssetRegistry, createDefaultRegistry, easeInCubic, easeInOutCubic, easeOutCubic, guardEntryAnimation, guardExitAnimation, guardLifecycleStatus, linear, mountScene, projectToScreen, resolveEasing, resolveTheme };
//# sourceMappingURL=isostate.runtime.js.map
