import type { ConnectorMessage, ElementActivity, ValidationError } from "../types/index.ts";

/** Apply the same safe color token rules used by text and connector strokes. */
export function isSafeEffectColor(value: string): boolean {
	return (
		typeof value === "string" &&
		value.trim().length > 0 &&
		!/[<>]/.test(value) &&
		![...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) &&
		!/url\(|javascript:/i.test(value)
	);
}

/** Validate an optional activity replacement without adding runtime dependencies. */
export function validateActivity(
	activity: ElementActivity | undefined,
	errors: ValidationError[],
	sceneId: string,
	elementId: string,
): void {
	if (activity === undefined) return;
	if (
		!["idle", "processing", "waiting", "complete", "error"].includes(activity.state) ||
		(activity.color !== undefined && !isSafeEffectColor(activity.color))
	) {
		errors.push({
			code: "INVALID_ELEMENT_ACTIVITY",
			message: "Activity requires a known state and a safe optional color",
			sceneId,
			elementId,
			field: "activity",
		});
	}
}

/** Validate a complete connector-message replacement, including disabled configurations. */
export function validateMessage(
	message: ConnectorMessage | undefined,
	errors: ValidationError[],
	sceneId: string,
	elementId: string,
): void {
	if (message === undefined) return;
	const invalid =
		(message.kind !== undefined && !["packet", "orb", "envelope"].includes(message.kind)) ||
		(message.color !== undefined && !isSafeEffectColor(message.color)) ||
		(message.enabled !== undefined && typeof message.enabled !== "boolean") ||
		!optionalRange(message.size, 2, 32) ||
		!optionalRange(message.duration, 200, 30000) ||
		!optionalRange(message.count, 1, 4) ||
		(message.count !== undefined && !Number.isInteger(message.count));
	if (invalid)
		errors.push({
			code: "INVALID_CONNECTOR_MESSAGE",
			message:
				"Message requires a known kind, safe color, size 2..32, duration 200..30000, count integer 1..4, and boolean enabled",
			sceneId,
			elementId,
			field: "message",
		});
}

function optionalRange(value: number | undefined, minimum: number, maximum: number): boolean {
	return value === undefined || (Number.isFinite(value) && value >= minimum && value <= maximum);
}
