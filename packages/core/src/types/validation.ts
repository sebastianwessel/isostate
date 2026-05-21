/** Validation error detail */
export interface ValidationError {
	/** Machine-readable error code */
	code: string;
	/** Descriptive error message */
	message: string;
	/** Element ID involved (if applicable) */
	elementId?: string;
	/** State name involved (if applicable) */
	stateName?: string;
	/** Scene ID involved (if applicable) */
	sceneId?: string;
	/** Asset name involved (if applicable) */
	assetName?: string;
	/** Layer name involved (if applicable) */
	layerName?: string;
	/** Source location (if applicable) */
	location?: {
		file?: string;
		line?: number;
		column?: number;
	};
	/** Previous lifecycle state (if applicable) */
	fromState?: string;
	/** Next lifecycle state (if applicable) */
	toState?: string;
}

/** Validation warning detail */
export interface ValidationWarning extends ValidationError {}

/** Complete validation report */
export interface ValidationReport {
	/** Blocking errors */
	errors: ValidationError[];
	/** Non-blocking warnings */
	warnings: ValidationWarning[];
	/** True when no errors are present */
	isValid: boolean;
}
