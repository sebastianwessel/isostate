import { useEffect, useMemo, useState } from 'react';
import {
	getMissingAssets,
	getPlaceableManifestAssets,
	getUnusedAssets
} from '../assets.ts';
import type {
	EditorAssetCatalog,
	EditorWorkspace,
	PlaceableAssetManifestEntry,
	SpriteAssetManifestEntry
} from '../types.ts';
import { Input } from '../ui/input.tsx';
import { ScrollArea } from '../ui/scroll-area.tsx';

interface AssetPanelProps {
	workspace: EditorWorkspace;
	assetManifestUrl?: string;
	assetManifestUrls?: string[];
	onDragAsset?: (assetId: string) => void;
	onClickAsset?: (assetId: string) => void;
	activeAssetId?: string;
}

interface LoadedAssetCatalog {
	manifestUrl: string;
	catalog: EditorAssetCatalog;
}

type PanelAsset = PlaceableAssetManifestEntry & {
	__assetBaseUrl: string;
	__manifestUrl: string;
};

function resolveAssetUrl(
	assetBaseUrl: string,
	path: string,
	manifestUrl: string
): string {
	const baseUrl = resolveAssetBaseUrl(assetBaseUrl, manifestUrl);
	const href = baseUrl.href.endsWith('/') ? baseUrl.href : `${baseUrl.href}/`;
	return new URL(path, href).href;
}

function resolveAssetBaseUrl(assetBaseUrl: string, manifestUrl: string): URL {
	const manifestHref = new URL(manifestUrl, document.baseURI).href;
	return new URL(assetBaseUrl, manifestHref);
}

function serializeAssetBaseUrl(
	assetBaseUrl: string,
	manifestUrl: string
): string {
	const url = resolveAssetBaseUrl(assetBaseUrl, manifestUrl);
	if (url.origin === window.location.origin) {
		return `${url.pathname}${url.search}${url.hash}`;
	}
	return url.href.replace(/\/+$/, '');
}

async function loadManifestCatalog(
	manifestUrl: string
): Promise<LoadedAssetCatalog> {
	const res = await fetch(manifestUrl);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const data = await res.json();
	if (
		data.format === 'isostate.asset-manifest' &&
		data.version === 1 &&
		typeof data.assetBaseUrl === 'string' &&
		Array.isArray(data.assets)
	) {
		return {
			manifestUrl,
			catalog: {
				assetBaseUrl: data.assetBaseUrl,
				assets: data.assets
			}
		};
	}
	throw new Error('Invalid manifest format');
}

function searchPanelAssets(assets: PanelAsset[], query: string): PanelAsset[] {
	const q = query.toLowerCase();
	return assets.filter((asset) => {
		if (asset.id.toLowerCase().includes(q)) return true;
		if (asset.label?.toLowerCase().includes(q)) return true;
		if (asset.path.toLowerCase().includes(q)) return true;
		if (asset.tags?.some((tag) => tag.toLowerCase().includes(q))) return true;
		return false;
	});
}

function setAssetDragImage(event: React.DragEvent): void {
	const source = event.currentTarget.querySelector('.isostate-asset-thumb');
	if (!(source instanceof HTMLElement)) return;
	const dragImage = source.cloneNode(true) as HTMLElement;
	dragImage.classList.add('isostate-asset-drag-image');
	dragImage.style.position = 'fixed';
	dragImage.style.left = '-1000px';
	dragImage.style.top = '-1000px';
	dragImage.style.pointerEvents = 'none';
	document.body.appendChild(dragImage);
	event.dataTransfer.setDragImage(dragImage, 20, 20);
	const cleanup = () => dragImage.remove();
	if (typeof requestAnimationFrame === 'function') {
		requestAnimationFrame(cleanup);
	} else {
		window.setTimeout(cleanup, 0);
	}
}

export function AssetPanel({
	workspace,
	assetManifestUrl,
	assetManifestUrls,
	onDragAsset,
	onClickAsset,
	activeAssetId
}: AssetPanelProps) {
	const doc = workspace.document;
	const [catalogs, setCatalogs] = useState<LoadedAssetCatalog[]>([]);
	const [manifestUrl, setManifestUrl] = useState(assetManifestUrl ?? '');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [openAssetGroups, setOpenAssetGroups] = useState<Set<string>>(
		() => new Set()
	);

	const browserState = workspace.uiState.assetBrowser;
	const [searchQuery, setSearchQuery] = useState(browserState.searchQuery);
	const configuredManifestUrls = useMemo(() => {
		if (assetManifestUrls?.length) return assetManifestUrls;
		if (assetManifestUrl) return [assetManifestUrl];
		return manifestUrl ? [manifestUrl] : [];
	}, [assetManifestUrl, assetManifestUrls, manifestUrl]);

	// Load manifest if URL is provided
	useEffect(() => {
		if (configuredManifestUrls.length === 0) {
			setCatalogs([]);
			return;
		}
		setLoading(true);
		setError(null);
		Promise.all(configuredManifestUrls.map(loadManifestCatalog))
			.then(setCatalogs)
			.catch((err) => {
				setError(String(err));
				setCatalogs([]);
			})
			.finally(() => setLoading(false));
	}, [configuredManifestUrls]);

	const combinedCatalog = useMemo<EditorAssetCatalog | null>(() => {
		if (catalogs.length === 0) return null;
		return {
			assetBaseUrl: '',
			assets: catalogs.flatMap((entry) => entry.catalog.assets)
		};
	}, [catalogs]);

	const allAssets = useMemo(
		() =>
			catalogs.flatMap(({ catalog, manifestUrl: sourceManifestUrl }) =>
				getPlaceableManifestAssets(catalog).map((asset) => ({
					...asset,
					__assetBaseUrl: catalog.assetBaseUrl,
					__manifestUrl: sourceManifestUrl
				}))
			),
		[catalogs]
	);

	const filteredAssets = useMemo(() => {
		let result = allAssets;
		if (searchQuery) {
			result = searchPanelAssets(allAssets, searchQuery);
		}
		return result;
	}, [allAssets, searchQuery]);

	const groupedAssets = useMemo(() => {
		const map = new Map<string, typeof filteredAssets>();
		for (const asset of filteredAssets) {
			const list = map.get(asset.group) ?? [];
			list.push(asset);
			map.set(asset.group, list);
		}
		return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
	}, [filteredAssets]);

	useEffect(() => {
		const groupNames = groupedAssets.map(([group]) => group);
		setOpenAssetGroups((current) => {
			const next = new Set(
				Array.from(current).filter((group) => groupNames.includes(group))
			);
			if (next.size === 0 && groupNames[0]) {
				next.add(groupNames[0]);
			}
			return next;
		});
	}, [groupedAssets]);

	const missingAssets = useMemo(() => {
		if (!combinedCatalog || !doc) return [];
		return getMissingAssets(workspace, combinedCatalog);
	}, [combinedCatalog, doc, workspace]);

	const unusedAssets = useMemo(() => {
		if (!combinedCatalog || !doc) return [];
		return getUnusedAssets(workspace, combinedCatalog);
	}, [combinedCatalog, doc, workspace]);

	const recentIds = browserState.recentAssetIds;
	const recentAssets = useMemo(() => {
		return recentIds
			.map((id) => allAssets.find((a) => a.id === id))
			.filter(Boolean) as NonNullable<(typeof allAssets)[number]>[];
	}, [recentIds, allAssets]);

	const builtInAssets = ['text', 'rectangle', 'circle', 'polygon', 'line'];

	return (
		<ScrollArea className="isostate-asset-panel">
			{!assetManifestUrl && !assetManifestUrls?.length && (
				<div className="isostate-asset-manifest-input">
					<FormRow label="Manifest URL">
						<Input
							type="text"
							placeholder="https://example.com/assets/manifest.json"
							value={manifestUrl}
							onChange={(e) => setManifestUrl(e.target.value)}
						/>
					</FormRow>
				</div>
			)}

			{loading && (
				<div className="isostate-asset-loading">Loading manifest…</div>
			)}
			{error && <div className="isostate-asset-error">Error: {error}</div>}

			<div className="isostate-asset-filters">
				<Input
					type="text"
					placeholder="Search assets…"
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
				/>
			</div>

			{missingAssets.length > 0 && (
				<div className="isostate-asset-warnings">
					<div className="isostate-asset-warning">
						Missing from manifest: {missingAssets.join(', ')}
					</div>
				</div>
			)}

			{unusedAssets.length > 0 && (
				<div className="isostate-asset-warnings">
					<div className="isostate-asset-warning isostate-asset-warning--unused">
						Unused declared: {unusedAssets.join(', ')}
					</div>
				</div>
			)}

			{recentAssets.length > 0 && (
				<div className="isostate-asset-section">
					<div className="isostate-asset-section-title">Recently Used</div>
					<div className="isostate-asset-grid">
						{recentAssets.map((asset) => (
							<AssetItem
								key={asset.id}
								asset={asset}
								isActive={activeAssetId === asset.id}
								assetBaseUrl={asset.__assetBaseUrl}
								assetManifestUrl={asset.__manifestUrl}
								previewUrl={resolveAssetUrl(
									asset.__assetBaseUrl,
									asset.path,
									asset.__manifestUrl
								)}
								onDrag={() => onDragAsset?.(asset.id)}
								onClick={() => onClickAsset?.(asset.id)}
							/>
						))}
					</div>
				</div>
			)}

			<div className="isostate-asset-section">
				<div className="isostate-asset-section-title">Built-ins</div>
				<div className="isostate-asset-grid">
					{builtInAssets.map((id) => (
						<BuiltInAssetItem
							key={id}
							id={id}
							isActive={activeAssetId === id}
							onDrag={() => onDragAsset?.(id)}
							onClick={() => onClickAsset?.(id)}
						/>
					))}
				</div>
			</div>

			{combinedCatalog && (
				<div className="isostate-asset-section">
					<div className="isostate-asset-section-title">
						Manifest ({filteredAssets.length})
					</div>
					{groupedAssets.map(([group, assets]) => (
						<div key={group} className="isostate-asset-group">
							<button
								type="button"
								className="isostate-asset-group-title"
								aria-expanded={openAssetGroups.has(group)}
								onClick={() => {
									setOpenAssetGroups((current) => {
										const next = new Set(current);
										if (next.has(group)) {
											next.delete(group);
										} else {
											next.add(group);
										}
										return next;
									});
								}}
							>
								<span
									className="isostate-asset-group-disclosure"
									aria-hidden="true"
								>
									{openAssetGroups.has(group) ? '▾' : '▸'}
								</span>
								<span>{group}</span>
								<span className="isostate-asset-group-count">
									{assets.length}
								</span>
							</button>
							{openAssetGroups.has(group) && (
								<div className="isostate-asset-grid">
									{assets.map((asset) => (
										<AssetItem
											key={asset.id}
											asset={asset}
											assetBaseUrl={asset.__assetBaseUrl}
											assetManifestUrl={asset.__manifestUrl}
											previewUrl={resolveAssetUrl(
												asset.__assetBaseUrl,
												asset.path,
												asset.__manifestUrl
											)}
											onDrag={() => onDragAsset?.(asset.id)}
											onClick={() => onClickAsset?.(asset.id)}
										/>
									))}
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</ScrollArea>
	);
}

function BuiltInAssetItem({
	id,
	isActive,
	onDrag,
	onClick
}: {
	id: string;
	isActive?: boolean;
	onDrag?: () => void;
	onClick?: () => void;
}) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: draggable asset items
		<div
			className={`isostate-asset-item isostate-asset-item--builtin ${isActive ? 'isostate-asset-item--active' : ''}`}
			draggable
			role="button"
			tabIndex={0}
			onDragStart={(event) => {
				event.dataTransfer.effectAllowed = 'copy';
				setAssetDragImage(event);
				event.dataTransfer.setData('application/x-isostate-asset', id);
				event.dataTransfer.setData('text/plain', id);
				onDrag?.();
			}}
			onClick={onClick}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onClick?.();
				}
			}}
			title={id}
		>
			<div className="isostate-asset-thumb isostate-asset-thumb--builtin">
				<BuiltInAssetPreview id={id} />
			</div>
		</div>
	);
}

function BuiltInAssetPreview({ id }: { id: string }) {
	const common = {
		vectorEffect: 'non-scaling-stroke' as const
	};
	switch (id) {
		case 'text':
			return (
				<svg viewBox="0 0 40 40" aria-hidden="true">
					<rect x="5" y="7" width="30" height="26" rx="4" />
					<text x="20" y="25" textAnchor="middle">
						T
					</text>
				</svg>
			);
		case 'rectangle':
			return (
				<svg viewBox="0 0 40 40" aria-hidden="true">
					<rect x="8" y="11" width="24" height="18" rx="3" {...common} />
				</svg>
			);
		case 'circle':
			return (
				<svg viewBox="0 0 40 40" aria-hidden="true">
					<circle cx="20" cy="20" r="12" {...common} />
				</svg>
			);
		case 'polygon':
			return (
				<svg viewBox="0 0 40 40" aria-hidden="true">
					<polygon points="20,7 33,17 28,32 12,32 7,17" {...common} />
				</svg>
			);
		case 'line':
			return (
				<svg viewBox="0 0 40 40" aria-hidden="true">
					<path d="M8 28 L18 14 L31 24" {...common} />
					<circle cx="8" cy="28" r="2.5" />
					<circle cx="18" cy="14" r="2.5" />
					<circle cx="31" cy="24" r="2.5" />
				</svg>
			);
		default:
			return null;
	}
}

function AssetItem({
	asset,
	isActive,
	assetBaseUrl,
	assetManifestUrl,
	previewUrl,
	onDrag,
	onClick
}: {
	asset:
		| PlaceableAssetManifestEntry
		| { id: string; name: string; label?: string };
	isActive?: boolean;
	assetBaseUrl?: string;
	assetManifestUrl?: string;
	previewUrl?: string;
	onDrag?: () => void;
	onClick?: () => void;
}) {
	const handleDragStart = (event: React.DragEvent) => {
		event.dataTransfer.effectAllowed = 'copy';
		setAssetDragImage(event);
		event.dataTransfer.setData('application/x-isostate-asset', asset.id);
		if (
			assetBaseUrl &&
			assetManifestUrl &&
			'path' in asset &&
			typeof asset.path === 'string'
		) {
			event.dataTransfer.setData(
				'application/x-isostate-manifest-asset',
				JSON.stringify({
					entry: asset,
					assetBaseUrl: serializeAssetBaseUrl(assetBaseUrl, assetManifestUrl)
				})
			);
		}
		event.dataTransfer.setData('text/plain', asset.id);
		onDrag?.();
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: draggable asset items
		<div
			className={`isostate-asset-item ${isActive ? 'isostate-asset-item--active' : ''}`}
			role="button"
			tabIndex={0}
			draggable
			onDragStart={handleDragStart}
			onClick={onClick}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onClick?.();
				}
			}}
			title={asset.id}
		>
			<div className="isostate-asset-thumb">
				{previewUrl && isSpriteManifestAsset(asset) ? (
					<SpriteAssetPreview asset={asset} previewUrl={previewUrl} />
				) : (
					previewUrl && <img src={previewUrl} alt="" draggable={false} />
				)}
			</div>
		</div>
	);
}

function isSpriteManifestAsset(
	asset:
		| PlaceableAssetManifestEntry
		| { id: string; name: string; label?: string }
): asset is SpriteAssetManifestEntry {
	return 'type' in asset && asset.type === 'sprite';
}

function SpriteAssetPreview({
	asset,
	previewUrl
}: {
	asset: SpriteAssetManifestEntry;
	previewUrl: string;
}) {
	const rect = spriteRect(asset);
	if (!rect) return <img src={previewUrl} alt="" draggable={false} />;
	const [x, y, width, height] = rect;
	return (
		<div
			className="isostate-asset-sprite-window"
			style={{ aspectRatio: `${width} / ${height}` }}
		>
			<img
				src={previewUrl}
				alt=""
				draggable={false}
				style={{
					width: `${(asset.sheetSize[0] / width) * 100}%`,
					height: `${(asset.sheetSize[1] / height) * 100}%`,
					transform: `translate(${(-x / asset.sheetSize[0]) * 100}%, ${(-y / asset.sheetSize[1]) * 100}%)`
				}}
			/>
		</div>
	);
}

function spriteRect(
	asset: SpriteAssetManifestEntry
): [number, number, number, number] | undefined {
	if (Array.isArray(asset.sprite)) {
		if (!asset.tileSize) return undefined;
		return [
			asset.sprite[0] * asset.tileSize[0],
			asset.sprite[1] * asset.tileSize[1],
			asset.tileSize[0],
			asset.tileSize[1]
		];
	}
	if (asset.sprite.rect) return asset.sprite.rect;
	if (asset.sprite.at && asset.tileSize) {
		return [
			asset.sprite.at[0] * asset.tileSize[0],
			asset.sprite.at[1] * asset.tileSize[1],
			asset.tileSize[0],
			asset.tileSize[1]
		];
	}
	return undefined;
}

function FormRow({
	label,
	children
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="isostate-inspector-row">
			<span className="isostate-inspector-label">{label}</span>
			<div className="isostate-inspector-control">{children}</div>
		</div>
	);
}
