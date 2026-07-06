import { parseScene, validateScene } from '@sebastianwessel/isostate/dsl';

/**
 * Non-fatal conversion notice reported alongside the generated YAML. Codes
 * are documented in `specs/03-contracts/errors.md` ("Converter" section).
 */
export interface MermaidConversionWarning {
	/** Warning code (`MERMAID_LABEL_DROPPED` or `MERMAID_CYCLE_BROKEN`). */
	code: string;
	/** Human-readable description of what was dropped or changed. */
	message: string;
	/** 1-based source line the warning applies to. */
	line: number;
}

/** Result of converting a Mermaid flowchart source into an isostate scene. */
export interface MermaidConversionResult {
	/** Serialized `.isostate.yaml` document text. */
	yaml: string;
	/** Non-fatal conversion notices (see warning codes). */
	warnings: MermaidConversionWarning[];
}

/** Options accepted by {@link convertMermaidToDsl}. */
export interface MermaidConversionOptions {
	/**
	 * Basename used for `header.name` (id-normalized). Defaults to
	 * `mermaid-scene` when omitted, per the spec's string-conversion default.
	 */
	name?: string;
}

type MermaidDirection = 'TD' | 'LR';

type MermaidShape = 'rectangle' | 'circle' | 'polygon';

interface MermaidNode {
	/** Original Mermaid id, first-seen spelling. */
	mermaidId: string;
	/** Normalized DSL element id. */
	dslId: string;
	/** First-appearance order index (0-based). */
	order: number;
	shape?: MermaidShape;
	label?: string;
	/** Line number of the first bracketed definition, for error reporting. */
	definedAtLine?: number;
}

interface MermaidEdge {
	fromId: string;
	toId: string;
	/** `true` for `-->`, `false` for `---`. */
	directed: boolean;
	label?: string;
	line: number;
}

/**
 * A structured error thrown by the Mermaid converter. Matches the
 * `ParseError`-shaped contract described in
 * `specs/02-capabilities/dsl/mermaid2dsl.md`. When `details.line` is
 * present, it is appended to the displayed message so the CLI's generic
 * thrown-error formatter (which does not otherwise surface `details`)
 * still shows the offending line to the user.
 */
export class MermaidConversionError extends Error {
	constructor(
		/** Structured error code, e.g. `MERMAID_UNSUPPORTED`. */
		public readonly code: string,
		message: string,
		/** Additional structured context, e.g. `{ line: number }`. */
		public readonly details?: Record<string, unknown>
	) {
		super(
			typeof details?.line === 'number'
				? `${message} (line ${details.line})`
				: message
		);
		this.name = 'MermaidConversionError';
	}
}

const DEFAULT_SCENE_NAME = 'mermaid-scene';

const NODE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const SHAPE_COLOR_STYLE = {
	fill: 'var(--iso-node-fill, #dbeafe)',
	stroke: 'var(--iso-node-stroke, #2563eb)',
	strokeWidth: 1,
	opacity: 0.9
} as const;

/**
 * Converts Mermaid flowchart source text into a validated `.isostate.yaml`
 * scene document. Pure function: no filesystem access. Implements
 * `specs/02-capabilities/dsl/mermaid2dsl.md` exactly.
 */
export function convertMermaidToDsl(
	source: string,
	options: MermaidConversionOptions = {}
): MermaidConversionResult {
	const warnings: MermaidConversionWarning[] = [];
	const lines = splitLines(source);

	const direction = parseHeaderLine(lines);

	const nodes = new Map<string, MermaidNode>();
	const nodeOrder: string[] = [];
	const edges: MermaidEdge[] = [];

	for (const { text, line } of lines) {
		if (text.length === 0) continue;
		if (line === direction.headerLine) continue;

		parseStatementLine(text, line, nodes, nodeOrder, edges);
	}

	if (nodeOrder.length === 0) {
		throw new MermaidConversionError(
			'MERMAID_EMPTY',
			'Input declares no nodes'
		);
	}

	const dslIdByMermaidId = assignDslIds(nodes, nodeOrder);
	const labelDslIdByMermaidId = assignLabelDslIds(
		nodes,
		nodeOrder,
		dslIdByMermaidId
	);

	const { layerByMermaidId, brokenEdgeLines } = computeLayers(nodeOrder, edges);
	for (const line of brokenEdgeLines) {
		warnings.push({
			code: 'MERMAID_CYCLE_BROKEN',
			message: `Edge at line ${line} closes a cycle and was ignored for layout layering`,
			line
		});
	}

	const indexInLayer = computeIndexInLayer(nodeOrder, layerByMermaidId);

	const yaml = emitYaml({
		direction: direction.direction,
		name: normalizeSceneName(options.name),
		nodes,
		nodeOrder,
		edges,
		dslIdByMermaidId,
		labelDslIdByMermaidId,
		layerByMermaidId,
		indexInLayer,
		warnings
	});

	const document = parseScene(yaml);
	const report = validateScene(document);
	if (!report.isValid) {
		throw new MermaidConversionError(
			'MERMAID_INTERNAL',
			'Generated document failed DSL validation',
			{ issues: report.errors }
		);
	}

	return { yaml, warnings };
}

interface LineEntry {
	text: string;
	line: number;
}

function splitLines(source: string): LineEntry[] {
	const rawLines = source.split(/\r\n|\r|\n/);
	const entries: LineEntry[] = [];
	for (let index = 0; index < rawLines.length; index += 1) {
		const trimmed = rawLines[index].trim();
		const lineNumber = index + 1;
		if (trimmed.length === 0) continue;
		if (trimmed.startsWith('%%')) continue;
		entries.push({ text: trimmed, line: lineNumber });
	}
	return entries;
}

function parseHeaderLine(lines: LineEntry[]): {
	direction: MermaidDirection;
	headerLine: number;
} {
	const first = lines[0];
	if (!first) {
		throw new MermaidConversionError(
			'MERMAID_EMPTY',
			'Input declares no nodes'
		);
	}

	const match = first.text.match(/^(?:graph|flowchart)\s+(\S+)$/);
	if (!match) {
		throw new MermaidConversionError(
			'MERMAID_PARSE_ERROR',
			`Expected a "graph <DIR>" or "flowchart <DIR>" header, got: ${first.text}`,
			{ line: first.line }
		);
	}

	const dir = match[1];
	if (dir === 'TD' || dir === 'TB') {
		return { direction: 'TD', headerLine: first.line };
	}
	if (dir === 'LR') {
		return { direction: 'LR', headerLine: first.line };
	}
	if (dir === 'RL' || dir === 'BT') {
		throw new MermaidConversionError(
			'MERMAID_UNSUPPORTED',
			`Direction "${dir}" is not supported`,
			{ line: first.line }
		);
	}

	throw new MermaidConversionError(
		'MERMAID_PARSE_ERROR',
		`Unsupported direction "${dir}"`,
		{ line: first.line }
	);
}

/**
 * Matches a node reference at the start of a string:
 * `id`, `id[text]`, `id(text)`, `id((text))`, `id{text}`.
 * Returns the match and the remaining unconsumed string.
 *
 * Recognized-but-unsupported shape delimiters immediately following a node
 * id (`id[[text]]` subroutine, `id[(text)]` database, `id>text]` flag) throw
 * `MERMAID_UNSUPPORTED` here, where the tokenizer position unambiguously
 * identifies a node-shape marker rather than risking false positives from a
 * whole-line heuristic (e.g. an unrelated `-->` arrow later on the line).
 */
function matchNodeToken(
	text: string,
	line: number
):
	| { id: string; shape?: MermaidShape; label?: string; consumed: string }
	| undefined {
	const idMatch = text.match(/^[A-Za-z0-9_-]+/);
	if (!idMatch) return undefined;
	const id = idMatch[0];
	const rest = text.slice(id.length);

	if (rest.startsWith('[[') || rest.startsWith('[(') || rest.startsWith('>')) {
		throw new MermaidConversionError(
			'MERMAID_UNSUPPORTED',
			`Unsupported node shape for "${id}"`,
			{ line }
		);
	}

	// id((text)) -> circle
	const doubleParen = rest.match(/^\(\((.*?)\)\)/);
	if (doubleParen) {
		return {
			id,
			shape: 'circle',
			label: stripQuotes(doubleParen[1]),
			consumed: id + doubleParen[0]
		};
	}

	// id(text) -> circle
	const paren = rest.match(/^\((.*?)\)/);
	if (paren) {
		return {
			id,
			shape: 'circle',
			label: stripQuotes(paren[1]),
			consumed: id + paren[0]
		};
	}

	// id[text] -> rectangle
	const bracket = rest.match(/^\[(.*?)\]/);
	if (bracket) {
		return {
			id,
			shape: 'rectangle',
			label: stripQuotes(bracket[1]),
			consumed: id + bracket[0]
		};
	}

	// id{text} -> polygon (diamond)
	const brace = rest.match(/^\{(.*?)\}/);
	if (brace) {
		return {
			id,
			shape: 'polygon',
			label: stripQuotes(brace[1]),
			consumed: id + brace[0]
		};
	}

	return { id, consumed: id };
}

function stripQuotes(text: string): string {
	if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
		return text.slice(1, -1);
	}
	return text;
}

/**
 * Edge operator forms recognized between two node tokens, tried longest
 * first so that e.g. `-- text -->` is not mistaken for a bare `--`.
 */
const EDGE_OPERATORS: Array<{
	pattern: RegExp;
	directed: boolean;
}> = [
	{ pattern: /^-->\|([^|]*)\|/, directed: true },
	{ pattern: /^---\|([^|]*)\|/, directed: false },
	{ pattern: /^--\s+([^\n>-][^\n]*?)\s*-->/, directed: true },
	{ pattern: /^--\s+([^\n>-][^\n]*?)\s*---/, directed: false },
	{ pattern: /^-->/, directed: true },
	{ pattern: /^---/, directed: false }
];

function matchEdgeOperator(
	text: string
): { label?: string; directed: boolean; consumed: string } | undefined {
	for (const operator of EDGE_OPERATORS) {
		const match = text.match(operator.pattern);
		if (match) {
			return {
				directed: operator.directed,
				label:
					match[1] !== undefined ? stripQuotes(match[1].trim()) : undefined,
				consumed: match[0]
			};
		}
	}
	return undefined;
}

function parseStatementLine(
	text: string,
	line: number,
	nodes: Map<string, MermaidNode>,
	nodeOrder: string[],
	edges: MermaidEdge[]
): void {
	// Reject known unsupported constructs explicitly so they get a clear
	// MERMAID_UNSUPPORTED rather than falling through to MERMAID_PARSE_ERROR.
	if (isUnsupportedStatement(text)) {
		throw new MermaidConversionError(
			'MERMAID_UNSUPPORTED',
			`Unsupported statement: ${text}`,
			{ line }
		);
	}

	let cursor = text;
	const firstToken = matchNodeToken(cursor, line);
	if (!firstToken) {
		throw new MermaidConversionError(
			'MERMAID_PARSE_ERROR',
			`Unable to parse statement: ${text}`,
			{ line }
		);
	}
	if (!NODE_ID_PATTERN.test(firstToken.id)) {
		throw new MermaidConversionError(
			'MERMAID_PARSE_ERROR',
			`Invalid node id "${firstToken.id}"`,
			{ line }
		);
	}

	registerNode(firstToken, line, nodes, nodeOrder);
	cursor = cursor.slice(firstToken.consumed.length).trimStart();

	let previousId = firstToken.id;
	let sawEdge = false;

	while (cursor.length > 0) {
		const operator = matchEdgeOperator(cursor);
		if (!operator) {
			throw new MermaidConversionError(
				'MERMAID_PARSE_ERROR',
				`Unable to parse statement: ${text}`,
				{ line }
			);
		}
		sawEdge = true;
		cursor = cursor.slice(operator.consumed.length).trimStart();

		const nextToken = matchNodeToken(cursor, line);
		if (!nextToken) {
			throw new MermaidConversionError(
				'MERMAID_PARSE_ERROR',
				`Unable to parse statement: ${text}`,
				{ line }
			);
		}
		if (!NODE_ID_PATTERN.test(nextToken.id)) {
			throw new MermaidConversionError(
				'MERMAID_PARSE_ERROR',
				`Invalid node id "${nextToken.id}"`,
				{ line }
			);
		}

		registerNode(nextToken, line, nodes, nodeOrder);
		cursor = cursor.slice(nextToken.consumed.length).trimStart();

		edges.push({
			fromId: previousId,
			toId: nextToken.id,
			directed: operator.directed,
			label:
				operator.label && operator.label.length > 0
					? operator.label
					: undefined,
			line
		});

		previousId = nextToken.id;
	}

	if (!sawEdge && cursor.length > 0) {
		throw new MermaidConversionError(
			'MERMAID_PARSE_ERROR',
			`Unable to parse statement: ${text}`,
			{ line }
		);
	}
}

/** Multi-edge `&` fan-out, subgraphs, styling/meta statements, and other unsupported arrow/shape forms. */
function isUnsupportedStatement(text: string): boolean {
	if (/^subgraph\b/.test(text)) return true;
	if (/^end$/.test(text)) return true;
	if (/^classDef\b/.test(text)) return true;
	if (/^class\b/.test(text)) return true;
	if (/^style\b/.test(text)) return true;
	if (/^click\b/.test(text)) return true;
	if (/^linkStyle\b/.test(text)) return true;
	if (/^direction\b/.test(text)) return true;
	if (text.includes('&')) return true;
	if (/-\.-|-\.->|==>|===/.test(text)) return true;
	return false;
}

function registerNode(
	token: { id: string; shape?: MermaidShape; label?: string },
	line: number,
	nodes: Map<string, MermaidNode>,
	nodeOrder: string[]
): void {
	const existing = nodes.get(token.id);
	if (!existing) {
		nodes.set(token.id, {
			mermaidId: token.id,
			dslId: '',
			order: nodeOrder.length,
			shape: token.shape,
			label: token.label,
			definedAtLine: token.shape !== undefined ? line : undefined
		});
		nodeOrder.push(token.id);
		return;
	}

	if (token.shape === undefined) {
		// Bare reference; does not redefine an existing shape/label.
		return;
	}

	if (existing.shape === undefined) {
		existing.shape = token.shape;
		existing.label = token.label;
		existing.definedAtLine = line;
		return;
	}

	if (existing.shape !== token.shape || existing.label !== token.label) {
		throw new MermaidConversionError(
			'MERMAID_NODE_REDEFINED',
			`Node "${token.id}" is redefined with a different shape or label`,
			{ line }
		);
	}
}

/** Step 1-4 of Id Normalization. */
function normalizeMermaidId(mermaidId: string): string {
	let normalized = mermaidId.toLowerCase();
	normalized = normalized.replace(/[^a-z0-9]/g, '-');
	normalized = normalized.replace(/-+/g, '-');
	normalized = normalized.replace(/^-+|-+$/g, '');
	if (normalized.length === 0) {
		throw new MermaidConversionError(
			'MERMAID_PARSE_ERROR',
			`Node id "${mermaidId}" normalizes to an empty DSL id`
		);
	}
	if (/^[0-9]/.test(normalized)) {
		normalized = `n-${normalized}`;
	}
	return normalized;
}

function assignDslIds(
	nodes: Map<string, MermaidNode>,
	nodeOrder: string[]
): Map<string, string> {
	const dslIdByMermaidId = new Map<string, string>();
	const seenBy = new Map<string, string>();

	for (const mermaidId of nodeOrder) {
		const node = nodes.get(mermaidId);
		if (!node) continue;
		const dslId = normalizeMermaidId(mermaidId);
		node.dslId = dslId;
		dslIdByMermaidId.set(mermaidId, dslId);

		const priorMermaidId = seenBy.get(dslId);
		if (priorMermaidId !== undefined && priorMermaidId !== mermaidId) {
			throw new MermaidConversionError(
				'MERMAID_ID_COLLISION',
				`Mermaid ids "${priorMermaidId}" and "${mermaidId}" both normalize to "${dslId}"`
			);
		}
		seenBy.set(dslId, mermaidId);
	}

	return dslIdByMermaidId;
}

function assignLabelDslIds(
	nodes: Map<string, MermaidNode>,
	nodeOrder: string[],
	dslIdByMermaidId: Map<string, string>
): Map<string, string> {
	const labelDslIdByMermaidId = new Map<string, string>();
	const allDslIds = new Set(dslIdByMermaidId.values());

	for (const mermaidId of nodeOrder) {
		const node = nodes.get(mermaidId);
		if (!node || node.label === undefined) continue;
		const dslId = dslIdByMermaidId.get(mermaidId);
		if (dslId === undefined) continue;
		const labelDslId = `${dslId}-label`;

		if (allDslIds.has(labelDslId)) {
			const collidingMermaidId = [...dslIdByMermaidId.entries()].find(
				([, value]) => value === labelDslId
			)?.[0];
			throw new MermaidConversionError(
				'MERMAID_ID_COLLISION',
				`Label element id "${labelDslId}" for node "${mermaidId}" collides with normalized node id from "${collidingMermaidId}"`
			);
		}

		labelDslIdByMermaidId.set(mermaidId, labelDslId);
	}

	return labelDslIdByMermaidId;
}

/**
 * Builds the directed layering graph, breaks cycles via a first-appearance
 * DFS from in-degree-0 sources, and returns the longest-path layer for every
 * node plus the source line numbers of ignored (cycle-closing) edges.
 *
 * SPEC-GAP: the spec does not define a starting point when no in-degree-0
 * source node exists (e.g. an input entirely composed of a cycle with no
 * external entry point). This implementation falls back to starting the
 * layering DFS from the first node in document order in that case, which is
 * the natural degenerate case of "sources in first-appearance order" once
 * the source set is empty.
 */
function computeLayers(
	nodeOrder: string[],
	edges: MermaidEdge[]
): { layerByMermaidId: Map<string, number>; brokenEdgeLines: number[] } {
	const adjacency = new Map<string, Array<{ to: string; edgeIndex: number }>>();
	const inDegree = new Map<string, number>();
	for (const id of nodeOrder) {
		adjacency.set(id, []);
		inDegree.set(id, 0);
	}
	edges.forEach((edge, edgeIndex) => {
		adjacency.get(edge.fromId)?.push({ to: edge.toId, edgeIndex });
		inDegree.set(edge.toId, (inDegree.get(edge.toId) ?? 0) + 1);
	});

	const sources = nodeOrder.filter((id) => (inDegree.get(id) ?? 0) === 0);
	const dfsStarts = sources.length > 0 ? sources : nodeOrder.slice(0, 1);

	const brokenEdgeIndexes = new Set<number>();
	const visiting = new Set<string>();
	const visited = new Set<string>();

	function dfs(id: string): void {
		if (visited.has(id)) return;
		visiting.add(id);
		visited.add(id);
		for (const { to, edgeIndex } of adjacency.get(id) ?? []) {
			if (visiting.has(to)) {
				brokenEdgeIndexes.add(edgeIndex);
				continue;
			}
			if (!visited.has(to)) {
				dfs(to);
			}
		}
		visiting.delete(id);
	}

	for (const start of dfsStarts) {
		dfs(start);
	}
	// Any remaining unvisited nodes (disconnected components with no
	// in-degree-0 entry point of their own) still need a deterministic start.
	for (const id of nodeOrder) {
		if (!visited.has(id)) dfs(id);
	}

	const dagAdjacency = new Map<string, string[]>();
	for (const id of nodeOrder) dagAdjacency.set(id, []);
	edges.forEach((edge, edgeIndex) => {
		if (brokenEdgeIndexes.has(edgeIndex)) return;
		dagAdjacency.get(edge.fromId)?.push(edge.toId);
	});

	const layerByMermaidId = new Map<string, number>();
	const memoState = new Map<string, 'computing' | 'done'>();

	function longestPathLayer(id: string): number {
		const cached = layerByMermaidId.get(id);
		if (cached !== undefined) return cached;
		memoState.set(id, 'computing');
		let maxIncoming = -1;
		for (const otherId of nodeOrder) {
			for (const target of dagAdjacency.get(otherId) ?? []) {
				if (target !== id) continue;
				const otherLayer =
					memoState.get(otherId) === 'computing'
						? 0
						: longestPathLayer(otherId);
				if (otherLayer + 1 > maxIncoming) maxIncoming = otherLayer + 1;
			}
		}
		const layer = maxIncoming < 0 ? 0 : maxIncoming;
		layerByMermaidId.set(id, layer);
		memoState.set(id, 'done');
		return layer;
	}

	for (const id of nodeOrder) {
		longestPathLayer(id);
	}

	const brokenEdgeLines = edges
		.filter((_, index) => brokenEdgeIndexes.has(index))
		.map((edge) => edge.line);

	return { layerByMermaidId, brokenEdgeLines };
}

function computeIndexInLayer(
	nodeOrder: string[],
	layerByMermaidId: Map<string, number>
): Map<string, number> {
	const counters = new Map<number, number>();
	const indexInLayer = new Map<string, number>();
	for (const id of nodeOrder) {
		const layer = layerByMermaidId.get(id) ?? 0;
		const index = counters.get(layer) ?? 0;
		indexInLayer.set(id, index);
		counters.set(layer, index + 1);
	}
	return indexInLayer;
}

function normalizeSceneName(name: string | undefined): string {
	if (name === undefined) return DEFAULT_SCENE_NAME;
	return normalizeMermaidId(name);
}

interface EmitContext {
	direction: MermaidDirection;
	name: string;
	nodes: Map<string, MermaidNode>;
	nodeOrder: string[];
	edges: MermaidEdge[];
	dslIdByMermaidId: Map<string, string>;
	labelDslIdByMermaidId: Map<string, string>;
	layerByMermaidId: Map<string, number>;
	indexInLayer: Map<string, number>;
	warnings: MermaidConversionWarning[];
}

function emitYaml(context: EmitContext): string {
	const lines: string[] = [];
	lines.push('header:');
	lines.push(`  name: ${yamlScalar(context.name)}`);
	lines.push('  assets: []');
	lines.push('  layers:');
	lines.push('    - name: ground');
	lines.push('    - name: nodes');
	lines.push('    - name: labels');
	lines.push('scenes:');
	lines.push('  - id: initial');
	lines.push('    elements:');

	for (const mermaidId of context.nodeOrder) {
		const node = context.nodes.get(mermaidId);
		if (!node) continue;
		const dslId = context.dslIdByMermaidId.get(mermaidId) as string;
		const shape = node.shape ?? 'rectangle';
		const layer = context.layerByMermaidId.get(mermaidId) ?? 0;
		const index = context.indexInLayer.get(mermaidId) ?? 0;
		const at = gridPosition(context.direction, layer, index);

		lines.push(`      - id: ${dslId}`);
		lines.push(`        asset: ${shape}`);
		lines.push(`        at: ${flowTuple(at)}`);
		lines.push('        layer: nodes');
		lines.push(...emitPrimitive(shape));

		if (node.label !== undefined) {
			const labelDslId = context.labelDslIdByMermaidId.get(mermaidId) as string;
			lines.push(`      - id: ${labelDslId}`);
			lines.push('        asset: text');
			lines.push(`        at: ${flowTuple(at)}`);
			lines.push('        layer: labels');
			lines.push('        text:');
			lines.push(`          value: ${yamlScalar(node.label)}`);
			lines.push('          align: middle');
			lines.push('          placement: caption');
		}
	}

	const connectionLines = emitConnections(context);
	if (connectionLines.length === 0) {
		lines.push('    connections: []');
	} else {
		lines.push('    connections:');
		lines.push(...connectionLines);
	}

	return `${lines.join('\n')}\n`;
}

function emitPrimitive(shape: MermaidShape): string[] {
	const lines: string[] = [];
	lines.push('        primitive:');
	if (shape === 'rectangle') {
		lines.push('          rectangle:');
		lines.push(...emitShapeStyle());
	} else if (shape === 'circle') {
		lines.push('          circle:');
		lines.push(...emitShapeStyle());
	} else {
		lines.push('          polygon:');
		lines.push('            points: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]');
		lines.push(...emitShapeStyle());
	}
	return lines;
}

function emitShapeStyle(): string[] {
	return [
		`            fill: ${yamlScalar(SHAPE_COLOR_STYLE.fill)}`,
		`            stroke: ${yamlScalar(SHAPE_COLOR_STYLE.stroke)}`,
		`            strokeWidth: ${SHAPE_COLOR_STYLE.strokeWidth}`,
		`            opacity: ${SHAPE_COLOR_STYLE.opacity}`
	];
}

function emitConnections(context: EmitContext): string[] {
	const lines: string[] = [];
	const usedConnectionIds = new Map<string, number>();

	for (const edge of context.edges) {
		const fromDslId = context.dslIdByMermaidId.get(edge.fromId);
		const toDslId = context.dslIdByMermaidId.get(edge.toId);
		if (fromDslId === undefined || toDslId === undefined) continue;

		if (edge.label !== undefined) {
			context.warnings.push({
				code: 'MERMAID_LABEL_DROPPED',
				message: `Edge label "${edge.label}" was dropped; the DSL has no connection labels`,
				line: edge.line
			});
		}

		const baseId = `${fromDslId}-to-${toDslId}`;
		const count = usedConnectionIds.get(baseId) ?? 0;
		usedConnectionIds.set(baseId, count + 1);
		const connectionId = count === 0 ? baseId : `${baseId}-${count + 1}`;

		lines.push(`      - id: ${connectionId}`);
		lines.push('        from:');
		lines.push(`          element: ${fromDslId}`);
		lines.push('        to:');
		lines.push(`          element: ${toDslId}`);
		lines.push('        layer: ground');
		lines.push(`        end: ${edge.directed ? 'arrow' : 'none'}`);
	}

	return lines;
}

function gridPosition(
	direction: MermaidDirection,
	layer: number,
	indexInLayer: number
): [number, number] {
	if (direction === 'LR') {
		return [layer * 2, indexInLayer * 2];
	}
	return [indexInLayer * 2, layer * 2];
}

function flowTuple(values: readonly number[]): string {
	return `[${values.join(', ')}]`;
}

/** Emits a YAML scalar, double-quoting only when YAML requires quoting. */
function yamlScalar(value: string): string {
	if (requiresQuoting(value)) {
		return JSON.stringify(value);
	}
	return value;
}

function requiresQuoting(value: string): boolean {
	if (value.length === 0) return true;
	if (/^[\s]|[\s]$/.test(value)) return true;
	if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(value)) return true;
	if (/[:#]/.test(value)) return true;
	if (/^(true|false|null|~|yes|no|on|off)$/i.test(value)) return true;
	if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value)) return true;
	if (/^[+-]?\d+$/.test(value)) return true;
	return false;
}
