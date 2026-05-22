import { OGImageRoute } from 'astro-og-canvas';
import { docs } from '../../docs';

type OgPage = {
	title: string;
	description: string;
};

const homeDescription =
	'Compile YAML into lightweight SVG scenes for scroll-driven product stories, documentation, and technical explainers.';

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

export const { getStaticPaths, GET } = await OGImageRoute({
	param: 'route',
	pages,
	getImageOptions: (_path, page) => ({
		title: page.title,
		description: page.description,
		bgImage: {
			path: './assets/isostate-story/hero-tilt-shift-city.png',
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
				weight: 'bold'
			},
			description: {
				color: [236, 230, 215],
				size: 36
			}
		},
		padding: 72
	})
});
