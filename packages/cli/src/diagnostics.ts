export interface StructuredError extends Error {
	code?: string;
	details?: Record<string, unknown>;
}

interface ValidationIssue {
	code: string;
	message: string;
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
	return `${level} ${issue.code}${location} ${issue.message}`;
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
