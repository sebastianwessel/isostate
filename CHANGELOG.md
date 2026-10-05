# Changelog

## 0.6.0

- Disclose OpenAI image-model generation in asset licence/provenance notices, website credits, downloadable catalogs, and the npm asset distribution.

- Add a local Mermaid workbench with source examples, line diagnostics, YAML copy/download, and direct editor handoff; preserve node and branch labels, reverse reading directions, fan-out, and dotted/thick links in deterministic conversion.
- Refresh the Mermaid tutorial illustrations and native-cell layout, add manual story navigation and reduced-motion controls, and keep conversion docs, agent skills, source examples, and compiled bundles in sync.
- Give homepage showcase captions a separate layout band and a contrasting outline for readable desktop and mobile scenes.

- Rebuild the overview around a moving request through software architecture, asynchronous processing, AI review, and human approval, with smooth step navigation, scroll scrubbing, pause, and reduced-motion controls.
- Restore lifecycle transitions when timeline seeks skip scene stops; prioritize scrubbing over in-flight navigation and preserve runtime camera/effects in editor preview.
- Fix editor pan scaling, centered zoom, object grab offsets, pointer capture/cancellation, and return-to-edit navigation after timeline scrubbing; synchronize the authoring docs and skill.

- Add rounded dimensional beam connections, configurable glow, moving packet/orb/envelope messages, and element activity indicators with pause and reduced-motion support.
- Support scene-step image/sprite swaps while preserving element identity and connections; expose workflow controls in the editor and make the agentic example the hosted editor default.
- Upgrade agentic and provider examples with selective traffic and work states, add gallery motion controls, and distinguish human-to-human, human-to-AI, and AI-to-human handoffs.

- Add an optional catalog of 94 photorealistic isometric assets for software architecture, AI agents, human workflows, intake channels, ServiceNow records, providers, and supporting infrastructure, with transparent PNG sprites, checked anchors, a reusable manifest, and generation provenance.
- Include the catalog in the core package and add a website gallery with downloads, runnable architecture, human-to-agent migration, and provider-routing examples, and editor integration.
- Update direct dependencies to their latest stable releases, including TypeScript 7, Astro 7, React 19.3, Biome, and Bun 1.4.2. Use esbuild for JavaScript transforms and TypeScript for declarations and type checks.
- Refresh generated scene and static deployment bundles for the 0.6.0 compiler and runtime.
- Strengthen release checks for workspace versions, exact internal dependencies, npm version availability, and pinned tooling. Serialize release and manual website deployments and keep npm publication limited to the core and CLI packages.

The asset catalog is loaded separately from the browser runtime. The runtime remains dependency-free and within its 20 KB gzip budget. The DSL and runtime bundle formats remain compatible.
