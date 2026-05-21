import { RenderError } from '../types/errors.ts';
import type { TextAlign, TextContent } from '../types/node.ts';
import type { RuntimeBundle } from '../types/runtime-bundle.ts';

const NS = 'http://www.w3.org/2000/svg';

type ResolvedAsset = { url: string; anchor?: [number, number] };

export type AssetResolver = (name: string) => ResolvedAsset | undefined;

export function createAssetResolver(bundle?: RuntimeBundle): AssetResolver {
	const embedded = new Map<string, ResolvedAsset>();
	const bundleAssets = bundle?.assets;

	if (bundleAssets && typeof bundleAssets === 'object') {
		for (const [name, asset] of Object.entries(bundleAssets)) {
			if (asset && typeof asset === 'object' && typeof asset.url === 'string') {
				embedded.set(name, { url: asset.url, anchor: asset.anchor });
			}
		}
	}

	return (name: string) => embedded.get(name);
}

export function createAssetNode(
	asset: ResolvedAsset,
	assetName: string,
	cellSize: number
): SVGGElement {
	return createUrlAssetNode(asset.url, assetName, cellSize, asset.anchor);
}

export function createTextAssetNode(
	textContent: TextContent | undefined,
	assetName: string,
	cellSize: number
): SVGGElement {
	if (!textContent?.value) {
		throw new RenderError(
			'TEXT_CONTENT_MISSING',
			`Text content is missing for built-in asset: ${assetName}`,
			{ asset: assetName }
		);
	}

	const group = document.createElementNS(NS, 'g') as SVGGElement;
	const text = document.createElementNS(NS, 'text') as SVGTextElement;
	const align = textContent.align ?? 'middle';
	const fontSize = textContent.fontSize ?? 12;
	const lineHeight = textContent.lineHeight ?? 1.2;
	const anchorX = textAnchorX(align, cellSize);

	text.setAttribute('x', String(anchorX));
	text.setAttribute('y', String(-cellSize));
	text.setAttribute('text-anchor', align);
	text.setAttribute('dominant-baseline', 'text-before-edge');
	text.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
	text.setAttribute('font-size', String(fontSize));
	text.setAttribute('font-weight', String(textContent.fontWeight ?? 700));
	text.setAttribute('fill', textContent.fill ?? 'currentColor');

	const lines = normalizeTextLines(textContent.value);
	for (const [index, line] of lines.entries()) {
		const tspan = document.createElementNS(NS, 'tspan') as SVGTSpanElement;
		tspan.setAttribute('x', String(anchorX));
		tspan.setAttribute('dy', index === 0 ? '0' : String(fontSize * lineHeight));
		tspan.textContent = line;
		text.appendChild(tspan);
	}

	group.appendChild(text);
	return group;
}

function textAnchorX(align: TextAlign, cellSize: number): number {
	if (align === 'start') return -cellSize / 2;
	if (align === 'end') return cellSize / 2;
	return 0;
}

function normalizeTextLines(value: string): string[] {
	const normalized = value.replace(/\r\n?/g, '\n').replace(/\n$/, '');
	return normalized.split('\n');
}

function createUrlAssetNode(
	url: string,
	assetName: string,
	cellSize: number,
	anchor?: [number, number]
): SVGGElement {
	if (!isSafeAssetUrl(url)) {
		throw new RenderError(
			'INVALID_ASSET_URL',
			`Asset URL is unsafe: ${assetName}`,
			{ asset: assetName }
		);
	}
	const group = document.createElementNS(NS, 'g') as SVGGElement;
	const image = document.createElementNS(NS, 'image') as SVGImageElement;
	const resolvedUrl = resolveBrowserAssetUrl(url);
	const [anchorX, anchorY] = anchor ?? [0.5, 1];
	image.setAttribute('href', resolvedUrl);
	image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', resolvedUrl);
	image.setAttribute('x', String(-cellSize * anchorX));
	image.setAttribute('y', String(-cellSize * anchorY));
	image.setAttribute('width', String(cellSize));
	image.setAttribute('height', String(cellSize));
	image.setAttribute('preserveAspectRatio', 'xMidYMax meet');
	group.appendChild(image);
	return group;
}

function resolveBrowserAssetUrl(url: string): string {
	try {
		const baseURI = document.baseURI;
		return typeof baseURI === 'string' ? new URL(url, baseURI).href : url;
	} catch {
		return url;
	}
}

function isSafeAssetUrl(url: string): boolean {
	const normalized = url.trim().toLowerCase();
	return normalized.length > 0 && !normalized.startsWith('javascript:');
}
