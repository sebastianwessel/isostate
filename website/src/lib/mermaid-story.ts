import mermaidWorkflowSheetUrl from '../../../assets/isostate-story/mermaid-workflow-sheet.png?url';
import { mountScene } from '../../../packages/core/src/index.ts';
import type { RuntimeBundle } from '../../../packages/core/src/types/runtime-bundle.ts';
import source from '../scenes/mermaid-workflow.isostate.js';

/** The tutorial renders a compiled story; conversion is a separate authoring tool. */
export function initializeMermaidStory(): void {
	const target = document.querySelector<HTMLElement>('#mermaid-workflow-scene');
	if (!target) return;
	mountMermaidStory(target).catch(() => {
		target.textContent =
			'The story preview could not load. The conversion tool and workflow guide are still available.';
		target.dataset.error = 'scene-load-failed';
		target.setAttribute('role', 'status');
	});
}

async function mountMermaidStory(target: HTMLElement): Promise<void> {
	const bundle = structuredClone(source) as unknown as RuntimeBundle;
	for (const asset of Object.values(bundle.assets ?? {}))
		asset.url = mermaidWorkflowSheetUrl;
	bundle._digest = await digestBundle(bundle);
	const mounted = mountScene(target, bundle, {
		label: 'Six steps from Mermaid source to an isostate visual story',
		controller: { transitionDuration: 600, transitionEasing: 'ease-in-out' },
		themeVars: {
			'--isostate-floor-stroke': 'rgba(17, 20, 23, 0.1)',
			'--isostate-floor-fill': 'rgba(255, 255, 255, 0.22)',
			'--mermaid-label': '#182d28'
		}
	});
	const story = document.getElementById('mermaid-story');
	const chapters = Array.from(
		story?.querySelectorAll<HTMLElement>('.chapter') ?? []
	);
	const steps = Array.from(
		story?.querySelectorAll<HTMLButtonElement>('[data-mermaid-step]') ?? []
	);
	const follow = document.querySelector<HTMLButtonElement>('#mermaid-follow');
	const effects = document.querySelector<HTMLButtonElement>('#mermaid-effects');
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
	const events = new AbortController();
	const options = { signal: events.signal };
	let followScroll = !reduced.matches;
	let pendingFrame = 0;
	let destroyed = false;
	let lastIndex = -1;

	function setFollow(value: boolean): void {
		followScroll = value;
		follow?.setAttribute('aria-pressed', String(value));
		if (value) scheduleScrollUpdate();
	}
	function setEffects(paused: boolean): void {
		target.classList.toggle('effects-paused', paused);
		effects?.setAttribute('aria-pressed', String(paused));
		if (effects)
			effects.textContent = paused ? 'Resume effects' : 'Pause effects';
	}
	function setScene(
		index: number,
		progress: number,
		announce = false,
		render = true
	): void {
		const chapter = chapters[index];
		if (!chapter) return;
		if (render) mounted.controller?.setProgress(progress);
		if (index !== lastIndex) {
			lastIndex = index;
			chapters.forEach((item, position) => {
				item.classList.toggle('is-active', position === index);
			});
			steps.forEach((button, position) => {
				button.setAttribute('aria-pressed', String(position === index));
			});
			const title = document.getElementById('scene-title');
			const counter = document.getElementById('scene-index');
			if (title) title.textContent = chapter.dataset.title ?? '';
			if (counter) counter.textContent = chapter.dataset.index ?? '';
		}
		const bar = document.getElementById('scene-progress-bar');
		if (bar) bar.style.inlineSize = `${Math.max(5, progress * 100)}%`;
		if (announce) {
			const status = document.getElementById('mermaid-scene-status');
			if (status)
				status.textContent = `Step ${index + 1} of ${chapters.length}: ${chapter.dataset.title ?? ''}`;
		}
	}
	function scheduleScrollUpdate(): void {
		if (!followScroll || pendingFrame || destroyed) return;
		pendingFrame = requestAnimationFrame(() => {
			pendingFrame = 0;
			if (!followScroll || destroyed) return;
			updateSceneFromScroll();
		});
	}
	function updateSceneFromScroll(): void {
		const stops = chapters.map((chapter) => {
			const rect = chapter.getBoundingClientRect();
			return {
				progress: Number(chapter.dataset.progress ?? '0'),
				anchor: window.scrollY + rect.top + rect.height * 0.42
			};
		});
		if (!stops.length) return;
		const marker = window.scrollY + window.innerHeight * 0.52;
		let active = 0;
		for (let i = 1; i < stops.length; i++) {
			if (
				Math.abs(stops[i].anchor - marker) <
				Math.abs(stops[active].anchor - marker)
			)
				active = i;
		}
		let progress = stops[0].progress;
		for (let i = 1; i < stops.length; i++) {
			const previous = stops[i - 1];
			const next = stops[i];
			if (marker <= next.anchor) {
				const local = Math.min(
					1,
					Math.max(
						0,
						(marker - previous.anchor) /
							Math.max(1, next.anchor - previous.anchor)
					)
				);
				progress =
					previous.progress + (next.progress - previous.progress) * local;
				break;
			}
			progress = next.progress;
		}
		setScene(active, reduced.matches ? stops[active].progress : progress);
	}
	steps.forEach((button, index) => {
		button.addEventListener(
			'click',
			() => {
				setFollow(false);
				setScene(
					index,
					Number(chapters[index]?.dataset.progress ?? 0),
					true,
					reduced.matches
				);
				if (!reduced.matches) mounted.controller?.setSceneIndex(index);
			},
			options
		);
	});
	follow?.addEventListener('click', () => setFollow(!followScroll), options);
	effects?.addEventListener(
		'click',
		() => setEffects(!target.classList.contains('effects-paused')),
		options
	);
	reduced.addEventListener(
		'change',
		() => {
			setEffects(reduced.matches);
			setFollow(!reduced.matches);
		},
		options
	);
	window.addEventListener('scroll', scheduleScrollUpdate, {
		...options,
		passive: true
	});
	window.addEventListener('resize', scheduleScrollUpdate, options);
	window.addEventListener('pagehide', (event) => {
		if (event.persisted) return;
		destroyed = true;
		cancelAnimationFrame(pendingFrame);
		events.abort();
		mounted.destroy();
	});
	mounted.controller?.on('progress-change', (progress) => {
		setScene(
			Math.round(progress * (chapters.length - 1)),
			progress,
			false,
			false
		);
	});
	setScene(0, 0);
	setEffects(reduced.matches);
	setFollow(followScroll);
}

async function digestBundle(bundle: RuntimeBundle): Promise<string> {
	const { _digest, ...unsignedBundle } = bundle;
	const encoded = new TextEncoder().encode(
		JSON.stringify(normalizeValue(unsignedBundle))
	);
	const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoded));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
		''
	);
}

function normalizeValue(value: unknown): unknown {
	if (Array.isArray(value))
		return value.map((item) =>
			item === undefined ? null : normalizeValue(item)
		);
	if (
		!value ||
		typeof value !== 'object' ||
		Object.getPrototypeOf(value) !== Object.prototype
	)
		return value;
	const record = value as Record<string, unknown>;
	return Object.fromEntries(
		Object.keys(record)
			.sort()
			.filter((key) => record[key] !== undefined)
			.map((key) => [key, normalizeValue(record[key])])
	);
}
