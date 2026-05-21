/** Easing function type */
export type EasingFn = (t: number) => number;

/** Easing configuration type */
export type EasingType = "linear" | "easeInCubic" | "easeInOutCubic" | "easeOutCubic";

/**
 * Linear easing (no interpolation).
 */
export function linear(t: number): number {
	return t;
}

/**
 * Cubic ease-in: starts slowly, accelerates.
 */
export function easeInCubic(t: number): number {
	return t * t * t;
}

/**
 * Cubic ease-out: starts fast, decelerates.
 */
export function easeOutCubic(t: number): number {
	return 1 - (1 - t) ** 3;
}

/**
 * Cubic ease-in-out: slow start, fast middle, slow end.
 */
export function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Resolve an easing type string to a function.
 */
export function resolveEasing(type: EasingType): EasingFn {
	switch (type) {
		case "linear":
			return linear;
		case "easeInCubic":
			return easeInCubic;
		case "easeOutCubic":
			return easeOutCubic;
		case "easeInOutCubic":
			return easeInOutCubic;
	}
}
