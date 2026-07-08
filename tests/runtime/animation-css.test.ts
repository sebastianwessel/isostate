import { describe, expect, test } from 'bun:test';
import { buildKeyframeCSS } from '../../packages/core/src/rendering/animation-css.ts';

const BUILT_IN_AMBIENT_NAMES = [
	'pulse',
	'float',
	'shake',
	'glow',
	'spin',
	'blink'
];

describe('buildKeyframeCSS', () => {
	test('binds every built-in ambient class to an animation rule', () => {
		const css = buildKeyframeCSS();

		for (const name of BUILT_IN_AMBIENT_NAMES) {
			const bindingPattern = new RegExp(
				`\\.iso-ambient-${name}\\{animation:iso-anim-${name}\\s`
			);
			expect(css).toMatch(bindingPattern);
			expect(css).toContain(`@keyframes iso-anim-${name}`);
		}
	});

	test('reduced-motion block still disables built-in ambient classes', () => {
		const css = buildKeyframeCSS();
		const reducedMotionBlock = css.split(
			'@media (prefers-reduced-motion: reduce)'
		)[1];

		expect(reducedMotionBlock).toBeDefined();
		for (const name of BUILT_IN_AMBIENT_NAMES) {
			expect(reducedMotionBlock).toContain(`.iso-ambient-${name}`);
		}
	});
});
