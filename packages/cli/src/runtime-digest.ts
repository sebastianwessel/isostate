import { createHash } from 'node:crypto';
import type { RuntimeBundle } from '@sebastianwessel/isostate/dsl';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export function runtimeDigest(bundle: RuntimeBundle): string {
	const { _digest, ...bundleWithoutDigest } = bundle;
	return sha256Hex(canonicalStringify(bundleWithoutDigest));
}

export function sha256Hex(input: string | Uint8Array): string {
	return createHash('sha256').update(input).digest('hex');
}

function canonicalStringify(value: unknown): string {
	return JSON.stringify(normalizeValue(value));
}

function normalizeValue<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((item) =>
			item === undefined ? null : normalizeValue(item)
		) as T;
	}

	if (!isPlainObject(value)) return value;

	const normalized: Record<string, JsonValue> = {};
	for (const key of Object.keys(value).sort()) {
		const child = (value as Record<string, unknown>)[key];
		if (child !== undefined) {
			normalized[key] = normalizeValue(child) as JsonValue;
		}
	}

	return normalized as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
