import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import {
	compileScene,
	parseScene,
	validateScene
} from '../../packages/core/src/dsl/index.ts';

const expectedMessages = {
	'agentic-workflow': [
		['manual-triage', 'requester-email'],
		['interaction-triage', 'task-tools', 'triage-knowledge'],
		['wait-approver'],
		['approval-audit', 'tools-complete']
	],
	'provider-routing': [
		['agent-router', 'route-bedrock'],
		['agent-cache', 'rag-vector'],
		['api-stream', 'runner-api'],
		['review-complete']
	]
};

async function workflow(name: string) {
	const yaml = await readFile(
		`website/src/scenes/${name}.isostate.yaml`,
		'utf8'
	);
	const document = parseScene(yaml);
	expect(validateScene(document).errors).toEqual([]);
	return compileScene(document);
}

describe('workflow presentation examples', () => {
	for (const [name, stops] of Object.entries(expectedMessages)) {
		test(`${name} moves traffic to the current work and finishes processing`, async () => {
			const bundle = await workflow(name);
			for (const [index, scene] of bundle.scenes.entries()) {
				const connectors = scene.connectors.filter(
					(connection) =>
						connection.presence !== 'exiting' &&
						connection.presence !== 'removed'
				);
				expect(
					connectors
						.filter(
							(connection) =>
								connection.message && connection.message.enabled !== false
						)
						.map((connection) => connection.id)
						.sort()
				).toEqual(stops[index]);
				for (const connection of connectors) {
					expect(connection.style.variant).toBe('beam');
					expect(connection.style.cornerRadius).toBeGreaterThan(0);
				}
			}
			const final = bundle.scenes.at(-1);
			expect(
				final?.elements.filter(
					(element) =>
						element.presence !== 'exiting' &&
						element.presence !== 'removed' &&
						element.activity?.state === 'processing'
				)
			).toEqual([]);
		});
	}

	test('the AI worker changes visual state without losing its identity or connections', async () => {
		const bundle = await workflow('agentic-workflow');
		expect(
			bundle.scenes[1]?.elements.find((element) => element.id === 'intake')
				?.asset
		).toBe('human-to-ai-handoff');
		expect(
			bundle.scenes[2]?.elements.find((element) => element.id === 'wait')?.asset
		).toBe('ai-to-human-handoff');
		expect(bundle.assets?.['human-to-ai-handoff']).toBeDefined();
		expect(bundle.assets?.['ai-to-human-handoff']).toBeDefined();
		const triage = bundle.scenes
			.slice(1)
			.map((scene) =>
				scene.elements.find((element) => element.id === 'triage')
			);
		expect(triage.map((element) => element?.asset)).toEqual([
			'ai-agent',
			'agent-await-human',
			'agent-complete'
		]);
		expect(triage.map((element) => element?.activity?.state)).toEqual([
			'processing',
			'waiting',
			'complete'
		]);
		for (const element of triage) {
			expect(element?.pos).toEqual([7, 4]);
			expect(element?.size).toBe(1);
			expect(bundle.assets?.[element?.asset ?? '']).toBeDefined();
		}
		for (const scene of bundle.scenes.slice(1))
			expect(
				scene.connectors.find(
					(connection) => connection.id === 'interaction-triage'
				)
			).toBeDefined();
	});
});
