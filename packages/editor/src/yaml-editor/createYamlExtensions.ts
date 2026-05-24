import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { yaml } from '@codemirror/lang-yaml';
import {
	bracketMatching,
	foldGutter,
	foldKeymap,
	HighlightStyle,
	indentOnInput,
	syntaxHighlighting
} from '@codemirror/language';
import { lintKeymap } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState, type Extension } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import {
	crosshairCursor,
	drawSelection,
	dropCursor,
	EditorView,
	highlightActiveLine,
	highlightActiveLineGutter,
	highlightSpecialChars,
	keymap,
	lineNumbers,
	rectangularSelection
} from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

const lightTheme = EditorView.theme(
	{
		'&': {
			color: '#0a0a0a',
			backgroundColor: '#ffffff'
		},
		'.cm-content': {
			caretColor: '#18181b'
		},
		'.cm-gutters': {
			backgroundColor: '#f4f4f5',
			color: '#71717a',
			borderRight: '1px solid #e4e4e7'
		},
		'.cm-activeLineGutter': {
			backgroundColor: '#e4e4e7'
		},
		'.cm-activeLine': {
			backgroundColor: '#f4f4f5'
		},
		'.cm-selectionMatch': {
			backgroundColor: '#e4e4e7'
		},
		'&.cm-focused .cm-selectionMatch': {
			backgroundColor: '#d4d4d8'
		},
		'.cm-matchingBracket': {
			backgroundColor: '#e4e4e7',
			outline: '1px solid #d4d4d8'
		}
	},
	{ dark: false }
);

const lightHighlightStyle = HighlightStyle.define([
	{ tag: t.comment, color: '#71717a', fontStyle: 'italic' },
	{ tag: t.propertyName, color: '#0f5f4f', fontWeight: '600' },
	{ tag: t.string, color: '#b45309' },
	{ tag: t.number, color: '#2563eb' },
	{ tag: t.bool, color: '#9333ea' },
	{ tag: t.null, color: '#9333ea' },
	{ tag: t.keyword, color: '#0f5f4f', fontWeight: '600' },
	{ tag: t.atom, color: '#9333ea' },
	{ tag: t.definition(t.variableName), color: '#0f5f4f' },
	{ tag: t.punctuation, color: '#71717a' }
]);

const darkHighlightStyle = HighlightStyle.define([
	{ tag: t.comment, color: '#a1a1aa', fontStyle: 'italic' },
	{ tag: t.propertyName, color: '#78d9ba', fontWeight: '600' },
	{ tag: t.string, color: '#facc15' },
	{ tag: t.number, color: '#93c5fd' },
	{ tag: t.bool, color: '#d8b4fe' },
	{ tag: t.null, color: '#d8b4fe' },
	{ tag: t.keyword, color: '#78d9ba', fontWeight: '600' },
	{ tag: t.atom, color: '#d8b4fe' },
	{ tag: t.definition(t.variableName), color: '#78d9ba' },
	{ tag: t.punctuation, color: '#a1a1aa' }
]);

export interface YamlExtensionOptions {
	theme: 'light' | 'dark';
	readOnly?: boolean;
}

export function createYamlExtensions(
	options: YamlExtensionOptions
): Extension[] {
	const extensions: Extension[] = [
		lineNumbers(),
		highlightActiveLineGutter(),
		highlightSpecialChars(),
		history(),
		foldGutter(),
		drawSelection(),
		dropCursor(),
		indentOnInput(),
		bracketMatching(),
		rectangularSelection(),
		crosshairCursor(),
		highlightActiveLine(),
		highlightSelectionMatches(),
		keymap.of([
			...defaultKeymap,
			...searchKeymap,
			...historyKeymap,
			...foldKeymap,
			...lintKeymap
		]),
		yaml()
	];

	if (options.theme === 'dark') {
		extensions.push(oneDark);
		extensions.push(syntaxHighlighting(darkHighlightStyle));
	} else {
		extensions.push(lightTheme);
		extensions.push(syntaxHighlighting(lightHighlightStyle));
	}

	if (options.readOnly) {
		extensions.push(EditorState.readOnly.of(true));
	}

	return extensions;
}
