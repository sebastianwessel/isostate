import { mountScene } from '../../../packages/core/src/index.ts';
import type { RuntimeBundle } from '../../../packages/core/src/types/runtime-bundle.ts';
import agentic from '../scenes/agentic-workflow.isostate.js';
import providers from '../scenes/provider-routing.isostate.js';
import architecture from '../scenes/software-architecture.isostate.js';

const examples = {
	'agentic-workflow': {
		bundle: agentic,
		labels: ['Manual', 'Agents', 'Review', 'Complete'],
		descriptions: [
			'A requester sends an email; a human operator triages and fulfills the interaction.',
			'AI triage creates the request, requested item, and fulfillment task, consults knowledge, and prepares a tool action.',
			'The workflow waits for human approval. Unclear cases can be handed to an expert before any prepared action executes.',
			'An approved action executes, the task closes, and the decision is recorded in an audit trail.'
		]
	},
	'provider-routing': {
		bundle: providers,
		labels: ['Provider', 'Context', 'Tools', 'Review'],
		descriptions: [
			'An orchestrator chooses a model platform: Microsoft Foundry, Amazon Bedrock, or Google Vertex AI.',
			'Bedrock is selected while retrieval supplies context from a vector store and Redis caches reusable context.',
			'A tool runner calls an API, appends an event to Redis Streams, and validates the result.',
			'A human reviews the validated result before the approved output is delivered.'
		]
	},
	'software-architecture': {
		bundle: architecture,
		labels: ['Architecture', 'Workflow', 'Process'],
		descriptions: [
			'A request travels from a client through the gateway and service to data.',
			'A workflow moves from its starting point through a task and decision to completion.',
			'A scheduled process creates a document, asks for approval, and delivers the result.'
		]
	}
};

/** Mount the compiled examples and expose their scene stops to gallery controls. */
export function initializeSoftwareExamples(): void {
	const container = document.getElementById('software-architecture-scene');
	if (!container) return;
	const picker = document.querySelector<HTMLSelectElement>('#asset-example');
	let mounted: ReturnType<typeof mountScene> | undefined;
	let revision = 0;
	const show = async () => {
		const current = ++revision;
		const key = picker?.value ?? 'agentic-workflow';
		const example = examples[key as keyof typeof examples];
		if (!example) return;
		// Generated JS infers arrays instead of tuples; CLI checks and mountScene validate this data.
		const bundle = await hostedBundle(
			example.bundle as unknown as RuntimeBundle
		);
		if (current !== revision) return;
		mounted?.destroy();
		mounted = mountScene(container, bundle, {
			label: 'AI agent and software workflow example',
			controller: {}
		});
		renderSceneControls(mounted, example);
		mounted.controller?.setProgress(0);
		updateDescription(example.descriptions[0], 0, example.labels.length);
		const edit = document.querySelector<HTMLAnchorElement>(
			'#asset-edit-example'
		);
		if (edit)
			edit.href = `${import.meta.env.BASE_URL.replace(/\/+$/, '')}/editor/?example=${key}`;
	};
	const load = () =>
		show().catch(() => {
			container.textContent =
				'Download the example YAML below to explore this story in the editor.';
		});
	picker?.addEventListener('change', load);
	window.addEventListener('beforeunload', () => mounted?.destroy(), {
		once: true
	});
	load();
}

function renderSceneControls(
	mounted: ReturnType<typeof mountScene>,
	example: (typeof examples)[keyof typeof examples]
): void {
	const controls = document.querySelector<HTMLElement>('.scene-controls');
	if (!controls) return;
	controls.replaceChildren();
	controls.style.setProperty('--scene-steps', String(example.labels.length));
	example.labels.forEach((label, index) => {
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = `${String(index + 1).padStart(2, '0')} ${label}`;
		button.dataset.progress = String(index / (example.labels.length - 1));
		button.setAttribute('aria-pressed', String(index === 0));
		button.addEventListener('click', () => {
			mounted?.controller?.setProgress(Number(button.dataset.progress));
			controls.querySelectorAll('button').forEach((control) => {
				control.setAttribute('aria-pressed', String(control === button));
			});
			updateDescription(
				example.descriptions[index],
				index,
				example.labels.length
			);
		});
		controls.append(button);
	});
}

function updateDescription(
	description: string,
	index: number,
	count: number
): void {
	const counter = document.getElementById('asset-scene-counter');
	const text = document.getElementById('asset-scene-description');
	if (counter)
		counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`;
	if (text) text.textContent = description;
}

async function hostedBundle(source: RuntimeBundle): Promise<RuntimeBundle> {
	const bundle = structuredClone(source);
	const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
	for (const asset of Object.values(bundle.assets ?? {})) {
		if (asset.url) asset.url = `${base}/${asset.url.replace(/^\.\//, '')}`;
	}
	const { _digest, ...unsigned } = bundle;
	const bytes = new TextEncoder().encode(JSON.stringify(normalize(unsigned)));
	const hash = await crypto.subtle.digest('SHA-256', bytes);
	bundle._digest = Array.from(new Uint8Array(hash), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');
	return bundle;
}

function normalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(normalize);
	if (!value || typeof value !== 'object') return value;
	return Object.fromEntries(
		Object.entries(value)
			.filter(([, item]) => item !== undefined)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.map(([key, item]) => [key, normalize(item)])
	);
}
