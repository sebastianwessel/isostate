import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseScene, validateScene } from '@sebastianwessel/isostate/dsl';
import {
	convertMermaidToDsl,
	MermaidConversionError
} from '../../packages/cli/src/mermaid2dsl';

const cli = [process.execPath, 'packages/cli/src/bin.ts'];
const tempDirs: string[] = [];

const HAPPY_PATH_SOURCE = `graph TD
Start[Begin Here] --> Process(Do Work) --> Decision{Ready?}
Decision --> Done
Done --- Skip
`;

const EXPECTED_HAPPY_PATH_YAML = `header:
  name: demo
  assets: []
  layers:
    - name: ground
    - name: nodes
    - name: labels
scenes:
  - id: initial
    elements:
      - id: start
        asset: rectangle
        at: [0, 0]
        layer: nodes
        primitive:
          rectangle:
            fill: "var(--iso-node-fill, #dbeafe)"
            stroke: "var(--iso-node-stroke, #2563eb)"
            strokeWidth: 1
            opacity: 0.9
      - id: start-label
        asset: text
        at: [0, 0]
        layer: labels
        text:
          value: Begin Here
          align: middle
          placement: caption
      - id: process
        asset: circle
        at: [0, 2]
        layer: nodes
        primitive:
          circle:
            fill: "var(--iso-node-fill, #dbeafe)"
            stroke: "var(--iso-node-stroke, #2563eb)"
            strokeWidth: 1
            opacity: 0.9
      - id: process-label
        asset: text
        at: [0, 2]
        layer: labels
        text:
          value: Do Work
          align: middle
          placement: caption
      - id: decision
        asset: polygon
        at: [0, 4]
        layer: nodes
        primitive:
          polygon:
            points: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]
            fill: "var(--iso-node-fill, #dbeafe)"
            stroke: "var(--iso-node-stroke, #2563eb)"
            strokeWidth: 1
            opacity: 0.9
      - id: decision-label
        asset: text
        at: [0, 4]
        layer: labels
        text:
          value: Ready?
          align: middle
          placement: caption
      - id: done
        asset: rectangle
        at: [0, 6]
        layer: nodes
        primitive:
          rectangle:
            fill: "var(--iso-node-fill, #dbeafe)"
            stroke: "var(--iso-node-stroke, #2563eb)"
            strokeWidth: 1
            opacity: 0.9
      - id: skip
        asset: rectangle
        at: [0, 8]
        layer: nodes
        primitive:
          rectangle:
            fill: "var(--iso-node-fill, #dbeafe)"
            stroke: "var(--iso-node-stroke, #2563eb)"
            strokeWidth: 1
            opacity: 0.9
    connections:
      - id: start-to-process
        from:
          element: start
        to:
          element: process
        layer: ground
        end: arrow
      - id: process-to-decision
        from:
          element: process
        to:
          element: decision
        layer: ground
        end: arrow
      - id: decision-to-done
        from:
          element: decision
        to:
          element: done
        layer: ground
        end: arrow
      - id: done-to-skip
        from:
          element: done
        to:
          element: skip
        layer: ground
        end: none
`;

describe('convertMermaidToDsl', () => {
	test('happy path: three shapes, labeled and unlabeled nodes, chained edges, undirected edge', () => {
		const result = convertMermaidToDsl(HAPPY_PATH_SOURCE, { name: 'demo' });

		expect(result.yaml).toBe(EXPECTED_HAPPY_PATH_YAML);
		expect(result.warnings).toEqual([]);

		const document = parseScene(result.yaml);
		const report = validateScene(document);
		expect(report.errors).toEqual([]);
		expect(report.isValid).toBe(true);
	});

	test('is deterministic: identical input yields byte-identical YAML', () => {
		const first = convertMermaidToDsl(HAPPY_PATH_SOURCE, { name: 'demo' });
		const second = convertMermaidToDsl(HAPPY_PATH_SOURCE, { name: 'demo' });

		expect(first.yaml).toBe(second.yaml);
	});

	test('LR direction transposes coordinates', () => {
		const source = `graph LR
A[One] --> B(Two)
B --> C{Three}
`;
		const result = convertMermaidToDsl(source, { name: 'lr-demo' });
		const document = parseScene(result.yaml);
		const report = validateScene(document);
		expect(report.isValid).toBe(true);

		const at = (id: string) =>
			document.scenes[0]?.elements?.find((element) => element.id === id)?.at;

		expect(at('a')).toEqual([0, 0]);
		expect(at('b')).toEqual([2, 0]);
		expect(at('c')).toEqual([4, 0]);
	});

	test('id normalization: underscores and mixed case become kebab-case', () => {
		const result = convertMermaidToDsl(
			`graph TD\nWeb_Server[Server] --> Other\n`
		);
		const document = parseScene(result.yaml);
		const ids = document.scenes[0]?.elements?.map((element) => element.id);
		expect(ids).toContain('web-server');
		expect(ids).toContain('web-server-label');
	});

	test('id normalization: a normalized id starting with a digit is prefixed with n-', () => {
		const result = convertMermaidToDsl(`graph TD\n2tier[Tier] --> Other\n`);
		const document = parseScene(result.yaml);
		const ids = document.scenes[0]?.elements?.map((element) => element.id);
		expect(ids).toContain('n-2tier');
	});

	test('id normalization collision throws MERMAID_ID_COLLISION', () => {
		expect(() =>
			convertMermaidToDsl(`graph TD\nA-B[X] --> C\nA_B[Y] --> C\n`)
		).toThrow(MermaidConversionError);

		try {
			convertMermaidToDsl(`graph TD\nA-B[X] --> C\nA_B[Y] --> C\n`);
			throw new Error('expected convertMermaidToDsl to throw');
		} catch (error) {
			expect(error).toBeInstanceOf(MermaidConversionError);
			expect((error as MermaidConversionError).code).toBe(
				'MERMAID_ID_COLLISION'
			);
		}
	});

	test('node redefinition with a different shape or label throws MERMAID_NODE_REDEFINED', () => {
		try {
			convertMermaidToDsl(`graph TD\nA[One] --> B\nA(Two) --> C\n`);
			throw new Error('expected convertMermaidToDsl to throw');
		} catch (error) {
			expect(error).toBeInstanceOf(MermaidConversionError);
			expect((error as MermaidConversionError).code).toBe(
				'MERMAID_NODE_REDEFINED'
			);
			expect((error as MermaidConversionError).details?.line).toBe(3);
		}
	});

	test('unsupported statement throws MERMAID_UNSUPPORTED with the 1-based line number', () => {
		try {
			convertMermaidToDsl(`graph TD\nsubgraph S\nA --> B\nend\n`);
			throw new Error('expected convertMermaidToDsl to throw');
		} catch (error) {
			expect(error).toBeInstanceOf(MermaidConversionError);
			expect((error as MermaidConversionError).code).toBe(
				'MERMAID_UNSUPPORTED'
			);
			expect((error as MermaidConversionError).details?.line).toBe(2);
		}
	});

	test('empty input (zero nodes) throws MERMAID_EMPTY', () => {
		try {
			convertMermaidToDsl('graph TD\n');
			throw new Error('expected convertMermaidToDsl to throw');
		} catch (error) {
			expect(error).toBeInstanceOf(MermaidConversionError);
			expect((error as MermaidConversionError).code).toBe('MERMAID_EMPTY');
		}
	});

	test('a cycle produces MERMAID_CYCLE_BROKEN and still lays out all nodes', () => {
		const result = convertMermaidToDsl(`graph TD\nA --> B\nB --> C\nC --> A\n`);

		expect(result.warnings).toEqual([
			{
				code: 'MERMAID_CYCLE_BROKEN',
				message:
					'Edge at line 4 closes a cycle and was ignored for layout layering',
				line: 4
			}
		]);

		const document = parseScene(result.yaml);
		const report = validateScene(document);
		expect(report.isValid).toBe(true);
		expect(document.scenes[0]?.elements?.map((element) => element.id)).toEqual([
			'a',
			'b',
			'c'
		]);
		expect(document.scenes[0]?.connections?.length).toBe(3);
	});

	test('an edge label produces MERMAID_LABEL_DROPPED and the connection carries no label', () => {
		const result = convertMermaidToDsl(`graph TD\nA -->|yes| B\n`);

		expect(result.warnings).toEqual([
			{
				code: 'MERMAID_LABEL_DROPPED',
				message:
					'Edge label "yes" was dropped; the DSL has no connection labels',
				line: 2
			}
		]);

		const document = parseScene(result.yaml);
		const report = validateScene(document);
		expect(report.isValid).toBe(true);
	});

	test('an edge label on an undirected `-- text ---` edge also warns', () => {
		const result = convertMermaidToDsl(`graph TD\nA -- plain --- B\n`);
		expect(result.warnings).toEqual([
			{
				code: 'MERMAID_LABEL_DROPPED',
				message:
					'Edge label "plain" was dropped; the DSL has no connection labels',
				line: 2
			}
		]);
	});

	test('duplicate connection ids get -2, -3, ... suffixes in document order', () => {
		const result = convertMermaidToDsl(`graph TD\nA --> B\nA --> B\nA --> B\n`);
		const document = parseScene(result.yaml);
		expect(
			document.scenes[0]?.connections?.map((connection) => connection.id)
		).toEqual(['a-to-b', 'a-to-b-2', 'a-to-b-3']);
	});

	test('defaults header.name to mermaid-scene when no name option is given', () => {
		const result = convertMermaidToDsl(`graph TD\nA --> B\n`);
		const document = parseScene(result.yaml);
		expect(document.header.name).toBe('mermaid-scene');
	});
});

describe('isostate mermaid2dsl', () => {
	afterEach(async () => {
		await Promise.all(
			tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
		);
	});

	test('writes the output file at the default derived path', async () => {
		const dir = await makeTempDir();
		const input = join(dir, 'flow.mmd');
		await writeFile(input, HAPPY_PATH_SOURCE, 'utf8');

		const result = await runCli(['mermaid2dsl', input]);

		expect(result.exitCode).toBe(0);
		const expectedOut = join(dir, 'flow.isostate.yaml');
		expect(result.stdout).toContain(`WROTE ${expectedOut}`);
		expect(existsSync(expectedOut)).toBe(true);
		const written = await readFile(expectedOut, 'utf8');
		expect(written).toContain('header:');
	});

	test('honors --out', async () => {
		const dir = await makeTempDir();
		const input = join(dir, 'flow.mmd');
		const out = join(dir, 'scenes', 'custom.isostate.yaml');
		await writeFile(input, HAPPY_PATH_SOURCE, 'utf8');

		const result = await runCli(['mermaid2dsl', input, '--out', out]);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain(`WROTE ${out}`);
		expect(existsSync(out)).toBe(true);
	});

	test('exits 1 with MERMAID_UNSUPPORTED on a subgraph input', async () => {
		const dir = await makeTempDir();
		const input = join(dir, 'flow.mmd');
		await writeFile(input, `graph TD\nsubgraph S\nA --> B\nend\n`, 'utf8');

		const result = await runCli(['mermaid2dsl', input]);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('ERROR MERMAID_UNSUPPORTED');
		expect(existsSync(join(dir, 'flow.isostate.yaml'))).toBe(false);
	});

	test('prints warnings using the standard WARN <code> ... format and still exits 0', async () => {
		const dir = await makeTempDir();
		const input = join(dir, 'flow.mmd');
		await writeFile(input, `graph TD\nA -->|yes| B\n`, 'utf8');

		const result = await runCli(['mermaid2dsl', input]);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toContain('WARN MERMAID_LABEL_DROPPED');
	});
});

async function makeTempDir(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), 'isostate-cli-'));
	tempDirs.push(dir);
	return dir;
}

async function runCli(args: string[]) {
	const proc = Bun.spawn([...cli, ...args], {
		cwd: process.cwd(),
		stdout: 'pipe',
		stderr: 'pipe'
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited
	]);

	return { stdout, stderr, exitCode };
}
