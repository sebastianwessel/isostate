/** Base class for all structured errors */
class IsostateError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly details?: Record<string, unknown>,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

/** DSL parsing error */
export class ParseError extends IsostateError {}

/** DSL validation error */
export class ValidationErrorClass extends IsostateError {}

/** Rendering engine error */
export class RenderError extends IsostateError {}

/** Animation engine error */
export class AnimationError extends IsostateError {}

/** Animation controller error */
export class ControllerError extends IsostateError {}
