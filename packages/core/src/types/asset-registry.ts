import type { AssetCategory, AssetDefinition, AssetRegistry, Theme } from "./assets.ts";

// ── Built-in themes ────────────────────────────────────────────────────────

const BUILTIN_THEMES: Record<string, Record<string, string>> = {
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
export function resolveTheme(name: string): Record<string, string> | undefined {
	return BUILTIN_THEMES[name];
}

/**
 * Compose a new theme by extending an existing one with overrides.
 */
export function composeTheme(baseName: string, overrides: Record<string, string>): Theme {
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
export class AssetRegistryImpl implements AssetRegistry {
	private _assets = new Map<string, AssetDefinition>();

	register(asset: AssetDefinition): void {
		this._assets.set(asset.id, asset);
	}

	get(id: string): AssetDefinition | undefined {
		return this._assets.get(id);
	}

	getAll(category?: AssetCategory): AssetDefinition[] {
		if (category) {
			return [...this._assets.values()].filter((a) => a.category === category);
		}
		return [...this._assets.values()];
	}

	has(id: string): boolean {
		return this._assets.has(id);
	}

	remove(id: string): void {
		this._assets.delete(id);
	}
}

export function createAssetRegistry(assets: AssetDefinition[] = []): AssetRegistryImpl {
	const registry = new AssetRegistryImpl();
	for (const asset of assets) {
		registry.register(asset);
	}
	return registry;
}

/** Create a fresh registry populated with the built-in demo assets. */
export function createDefaultRegistry(): AssetRegistryImpl {
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
