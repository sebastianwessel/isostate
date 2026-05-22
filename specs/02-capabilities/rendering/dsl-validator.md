# Capability: DSL Validator

## Overview

The DSL validator checks semantic correctness of a parsed `SceneDocument`. It validates the authored header and scene-delta timeline before the compiler expands deltas into runtime snapshots.

The validator runs after parsing and before compilation. It never runs in the browser bundle.

## Validation Phases

### Phase 1: Header And Asset URL Validation

| Check | Rule | Error Code |
|---|---|---|
| Asset catalog exists | `header.assets` contains at least one entry unless every placement uses built-in generated assets | `NO_ASSETS` |
| Duplicate asset ids | `header.assets[].id` values are unique | `DUPLICATE_ASSET_ID` |
| Reserved built-in ids | `header.assets[].id` must not be `text`, `rectangle`, `circle`, `polygon`, or `line` | `BUILTIN_ASSET_ID_RESERVED` |
| Asset URL source | Each declared external asset can resolve to a URL through `header.assetBaseUrl` plus asset `path` or `id` | `ASSET_URL_REQUIRED` |
| Asset anchor | `header.assets[].anchor`, when supplied, is a normalized `[x, y]` tuple where both values are `0..1` | `INVALID_ASSET_ANCHOR` |
| Floor config | `header.floor`, when present, is a mapping | `DSL_SCHEMA_TYPE_ERROR` |
| Floor size | `header.floor.size`, when present, is a positive `[columns, rows]` tuple | `INVALID_FLOOR_SIZE` |
| Floor layer | `header.floor.layer`, when supplied, references a declared layer | `LAYER_NOT_FOUND` |
| Floor asset | `header.floor.asset`, when supplied, is declared in `header.assets` | `ASSET_NOT_DECLARED` |
| Layers exist | `header.layers` contains at least one layer | `NO_LAYERS` |
| Duplicate layer names | `header.layers[].name` values are unique | `DUPLICATE_LAYER_NAME` |

### Phase 2: Scene Timeline Validation

| Check | Rule | Error Code |
|---|---|---|
| Scenes exist | `scenes` contains at least one item | `NO_SCENES` |
| Duplicate scene ids | `scenes[].id` values are unique | `DUPLICATE_SCENE_ID` |
| Initial scene shape | First scene has `elements` and no `add`, `update`, or `remove` | `INVALID_INITIAL_SCENE` |
| Initial scene shape | First scene may use `connections`, but no operation fields | `INVALID_INITIAL_SCENE` |
| Delta scene shape | Later scenes do not use top-level `elements` or `connections`; they may use `add`, `update`, and `remove` operation sections | `INVALID_SCENE_DELTA` |

Authored scenes are ordered steps. They do not accept scene-level progress fields;
the compiler derives runtime progress from scene order.

### Phase 3: Element Delta Validation

The validator walks scenes in order and maintains a resolved presence map.

| Check | Rule | Error Code |
|---|---|---|
| Initial duplicate ids | First scene has unique `elements[].id` values | `DUPLICATE_ELEMENT_ID` |
| Add id is absent | `add.elements[].id` is not currently present | `ELEMENT_ALREADY_PRESENT` |
| Update id is present | `update.elements[].id` is currently present | `ELEMENT_NOT_PRESENT` |
| Remove id is present | `remove.elements[].id` is currently present | `ELEMENT_NOT_PRESENT` |
| Update/remove conflict | Same id is not both updated and removed in one scene | `ELEMENT_DELTA_CONFLICT` |
| Declared asset | Placement `asset` exists in `header.assets` | `ASSET_NOT_DECLARED` |
| Built-in text payload | Text placements define valid `text.value`; text updates may provide sparse nested text fields; non-text assets do not define `text` | `TEXT_CONTENT_REQUIRED`, `TEXT_CONTENT_FOR_NON_TEXT_ASSET`, `INVALID_TEXT_CONTENT`, `INVALID_TEXT_STYLE` |
| Built-in primitive payload | Primitive placements define exactly one matching `primitive` payload; primitive updates may provide sparse nested primitive fields; external assets do not define `primitive` | `PRIMITIVE_CONTENT_REQUIRED`, `PRIMITIVE_CONTENT_MISMATCH`, `INVALID_PRIMITIVE_POINTS`, `INVALID_PRIMITIVE_STYLE`, `GENERATED_CONTENT_FOR_EXTERNAL_ASSET` |
| Declared layer | Placement/patch `layer` exists in `header.layers` | `LAYER_NOT_FOUND` |
| Valid position | `at` tuple contains finite non-negative numbers | `INVALID_POSITION` |
| Valid size | Placement `size` is a positive whole-grid-cell count; update patch `size` is a whole-grid-cell count and may be `0` | `INVALID_SIZE` |
| Known animation | `enter` and `exit` values are built-ins or registered custom names | `UNKNOWN_ANIMATION` |
| Known ambient | `ambient[].name` is built-in or registered custom CSS | `UNKNOWN_AMBIENT_ANIMATION` |

The authored DSL must not use `pos`, `states`, `keyframes`, or `lifecycle.status`. The parser should reject these as `UNKNOWN_FIELD` before semantic validation.

For patches, `text` is legal only when the target element is already a text
element. Patch text payloads merge field-by-field with the previous resolved
text payload. `primitive` follows the same rule for primitive elements, using
the child key that matches the element's primitive asset id.

When an element is removed, the validator must inspect the resolved connection
map before applying removals. Any present connection that references the removed
element through `from.element` or `to.element` must also appear in
`remove.connections` in the same scene. The validator must not silently cascade
connection removal.

### Phase 3b: Connector Delta Validation

The validator walks scenes in order and maintains a resolved connector presence
map independently from elements.

| Check | Rule | Error Code |
|---|---|---|
| Initial duplicate connector ids | First scene has unique `connections[].id` values | `DUPLICATE_CONNECTOR_ID` |
| Element/connector id collision | Connector ids must not collide with element ids in the document | `DUPLICATE_SCENE_OBJECT_ID` |
| Add connector id is absent | `add.connections[].id` is not currently present | `CONNECTOR_ALREADY_PRESENT` |
| Update connector id is present | `update.connections[].id` is currently present | `CONNECTOR_NOT_PRESENT` |
| Remove connector id is present | `remove.connections[].id` is currently present | `CONNECTOR_NOT_PRESENT` |
| Update/remove connector conflict | Same id is not both updated and removed in one scene | `CONNECTOR_DELTA_CONFLICT` |
| Removed endpoint element | A connection referencing an element removed in this scene is also removed in this scene | `CONNECTION_ENDPOINT_REMOVED` |
| Declared layer | Connector `layer` exists in `header.layers` | `LAYER_NOT_FOUND` |
| Route source | Connector uses either `route` or both `from` and `to`, not both | `INVALID_CONNECTOR_ROUTE` |
| Valid route | Manual `route` has at least two finite non-negative whole-grid `[x, y]` points, and every segment changes only one grid axis | `INVALID_CONNECTOR_ROUTE` |
| Endpoint refs | `from`/`to` endpoint refs resolve element ids or explicit grid points | `CONNECTOR_ENDPOINT_NOT_FOUND`, `INVALID_CONNECTOR_ROUTE` |
| Routing config | `routing` is valid only for endpoint-routed connectors and has supported values | `INVALID_CONNECTOR_ROUTING` |
| Valid pattern | `style.pattern` is `solid`, `dashed`, or `dotted` | `INVALID_CONNECTOR_STYLE` |
| Valid variant | `style.variant` is `line` or `road` | `INVALID_CONNECTOR_STYLE` |
| Valid endpoint | `start`/`end` is `none`, `arrow`, `dot`, `circle`, `diamond`, or `bar` | `INVALID_CONNECTOR_ENDPOINT` |
| Valid direction | `direction` is `route` or `reverse` | `INVALID_CONNECTOR_DIRECTION` |
| Valid style numbers | stroke, outline, opacity, and dash fields are finite and in range | `INVALID_CONNECTOR_STYLE` |
| Known animation | `enter` and `exit` values are built-ins or registered custom names | `UNKNOWN_ANIMATION` |
| Known ambient | `ambient[].name` is valid for connectors; built-in `flow` is allowed | `UNKNOWN_AMBIENT_ANIMATION` |

### Phase 4: Cross-Reference And Warnings

| Check | Rule | Code |
|---|---|---|
| Unused declared asset | Asset declared but never used by any placement | `UNREFERENCED_ASSET` warning |
| Unused layer | Layer has no element in any resolved scene | `UNREFERENCED_LAYER` warning |
| Floor/content outside bounds | Element or connector route lies outside `floor.size` when `layout.bounds` is `floor` | `ELEMENT_OUTSIDE_FLOOR` or `CONNECTOR_OUTSIDE_FLOOR` warning |

## Validation Report

```ts
interface ValidationReport {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  isValid: boolean;
}

interface ValidationIssue {
  code: string;
  message: string;
  sceneId?: string;
  elementId?: string;
  assetName?: string;
  layerName?: string;
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
}
```

## Validator API

```ts
interface DSLValidator {
  validate(document: SceneDocument): ValidationReport;
  resolveSceneSnapshots(document: SceneDocument): ResolvedSceneSnapshot[];
}
```

`resolveSceneSnapshots` is a dev-time helper used by tests and compiler diagnostics. It must not be imported by the browser runtime.
