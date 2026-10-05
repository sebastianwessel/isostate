import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import {
	compileScene,
	parseScene,
	validateScene
} from '@sebastianwessel/isostate/dsl';
import { convertMermaidToDsl } from '../../packages/cli/src/mermaid2dsl';

const directory = new URL('../../examples/mermaid/', import.meta.url);

describe('published Mermaid source example', () => {
	test('generated draft and browser bundle preserve request branches and async work', async () => {
		const source = await readFile(
			new URL('request-flow.mmd', directory),
			'utf8'
		);
		const yaml = await readFile(
			new URL('request-flow.isostate.yaml', directory),
			'utf8'
		);
		expect(convertMermaidToDsl(source, { name: 'request-flow' }).yaml).toBe(
			yaml
		);
		const document = parseScene(yaml);
		expect(validateScene(document).isValid).toBe(true);
		const scene = document.scenes[0];
		expect(
			scene.elements?.filter((element) => element.asset !== 'text')
		).toHaveLength(9);
		expect(scene.connections).toHaveLength(11);
		for (const label of ['ok', 'denied', 'hit', 'miss', 'async']) {
			expect(
				scene.elements?.filter((element) => element.text?.value === label)
			).toHaveLength(1);
		}
		expect(
			scene.connections?.find((connection) => connection.id === 'app-to-queue')
		).toMatchObject({
			from: { element: 'app' },
			to: { element: 'queue' },
			style: { pattern: 'dotted' }
		});
		const moduleText = await readFile(
			new URL('request-flow.isostate.js', directory),
			'utf8'
		);
		const serialized = JSON.parse(
			moduleText
				.replace(/^export default /, '')
				.trim()
				.replace(/;$/, '')
		);
		expect(serialized).toEqual(compileScene(document));
	});
});
