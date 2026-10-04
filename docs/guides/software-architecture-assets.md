# Software Architecture Assets

The software collection supplies 20 photorealistic isometric objects for
architecture diagrams, workflow stories, and business processes. The objects
share a camera angle, material palette, soft lighting, and transparent
backgrounds so they work together in one scene.

Browse and download the collection on the
[asset showcase](https://sebastianwessel.github.io/isostate/assets/). Choose
**Build with these assets** to open the three-scene example in the editor.
The collection is available in the editor's asset browser alongside the existing
city, traffic, and AWS catalogs.

## Choose An Object

| Family | Logical sprite ids |
|---|---|
| Architecture | `architecture-browser`, `architecture-api-gateway`, `architecture-service`, `architecture-database`, `architecture-cache`, `architecture-queue`, `architecture-worker`, `architecture-load-balancer`, `architecture-storage`, `architecture-cloud`, `architecture-container`, `architecture-observability` |
| Workflow | `workflow-start`, `workflow-end`, `workflow-task`, `workflow-decision`, `workflow-event` |
| Process | `process-approval`, `process-document`, `process-scheduler` |

Each logical object is a sprite cropped from a transparent PNG sheet. The sheet
namespace itself cannot be placed. Scene elements use the logical ids above;
the renderer uses the compiled pixel rectangles to display the chosen object.

Use labels to explain your domain and real `connections` to show direction.
A queue asset identifies a queue; it does not define message delivery behavior.
Decision branches should have their own clear lanes and outcome labels.

## Install And Host The Collection

The runtime package includes the catalog as static files:

```bash
npm install @sebastianwessel/isostate
mkdir -p public/assets
cp -R node_modules/@sebastianwessel/isostate/dist/assets/software-architecture \
  public/assets/software-architecture
```

This copies the sheets, editor manifest, and license. Serve the folder from
your host's public asset directory. For a site hosted under `/my-app`, the public
URL is `/my-app/assets/software-architecture`; include that prefix in your
`assetBaseUrl` and manifest URL.

You can also download a sheet from a card on the showcase and download its
**Editor manifest**. Keep the sheet paths relative to the manifest unchanged.
The included MIT license allows use and adaptation; preserve the license notice
when redistributing the catalog.

## Use The Editor

Pass the catalog's manifest URL to the editor:

```ts
mountEditor(document.querySelector('#editor')!, {
  assetManifestUrls: ['/assets/software-architecture/manifest.json'],
});
```

The editor exposes individual sprites with their labels and checked anchors.
Placing an object adds the appropriate sheet declaration and logical sprite
reference to YAML. Use the editor's YAML export as the starting point for manual
authoring instead of guessing image rectangles.

## Start From The Example

Download the
[sample YAML](https://sebastianwessel.github.io/isostate/scenes/software-architecture.isostate.yaml)
and place it beside your website entry page. Its asset root is
`./assets/software-architecture`. Change that root to your actual served URL,
including any deployment prefix. The sample has three scene stops:

1. Architecture: client → gateway → service → database.
2. Workflow: start → task → decision → finish.
3. Process: schedule → document → approval → delivery.

Each stop removes the previous connections and their endpoint elements before
adding the next example. Caption labels keep the object roles visible. All
placements use whole grid cells, and each asset uses its native one-cell size.

Validate and compile after changing the YAML:

```bash
npx --package @sebastianwessel/isostate-cli isostate validate scene.isostate.yaml
npx --package @sebastianwessel/isostate-cli isostate compile scene.isostate.yaml \
  --out public/scene.isostate.js
```

Mount the compiled scene through `mountScene`. The browser receives runtime data
and PNG files; no YAML parser or compiler is needed on the page. For a complete
static output directory, follow [Deploy Static Bundle](./deploy-static-bundle.md).

## Maintain The Repository Example

The source catalog lives in `assets/software-architecture`. Its manifest records
exact sheet dimensions, sprite rectangles, labels, and anchors. Do not change
those numbers only in a scene to compensate for a crop or contact-point error;
fix the source metadata and regenerate the manifest.

```bash
bun run assets:build
```

This regenerates the source manifest, packaged catalog, website copy, showcase
asset declarations, compiled sample, and downloadable files. The authored
timeline remains in `website/src/scenes/software-architecture.isostate.yaml`.
