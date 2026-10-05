import type { RuntimeConnectorState, RuntimeElementState } from "../types/node.ts";

const NS = "http://www.w3.org/2000/svg";
type Point = { x: number; y: number };

/** Build rounded projected geometry shared by tracks and message motion. */
export function roundedPath(points: Point[], radius: number): string {
	if (!points.length) return "";
	let result = `M ${points[0].x} ${points[0].y}`;
	for (let i = 1; i < points.length; i++) {
		const point = points[i];
		const previous = points[i - 1];
		const next = points[i + 1];
		const before = Math.hypot(point.x - previous.x, point.y - previous.y);
		const after = next ? Math.hypot(next.x - point.x, next.y - point.y) : 0;
		const distance = Math.min(radius, before / 2, after / 2);
		if (!next || !distance) {
			result += ` L ${point.x} ${point.y}`;
			continue;
		}
		const a = {
			x: point.x + ((previous.x - point.x) * distance) / before,
			y: point.y + ((previous.y - point.y) * distance) / before,
		};
		const b = {
			x: point.x + ((next.x - point.x) * distance) / after,
			y: point.y + ((next.y - point.y) * distance) / after,
		};
		result += ` L ${a.x} ${a.y} Q ${point.x} ${point.y} ${b.x} ${b.y}`;
	}
	return result;
}

function shape<K extends keyof SVGElementTagNameMap>(
	tag: K,
	attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
	const node = document.createElementNS(NS, tag);
	for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
	return node;
}

/** Reconcile cheap layered beam lighting without allocating SVG filters. */
export function updateTrackEffects(
	node: SVGGElement,
	shaft: SVGPathElement,
	def: RuntimeConnectorState,
	d: string,
): void {
	for (const old of node.querySelectorAll(".iso-track-effect")) node.removeChild(old);
	const { style } = def;
	if (style.glow) {
		const glow = shape("path", {
			d,
			fill: "none",
			stroke: style.glow,
			"stroke-width": style.strokeWidth + (style.glowWidth ?? 8),
			opacity: style.opacity * 0.16,
			"stroke-linecap": "round",
			"stroke-linejoin": "round",
			class: "iso-track-effect iso-connector-glow",
		});
		node.insertBefore(glow, node.firstChild);
	}
	if (style.variant !== "beam") return;
	const highlight = shape("path", {
		d,
		fill: "none",
		stroke: "#efffff",
		"stroke-width": Math.max(0.6, style.strokeWidth * 0.23),
		opacity: style.opacity * 0.7,
		"stroke-linecap": "round",
		"stroke-linejoin": "round",
		class: "iso-track-effect iso-connector-highlight",
	});
	// The highlight follows the main shaft but remains below moving tokens.
	node.insertBefore(highlight, shaft.nextSibling);
}

/** Draw projected tokens with highlights; all motion is on the outer group. */
function messageToken(kind: string, size: number, color: string): SVGGElement {
	const group = shape("g", { transform: `scale(${size / 16})`, fill: color });
	group.appendChild(shape("ellipse", { cx: 1, cy: 5, rx: 9, ry: 3.5, fill: "#07131f", opacity: 0.35 }));
	if (kind === "orb") {
		group.appendChild(shape("circle", { r: 7, fill: "#173343" }));
		group.appendChild(shape("circle", { cx: -1, cy: -1.5, r: 5.6 }));
		group.appendChild(shape("ellipse", { cx: -2, cy: -3.5, rx: 2.5, ry: 1.6, fill: "#fff", opacity: 0.85 }));
	} else if (kind === "envelope") {
		group.appendChild(shape("path", { d: "M-8-5 8-2 8 6-8 3Z", fill: "#142e3c", stroke: color, "stroke-width": 1 }));
		group.appendChild(shape("path", { d: "M-8-5 8-2 0 2Z" }));
		group.appendChild(
			shape("path", { d: "M-7-4 0 1 7-1", fill: "none", stroke: "#f0ffff", "stroke-width": 0.8, opacity: 0.8 }),
		);
	} else {
		group.appendChild(shape("path", { d: "M-8-2 0-6 8-2 0 2Z" }));
		group.appendChild(shape("path", { d: "M-8-2 0 2 0 7-8 3Z", fill: "#183544", stroke: color, "stroke-width": 0.6 }));
		group.appendChild(shape("path", { d: "M0 2 8-2 8 3 0 7Z", opacity: 0.65 }));
		group.appendChild(
			shape("path", { d: "M-6-2 0-5 6-2", fill: "none", stroke: "#fff", "stroke-width": 0.9, opacity: 0.85 }),
		);
	}
	return group;
}

/** Update motion paths in place so rerouting does not restart packet progress. */
export function updateMessages(node: SVGGElement, def: RuntimeConnectorState, d: string, recreate: boolean): void {
	if (recreate) for (const old of node.querySelectorAll(".iso-message")) node.removeChild(old);
	const message = def.message;
	if (!message || message.enabled === false) return;
	if (recreate) {
		const count = message.count ?? 1;
		const duration = message.duration ?? 1800;
		for (let i = 0; i < count; i++) {
			const token = shape("g", { class: "iso-message", "aria-hidden": "true", "data-kind": message.kind ?? "packet" });
			token.style.animationDuration = `${duration}ms`;
			token.style.animationDelay = `${(-duration * i) / count}ms`;
			token.appendChild(messageToken(message.kind ?? "packet", message.size ?? 10, message.color ?? def.style.stroke));
			node.appendChild(token);
		}
	}
	for (const token of node.querySelectorAll<SVGGElement>(".iso-message")) {
		token.style.offsetPath = `path("${d}")`;
		token.style.opacity = String(def.style.opacity);
		token.style.animationDirection = def.direction === "reverse" ? "reverse" : "normal";
		token.style.display = def.presence === "removed" ? "none" : "";
	}
}

/** Keep activity geometry independent of asset artwork and ambient transforms. */
export function updateActivity(node: SVGGElement, activity: RuntimeElementState["activity"], cellSize: number): void {
	for (const old of node.querySelectorAll(".iso-activity")) node.removeChild(old);
	node.setAttribute("data-activity", activity?.state ?? "idle");
	if (!activity || activity.state === "idle") return;
	const state = activity.state;
	const color =
		activity.color ?? { processing: "#67e8f9", waiting: "#fbbf24", complete: "#6ee7b7", error: "#fb7185" }[state];
	const group = shape("g", {
		class: `iso-activity iso-activity-${state}`,
		color,
		"aria-label": state,
		"pointer-events": "none",
	});
	const radius = cellSize * 0.36;
	const halo = shape("ellipse", {
		cx: 0,
		cy: -2,
		rx: radius,
		ry: radius * 0.42,
		fill: color,
		"fill-opacity": 0.08,
		stroke: color,
		"stroke-opacity": 0.6,
		"stroke-width": 1.3,
		class: "iso-activity-ring",
	});
	group.appendChild(halo);
	const badge = shape("g", {
		transform: `translate(${cellSize * 0.29} ${-cellSize * 0.6})`,
		class: "iso-activity-badge",
	});
	badge.appendChild(shape("circle", { r: 6, fill: "#102330", stroke: color, "stroke-width": 1 }));
	const glyph = {
		processing: "M-2 0h4M0-2v4",
		waiting: "M-2-2v4M2-2v4",
		complete: "M-3 0-1 2 3-2",
		error: "M0-3v3M0 2v.5",
	}[state];
	badge.appendChild(
		shape("path", {
			d: glyph,
			fill: "none",
			stroke: color,
			"stroke-width": 1.5,
			"stroke-linecap": "round",
			"stroke-linejoin": "round",
		}),
	);
	group.appendChild(badge);
	node.appendChild(group);
}
