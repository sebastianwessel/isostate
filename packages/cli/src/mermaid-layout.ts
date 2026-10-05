import {
	MermaidConversionError,
	type MermaidEdge,
	type MermaidNode
} from './mermaid-types.js';

/** Step 1-4 of Id Normalization. */
export function normalizeMermaidId(mermaidId: string): string {
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

/** Normalizes node identifiers and rejects ambiguous mappings. */
export function assignDslIds(
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

/** Reserves one readable text element for every node. */
export function assignLabelDslIds(
	nodes: Map<string, MermaidNode>,
	nodeOrder: string[],
	dslIdByMermaidId: Map<string, string>
): Map<string, string> {
	const labelDslIdByMermaidId = new Map<string, string>();
	const allDslIds = new Set(dslIdByMermaidId.values());

	for (const mermaidId of nodeOrder) {
		const node = nodes.get(mermaidId);
		if (!node) continue;
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

type Adjacency = Map<string, Array<{ to: string; edgeIndex: number }>>;

function layeringGraph(nodeOrder: string[], edges: MermaidEdge[]) {
	const adjacency: Adjacency = new Map(nodeOrder.map((id) => [id, []]));
	const inDegree = new Map(nodeOrder.map((id) => [id, 0]));
	edges.forEach((edge, edgeIndex) => {
		adjacency.get(edge.fromId)?.push({ to: edge.toId, edgeIndex });
		inDegree.set(edge.toId, (inDegree.get(edge.toId) ?? 0) + 1);
	});
	const sources = nodeOrder.filter((id) => inDegree.get(id) === 0);
	return { adjacency, starts: [...sources, ...nodeOrder] };
}

function breakCycles(adjacency: Adjacency, starts: string[]): Set<number> {
	const broken = new Set<number>();
	const visiting = new Set<string>();
	const visited = new Set<string>();
	function visit(id: string): void {
		if (visited.has(id)) return;
		visiting.add(id);
		visited.add(id);
		for (const { to, edgeIndex } of adjacency.get(id) ?? []) {
			if (visiting.has(to)) broken.add(edgeIndex);
			else visit(to);
		}
		visiting.delete(id);
	}
	for (const id of starts) visit(id);
	return broken;
}

function longestLayers(
	nodeOrder: string[],
	edges: MermaidEdge[],
	broken: Set<number>
): Map<string, number> {
	const incoming = new Map<string, string[]>(nodeOrder.map((id) => [id, []]));
	edges.forEach((edge, index) => {
		if (!broken.has(index)) incoming.get(edge.toId)?.push(edge.fromId);
	});
	const layers = new Map<string, number>();
	function layer(id: string): number {
		const cached = layers.get(id);
		if (cached !== undefined) return cached;
		let value = 0;
		for (const from of incoming.get(id) ?? [])
			value = Math.max(value, layer(from) + 1);
		layers.set(id, value);
		return value;
	}
	for (const id of nodeOrder) layer(id);
	return layers;
}

/** Breaks cycles in appearance order, then computes longest-path layers. */
export function computeLayers(
	nodeOrder: string[],
	edges: MermaidEdge[]
): { layerByMermaidId: Map<string, number>; brokenEdgeLines: number[] } {
	const { adjacency, starts } = layeringGraph(nodeOrder, edges);
	const broken = breakCycles(adjacency, starts);
	return {
		layerByMermaidId: longestLayers(nodeOrder, edges, broken),
		brokenEdgeLines: edges
			.filter((_, index) => broken.has(index))
			.map((edge) => edge.line)
	};
}

/** Assigns stable first-appearance indices within each layout layer. */
export function computeIndexInLayer(
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
