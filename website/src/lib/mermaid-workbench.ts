import { convertMermaidSource } from '../../../packages/cli/src/mermaid-source.ts';
import { saveMermaidHandoff } from './mermaid-handoff';

export const mermaidExamples = {
	request: `flowchart TD
  Request --> Router
  Router --> Auth
  Auth -- ok --> App
  Auth -- denied --> Response
  App --> Cache
  Cache -- hit --> Response
  Cache -- miss --> DB
  DB --> Response
  App -. async .-> Queue
  Queue --> Worker
  Worker --> DB`,
	decision: `flowchart TD
  Start([Request]) --> Review{Approved?}
  Review -->|yes| Publish[Publish]
  Review -->|no| Revise[Revise]
  Publish --> Done([Complete])
  Revise --> Review`,
	pipeline: `flowchart LR
  Source[Source] ==> Build[Build]
  Build --> Test{Tests pass?}
  Test -->|yes| Deploy[Deploy]
  Test -. failed .-> Report[Report]`,
	cycle: `flowchart TD
  Request[Request] --> Service[Service]
  Service -->|retry| Request
  Service -->|success| Response[Response]`
};

/** Bind the authoring workbench without importing the scene parser or compiler. */
export function initializeMermaidWorkbench(): void {
	const root = document.querySelector<HTMLElement>('.mermaid-workbench');
	if (!root) return;
	const inputElement =
		root.querySelector<HTMLTextAreaElement>('#mermaid-input');
	const outputElement =
		root.querySelector<HTMLTextAreaElement>('#mermaid-output');
	const form = root.querySelector<HTMLFormElement>('#mermaid-convert-form');
	if (!inputElement || !outputElement || !form) return;
	const input = inputElement;
	const output = outputElement;
	const state = root.querySelector<HTMLElement>('#mermaid-output-state');
	const diagnostics = root.querySelector<HTMLElement>('#mermaid-diagnostics');
	const status = root.querySelector<HTMLElement>('#mermaid-result-status');
	const warnings = root.querySelector<HTMLUListElement>('#mermaid-warnings');
	const lineButton = root.querySelector<HTMLButtonElement>(
		'#mermaid-error-line'
	);
	const actions = ['copy', 'download', 'editor'].map((name) =>
		root.querySelector<HTMLButtonElement>(`#mermaid-${name}`)
	);
	let yaml = '';
	let errorLine = 0;
	let fileRevision = 0;
	const events = new AbortController();
	const options = { signal: events.signal };

	function message(text: string, error = false): void {
		if (diagnostics) {
			diagnostics.hidden = false;
			diagnostics.dataset.error = String(error);
		}
		if (status) status.textContent = text;
	}
	function invalidate(): void {
		yaml = '';
		output.value = '';
		for (const action of actions) if (action) action.disabled = true;
		if (state) state.textContent = 'Source changed';
		if (warnings) warnings.replaceChildren();
		if (lineButton) lineButton.hidden = true;
		input.removeAttribute('aria-invalid');
		message('Source changed. Convert again to update the YAML.');
	}
	function convert(): void {
		try {
			const result = convertMermaidSource(input.value);
			yaml = result.yaml;
			output.value = yaml;
			input.removeAttribute('aria-invalid');
			for (const action of actions) if (action) action.disabled = false;
			if (state) state.textContent = 'Converted';
			if (lineButton) lineButton.hidden = true;
			warnings?.replaceChildren();
			for (const warning of result.warnings) {
				const item = document.createElement('li');
				item.textContent = `${warning.message}${warning.line ? ` (line ${warning.line})` : ''}`;
				warnings?.append(item);
			}
			message(
				result.warnings.length
					? `Converted with ${result.warnings.length} layout warning${result.warnings.length === 1 ? '' : 's'}. Review the notes before refining the scene.`
					: 'Converted. Copy or download the YAML, or open it in the editor.'
			);
		} catch (error) {
			invalidate();
			input.setAttribute('aria-invalid', 'true');
			if (state) state.textContent = 'Check source';
			const details =
				error && typeof error === 'object' && 'details' in error
					? (error.details as { line?: number })
					: undefined;
			errorLine = details?.line ?? 0;
			if (lineButton) {
				lineButton.hidden = errorLine < 1;
				lineButton.textContent = `Go to line ${errorLine}`;
			}
			message(
				error instanceof Error
					? error.message
					: 'Conversion failed. Check the Mermaid syntax.',
				true
			);
		}
	}
	form.addEventListener(
		'submit',
		(event) => {
			event.preventDefault();
			convert();
		},
		options
	);
	input.addEventListener(
		'input',
		() => {
			fileRevision++;
			invalidate();
		},
		options
	);
	root.querySelector<HTMLSelectElement>('#mermaid-example')?.addEventListener(
		'change',
		(event) => {
			const selected = (event.target as HTMLSelectElement)
				.value as keyof typeof mermaidExamples;
			if (!mermaidExamples[selected]) return;
			fileRevision++;
			input.value = mermaidExamples[selected];
			convert();
		},
		options
	);
	root.querySelector<HTMLInputElement>('#mermaid-file')?.addEventListener(
		'change',
		async (event) => {
			const picker = event.target as HTMLInputElement;
			const file = picker.files?.[0];
			if (!file) return;
			const revision = ++fileRevision;
			invalidate();
			try {
				if (file.size > 100_000)
					throw new Error('Choose a Mermaid text file smaller than 100 KB.');
				const source = await file.text();
				if (revision !== fileRevision || events.signal.aborted) return;
				input.value = source;
				convert();
			} catch (error) {
				if (revision === fileRevision)
					message(
						error instanceof Error
							? error.message
							: 'Could not read this file.',
						true
					);
			} finally {
				picker.value = '';
			}
		},
		options
	);
	lineButton?.addEventListener(
		'click',
		() => {
			const lines = input.value.split('\n');
			const start = lines
				.slice(0, errorLine - 1)
				.reduce((length, line) => length + line.length + 1, 0);
			input.focus();
			input.setSelectionRange(
				start,
				start + (lines[errorLine - 1]?.length ?? 0)
			);
		},
		options
	);
	actions[0]?.addEventListener(
		'click',
		async () => {
			if (!yaml) return;
			try {
				await navigator.clipboard.writeText(yaml);
				message('YAML copied to the clipboard.');
			} catch {
				output.focus();
				output.select();
				message(
					'Clipboard access is unavailable. The YAML is selected; copy it with your keyboard.'
				);
			}
		},
		options
	);
	actions[1]?.addEventListener(
		'click',
		() => {
			if (!yaml) return;
			const url = URL.createObjectURL(
				new Blob([yaml], { type: 'text/yaml;charset=utf-8' })
			);
			const link = document.createElement('a');
			link.href = url;
			link.download = 'mermaid-scene.isostate.yaml';
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
			message('Downloaded mermaid-scene.isostate.yaml.');
		},
		options
	);
	actions[2]?.addEventListener(
		'click',
		() => {
			if (!yaml) return;
			try {
				saveMermaidHandoff(window.sessionStorage, yaml);
				const url = new URL(
					root.dataset.editorUrl ?? '/editor/',
					window.location.href
				);
				url.searchParams.set('import', 'mermaid');
				window.location.assign(url.href);
			} catch {
				message(
					'The editor handoff is unavailable in this browser. Download the YAML and use Import in the editor.',
					true
				);
			}
		},
		options
	);
	window.addEventListener('pagehide', (event) => {
		if (!event.persisted) events.abort();
	});
	convert();
}
