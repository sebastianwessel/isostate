import type { PlaceableAssetManifestEntry } from '../types.ts';

const AGENTIC_GROUP_LABELS: Record<string, string> = {
	agents: 'AI agents',
	'ai-capabilities': 'AI knowledge & quality',
	channels: 'Intake channels',
	humans: 'People & collaboration',
	handoffs: 'People & collaboration',
	infrastructure: 'Tools & infrastructure',
	lifecycle: 'Workflow events',
	orchestration: 'Workflow control',
	providers: 'Model providers',
	servicenow: 'ServiceNow records'
};

/** Give agentic collections readable groups without changing manifest entries. */
export function getAssetPanelGroup(asset: PlaceableAssetManifestEntry): string {
	if (asset.group === 'handoffs' || asset.id.includes('handoff')) {
		return 'People & collaboration';
	}
	if (asset.group !== 'agentic' || asset.type !== 'sprite') return asset.group;
	const namespace = asset.sheetId
		.replace(/^agentic-/, '')
		.replace(/-sprites$/, '');
	return AGENTIC_GROUP_LABELS[namespace] ?? asset.group;
}
