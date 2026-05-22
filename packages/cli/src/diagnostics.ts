export interface StructuredError extends Error {
	code?: string;
	details?: Record<string, unknown>;
}

interface ValidationIssue {
	code: string;
	message: string;
	sceneId?: string;
	elementId?: string;
	connectionId?: string;
	assetName?: string;
	layerName?: string;
	field?: string;
	value?: unknown;
	location?: {
		file?: string;
		line?: number;
		column?: number;
	};
}

export function formatValidationError(error: ValidationIssue): string {
	return formatIssue('ERROR', error);
}

export function formatValidationWarning(warning: ValidationIssue): string {
	return formatIssue('WARN', warning);
}

export function formatThrownError(error: unknown): string {
	if (isStructuredError(error) && error.code) {
		return `ERROR ${error.code} ${error.message}`;
	}

	if (error instanceof Error) {
		return `ERROR CLI_ERROR ${error.message}`;
	}

	return 'ERROR CLI_ERROR Unknown CLI failure';
}

function formatIssue(level: 'ERROR' | 'WARN', issue: ValidationIssue): string {
	const location = issue.location ? ` ${formatLocation(issue.location)}` : '';
	const context = formatIssueContext(issue);
	return `${level} ${issue.code}${location}${context} ${issue.message}`;
}

function formatIssueContext(issue: ValidationIssue): string {
	const parts = [
		['scene', issue.sceneId],
		['element', issue.elementId],
		['connection', issue.connectionId],
		['asset', issue.assetName],
		['layer', issue.layerName],
		['field', issue.field],
		['value', issue.value === undefined ? undefined : formatValue(issue.value)]
	].flatMap(([name, value]) =>
		value === undefined ? [] : [`${name}=${value}`]
	);

	return parts.length === 0 ? '' : ` ${parts.join(' ')}`;
}

function formatValue(value: unknown): string {
	const formatted = JSON.stringify(value);
	if (formatted === undefined) return String(value);
	return formatted.length > 80 ? `${formatted.slice(0, 77)}...` : formatted;
}

function formatLocation(location: NonNullable<ValidationIssue['location']>) {
	const parts = [
		location.file,
		location.line === undefined ? undefined : String(location.line),
		location.column === undefined ? undefined : String(location.column)
	].filter((part): part is string => part !== undefined && part.length > 0);

	return parts.length === 0 ? '' : `(${parts.join(':')})`;
}

function isStructuredError(error: unknown): error is StructuredError {
	return error instanceof Error && 'code' in error;
}
