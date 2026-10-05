import { describe, expect, test } from 'bun:test';
import {
	compileScene,
	parseScene,
	validateScene
} from '@sebastianwessel/isostate/dsl';
import { convertMermaidSource } from '../../packages/cli/src/mermaid-source';
import {
	convertMermaidToDsl,
	MermaidConversionError
} from '../../packages/cli/src/mermaid2dsl';

function convert(source: string) {
	const result = convertMermaidToDsl(source);
	const document = parseScene(result.yaml);
	expect(validateScene(document).errors).toEqual([]);
	return { result, document, scene: document.scenes[0] };
}

function failure(source: string, code: string, line: number) {
	try {
		convertMermaidSource(source);
		throw new Error('Expected conversion to fail');
	} catch (error) {
		expect(error).toBeInstanceOf(MermaidConversionError);
		expect(error).toMatchObject({ code, details: { line } });
	}
}

describe('Mermaid source fidelity', () => {
	test.each([
		['TD', [0, 0], [0, 4]],
		['TB', [0, 0], [0, 4]],
		['BT', [0, 4], [0, 0]],
		['LR', [0, 0], [4, 0]],
		['RL', [4, 0], [0, 0]]
	])('%s maps flow to nonnegative whole-cell positions', (direction, a, b) => {
		const { scene } = convert(`flowchart ${direction}; A-->B;`);
		expect(scene?.elements?.find((e) => e.id === 'a')?.at).toEqual(a);
		expect(scene?.elements?.find((e) => e.id === 'b')?.at).toEqual(b);
		expect(
			scene?.elements
				?.filter((e) => e.asset === 'text')
				.map((e) => e.text?.value)
		).toEqual(['A', 'B']);
	});

	test('quotes protect syntax, comments, semicolons, delimiters and escaped quotes', () => {
		const { scene } = convert(
			'%% introduction\nflowchart LR; A["API; 50%% & [ok] \\"yes\\""] -->|"true; %% & | pipe"| B["0x10"]; %% end\n B --> C["1e3"]'
		);
		expect(
			scene?.elements
				?.filter((e) => e.asset === 'text')
				.map((e) => e.text?.value)
		).toEqual(['API; 50%% & [ok] "yes"', '0x10', '1e3', 'true; %% & | pipe']);
	});

	test.each([
		'null',
		'false',
		'1e3',
		'0x10',
		'.inf',
		'hello\nworld',
		'a: b',
		'[flow]'
	])('YAML preserves string label %j', (value) => {
		const { scene } = convert(`graph TD\nA["${value}"]`);
		expect(scene?.elements?.find((e) => e.asset === 'text')?.text?.value).toBe(
			value
		);
	});

	test('compact directed arrows permit o/x target IDs and CR comments retain line positions', () => {
		const { scene } = convert('graph LR; A-->other-->xyz');
		expect(scene?.connections?.map((c) => c.to.element)).toEqual([
			'other',
			'xyz'
		]);
		failure('graph TD\r%% note\rA[[Unsupported]]', 'MERMAID_UNSUPPORTED', 3);
	});

	test('inline undirected labels stop before the next chained edge', () => {
		const { scene } = convert('graph TD; A -- label -- B --> C');
		expect(
			scene?.connections?.map((c) => [c.from.element, c.to.element])
		).toEqual([
			['a', 'b'],
			['b', 'c']
		]);
		expect(
			scene?.elements?.find((e) => e.id === 'a-to-b-label')?.text?.value
		).toBe('label');
	});
	test('trapezoids choose their own delimiter before later chained shapes', () => {
		const { scene } = convert('graph TD; A[/Trapezoid\\] --> B[/Input/]');
		expect(
			scene?.elements
				?.filter((e) => e.asset === 'text')
				.map((e) => e.text?.value)
		).toEqual(['Trapezoid', 'Input']);
	});
	test('explicit empty labels omit text while preserving shapes and connections', () => {
		const { scene } = convert('graph TD; A[""] -->|""| B');
		expect(scene?.elements?.map((e) => e.id)).toEqual(['a', 'b', 'b-label']);
		expect(scene?.connections).toHaveLength(1);
	});

	test('fanout and chains expand Cartesian pairs in source order and preserve styles and labels', () => {
		const { scene, result } = convert(
			'flowchart LR; A & B -.->|async| C & D ==> E'
		);
		expect(result.warnings).toEqual([]);
		expect(
			scene?.connections?.map((c) => [c.from.element, c.to.element])
		).toEqual([
			['a', 'c'],
			['a', 'd'],
			['b', 'c'],
			['b', 'd'],
			['c', 'e'],
			['d', 'e']
		]);
		expect(
			scene?.connections
				?.slice(0, 4)
				.every((c) => c.style?.pattern === 'dotted')
		).toBe(true);
		expect(
			scene?.connections?.slice(4).every((c) => c.style?.strokeWidth === 4)
		).toBe(true);
		expect(
			scene?.elements?.filter((e) => e.text?.value === 'async')
		).toHaveLength(4);
	});

	test.each([
		['-- answer -->', 'solid', 'arrow'],
		['-- answer ---', 'solid', 'none'],
		['-- answer --', 'solid', 'none'],
		['-. answer .->', 'dotted', 'arrow'],
		['-. answer .-', 'dotted', 'none'],
		['== answer ==>', 'thick', 'arrow'],
		['== answer ==', 'thick', 'none']
	])('preserves inline label and direction: %s', (operator, style, end) => {
		const { scene } = convert(`graph TD\nA ${operator} B`);
		expect(scene?.connections?.[0]?.end).toBe(end);
		expect(
			scene?.elements?.find((e) => e.id === 'a-to-b-label')?.text?.value
		).toBe('answer');
		if (style === 'dotted')
			expect(scene?.connections?.[0]?.style?.pattern).toBe('dotted');
	});

	test.each([
		['[Rectangle]', 'rectangle'],
		['(Rounded)', 'polygon'],
		['([Stadium])', 'polygon'],
		['((Circle))', 'circle'],
		['{Diamond}', 'polygon'],
		['{{Hexagon}}', 'polygon'],
		['[/Input/]', 'polygon'],
		['[\\Output\\]', 'polygon'],
		['[/Trapezoid\\]', 'polygon'],
		['[\\Inverted/]', 'polygon']
	])('emits the supported shape %s', (shape, asset) => {
		const { scene } = convert(`graph TD; A${shape}`);
		expect(scene?.elements?.[0]?.asset).toBe(asset);
		if (shape === '(Rounded)')
			expect(scene?.elements?.[0]?.primitive?.polygon?.points).toHaveLength(20);
		if (shape === '([Stadium])')
			expect(
				scene?.elements?.[0]?.primitive?.polygon?.points?.every(
					(point) => point[1] >= 0.25 && point[1] <= 0.75
				)
			).toBe(true);
	});

	test('label identifiers and duplicate connection identifiers never overwrite other elements', () => {
		const { scene } = convert(
			'graph TD; A -->|first| B; A -->|second| B; a-to-b-label[Existing]'
		);
		const ids = scene?.elements?.map((e) => e.id) ?? [];
		expect(new Set(ids).size).toBe(ids.length);
		expect(scene?.elements?.find((e) => e.text?.value === 'first')?.id).toBe(
			'a-to-b-label-2'
		);
		expect(scene?.elements?.find((e) => e.text?.value === 'second')?.id).toBe(
			'a-to-b-2-label'
		);
	});

	test('repeated edges and self-loop labels get separate whole-cell positions', () => {
		const { scene } = convert('graph TD; A -->|one| A; A -->|two| A');
		const positions = scene?.elements
			?.filter((e) => ['one', 'two'].includes(e.text?.value ?? ''))
			.map((e) => e.at);
		expect(positions).toEqual([
			[1, 0],
			[2, 0]
		]);
	});

	test('reverse directions and disconnected cycles preserve every node and edge', () => {
		const { scene, result } = convert(
			'graph RL; A-->B-->C; C-->B; D-->E-->D; F'
		);
		expect(result.warnings).toHaveLength(2);
		expect(scene?.connections).toHaveLength(5);
		expect(scene?.elements?.filter((e) => e.asset !== 'text')).toHaveLength(6);
	});

	test('browser authoring emitter matches the validated CLI result', () => {
		const source =
			'flowchart RL; API[API] -.->|events| Queue([Queue]); Queue ==> Worker';
		expect(convertMermaidSource(source)).toEqual(convertMermaidToDsl(source));
	});

	test('converted graph compiles through the runtime contract', () => {
		const { document } = convert(
			'graph LR; API[API] -.->|event| Worker; Worker ==> Done((Done))'
		);
		const bundle = compileScene(document);
		expect(bundle).toBeDefined();
	});

	test.each([
		'subgraph S',
		'classDef red fill:red',
		'A[(Database)]',
		'A[[Subroutine]]',
		'A>Flag]',
		'A@{ shape: rect }',
		'A:::highlight',
		'A --o B',
		'A <--> B',
		'A["<b>HTML</b>"]',
		'A["`Markdown`"]',
		'A["#9829;"]',
		'%%{init: {}}%%'
	])('rejects unsupported semantics with the source line: %s', (statement) => {
		failure(`graph TD\nA\n${statement}`, 'MERMAID_UNSUPPORTED', 3);
	});
	test('malformed fanout and unclosed quote report source lines', () => {
		failure('graph TD\nA &', 'MERMAID_PARSE_ERROR', 2);
		failure('graph TD\nA["Unclosed]', 'MERMAID_PARSE_ERROR', 2);
	});
	test('node-label ID conflicts remain explicit', () => {
		expect(() => convertMermaidSource('graph TD; A; A-label')).toThrow(
			MermaidConversionError
		);
	});
});
