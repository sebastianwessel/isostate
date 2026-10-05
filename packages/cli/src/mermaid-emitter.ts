import type {
	MermaidDirection,
	MermaidEdge,
	MermaidNode,
	MermaidShape
} from './mermaid-types.js';

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
}

const POLYGONS: Partial<Record<MermaidShape, number[][]>> = {
	polygon: [
		[0.5, 0],
		[1, 0.5],
		[0.5, 1],
		[0, 0.5]
	],
	hexagon: [
		[0.25, 0],
		[0.75, 0],
		[1, 0.5],
		[0.75, 1],
		[0.25, 1],
		[0, 0.5]
	],
	'lean-right': [
		[0.25, 0],
		[1, 0],
		[0.75, 1],
		[0, 1]
	],
	'lean-left': [
		[0, 0],
		[0.75, 0],
		[1, 1],
		[0.25, 1]
	],
	trapezoid: [
		[0.25, 0],
		[0.75, 0],
		[1, 1],
		[0, 1]
	],
	'trapezoid-alt': [
		[0, 0],
		[1, 0],
		[0.75, 1],
		[0.25, 1]
	]
};

function scalar(value: string): string {
	// A deliberately small plain-string set avoids YAML booleans, numbers,
	// exponents, nulls, flow delimiters and embedded line breaks changing types.
	if (
		/^[a-zA-Z_][a-zA-Z0-9_ .?/-]*$/.test(value) &&
		value.trim() === value &&
		!/^(true|false|null|yes|no|on|off)$/i.test(value)
	)
		return value;
	return JSON.stringify(value);
}
function tuple(values: number[]): string {
	return `[${values.join(', ')}]`;
}

function position(context: EmitContext, id: string): [number, number] {
	const maxLayer = Math.max(...context.layerByMermaidId.values());
	let layer = context.layerByMermaidId.get(id) ?? 0;
	const index = context.indexInLayer.get(id) ?? 0;
	if (context.direction === 'RL' || context.direction === 'BT')
		layer = maxLayer - layer;
	return context.direction === 'LR' || context.direction === 'RL'
		? [layer * 4, index * 4]
		: [index * 4, layer * 4];
}

function roundedPoints(stadium: boolean): number[][] {
	const radius = stadium ? 0.25 : 0.15;
	const top = stadium ? 0.25 : 0;
	const bottom = stadium ? 0.75 : 1;
	const corners = [
		[1 - radius, top + radius],
		[1 - radius, bottom - radius],
		[radius, bottom - radius],
		[radius, top + radius]
	];
	return corners.flatMap(([x, y], corner) =>
		Array.from({ length: 5 }, (_, step) => {
			const angle = ((corner * 90 - 90 + step * 22.5) * Math.PI) / 180;
			return [
				Number((x + radius * Math.cos(angle)).toFixed(6)),
				Number((y + radius * Math.sin(angle)).toFixed(6))
			];
		})
	);
}

function primitive(shape: MermaidShape): { asset: string; lines: string[] } {
	const points =
		shape === 'rounded' || shape === 'stadium'
			? roundedPoints(shape === 'stadium')
			: POLYGONS[shape];
	const asset = points
		? 'polygon'
		: shape === 'circle'
			? 'circle'
			: 'rectangle';
	const lines = ['        primitive:', `          ${asset}:`];
	if (points)
		lines.push(`            points: [${points.map(tuple).join(', ')}]`);
	lines.push(
		'            fill: "var(--iso-node-fill, #dbeafe)"',
		'            stroke: "var(--iso-node-stroke, #2563eb)"',
		'            strokeWidth: 1',
		'            opacity: 0.9'
	);
	return { asset, lines };
}

function textElement(id: string, value: string, at: number[]): string[] {
	return [
		`      - id: ${scalar(id)}`,
		'        asset: text',
		`        at: ${tuple(at)}`,
		'        layer: labels',
		'        text:',
		`          value: ${scalar(value)}`,
		'          align: middle',
		'          placement: caption'
	];
}

function uniqueId(base: string, used: Set<string>): string {
	let id = base;
	let suffix = 2;
	while (used.has(id)) id = `${base}-${suffix++}`;
	used.add(id);
	return id;
}

function connections(
	context: EmitContext,
	used: Set<string>
): { lines: string[]; labels: string[] } {
	const lines: string[] = [];
	const labels: string[] = [];
	const connectionIds = new Set<string>();
	const occupied = new Set(
		context.nodeOrder.map((id) => position(context, id).join(','))
	);
	for (const edge of context.edges) {
		const from = context.dslIdByMermaidId.get(edge.fromId) as string;
		const to = context.dslIdByMermaidId.get(edge.toId) as string;
		const id = uniqueId(`${from}-to-${to}`, connectionIds);
		lines.push(
			`      - id: ${scalar(id)}`,
			'        from:',
			`          element: ${scalar(from)}`,
			'        to:',
			`          element: ${scalar(to)}`,
			'        layer: ground',
			`        end: ${edge.directed ? 'arrow' : 'none'}`
		);
		if (edge.style !== 'solid')
			lines.push(
				'        style:',
				edge.style === 'dotted'
					? '          pattern: dotted'
					: '          strokeWidth: 4'
			);
		if (edge.label) {
			const a = position(context, edge.fromId);
			const b = position(context, edge.toId);
			const at = [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)];
			while (occupied.has(at.join(','))) at[0]++;
			occupied.add(at.join(','));
			labels.push(
				...textElement(uniqueId(`${id}-label`, used), edge.label, at)
			);
		}
	}
	return { lines, labels };
}

/** Emits deterministic YAML without loading the YAML parser or browser runtime. */
export function emitMermaidYaml(context: EmitContext): string {
	const lines = [
		'header:',
		`  name: ${scalar(context.name)}`,
		'  assets: []',
		'  layers:',
		'    - name: ground',
		'    - name: nodes',
		'    - name: labels',
		'scenes:',
		'  - id: initial',
		'    elements:'
	];
	const used = new Set([
		...context.dslIdByMermaidId.values(),
		...context.labelDslIdByMermaidId.values()
	]);
	for (const id of context.nodeOrder) {
		const node = context.nodes.get(id) as MermaidNode;
		const at = position(context, id);
		const shape = primitive(node.shape ?? 'rectangle');
		lines.push(
			`      - id: ${scalar(context.dslIdByMermaidId.get(id) as string)}`,
			`        asset: ${shape.asset}`,
			`        at: ${tuple(at)}`,
			'        layer: nodes',
			...shape.lines
		);
		if (node.label !== '')
			lines.push(
				...textElement(
					context.labelDslIdByMermaidId.get(id) as string,
					node.label ?? node.mermaidId,
					at
				)
			);
	}
	const result = connections(context, used);
	lines.push(
		...result.labels,
		result.lines.length ? '    connections:' : '    connections: []',
		...result.lines
	);
	return `${lines.join('\n')}\n`;
}
