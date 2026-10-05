import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

type Sprite = {
	rect: [number, number, number, number];
	label: string;
	tags: string[];
};
type Sheet = { path: string; sprites: Record<string, Sprite> };
const source = 'assets/software-architecture';
const { assets } = JSON.parse(
	await readFile(join(source, 'manifest.json'), 'utf8')
) as { assets: Sheet[] };
const required = {
	agents: [
		'ai-agent',
		'ai-orchestrator',
		'ai-planner',
		'ai-researcher',
		'ai-tool-runner',
		'ai-reviewer',
		'ai-memory',
		'ai-knowledge'
	],
	'ai-capabilities': [
		'ai-rag',
		'ai-embedding',
		'ai-vector-search',
		'ai-context',
		'ai-prompt',
		'ai-evaluation',
		'ai-guardrail',
		'ai-model-router'
	],
	humans: [
		'human-requester',
		'human-operator',
		'human-approver',
		'human-expert',
		'human-team',
		'human-handoff',
		'human-escalation',
		'human-feedback'
	],
	channels: [
		'channel-email',
		'channel-phone',
		'channel-teams',
		'channel-webform',
		'channel-chat',
		'channel-issue',
		'channel-document',
		'channel-webhook'
	],
	orchestration: [
		'agent-workflow',
		'agent-parallel',
		'agent-router',
		'agent-condition',
		'agent-loop',
		'agent-retry',
		'agent-timeout',
		'agent-error'
	],
	lifecycle: [
		'agent-trigger',
		'agent-schedule',
		'agent-await-human',
		'agent-approval',
		'agent-rejection',
		'agent-escalation',
		'agent-audit',
		'agent-complete'
	],
	servicenow: [
		'servicenow-interaction',
		'servicenow-request',
		'servicenow-requested-item',
		'servicenow-request-task',
		'servicenow-catalog-item',
		'servicenow-incident',
		'servicenow-problem',
		'servicenow-change'
	],
	providers: [
		'provider-azure-foundry',
		'provider-aws-bedrock',
		'provider-anthropic',
		'provider-openai',
		'provider-google-vertex',
		'provider-google-gemini',
		'provider-local-model',
		'provider-hugging-face'
	],
	infrastructure: [
		'infra-redis-cache',
		'infra-redis-stream',
		'infra-redis-pubsub',
		'infra-vector-database',
		'infra-object-storage',
		'infra-knowledge-base',
		'infra-api-tool',
		'infra-secret-vault'
	]
};

/** Decode unedited eight-bit RGBA PNG source pixels for actual crop/alpha checks. */
function rgbaPng(bytes: Buffer): {
	pixels: Uint8Array;
	width: number;
	height: number;
} {
	const width = bytes.readUInt32BE(16);
	const height = bytes.readUInt32BE(20);
	expect([bytes[24], bytes[25], bytes[28]]).toEqual([8, 6, 0]);
	const chunks: Buffer[] = [];
	for (let offset = 8; offset < bytes.length; ) {
		const length = bytes.readUInt32BE(offset);
		if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT')
			chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
		offset += 12 + length;
	}
	const raw = inflateSync(Buffer.concat(chunks));
	const stride = width * 4;
	const pixels = new Uint8Array(stride * height);
	for (let y = 0; y < height; y++) {
		const filter = raw[y * (stride + 1)];
		for (let x = 0; x < stride; x++) {
			const index = y * stride + x;
			const left = x >= 4 ? pixels[index - 4] : 0;
			const above = y > 0 ? pixels[index - stride] : 0;
			const diagonal = x >= 4 && y > 0 ? pixels[index - stride - 4] : 0;
			let predict = 0;
			if (filter === 1) predict = left;
			else if (filter === 2) predict = above;
			else if (filter === 3) predict = Math.floor((left + above) / 2);
			else if (filter === 4) predict = paeth(left, above, diagonal);
			else if (filter !== 0)
				throw new Error(`Unsupported PNG filter ${filter}`);
			pixels[index] = raw[y * (stride + 1) + x + 1] + predict;
		}
	}
	return { pixels, width, height };
}

function paeth(left: number, above: number, diagonal: number): number {
	const prediction = left + above - diagonal;
	const dl = Math.abs(prediction - left);
	const da = Math.abs(prediction - above);
	const dd = Math.abs(prediction - diagonal);
	if (dl <= da && dl <= dd) return left;
	return da <= dd ? above : diagonal;
}

describe('agentic workflow assets', () => {
	for (const [group, ids] of Object.entries(required)) {
		test(`${group} ships eight identifiable transparent objects without clipped solid edges`, async () => {
			const path = `agentic/${group}-sprites.png`;
			const sheet = assets.find((entry) => entry.path === path);
			if (!sheet) throw new Error(`Missing ${path}`);
			expect(Object.keys(sheet.sprites).sort()).toEqual([...ids].sort());
			const bytes = await readFile(join(source, path));
			expect(bytes.length).toBeLessThanOrEqual(2 * 1024 * 1024);
			const { pixels, width } = rgbaPng(bytes);
			const alpha = (x: number, y: number) => pixels[(y * width + x) * 4 + 3];
			for (const id of ids) {
				const sprite = sheet.sprites[id];
				expect(sprite.label.length).toBeGreaterThan(2);
				expect(sprite.tags.length).toBeGreaterThan(0);
				const [x, y, w, h] = sprite.rect;
				let transparent = 0;
				let solid = 0;
				for (let row = y; row < y + h; row++) {
					for (let column = x; column < x + w; column++) {
						const value = alpha(column, row);
						if (value === 0) transparent++;
						if (value >= 200) solid++;
					}
				}
				expect(
					transparent / (w * h),
					`${id}: genuine transparent crop`
				).toBeGreaterThan(0.2);
				expect(solid / (w * h), `${id}: visible subject`).toBeGreaterThan(0.02);
				const edges = [
					...Array.from({ length: w }, (_, i) =>
						Math.max(alpha(x + i, y), alpha(x + i, y + h - 1))
					),
					...Array.from({ length: h }, (_, i) =>
						Math.max(alpha(x, y + i), alpha(x + w - 1, y + i))
					)
				];
				expect(
					Math.max(...edges),
					`${id}: crop cuts through a solid object`
				).toBeLessThan(200);
			}
		});
	}
});
