import { describe, expect, test } from 'bun:test';
import { stringify } from 'yaml';
import {
	compileScene,
	fromJson,
	parseScene,
	toJson,
	validateScene
} from '../packages/core/src/dsl/index.ts';
import type { SceneDocument } from '../packages/core/src/types/index.ts';

function scene(): SceneDocument {
	return {
		header: {
			version: '0.1',
			assetBaseUrl: './assets',
			assets: [{ id: 'agent' }, { id: 'done' }],
			layers: [
				{ name: 'ground' },
				{ name: 'connectors' },
				{ name: 'structures' }
			]
		},
		scenes: [
			{
				id: 'working',
				elements: [
					{
						id: 'worker',
						asset: 'agent',
						at: [1, 1],
						activity: { state: 'processing', color: '#22d3ee' }
					}
				],
				connections: [
					{
						id: 'request',
						route: [
							[0, 1],
							[1, 1],
							[1, 3]
						],
						style: {
							variant: 'beam',
							cornerRadius: 12,
							glow: '#22d3ee',
							glowWidth: 8
						},
						message: {
							kind: 'envelope',
							color: '#aabbcc',
							size: 12,
							duration: 2400,
							count: 2
						}
					}
				]
			},
			{
				id: 'review',
				update: {
					elements: [{ id: 'worker', activity: { state: 'waiting' } }],
					connections: [{ id: 'request', message: { enabled: false } }]
				}
			},
			{
				id: 'finished',
				update: {
					elements: [
						{ id: 'worker', asset: 'done', activity: { state: 'complete' } }
					],
					connections: [
						{
							id: 'request',
							message: { kind: 'orb' },
							direction: 'reverse',
							style: { cornerRadius: 0 }
						}
					]
				}
			}
		]
	};
}

describe('workflow effects authoring pipeline', () => {
	test('round trips all effects and resolves discrete whole-object replacements', () => {
		const document = parseScene(stringify(scene()));
		expect(validateScene(document).errors).toEqual([]);
		const bundle = compileScene(document);
		expect(fromJson(toJson(bundle))).toEqual(bundle);
		expect(bundle.scenes[0].connectors[0].style).toMatchObject({
			variant: 'beam',
			strokeWidth: 6,
			outlineWidth: 2,
			outline: '#263746',
			cornerRadius: 12,
			glowWidth: 8
		});
		expect(bundle.scenes[1].elements[0].activity).toEqual({ state: 'waiting' });
		expect(bundle.scenes[1].connectors[0].message).toEqual({ enabled: false });
		expect(bundle.scenes[2].connectors[0].message).toEqual({ kind: 'orb' });
		expect(bundle.scenes[2].connectors[0].style).toMatchObject({
			glow: '#22d3ee',
			cornerRadius: 0
		});
		expect(bundle.scenes[2].elements[0].asset).toBe('done');
		expect(Object.keys(bundle.assets ?? {})).toEqual(['agent', 'done']);
	});

	test('old line snapshots retain their exact default style without new mandatory fields', () => {
		const document = scene();
		delete document.scenes[0].elements?.[0].activity;
		delete document.scenes[0].connections?.[0].message;
		if (document.scenes[0].connections)
			document.scenes[0].connections[0].style = {};
		document.scenes = [document.scenes[0]];
		expect(compileScene(document).scenes[0].connectors[0].style).toEqual({
			variant: 'line',
			pattern: 'solid',
			stroke: '#2563eb',
			strokeWidth: 3,
			opacity: 1,
			outlineWidth: 0,
			lane: 'none'
		});
	});

	test('rejects unknown nested fields and incorrect scalar types during parsing', () => {
		for (const replacement of [
			{ activity: { state: 'waiting', colour: 'red' } },
			{ activity: { state: 4 } }
		]) {
			const raw = scene();
			Object.assign(raw.scenes[0].elements?.[0] ?? {}, replacement);
			expect(() => parseScene(stringify(raw))).toThrow();
		}
		for (const message of [
			{ kind: 'packet', speed: 9 },
			{ enabled: 'false' },
			{ duration: Infinity }
		]) {
			const raw = scene();
			Object.assign(raw.scenes[0].connections?.[0] ?? {}, { message });
			expect(() => parseScene(stringify(raw))).toThrow();
		}
	});

	test('rejects invalid message ranges, count fractions, kinds, and unsafe colors even when disabled', () => {
		for (const message of [
			{ size: 1 },
			{ size: 33 },
			{ duration: 199 },
			{ duration: 30001 },
			{ count: 0 },
			{ count: 5 },
			{ count: 1.5 },
			{ kind: 'mail' },
			{ color: 'url(evil)' },
			{ enabled: false, color: 'javascript:alert(1)' }
		]) {
			const raw = scene();
			Object.assign(raw.scenes[0].connections?.[0] ?? {}, { message });
			expect(
				validateScene(parseScene(stringify(raw))).errors.some(
					(error) => error.code === 'INVALID_CONNECTOR_MESSAGE'
				)
			).toBe(true);
		}
	});

	test('rejects invalid activity and connector styling', () => {
		for (const activity of [
			{ state: 'running' },
			{ state: 'idle', color: '<red>' }
		]) {
			const raw = scene();
			Object.assign(raw.scenes[0].elements?.[0] ?? {}, { activity });
			expect(
				validateScene(parseScene(stringify(raw))).errors.some(
					(error) => error.code === 'INVALID_ELEMENT_ACTIVITY'
				)
			).toBe(true);
		}
		for (const style of [
			{ cornerRadius: -1 },
			{ glowWidth: 0 },
			{ glow: 'url(evil)' }
		]) {
			const raw = scene();
			Object.assign(raw.scenes[0].connections?.[0] ?? {}, { style });
			expect(
				validateScene(parseScene(stringify(raw))).errors.some(
					(error) => error.code === 'INVALID_CONNECTOR_STYLE'
				)
			).toBe(true);
		}
	});

	test('requires declared placeable external assets for swaps', () => {
		for (const [asset, code] of [
			['missing', 'ASSET_NOT_DECLARED'],
			['text', 'INVALID_ELEMENT_ASSET_SWAP'],
			['rectangle', 'INVALID_ELEMENT_ASSET_SWAP']
		]) {
			const raw = scene();
			const patch = raw.scenes[2].update?.elements?.[0];
			if (patch) patch.asset = asset;
			expect(
				validateScene(raw).errors.some((error) => error.code === code)
			).toBe(true);
		}
		const raw = scene();
		const placement = raw.scenes[0].elements?.[0];
		if (placement) {
			placement.asset = 'text';
			placement.text = { value: 'label' };
		}
		expect(
			validateScene(raw).errors.some(
				(error) => error.code === 'INVALID_ELEMENT_ASSET_SWAP'
			)
		).toBe(true);
	});
});
