# Flow: YAML to Static Website Bundle

## Actor

Developer adding an isostate scene to a static website, documentation site, or
application public asset folder.

## Trigger

Developer runs `isostate bundle` against a `.isostate.yaml` source file.

## Preconditions

- Dependencies are installed in the development environment.
- The YAML file validates against the scene schema.
- External URL assets referenced by the scene exist under the configured
  `--asset-dir` or absolute asset paths. This includes standalone SVG files and
  sprite sheet image files referenced by logical sprite ids.
- The output directory is writable.

## Happy Path

1. Developer authors `scene.isostate.yaml`.
2. Developer runs:

   ```bash
   isostate bundle scene.isostate.yaml --out public/isostate/scene
   ```

3. CLI parses and validates the YAML.
4. CLI resolves referenced external assets and excludes built-in generated
   assets.
5. CLI compiles the runtime scene data with asset URLs rewritten to
   `./assets/<file>`.
6. CLI writes `scene.isostate.js`.
7. CLI writes or copies `isostate.runtime.js`.
8. CLI copies referenced external asset source files into `assets/`, including
   standalone SVG assets and sprite sheet image files.
9. CLI writes `manifest.json`.
10. Website code imports the runtime and scene bundle from the public directory.
11. Browser calls `mountScene(target, sceneBundle, options)`.

## Website Usage

```html
<div id="scene"></div>
<script type="module">
  import { mountScene } from './isostate/scene/isostate.runtime.js';
  import sceneBundle from './isostate/scene/scene.isostate.js';

  mountScene(document.querySelector('#scene'), sceneBundle, {
    controller: {}
  });
</script>
```

## Failure Paths

| Step | Failure | Result |
|---|---|---|
| parse | invalid YAML | CLI exits `1`, no bundle published |
| validate | semantic errors | CLI exits `1`, no bundle published |
| asset resolution | referenced SVG missing | CLI exits `1`, reports asset id and source path |
| compile | missing URL source after rewrite | CLI exits `1` |
| write | output directory not writable | CLI exits `1`, reports output path |
| browser import | wrong public path | browser module load fails; inspect manifest paths |
| runtime mount | digest mismatch or incompatible bundle | runtime throws structured bundle error |

## Verification

Default tests are local process tests and do not require a browser:

```bash
bun test tests/cli/bundle.test.ts
```

Browser smoke tests remain opt-in:

```bash
ISOSTATE_BROWSER_TESTS=1 bun test tests/browser/static-bundle.test.ts
```
