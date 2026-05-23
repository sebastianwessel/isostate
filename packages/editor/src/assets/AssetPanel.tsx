import { useEffect, useMemo, useState } from 'react';
import { getMissingAssets, getUnusedAssets, searchAssets } from '../assets.ts';
import type { EditorAssetCatalog, EditorWorkspace } from '../types.ts';
import { Badge } from '../ui/badge.tsx';
import { Input } from '../ui/input.tsx';
import { ScrollArea } from '../ui/scroll-area.tsx';

interface AssetPanelProps {
	workspace: EditorWorkspace;
	assetManifestUrl?: string;
	onDragAsset?: (assetId: string) => void;
	onClickAsset?: (assetId: string) => void;
	activeAssetId?: string;
}

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

export function AssetPanel({
	workspace,
	assetManifestUrl,
	onDragAsset,
	onClickAsset,
	activeAssetId
}: AssetPanelProps) {
	const doc = workspace.document;
	const [catalog, setCatalog] = useState<EditorAssetCatalog | null>(null);
	const [manifestUrl, setManifestUrl] = useState(assetManifestUrl ?? '');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const browserState = workspace.uiState.assetBrowser;
	const [searchQuery, setSearchQuery] = useState(browserState.searchQuery);

	// Load manifest if URL is provided
	useEffect(() => {
		if (!manifestUrl) return;
		setLoading(true);
		setError(null);
		fetch(manifestUrl)
			.then(async (res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = await res.json();
				if (
					data.format === 'isostate.asset-manifest' &&
					data.version === 1 &&
					typeof data.assetBaseUrl === 'string' &&
					Array.isArray(data.assets)
				) {
					setCatalog({
						assetBaseUrl: data.assetBaseUrl,
						assets: data.assets
					});
				} else {
					throw new Error('Invalid manifest format');
				}
			})
			.catch((err) => {
				setError(String(err));
				setCatalog(null);
			})
			.finally(() => setLoading(false));
	}, [manifestUrl]);

	const allAssets = catalog?.assets ?? [];

	const filteredAssets = useMemo(() => {
		let result = allAssets;
		if (searchQuery) {
			result = searchAssets(
				catalog ?? { assetBaseUrl: '', assets: result },
				searchQuery
			);
		}
		return result;
	}, [allAssets, searchQuery, catalog]);

	const groupedAssets = useMemo(() => {
		const map = new Map<string, typeof filteredAssets>();
		for (const asset of filteredAssets) {
			const list = map.get(asset.group) ?? [];
			list.push(asset);
			map.set(asset.group, list);
		}
		return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
	}, [filteredAssets]);

	const missingAssets = useMemo(() => {
		if (!catalog || !doc) return [];
		return getMissingAssets(workspace, catalog);
	}, [catalog, doc, workspace]);

	const unusedAssets = useMemo(() => {
		if (!catalog || !doc) return [];
		return getUnusedAssets(workspace, catalog);
	}, [catalog, doc, workspace]);

	const recentIds = browserState.recentAssetIds;
	const recentAssets = useMemo(() => {
		return recentIds
			.map((id) => allAssets.find((a) => a.id === id))
			.filter(Boolean) as NonNullable<(typeof allAssets)[number]>[];
	}, [recentIds, allAssets]);

	const declaredAssetIds = new Set(doc?.header.assets.map((a) => a.id) ?? []);
	const builtInAssets = ['text', 'rectangle', 'circle', 'polygon', 'line'];

	return (
		<ScrollArea className="isostate-asset-panel">
			{!assetManifestUrl && (
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
								isDeclared={declaredAssetIds.has(asset.id)}
								isActive={activeAssetId === asset.id}
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

			{catalog && (
				<div className="isostate-asset-section">
					<div className="isostate-asset-section-title">
						Manifest ({filteredAssets.length})
					</div>
					{groupedAssets.map(([group, assets]) => (
						<div key={group} className="isostate-asset-group">
							<div className="isostate-asset-group-title">{group}</div>
							<div className="isostate-asset-grid">
								{assets.map((asset) => (
									<AssetItem
										key={asset.id}
										asset={asset}
										isDeclared={declaredAssetIds.has(asset.id)}
										assetBaseUrl={catalog.assetBaseUrl}
										assetManifestUrl={manifestUrl}
										previewUrl={resolveAssetUrl(
											catalog.assetBaseUrl,
											asset.path,
											manifestUrl
										)}
										onDrag={() => onDragAsset?.(asset.id)}
										onClick={() => onClickAsset?.(asset.id)}
									/>
								))}
							</div>
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
			<div className="isostate-asset-name">{id}</div>
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
	isDeclared,
	isActive,
	assetBaseUrl,
	assetManifestUrl,
	previewUrl,
	onDrag,
	onClick
}: {
	asset: { id: string; name: string; label?: string };
	isDeclared: boolean;
	isActive?: boolean;
	assetBaseUrl?: string;
	assetManifestUrl?: string;
	previewUrl?: string;
	onDrag?: () => void;
	onClick?: () => void;
}) {
	const handleDragStart = (event: React.DragEvent) => {
		event.dataTransfer.effectAllowed = 'copy';
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
			className={`isostate-asset-item ${isDeclared ? 'isostate-asset-item--declared' : ''} ${isActive ? 'isostate-asset-item--active' : ''}`}
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
				{previewUrl && <img src={previewUrl} alt="" draggable={false} />}
			</div>
			<div className="isostate-asset-name">{asset.label ?? asset.name}</div>
			{isDeclared && (
				<Badge className="isostate-asset-declared-badge" variant="secondary">
					YAML
				</Badge>
			)}
		</div>
	);
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
