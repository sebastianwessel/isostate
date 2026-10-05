import { emitMermaidYaml } from './mermaid-emitter.js';
import {
	assignDslIds,
	assignLabelDslIds,
	computeIndexInLayer,
	computeLayers,
	normalizeMermaidId
} from './mermaid-layout.js';
import { parseMermaid } from './mermaid-parser.js';
import type {
	MermaidConversionOptions,
	MermaidConversionResult
} from './mermaid-types.js';

export type {
	MermaidConversionOptions,
	MermaidConversionResult,
	MermaidConversionWarning
} from './mermaid-types.js';
export { MermaidConversionError } from './mermaid-types.js';

/**
 * Converts the supported Mermaid subset to YAML for isolated authoring tools.
 * Dependency-free and browser-safe; use convertMermaidToDsl for dev-time DSL validation.
 */
export function convertMermaidSource(
	source: string,
	options: MermaidConversionOptions = {}
): MermaidConversionResult {
	const graph = parseMermaid(source);
	const dslIdByMermaidId = assignDslIds(graph.nodes, graph.nodeOrder);
	const labelDslIdByMermaidId = assignLabelDslIds(
		graph.nodes,
		graph.nodeOrder,
		dslIdByMermaidId
	);
	const { layerByMermaidId, brokenEdgeLines } = computeLayers(
		graph.nodeOrder,
		graph.edges
	);
	const warnings = brokenEdgeLines.map((line) => ({
		code: 'MERMAID_CYCLE_BROKEN',
		message: `Edge at line ${line} closes a cycle and was ignored for layout layering`,
		line
	}));
	const yaml = emitMermaidYaml({
		...graph,
		name:
			options.name === undefined
				? 'mermaid-scene'
				: normalizeMermaidId(options.name),
		dslIdByMermaidId,
		labelDslIdByMermaidId,
		layerByMermaidId,
		indexInLayer: computeIndexInLayer(graph.nodeOrder, layerByMermaidId)
	});
	return { yaml, warnings };
}
