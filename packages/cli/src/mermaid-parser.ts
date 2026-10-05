import {
	MermaidConversionError,
	type MermaidDirection,
	type MermaidEdge,
	type MermaidNode,
	type MermaidShape
} from './mermaid-types.js';

interface Statement {
	text: string;
	line: number;
}
interface NodeToken {
	id: string;
	shape?: MermaidShape;
	label?: string;
	length: number;
}

/** Splits source statements without treating quoted labels as Mermaid syntax. */
function statements(source: string): Statement[] {
	source = source.replace(/\r\n?/g, '\n');
	const result: Statement[] = [];
	let text = '';
	let line = 1;
	let startLine = 1;
	let quoted = false;
	let depth = 0;
	let pipe = false;
	const flush = () => {
		if (text.trim()) result.push({ text: text.trim(), line: startLine });
		text = '';
	};
	for (let i = 0; i < source.length; i++) {
		const char = source[i];
		if (!text.trim() && !/\s/.test(char)) startLine = line;
		if (!quoted && !depth && !pipe && source.startsWith('%%', i)) {
			i = skipComment(source, i, line);
			flush();
			line++;
			continue;
		}
		if (char === '"' && !escaped(source, i)) quoted = !quoted;
		if (!quoted) {
			if ('[({'.includes(char)) depth++;
			if ('])}'.includes(char)) depth = Math.max(0, depth - 1);
			if (!depth && char === '|') pipe = !pipe;
			if (!depth && !pipe && (char === ';' || char === '\n' || char === '\r')) {
				flush();
				if (char === '\n') line++;
				continue;
			}
		}
		text += char;
		if (char === '\n') line++;
	}
	if (quoted || depth !== 0 || pipe)
		fail('MERMAID_PARSE_ERROR', 'Unclosed label or node shape', startLine);
	flush();
	return result;
}

function skipComment(source: string, index: number, line: number): number {
	if (source.startsWith('%%{', index))
		fail('MERMAID_UNSUPPORTED', 'Mermaid directives are not supported', line);
	while (index < source.length && source[index] !== '\n') index++;
	return index;
}

function escaped(text: string, index: number): boolean {
	let count = 0;
	for (let i = index - 1; i >= 0 && text[i] === '\\'; i--) count++;
	return count % 2 === 1;
}

function fail(code: string, message: string, line: number): never {
	throw new MermaidConversionError(code, message, { line });
}

function labelText(value: string, line: number): string {
	let text = value.trim();
	if (text.startsWith('"') && text.endsWith('"'))
		text = text.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
	if (text.includes('`') || /<[^>]+>|#(?:\d+|[A-Za-z]+);/.test(text))
		fail(
			'MERMAID_UNSUPPORTED',
			'Markdown, HTML, and entity labels are not supported; use plain text',
			line
		);
	return text;
}

const SHAPES: Array<[string, string, MermaidShape]> = [
	['((', '))', 'circle'],
	['([', '])', 'stadium'],
	['{{', '}}', 'hexagon'],
	['[/', '/]', 'lean-right'],
	['[\\', '\\]', 'lean-left'],
	['[/', '\\]', 'trapezoid'],
	['[\\', '/]', 'trapezoid-alt'],
	['[', ']', 'rectangle'],
	['(', ')', 'rounded'],
	['{', '}', 'polygon']
];

function closingIndex(text: string, closing: string, start: number): number {
	let quoted = false;
	for (let i = start; i < text.length; i++) {
		if (text[i] === '"' && !escaped(text, i)) quoted = !quoted;
		if (!quoted && text.startsWith(closing, i)) return i;
	}
	return -1;
}

function shapeCandidates(text: string) {
	return SHAPES.filter(([opening]) => text.startsWith(opening))
		.map(([opening, closing, shape]) => ({
			opening,
			closing,
			shape,
			end: closingIndex(text, closing, opening.length)
		}))
		.filter((candidate) => candidate.end >= 0)
		.sort((a, b) => b.opening.length - a.opening.length || a.end - b.end);
}

function nodeToken(text: string, line: number): NodeToken {
	// Stop before a compact edge such as A-->B while allowing kebab-case IDs.
	const id = text.match(/^[A-Za-z0-9_](?:[A-Za-z0-9_]|-(?![-.>]))*/)?.[0];
	if (!id)
		return fail('MERMAID_PARSE_ERROR', `Expected a node, got: ${text}`, line);
	const rest = text.slice(id.length);
	if (/^(\[\[|\[\(|\(\(\(|>|@|:::)/.test(rest))
		fail(
			'MERMAID_UNSUPPORTED',
			`Unsupported node shape or annotation for "${id}"`,
			line
		);
	for (const { opening, closing, shape, end } of shapeCandidates(rest)) {
		const label = rest.slice(opening.length, end);
		if (/[[\]{}()]/.test(label.replace(/"(?:\\.|[^"\\])*"/g, '')))
			fail(
				'MERMAID_UNSUPPORTED',
				'Quote labels containing shape delimiters',
				line
			);
		return {
			id,
			shape,
			label: labelText(label, line),
			length: id.length + end + closing.length
		};
	}
	if (/^[[({]/.test(rest))
		fail('MERMAID_PARSE_ERROR', `Unclosed shape for "${id}"`, line);
	return { id, length: id.length };
}

interface Operator {
	directed: boolean;
	style: MermaidEdge['style'];
	label?: string;
	length: number;
}
const SIMPLE_EDGES: Array<[string, boolean, MermaidEdge['style']]> = [
	['-.->', true, 'dotted'],
	['-.-', false, 'dotted'],
	['-->', true, 'solid'],
	['---', false, 'solid'],
	['==>', true, 'thick'],
	['===', false, 'thick']
];

function edgeOperator(text: string, line: number): Operator {
	for (const [token, directed, style] of SIMPLE_EDGES) {
		if (!text.startsWith(token)) continue;
		let length = token.length;
		let label: string | undefined;
		if (text[length] === '|') {
			const end = closingIndex(text, '|', length + 1);
			if (end < 0) fail('MERMAID_PARSE_ERROR', 'Unclosed edge label', line);
			label = labelText(text.slice(length + 1, end), line);
			length = end + 1;
		}
		if (!directed && (text[length] === 'o' || text[length] === 'x'))
			fail(
				'MERMAID_UNSUPPORTED',
				'Circle and cross arrowheads are not supported',
				line
			);
		return { directed, style, label, length };
	}
	return inlineEdgeOperator(text, line);
}

function inlineEdgeOperator(text: string, line: number): Operator {
	for (const [opening, closings, style] of [
		['--', ['-->', '---', '--'], 'solid'],
		['-.', ['.->', '.-'], 'dotted'],
		['==', ['==>', '===', '=='], 'thick']
	] as const) {
		if (!text.startsWith(`${opening} `)) continue;
		const candidates = closings
			.map((closing) => ({
				closing,
				end: closingIndex(text, closing, opening.length)
			}))
			.filter((candidate) => candidate.end >= 0)
			.sort((a, b) => a.end - b.end);
		for (const { closing, end } of candidates) {
			return {
				directed: closing.endsWith('>'),
				style,
				label: labelText(text.slice(opening.length, end), line),
				length: end + closing.length
			};
		}
	}
	return fail(
		'MERMAID_UNSUPPORTED',
		`Unsupported edge or statement: ${text}`,
		line
	);
}

function register(
	token: NodeToken,
	line: number,
	nodes: Map<string, MermaidNode>,
	order: string[]
): void {
	const previous = nodes.get(token.id);
	if (!previous) {
		nodes.set(token.id, {
			mermaidId: token.id,
			dslId: '',
			order: order.length,
			shape: token.shape,
			label: token.label,
			definedAtLine: token.shape ? line : undefined
		});
		order.push(token.id);
		return;
	}
	if (!token.shape) return;
	if (
		previous.shape &&
		(previous.shape !== token.shape || previous.label !== token.label)
	)
		fail(
			'MERMAID_NODE_REDEFINED',
			`Node "${token.id}" is redefined with a different shape or label`,
			line
		);
	previous.shape = token.shape;
	previous.label = token.label;
	previous.definedAtLine = line;
}

function parseStatement(
	statement: Statement,
	nodes: Map<string, MermaidNode>,
	nodeOrder: string[],
	edges: MermaidEdge[]
): void {
	const { text, line } = statement;
	if (
		/^(subgraph|end|classDef|class|style|click|linkStyle|direction|accTitle|accDescr)\b/.test(
			text
		)
	)
		fail('MERMAID_UNSUPPORTED', `Unsupported statement: ${text}`, line);
	let cursor = text;
	const group = (): string[] => {
		const ids: string[] = [];
		do {
			const token = nodeToken(cursor, line);
			register(token, line, nodes, nodeOrder);
			ids.push(token.id);
			cursor = cursor.slice(token.length).trimStart();
			if (!cursor.startsWith('&')) break;
			cursor = cursor.slice(1).trimStart();
		} while (cursor.length > 0);
		if (!cursor && text.trimEnd().endsWith('&'))
			fail('MERMAID_PARSE_ERROR', 'Expected a node after &', line);
		return ids;
	};
	let from = group();
	while (cursor) {
		const operator = edgeOperator(cursor, line);
		cursor = cursor.slice(operator.length).trimStart();
		const to = group();
		for (const fromId of from)
			for (const toId of to)
				edges.push({
					fromId,
					toId,
					directed: operator.directed,
					style: operator.style,
					label: operator.label,
					line
				});
		from = to;
	}
}

/** Parses the explicitly supported Mermaid flowchart subset. */
export function parseMermaid(source: string): {
	direction: MermaidDirection;
	nodes: Map<string, MermaidNode>;
	nodeOrder: string[];
	edges: MermaidEdge[];
} {
	const entries = statements(source);
	const header = entries.shift();
	if (!header)
		throw new MermaidConversionError(
			'MERMAID_EMPTY',
			'Input declares no nodes'
		);
	const match = header.text.match(/^(?:graph|flowchart)\s+(TD|TB|LR|RL|BT)$/);
	if (!match)
		fail(
			'MERMAID_PARSE_ERROR',
			'Expected a graph or flowchart header with TD, TB, LR, RL, or BT direction',
			header.line
		);
	const direction = (match[1] === 'TB' ? 'TD' : match[1]) as MermaidDirection;
	const nodes = new Map<string, MermaidNode>();
	const nodeOrder: string[] = [];
	const edges: MermaidEdge[] = [];
	for (const statement of entries)
		parseStatement(statement, nodes, nodeOrder, edges);
	if (!nodeOrder.length)
		throw new MermaidConversionError(
			'MERMAID_EMPTY',
			'Input declares no nodes'
		);
	return { direction, nodes, nodeOrder, edges };
}
