/** Same-tab authoring handoff; never stores source in URLs or a server. */
export const MERMAID_HANDOFF_KEY = 'isostate:mermaid-editor-yaml:v1';
export const MERMAID_HANDOFF_LIMIT = 1_000_000;

export function saveMermaidHandoff(storage: Storage, yaml: string): void {
	if (!yaml.trim() || yaml.length > MERMAID_HANDOFF_LIMIT)
		throw new Error(
			'The generated YAML is empty or too large to open in the editor.'
		);
	storage.setItem(MERMAID_HANDOFF_KEY, yaml);
}

export function readMermaidHandoff(storage: Storage): string | null {
	const yaml = storage.getItem(MERMAID_HANDOFF_KEY);
	return yaml?.trim() && yaml.length <= MERMAID_HANDOFF_LIMIT ? yaml : null;
}
