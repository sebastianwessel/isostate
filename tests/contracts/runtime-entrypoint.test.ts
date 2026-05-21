import { describe, expect, test } from 'bun:test';
import * as dsl from '../../packages/core/src/dsl/index';
import * as runtime from '../../packages/core/src/index';

const dslApiNames = [
	'parseScene',
	'validateScene',
	'resolveSceneSnapshots',
	'deriveProgresses',
	'compileScene',
	'toJs',
	'toJson',
	'fromJs',
	'fromJson'
] as const;

describe('runtime entrypoint boundary', () => {
	test('root runtime entrypoint exposes primary mount API', () => {
		expect(Object.hasOwn(runtime, 'mountScene')).toBe(true);
		expect(Object.hasOwn(runtime, 'createAssetRegistry')).toBe(true);
	});

	test('root runtime entrypoint keeps DOM mutation helpers internal', () => {
		for (const apiName of [
			'updateElementTransforms',
			'getElementState',
			'hideElementAfterExit',
			'unhideElementOnReadd',
			'createNewElementInstance',
			'removeElementNode'
		]) {
			expect(Object.hasOwn(runtime, apiName)).toBe(false);
		}
	});

	test('root runtime entrypoint does not expose dev-time DSL APIs', () => {
		for (const apiName of dslApiNames) {
			expect(Object.hasOwn(runtime, apiName)).toBe(false);
		}
	});

	test('dev-time DSL entrypoint exposes DSL APIs', () => {
		for (const apiName of dslApiNames) {
			expect(Object.hasOwn(dsl, apiName)).toBe(true);
		}
	});
});
