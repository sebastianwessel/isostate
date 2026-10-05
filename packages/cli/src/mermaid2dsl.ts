import { parseScene, validateScene } from '@sebastianwessel/isostate/dsl';
import { convertMermaidSource } from './mermaid-source.js';
import {
	MermaidConversionError,
	type MermaidConversionOptions,
	type MermaidConversionResult
} from './mermaid-types.js';

export type {
	MermaidConversionOptions,
	MermaidConversionResult,
	MermaidConversionWarning
} from './mermaid-types.js';
export { MermaidConversionError } from './mermaid-types.js';

/** Converts Mermaid flowcharts to YAML and validates the emitted DSL at dev time. */
export function convertMermaidToDsl(
	source: string,
	options: MermaidConversionOptions = {}
): MermaidConversionResult {
	const result = convertMermaidSource(source, options);
	try {
		const report = validateScene(parseScene(result.yaml));
		if (!report.isValid)
			throw new MermaidConversionError(
				'MERMAID_INTERNAL',
				'Generated document failed DSL validation',
				{ issues: report.errors }
			);
	} catch (error) {
		if (error instanceof MermaidConversionError) throw error;
		throw new MermaidConversionError(
			'MERMAID_INTERNAL',
			'Generated document failed DSL parsing',
			{ cause: error }
		);
	}
	return result;
}
