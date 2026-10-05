import type {
	AssetManifestEntry,
	SpriteManifestDefinition
} from '../../../packages/editor/src/types.ts';

/** Stable collection categories, independent of sprite-sheet filenames. */
export const SOFTWARE_CATALOG_GROUPS = [
	{
		id: 'ai-roles',
		title: 'AI agents',
		description: 'Agents, orchestrators, planners, researchers, and reviewers.'
	},
	{
		id: 'ai-knowledge',
		title: 'AI knowledge & quality',
		description: 'Retrieval, context, prompts, evaluation, and guardrails.'
	},
	{
		id: 'human',
		title: 'People & collaboration',
		description: 'Requesters, operators, experts, approvals, and handoffs.'
	},
	{
		id: 'channel',
		title: 'Intake channels',
		description: 'Bring conversations, documents, and events into the workflow.'
	},
	{
		id: 'agent-control',
		title: 'Workflow control',
		description: 'Parallel work, conditions, loops, retries, and failures.'
	},
	{
		id: 'agent-lifecycle',
		title: 'Workflow events',
		description: 'Triggers, waiting, decisions, audit trails, and completion.'
	},
	{
		id: 'servicenow',
		title: 'ServiceNow records',
		description:
			'Distinct records for conversations, requests, fulfillment, and IT service work.'
	},
	{
		id: 'provider',
		title: 'Model providers',
		description: 'Cloud platforms, model APIs, and local inference.'
	},
	{
		id: 'infra',
		title: 'Tools & infrastructure',
		description:
			'Redis, retrieval stores, knowledge bases, APIs, and credentials.'
	},
	{
		id: 'architecture',
		title: 'Software architecture',
		description:
			'The components behind a system, from requests to background jobs.'
	},
	{
		id: 'workflow',
		title: 'Classic workflows',
		description: 'Starts, tasks, decisions, events, and endings.'
	},
	{
		id: 'process',
		title: 'Business processes',
		description: 'Schedules, documents, and human approvals.'
	}
] as const;

const knowledgeIds = new Set([
	'ai-rag',
	'ai-embedding',
	'ai-vector-search',
	'ai-context',
	'ai-prompt',
	'ai-evaluation',
	'ai-guardrail',
	'ai-model-router'
]);
const lifecycleIds = new Set([
	'agent-trigger',
	'agent-schedule',
	'agent-await-human',
	'agent-approval',
	'agent-rejection',
	'agent-escalation',
	'agent-audit',
	'agent-complete'
]);
const displayLabels: Record<string, string> = {
	'provider-azure-foundry': 'Microsoft Foundry (Azure)',
	'provider-aws-bedrock': 'Amazon Bedrock',
	'provider-anthropic': 'Anthropic / Claude',
	'provider-openai': 'OpenAI',
	'provider-google-vertex': 'Google Vertex AI',
	'provider-google-gemini': 'Google Gemini',
	'provider-hugging-face': 'Hugging Face',
	'servicenow-request-task': 'Request task / Catalog task',
	'servicenow-requested-item': 'Requested item (RITM)'
};
const aliases: Record<string, string[]> = {
	'provider-azure-foundry': [
		'Azure Foundry',
		'Azure AI Foundry',
		'Microsoft Foundry',
		'Azure AI Studio'
	],
	'provider-aws-bedrock': ['AWS Bedrock', 'Amazon Bedrock'],
	'provider-anthropic': ['Claude'],
	'provider-openai': ['GPT', 'OpenAI API'],
	'provider-google-vertex': [
		'Vertex AI',
		'Google Cloud',
		'Gemini Enterprise Agent Platform'
	],
	'provider-google-gemini': ['Gemini API', 'Google AI'],
	'servicenow-request': ['REQ', 'sc_request'],
	'servicenow-requested-item': ['RITM', 'sc_req_item'],
	'servicenow-request-task': ['SCTASK', 'catalog task', 'sc_task'],
	'servicenow-catalog-item': ['sc_cat_item', 'service catalog']
};

/** Placeable catalog preview with a source image and optional sprite crop. */
export interface SoftwareCatalogPreview {
	id: string;
	label: string;
	path: string;
	group: string;
	tags: string[];
	rect?: [number, number, number, number];
	sheetSize?: [number, number];
}

/** Flatten sheet namespaces into logical objects, preserving labels and tags. */
export function softwareCatalogPreviews(
	assets: AssetManifestEntry[]
): SoftwareCatalogPreview[] {
	return assets.flatMap((asset) => {
		if (asset.type !== 'sprite-sheet')
			return [
				{
					id: asset.id,
					label: displayLabels[asset.id] ?? asset.label ?? asset.name,
					path: asset.path,
					group: catalogGroup(asset.id, asset.group),
					tags: [...(asset.tags ?? []), ...(aliases[asset.id] ?? [])]
				}
			];
		return Object.entries(asset.sprites).map(([id, sprite]) => ({
			id,
			label:
				displayLabels[id] ??
				((!Array.isArray(sprite) && sprite.label) ||
					id.split('-').slice(1).join(' ')),
			path: asset.path,
			group: catalogGroup(id, asset.group),
			tags: [
				...(asset.tags ?? []),
				...(!Array.isArray(sprite) ? (sprite.tags ?? []) : []),
				...(aliases[id] ?? [])
			],
			rect: spriteRect(sprite, asset.tileSize),
			sheetSize: asset.sheetSize
		}));
	});
}

/** Search names, ids, tags, and provider aliases within the selected category. */
export function matchesSoftwareAsset(
	asset: SoftwareCatalogPreview,
	query: string,
	group = 'all'
): boolean {
	if (group !== 'all' && asset.group !== group) return false;
	const searchable = [asset.id, asset.label, ...asset.tags]
		.join(' ')
		.toLowerCase();
	return query
		.toLowerCase()
		.trim()
		.split(/\s+/)
		.every((term) => searchable.includes(term));
}

function catalogGroup(id: string, fallback: string): string {
	if (knowledgeIds.has(id)) return 'ai-knowledge';
	if (lifecycleIds.has(id)) return 'agent-lifecycle';
	if (id.startsWith('ai-')) return 'ai-roles';
	if (id.startsWith('agent-')) return 'agent-control';
	const prefix = id.split('-')[0];
	return SOFTWARE_CATALOG_GROUPS.some((group) => group.id === prefix)
		? prefix
		: fallback;
}

function spriteRect(
	sprite: SpriteManifestDefinition,
	tileSize?: [number, number]
): [number, number, number, number] {
	if (!Array.isArray(sprite) && sprite.rect) return sprite.rect;
	const at = Array.isArray(sprite) ? sprite : sprite.at;
	if (!at || !tileSize)
		throw new Error('Sprite preview requires a rectangle or tile coordinates.');
	return [at[0] * tileSize[0], at[1] * tileSize[1], tileSize[0], tileSize[1]];
}
