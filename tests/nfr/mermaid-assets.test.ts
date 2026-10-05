import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
	compileScene,
	parseScene,
	validateScene
} from '@sebastianwessel/isostate/dsl';

test('Mermaid illustration manifest and scene retain the same checked sprite crops', async () => {
	const sheet = await readFile(
		'assets/isostate-story/mermaid-workflow-sheet.png'
	);
	const manifest = JSON.parse(
		await readFile(
			'assets/isostate-story/mermaid-workflow.manifest.json',
			'utf8'
		)
	);
	const scene = parseScene(
		await readFile('website/src/scenes/mermaid-workflow.isostate.yaml', 'utf8')
	);
	expect(validateScene(scene).errors).toEqual([]);
	const compiledText = await readFile(
		'website/src/scenes/mermaid-workflow.isostate.js',
		'utf8'
	);
	const compiled = JSON.parse(
		compiledText
			.replace(/^export default /, '')
			.trim()
			.replace(/;$/, '')
	);
	expect(compiled).toEqual(compileScene(scene));
	const asset = manifest.assets[0];
	expect(sheet[25]).toBe(6); // PNG RGBA: true alpha, not a painted background.
	expect(asset.digest).toBe(
		`sha256:${createHash('sha256').update(sheet).digest('hex')}`
	);
	expect(asset.sheetSize).toEqual([
		sheet.readUInt32BE(16),
		sheet.readUInt32BE(20)
	]);
	expect(Object.keys(asset.sprites)).toHaveLength(7);
	const declared = scene.header.assets.find((entry) => entry.id === asset.id);
	expect(declared).toMatchObject({
		type: 'sprite-sheet',
		sheetSize: asset.sheetSize
	});
	if (declared?.type !== 'sprite-sheet')
		throw new Error('Missing Mermaid sprite sheet');
	for (const [id, value] of Object.entries(asset.sprites)) {
		const sprite = value as { rect: number[]; anchor: number[] };
		expect(declared.sprites[id]).toMatchObject({
			rect: sprite.rect,
			anchor: sprite.anchor
		});
		const [x, y, width, height] = sprite.rect;
		expect(x).toBeGreaterThanOrEqual(0);
		expect(y).toBeGreaterThanOrEqual(0);
		expect(x + width).toBeLessThanOrEqual(asset.sheetSize[0]);
		expect(y + height).toBeLessThanOrEqual(asset.sheetSize[1]);
		const elements = scene.scenes.flatMap(
			(step) => step.elements ?? step.add?.elements ?? []
		);
		expect(elements.find((element) => element.asset === id)?.size).toBe(1);
	}
});
