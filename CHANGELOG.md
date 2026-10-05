# Changelog

## 0.6.0

- Add an optional catalog of 20 photorealistic isometric assets for software architecture, workflows, and business processes, with transparent PNG sprites, checked anchors, a reusable manifest, and generation provenance.
- Include the catalog in the core package and add a website gallery with downloads, a runnable architecture example, and editor integration.
- Update direct dependencies to their latest stable releases, including TypeScript 7, Astro 7, React 19.3, Biome, and Bun 1.4.2. Use esbuild for JavaScript transforms and TypeScript for declarations and type checks.
- Refresh generated scene and static deployment bundles for the 0.6.0 compiler and runtime.
- Strengthen release checks for workspace versions, exact internal dependencies, npm version availability, and pinned tooling. Serialize release and manual website deployments and keep npm publication limited to the core and CLI packages.

The asset catalog is loaded separately from the browser runtime. The runtime remains dependency-free and within its 20 KB gzip budget. The DSL and runtime bundle formats remain compatible.
