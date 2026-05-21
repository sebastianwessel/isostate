# Install The Authoring Skill

isostate includes an AI agent skill for writing and reviewing scene DSL,
assets, connectors, generated bundles, and static deployment output. Install it
before asking an assistant to create or edit `.isostate.yaml` scenes.

The skill is published from this repository and can be installed with the
`skills` CLI.

## Install

Use the package runner for your project:

```bash
bunx skills add sebastianwessel/isostate --skill authoring-isostate-scenes
```

Equivalent package-runner forms:

```bash
npx skills add sebastianwessel/isostate --skill authoring-isostate-scenes
pnpm dlx skills add sebastianwessel/isostate --skill authoring-isostate-scenes
yarn dlx skills add sebastianwessel/isostate --skill authoring-isostate-scenes
```

To install only for a specific agent, add `--agent`:

```bash
bunx skills add sebastianwessel/isostate \
  --skill authoring-isostate-scenes \
  --agent codex
```

To inspect the available skills before installing:

```bash
bunx skills add sebastianwessel/isostate --list --full-depth
```

## What It Adds

The `authoring-isostate-scenes` skill gives your assistant project-specific
rules for:

- writing the current `.isostate.yaml` scene-delta model
- using generated text and primitive assets correctly
- declaring external SVG assets with checked anchors
- using first-class connections instead of stretched arrow SVGs
- keeping source YAML and generated `.isostate.js` bundles in sync
- preserving the browser runtime boundary so parser, validator, compiler, and
  `yaml` stay out of browser bundles

## Verify

List installed project skills:

```bash
bunx skills list
```

Then ask your assistant to use the isostate authoring skill when creating or
reviewing scenes.

Next: [Getting Started](../getting-started.md).
