import { mountScene } from '../../../packages/core/src/index.ts';
import type { RuntimeBundle } from '../../../packages/core/src/types/runtime-bundle.ts';
import source from '../scenes/product-story.isostate.js';

type Mounted = ReturnType<typeof mountScene>;

/** Mount the precompiled homepage story, with scene navigation and scroll scrubbing. */
export function initializeOverview(): void {
	const target = document.querySelector<HTMLElement>('#isostate-demo');
	if (!target) return;
	mountOverview(target).catch(() => {
		target.textContent =
			'Explore the software workflow in the editor to see every scene.';
		target.dataset.error = 'scene-load-failed';
		target.setAttribute('role', 'status');
	});
}

async function mountOverview(target: HTMLElement): Promise<void> {
	const bundle = await hostedBundle(source as unknown as RuntimeBundle);
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
	const mounted = mountScene(target, bundle, {
		label: 'A software request from browser to delivery',
		controller: {
			transitionDuration: 720,
			transitionEasing: 'ease-in-out'
		},
		themeVars: {
			'--isostate-floor-stroke': 'rgba(17, 60, 46, 0.09)',
			'--isostate-floor-fill': 'rgba(245, 247, 238, 0.64)'
		}
	});
	const chapters = Array.from(
		document.querySelectorAll<HTMLElement>('.chapter')
	);
	const cancelScrub = bindScrubbing(mounted, chapters);
	bindNavigation(mounted, target, chapters, cancelScrub, reduced);
	mounted.controller?.on('progress-change', (progress) =>
		updateStory(chapters, progress)
	);
	mounted.controller?.setProgress(0);
	updateStory(chapters, 0);
	window.addEventListener('beforeunload', () => mounted.destroy(), {
		once: true
	});
}

function bindNavigation(
	mounted: Mounted,
	target: HTMLElement,
	chapters: HTMLElement[],
	cancelScrub: () => void,
	reduced: MediaQueryList
): void {
	const navigate = (index: number) => {
		cancelScrub();
		if (reduced.matches)
			mounted.controller?.setProgress(index / (chapters.length - 1));
		else mounted.controller?.setSceneIndex(index);
		const status = document.getElementById('scene-status');
		if (status)
			status.textContent = `Scene ${index + 1} of ${chapters.length}: ${chapters[index]?.dataset.title ?? ''}`;
	};
	document
		.querySelectorAll<HTMLButtonElement>('[data-scene-index]')
		.forEach((button) => {
			button.addEventListener('click', () =>
				navigate(Number(button.dataset.sceneIndex))
			);
		});
	const current = () =>
		Math.round(
			(mounted.controller?.getProgress() ?? 0) * (chapters.length - 1)
		);
	document
		.getElementById('story-prev')
		?.addEventListener('click', () => navigate(Math.max(0, current() - 1)));
	document
		.getElementById('story-next')
		?.addEventListener('click', () =>
			navigate(Math.min(chapters.length - 1, current() + 1))
		);
	bindEffectsControl(target, reduced);
}

function bindEffectsControl(
	target: HTMLElement,
	reduced: MediaQueryList
): void {
	const button = document.querySelector<HTMLButtonElement>('#story-motion');
	const update = (paused: boolean) => {
		target.classList.toggle('effects-paused', paused);
		if (!button) return;
		button.textContent = paused ? 'Resume effects' : 'Pause effects';
		button.setAttribute('aria-pressed', String(paused));
	};
	update(reduced.matches);
	button?.addEventListener('click', () =>
		update(!target.classList.contains('effects-paused'))
	);
	reduced.addEventListener('change', () => update(reduced.matches));
}

function bindScrubbing(mounted: Mounted, chapters: HTMLElement[]): () => void {
	let pendingFrame = 0;
	const cancel = () => {
		cancelAnimationFrame(pendingFrame);
		pendingFrame = 0;
	};
	const schedule = () => {
		if (pendingFrame) return;
		pendingFrame = requestAnimationFrame(() => {
			pendingFrame = 0;
			const marker = window.scrollY + window.innerHeight * 0.55;
			const anchors = chapters.map((chapter) => {
				const rect = chapter.getBoundingClientRect();
				return window.scrollY + rect.top + rect.height * 0.3;
			});
			mounted.controller?.setProgress(progressAtMarker(anchors, marker));
		});
	};
	window.addEventListener('scroll', schedule, { passive: true });
	window.addEventListener('resize', schedule);
	return cancel;
}

/** Interpolate between chapter anchors; clamp before the first and after the last. */
export function progressAtMarker(anchors: number[], marker: number): number {
	if (anchors.length < 2 || marker <= anchors[0]) return 0;
	for (let index = 1; index < anchors.length; index++) {
		if (marker > anchors[index]) continue;
		const start = anchors[index - 1];
		const local = Math.max(
			0,
			Math.min(1, (marker - start) / Math.max(1, anchors[index] - start))
		);
		return (index - 1 + local) / (anchors.length - 1);
	}
	return 1;
}

function updateStory(chapters: HTMLElement[], progress: number): void {
	const active = Math.round(progress * (chapters.length - 1));
	const chapter = chapters[active];
	chapters.forEach((item, index) => {
		item.classList.toggle('is-active', index === active);
	});
	const title = document.getElementById('scene-title');
	const counter = document.getElementById('scene-index');
	const bar = document.getElementById('scene-progress-bar');
	if (title) title.textContent = chapter?.dataset.title ?? '';
	if (counter) counter.textContent = chapter?.dataset.index ?? '';
	if (bar) bar.style.inlineSize = `${progress * 100}%`;
	document
		.querySelectorAll<HTMLButtonElement>('[data-scene-index]')
		.forEach((button) => {
			button.setAttribute(
				'aria-pressed',
				String(Number(button.dataset.sceneIndex) === active)
			);
		});
	const previous = document.querySelector<HTMLButtonElement>('#story-prev');
	const next = document.querySelector<HTMLButtonElement>('#story-next');
	if (previous) previous.disabled = active === 0;
	if (next) next.disabled = active === chapters.length - 1;
}

async function hostedBundle(source: RuntimeBundle): Promise<RuntimeBundle> {
	const bundle = structuredClone(source);
	const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
	for (const asset of Object.values(bundle.assets)) {
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
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, item]) => [key, normalize(item)])
	);
}
