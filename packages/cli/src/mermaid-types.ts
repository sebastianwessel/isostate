/**
 * Non-fatal conversion notice reported alongside the generated YAML. Codes
 * are documented in `specs/03-contracts/errors.md` ("Converter" section).
 */
export interface MermaidConversionWarning {
	/** Warning code (`MERMAID_CYCLE_BROKEN`). */
	code: string;
	/** Human-readable description of the layout adjustment. */
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

/** Normalized flowchart direction. */
export type MermaidDirection = 'TD' | 'LR' | 'RL' | 'BT';

/** Supported shapes mapped to generated DSL primitives. */
export type MermaidShape =
	| 'rectangle'
	| 'rounded'
	| 'stadium'
	| 'circle'
	| 'polygon'
	| 'hexagon'
	| 'lean-right'
	| 'lean-left'
	| 'trapezoid'
	| 'trapezoid-alt';

/** Converter graph node before DSL emission. */
export interface MermaidNode {
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

/** Converter graph edge with preserved visual style and label. */
export interface MermaidEdge {
	fromId: string;
	toId: string;
	/** Whether the connection has an arrowhead. */
	directed: boolean;
	style: 'solid' | 'dotted' | 'thick';
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
