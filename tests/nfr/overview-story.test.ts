import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { AnimationEngine } from '../../packages/core/src/animation/animation-engine';
import {
	compileScene,
	parseScene,
	validateScene
} from '../../packages/core/src/dsl';
import type { RuntimeBundle } from '../../packages/core/src/types/runtime-bundle';
import { overviewChapters } from '../../website/src/lib/overview-content';
import { progressAtMarker } from '../../website/src/lib/overview-story';
import generated from '../../website/src/scenes/product-story.isostate.js';

const path = 'website/src/scenes/product-story.isostate.yaml';
const bundle = generated as unknown as RuntimeBundle;

describe('homepage software story', () => {
	test('source, compiled scenes, and chapter stops tell the same story', async () => {
		const source = parseScene(await readFile(path, 'utf8'));
		expect(validateScene(source).errors).toEqual([]);
		const compiled = compileScene(source);
		expect(bundle.scenes).toEqual(compiled.scenes);
		expect(bundle.assets).toEqual(compiled.assets);
		expect(bundle.scenes.map((scene) => scene.id)).toEqual(
			overviewChapters.map((chapter) => chapter.id)
		);
		for (const scene of bundle.scenes)
			expect(
				scene.elements.length + scene.connectors.length
			).toBeLessThanOrEqual(50);
	});

	test('catalog artwork keeps native footprints and checked sprite anchors', async () => {
		const manifest = JSON.parse(
			await readFile('assets/software-architecture/manifest.json', 'utf8')
		) as {
			assets: Array<{
				path: string;
				sprites: Record<string, { anchor: number[]; rect: number[] }>;
			}>;
		};
		for (const scene of bundle.scenes) {
			for (const element of scene.elements) {
				if (element.asset === 'text') continue;
				expect(element.size).toBe(1);
				expect(element.pos.every(Number.isInteger)).toBe(true);
				const sheet = manifest.assets.find(
					(asset) => asset.sprites[element.asset]
				);
				expect(sheet).toBeDefined();
				expect(bundle.assets[element.asset].anchor).toEqual(
					sheet?.sprites[element.asset].anchor
				);
				expect(bundle.assets[element.asset].sprite?.rect).toEqual(
					sheet?.sprites[element.asset].rect
				);
			}
		}
	});

	test('a persistent request interpolates forward and backward and leaves on delivery', () => {
		const engine = new AnimationEngine();
		engine.init(bundle);
		engine.setProgress(1 / 12);
		expect(engine.getElementUpdate('request').pos).toEqual([2, 4]);
		engine.setProgress(5 / 12);
		expect(engine.getElementUpdate('request').pos[0]).toBe(5);
		expect(engine.getElementUpdate('request').pos[1]).toBeCloseTo(2.5);
		engine.setProgress(1);
		expect(engine.getElementUpdate('request').lifecycle).toBe('exiting');
		expect(engine.getElementUpdate('result').lifecycle).toBe('entering');
		engine.setProgress(1 / 12);
		expect(engine.getElementUpdate('request').pos).toEqual([2, 4]);
		expect(engine.getElementUpdate('request').lifecycle).toBe('present');
	});

	test('scroll progress reaches every chapter continuously and clamps outside the story', () => {
		const anchors = [100, 300, 900, 1100];
		expect(progressAtMarker(anchors, -100)).toBe(0);
		expect(progressAtMarker(anchors, 300)).toBeCloseTo(1 / 3);
		expect(progressAtMarker(anchors, 600)).toBeCloseTo(0.5);
		expect(progressAtMarker(anchors, 2000)).toBe(1);
		expect(progressAtMarker([], 2000)).toBe(0);
	});
});
