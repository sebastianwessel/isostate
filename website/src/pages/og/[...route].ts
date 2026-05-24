import { OGImageRoute } from 'astro-og-canvas';
import { existsSync } from 'node:fs';
import { docs } from '../../docs';

type OgPage = {
	title: string;
	description: string;
};

const homeDescription =
	'YAML-authored isometric visual stories for documentation, product tours, and technical explainers.';

const pages: Record<string, OgPage> = {
	index: {
		title: 'isostate',
		description: homeDescription
	},
	...Object.fromEntries(
		docs.map((doc) => [
			`docs/${doc.slug}`,
			{
				title: `${doc.title} | isostate`,
				description: `Documentation for ${doc.title.toLowerCase()} in isostate.`
			}
		])
	)
};

const localFontCandidates = [
	'/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
	'/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
	'/System/Library/Fonts/Supplemental/Arial.ttf',
	'/System/Library/Fonts/SFNS.ttf'
];

const localFont = localFontCandidates.find((fontPath) => existsSync(fontPath));

export const { getStaticPaths, GET } = await OGImageRoute({
	param: 'route',
	pages,
	getImageOptions: (path, page) => ({
		title: page.title,
		description: page.description,
		bgImage: {
			path:
				path === 'index'
					? './assets/isostate-story/editor-overview.png'
					: './assets/isostate-story/hero-tilt-shift-city.png',
			fit: 'cover'
		},
		bgGradient: [
			[8, 63, 53],
			[246, 243, 234]
		],
		border: {
			color: [120, 217, 186],
			side: 'block-end',
			width: 18
		},
		font: {
			title: {
				color: [255, 253, 245],
				size: 82,
				weight: 'normal'
			},
			description: {
				color: [236, 230, 215],
				size: 36
			}
		},
		fonts: localFont ? [localFont] : undefined,
		padding: 72
	})
});
