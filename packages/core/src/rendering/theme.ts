import { RenderError } from "../types/errors.ts";

const CSS_CUSTOM_PROPERTY_PATTERN = /^--[a-zA-Z0-9-_]+$/;

/**
 * Apply theme CSS custom properties to an element's inline style.
 * Throws `RenderError` (`INVALID_THEME_VAR`) if a key is not a valid `--name` custom property.
 */
export function applyThemeToElement(element: SVGElement | HTMLElement, themeVars: Record<string, string>): void {
	for (const [name, value] of Object.entries(themeVars)) {
		if (!CSS_CUSTOM_PROPERTY_PATTERN.test(name)) {
			throw new RenderError("INVALID_THEME_VAR", `Invalid CSS custom property name: ${name}`);
		}
		element.style.setProperty(name, value);
	}
}
