import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
	output: 'static',
	site: 'https://sebastianwessel.github.io',
	base: '/isostate',
	integrations: [sitemap()]
});
