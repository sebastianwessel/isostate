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

/** Shape returned by `validateScene()`: blocking errors and non-blocking warnings. */
export interface ValidationReport {
	errors: ValidationIssue[];
	warnings: ValidationIssue[];
	isValid: boolean;
}

export function formatValidationError(error: ValidationIssue): string {
	return formatIssue('ERROR', error);
}

export function formatValidationWarning(warning: ValidationIssue): string {
	return formatIssue('WARN', warning);
}

type DiagnosticsIo = {
	stdout: Pick<typeof console, 'log'>;
	stderr: Pick<typeof console, 'error'>;
};

/**
 * Prints the `Errors (<n>)` / `ERROR <code> ...` block to stderr, per the
 * grouping rules in `specs/03-contracts/cli.md` ("## Diagnostics"). No-op
 * when there are no errors.
 */
export function printGroupedErrors(
	errors: ValidationIssue[],
	io: DiagnosticsIo
): void {
	if (errors.length === 0) return;
	io.stderr.error(`Errors (${errors.length})`);
	for (const error of errors) {
		io.stderr.error(formatValidationError(error));
	}
}

/**
 * Prints the `Warnings (<n>)` / `WARN <code> ...` block to stdout, per the
 * grouping rules in `specs/03-contracts/cli.md` ("## Diagnostics"). No-op
 * when there are no warnings.
 */
export function printGroupedWarnings(
	warnings: ValidationIssue[],
	io: DiagnosticsIo
): void {
	if (warnings.length === 0) return;
	io.stdout.log(`Warnings (${warnings.length})`);
	for (const warning of warnings) {
		io.stdout.log(formatValidationWarning(warning));
	}
}

/**
 * Prints a validation report using the grouped output contract from
 * `specs/03-contracts/cli.md` ("## Diagnostics"):
 *
 * - errors print first, one `ERROR <code> ...` line each, preceded by an
 *   `Errors (<n>)` header when `n > 0`; errors and that header go to stderr;
 * - warnings print after errors, one `WARN <code> ...` line each, preceded
 *   by a `Warnings (<n>)` header when `n > 0`; warnings, that header, and
 *   the summary go to stdout;
 * - the summary line is `OK` when clean, `OK (<n> warnings)` when only
 *   warnings are present, and `FAILED (<e> errors, <w> warnings)` when
 *   errors are present.
 *
 * Returns the exit code the caller should use: `1` when the report has
 * errors, `0` otherwise.
 */
export function printValidationReport(
	report: ValidationReport,
	io: DiagnosticsIo
): number {
	const errorCount = report.errors.length;
	const warningCount = report.warnings.length;

	printGroupedErrors(report.errors, io);
	printGroupedWarnings(report.warnings, io);

	if (errorCount > 0) {
		io.stdout.log(`FAILED (${errorCount} errors, ${warningCount} warnings)`);
		return 1;
	}

	io.stdout.log(warningCount > 0 ? `OK (${warningCount} warnings)` : 'OK');
	return 0;
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
