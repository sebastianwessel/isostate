import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const CODE_ROW_PATTERN = /^\| `([A-Z0-9_]+)`/;

/**
 * Extracts every backticked code from table rows shaped like
 * `| `CODE` | ... |` in the given markdown text.
 */
function extractCodesFromTableRows(text: string): string[] {
	const codes: string[] = [];

	for (const line of text.split('\n')) {
		const match = CODE_ROW_PATTERN.exec(line);
		if (match) {
			codes.push(match[1]);
		}
	}

	return codes;
}

describe('error docs completeness', () => {
	const specText = readFileSync(
		join(root, 'specs/03-contracts/errors.md'),
		'utf8'
	);
	const docsText = readFileSync(join(root, 'docs/reference/errors.md'), 'utf8');

	const specCodes = Array.from(new Set(extractCodesFromTableRows(specText)));
	const docsCodes = new Set(extractCodesFromTableRows(docsText));

	test('spec defines at least one error or warning code', () => {
		expect(specCodes.length).toBeGreaterThan(0);
	});

	for (const code of specCodes) {
		test(`docs/reference/errors.md documents ${code}`, () => {
			expect(docsCodes.has(code)).toBe(true);
		});
	}
});
