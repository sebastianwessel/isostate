import { RenderError } from "../types/errors.ts";
import type { LinePrimitive, PrimitiveContent, PrimitiveStyle, TextAlign, TextContent } from "../types/node.ts";
import type { CompiledSprite, RuntimeBundle } from "../types/runtime-bundle.ts";
import { projectToRaw } from "../utils/projection.ts";

const NS = "http://www.w3.org/2000/svg";

type ResolvedAsset = { url: string; anchor?: [number, number]; sprite?: CompiledSprite };

export type AssetResolver = (name: string) => ResolvedAsset | undefined;

export function createAssetResolver(bundle?: RuntimeBundle): AssetResolver {
	const embedded = new Map<string, ResolvedAsset>();
	const bundleAssets = bundle?.assets;

	if (bundleAssets && typeof bundleAssets === "object") {
		for (const [name, asset] of Object.entries(bundleAssets)) {
			if (asset && typeof asset === "object" && typeof asset.url === "string") {
				embedded.set(name, { url: asset.url, anchor: asset.anchor, sprite: asset.sprite });
			}
		}
	}

	return (name: string) => embedded.get(name);
}

export function createAssetNode(asset: ResolvedAsset, assetName: string, cellSize: number): SVGGElement {
	if (asset.sprite) {
		return createSpriteAssetNode(asset.url, assetName, cellSize, asset.sprite, asset.anchor);
	}
	return createUrlAssetNode(asset.url, assetName, cellSize, asset.anchor);
}

export function createTextAssetNode(
	textContent: TextContent | undefined,
	assetName: string,
	cellSize: number,
): SVGGElement {
	if (!textContent?.value) {
		throw new RenderError("TEXT_CONTENT_MISSING", `Text content is missing for built-in asset: ${assetName}`, {
			asset: assetName,
		});
	}

	const group = document.createElementNS(NS, "g") as SVGGElement;
	const text = document.createElementNS(NS, "text") as SVGTextElement;
	const align = textContent.align ?? "middle";
	const placement = textContent.placement ?? "cell";
	const fontSize = textContent.fontSize ?? 12;
	const lineHeight = textContent.lineHeight ?? 1.2;
	const anchorX = textAnchorX(align, cellSize);
	const vertical = textVerticalAnchor(placement, cellSize);

	text.setAttribute("x", String(anchorX));
	text.setAttribute("y", String(vertical.y));
	text.setAttribute("text-anchor", align);
	text.setAttribute("dominant-baseline", vertical.baseline);
	text.setAttribute("font-family", "Arial, Helvetica, sans-serif");
	text.setAttribute("font-size", String(fontSize));
	text.setAttribute("font-weight", String(textContent.fontWeight ?? 700));
	text.setAttribute("fill", textContent.fill ?? "currentColor");

	const lines = normalizeTextLines(textContent.value);
	for (const [index, line] of lines.entries()) {
		const tspan = document.createElementNS(NS, "tspan") as SVGTSpanElement;
		tspan.setAttribute("x", String(anchorX));
		tspan.setAttribute("dy", index === 0 ? "0" : String(fontSize * lineHeight));
		tspan.textContent = line;
		text.appendChild(tspan);
	}

	group.appendChild(text);
	return group;
}

export function createPrimitiveAssetNode(
	assetName: string,
	primitive: PrimitiveContent | undefined,
	cellSize: number,
): SVGGElement {
	const group = document.createElementNS(NS, "g") as SVGGElement;
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

function textAnchorX(align: TextAlign, cellSize: number): number {
	if (align === "start") return -cellSize / 2;
	if (align === "end") return cellSize / 2;
	return 0;
}

function textVerticalAnchor(placement: TextContent["placement"], cellSize: number): { y: number; baseline: string } {
	if (placement === "caption") return { y: -cellSize, baseline: "text-before-edge" };
	return { y: -cellSize / 2, baseline: "middle" };
}

function normalizeTextLines(value: string): string[] {
	const normalized = value.replace(/\r\n?/g, "\n").replace(/\n$/, "");
	return normalized.split("\n");
}

function rectanglePoints(): [number, number][] {
	return [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, 1],
	];
}

function appendProjectedPolygon(
	group: SVGGElement,
	points: [number, number][] | undefined,
	style: PrimitiveStyle | undefined,
	cellSize: number,
): void {
	if (!points) return;
	const polygon = document.createElementNS(NS, "polygon") as SVGPolygonElement;
	polygon.setAttribute("points", points.map((point) => projectLocalPoint(point, cellSize)).join(" "));
	applyPrimitiveStyle(polygon, style, { fill: "currentColor", stroke: "none" });
	group.appendChild(polygon);
}

function appendProjectedPolyline(
	group: SVGGElement,
	line: LinePrimitive | undefined,
	style: PrimitiveStyle | undefined,
	cellSize: number,
): void {
	if (!line?.points) return;
	const polyline = document.createElementNS(NS, "polyline") as SVGPolylineElement;
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

function appendCircle(group: SVGGElement, style: PrimitiveStyle | undefined, cellSize: number): void {
	const center = projectLocalPoint([0.5, 0.5], cellSize);
	const circle = document.createElementNS(NS, "circle") as SVGCircleElement;
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

function projectLocalPoint(point: [number, number], cellSize: number): string {
	const projected = projectToRaw(point[0], point[1], cellSize);
	const anchor = projectToRaw(1, 1, cellSize);
	return `${projected.rawX - anchor.rawX},${projected.rawY - anchor.rawY}`;
}

function applyPrimitiveStyle(
	node: SVGElement,
	style: PrimitiveStyle | undefined,
	defaults: { fill: string; stroke: string },
): void {
	node.setAttribute("fill", style?.fill ?? defaults.fill);
	node.setAttribute("stroke", style?.stroke ?? defaults.stroke);
	node.setAttribute("stroke-width", String(style?.strokeWidth ?? 0));
	node.setAttribute("opacity", String(style?.opacity ?? 1));
	if (style?.dash) node.setAttribute("stroke-dasharray", style.dash.join(" "));
}

function createUrlAssetNode(url: string, assetName: string, cellSize: number, anchor?: [number, number]): SVGGElement {
	if (!isSafeAssetUrl(url)) {
		throw new RenderError("INVALID_ASSET_URL", `Asset URL is unsafe: ${assetName}`, { asset: assetName });
	}
	const group = document.createElementNS(NS, "g") as SVGGElement;
	const image = document.createElementNS(NS, "image") as SVGImageElement;
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

function createSpriteAssetNode(
	url: string,
	assetName: string,
	cellSize: number,
	sprite: CompiledSprite,
	anchor?: [number, number],
): SVGGElement {
	if (!isSafeAssetUrl(url)) {
		throw new RenderError("INVALID_ASSET_URL", `Asset URL is unsafe: ${assetName}`, { asset: assetName });
	}
	const group = document.createElementNS(NS, "g") as SVGGElement;
	const viewport = document.createElementNS(NS, "svg") as SVGSVGElement;
	const image = document.createElementNS(NS, "image") as SVGImageElement;
	const resolvedUrl = resolveBrowserAssetUrl(url);
	const [anchorX, anchorY] = anchor ?? [0.5, 1];
	const [rectX, rectY, rectWidth, rectHeight] = sprite.rect;

	viewport.setAttribute("x", String(-cellSize * anchorX));
	viewport.setAttribute("y", String(-cellSize * anchorY));
	viewport.setAttribute("width", String(cellSize));
	viewport.setAttribute("height", String(cellSize));
	viewport.setAttribute("viewBox", `${rectX} ${rectY} ${rectWidth} ${rectHeight}`);
	viewport.setAttribute("preserveAspectRatio", "xMidYMax meet");

	image.setAttribute("href", resolvedUrl);
	image.setAttributeNS("http://www.w3.org/1999/xlink", "href", resolvedUrl);
	image.setAttribute("x", "0");
	image.setAttribute("y", "0");
	image.setAttribute("width", String(sprite.sheetSize[0]));
	image.setAttribute("height", String(sprite.sheetSize[1]));
	viewport.appendChild(image);
	group.appendChild(viewport);
	return group;
}

function resolveBrowserAssetUrl(url: string): string {
	try {
		const baseURI = document.baseURI;
		return typeof baseURI === "string" ? new URL(url, baseURI).href : url;
	} catch {
		return url;
	}
}

function isSafeAssetUrl(url: string): boolean {
	const normalized = url.trim().toLowerCase();
	return normalized.length > 0 && !normalized.startsWith("javascript:");
}
