import { setDiagnostics } from '@codemirror/lint';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useEffect, useRef } from 'react';
import type { EditorDiagnostic } from '../types.ts';
import { createYamlExtensions } from './createYamlExtensions.ts';

export interface YamlEditorProps {
	value: string;
	onChange: (value: string) => void;
	theme: 'light' | 'dark';
	readOnly?: boolean;
	diagnostics?: EditorDiagnostic[];
	__testViewRef?: React.RefObject<EditorView | null>;
}

function mapDiagnostics(
	diagnostics: EditorDiagnostic[],
	docText: string
): import('@codemirror/lint').Diagnostic[] {
	const lines = docText.split('\n');
	function offsetAt(line: number, column: number): number {
		let off = 0;
		for (let i = 0; i < line - 1 && i < lines.length; i++) {
			off += lines[i].length + 1;
		}
		return off + Math.min(column - 1, lines[line - 1]?.length ?? 0);
	}

	return diagnostics.map((d) => {
		const line = d.line ?? 1;
		const column = d.column ?? 1;
		const from = offsetAt(line, column);
		const to = offsetAt(line, column + 1);
		return {
			from,
			to: Math.max(to, from),
			severity: d.severity,
			message: d.message
		};
	});
}

export function YamlEditor({
	value,
	onChange,
	theme,
	readOnly,
	diagnostics,
	__testViewRef
}: YamlEditorProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const internalValueRef = useRef(value);
	const configCompartmentRef = useRef(new Compartment());

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const configCompartment = configCompartmentRef.current;
		const extensions = createYamlExtensions({ theme, readOnly });
		const startState = EditorState.create({
			doc: value,
			extensions: [
				configCompartment.of(extensions),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						const newValue = update.state.doc.toString();
						internalValueRef.current = newValue;
						if (debounceRef.current) {
							clearTimeout(debounceRef.current);
						}
						debounceRef.current = setTimeout(() => {
							onChangeRef.current(newValue);
						}, 300);
					}
				})
			]
		});

		const view = new EditorView({
			state: startState,
			parent: container
		});
		viewRef.current = view;
		if (__testViewRef) {
			__testViewRef.current = view;
		}

		if (diagnostics && diagnostics.length > 0) {
			view.dispatch(
				setDiagnostics(view.state, mapDiagnostics(diagnostics, value))
			);
		}

		return () => {
			view.destroy();
			viewRef.current = null;
			if (__testViewRef) {
				__testViewRef.current = null;
			}
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		const view = viewRef.current;
		if (!view) return;

		if (
			value !== view.state.doc.toString() &&
			value !== internalValueRef.current
		) {
			const selection = view.state.selection;
			view.dispatch({
				changes: {
					from: 0,
					to: view.state.doc.length,
					insert: value
				},
				selection
			});
			internalValueRef.current = value;
		}
	}, [value]);

	useEffect(() => {
		const view = viewRef.current;
		if (!view) return;

		view.dispatch(
			setDiagnostics(
				view.state,
				mapDiagnostics(diagnostics ?? [], view.state.doc.toString())
			)
		);
	}, [diagnostics]);

	useEffect(() => {
		const view = viewRef.current;
		if (!view) return;

		view.dispatch({
			effects: configCompartmentRef.current.reconfigure(
				createYamlExtensions({ theme, readOnly })
			)
		});
	}, [theme, readOnly]);

	return <div ref={containerRef} className="isostate-editor-yaml-editor" />;
}
