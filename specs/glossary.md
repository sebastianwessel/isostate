# Glossary

| Term | Meaning |
|---|---|
| SceneDocument | Parsed authored YAML containing `header` and ordered `scenes`. |
| Header | Document-level catalog and render settings: assets, grid, floor, layout, layers, theme, and root CSS class. |
| SceneStep | One timeline stop. The first scene is a full snapshot; later scenes are deltas. |
| Delta | A scene-local element or connector operation applied to the previous scene. |
| Element | Placed asset instance in a scene operation. |
| Connector | Generated SVG ground-plane route with style, endpoints, direction, lifecycle, and animation metadata. |
| RuntimeBundle | Compiled browser data with resolved scenes, layout, floor, layers, theme, and optional embedded assets. |
