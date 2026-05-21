import { RenderError } from '../types/errors.ts';

const CSS_CUSTOM_PROPERTY_PATTERN = /^--[a-zA-Z0-9-_]+$/;

export function applyThemeToElement(
	element: SVGElement | HTMLElement,
	themeVars: Record<string, string>
): void {
	for (const [name, value] of Object.entries(themeVars)) {
		if (!CSS_CUSTOM_PROPERTY_PATTERN.test(name)) {
			throw new RenderError(
				'INVALID_THEME_VAR',
				`Invalid CSS custom property name: ${name}`
			);
		}
		element.style.setProperty(name, value);
	}
}
