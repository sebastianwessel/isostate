import { describe, expect, test } from 'bun:test';
import {
	createAssetRegistry,
	createDefaultRegistry,
	composeTheme,
	guardEntryAnimation,
	guardExitAnimation,
	guardLifecycleStatus,
	resolveEasing,
	resolveTheme,
	calculateTransform,
	calculateVisualSize,
	projectToScreen
} from '../../packages/core/src/index.ts';
import { applyThemeToElement } from '../../packages/core/src/rendering/theme.ts';

describe('public helper APIs', () => {
	test('projects and scales grid coordinates deterministically', () => {
		expect(projectToScreen(3, 1, 64, 32, 16, 8, 4)).toEqual({
			screenX: 40,
			screenY: 52
		});
		expect(calculateVisualSize(2, 64)).toBe(128);
		expect(calculateTransform(10, 20, 128, 64)).toBe(
			'translate(10px, 20px) scale(2)'
		);
	});

	test('resolves easing helpers and type guards', () => {
		expect(resolveEasing('linear')(0.4)).toBe(0.4);
		expect(resolveEasing('easeInCubic')(0.5)).toBe(0.125);
		expect(resolveEasing('easeOutCubic')(0)).toBe(0);
		expect(resolveEasing('easeInOutCubic')(0.5)).toBe(0.5);
		expect(guardEntryAnimation('fade-in')).toBe('fade-in');
		expect(guardExitAnimation('fade-out')).toBe('fade-out');
		expect(guardLifecycleStatus('present')).toBe('present');
		expect(guardEntryAnimation('wrong')).toBeUndefined();
		expect(guardExitAnimation(1)).toBeUndefined();
		expect(guardLifecycleStatus(null)).toBeUndefined();
	});

	test('creates isolated registries and composed themes', () => {
		const registry = createAssetRegistry([
			{ id: 'box', path: 'custom/box', category: 'custom' }
		]);
		expect(registry.has('box')).toBe(true);
		expect(registry.get('box')?.id).toBe('box');
		expect(registry.getAll('custom')).toHaveLength(1);
		registry.remove('box');
		expect(registry.has('box')).toBe(false);

		const defaults = createDefaultRegistry();
		expect(defaults.has('iso-platform')).toBe(true);
		expect(defaults.getAll()).toContainEqual(
			expect.objectContaining({ id: 'iso-server' })
		);

		expect(resolveTheme('light')).toEqual(
			expect.objectContaining({ '--color-accent': '#3b82f6' })
		);
		expect(composeTheme('light', { '--color-accent': '#000000' }).vars).toEqual(
			expect.objectContaining({ '--color-accent': '#000000' })
		);
		expect(
			composeTheme('missing', { '--color-accent': '#111111' }).vars
		).toEqual({ '--color-accent': '#111111' });
	});

	test('validates theme custom property names', () => {
		const values = new Map<string, string>();
		const element = {
			style: {
				setProperty(name: string, value: string) {
					values.set(name, value);
				}
			}
		} as unknown as HTMLElement;

		applyThemeToElement(element, { '--color-accent': '#fff' });
		expect(values.get('--color-accent')).toBe('#fff');
		expect(() => applyThemeToElement(element, { color: 'red' })).toThrow();
	});
});
