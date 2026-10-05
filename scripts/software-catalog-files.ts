/** Static catalog files copied into both npm distribution and website downloads. */
export function softwareCatalogFiles(
	assets: Array<{ path: string }>
): string[] {
	return [
		'manifest.json',
		'README.md',
		'LICENSE',
		'IMAGEGEN-PROMPTS.md',
		'agentic/AGENT-VISUAL-PROMPTS.md',
		'agentic/PROCESS-VISUAL-PROMPTS.md',
		...new Set(assets.map((asset) => asset.path))
	];
}
