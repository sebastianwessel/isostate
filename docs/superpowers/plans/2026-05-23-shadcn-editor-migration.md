# Shadcn Editor Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `@sebastianwessel/isostate-editor` to shadcn/ui-based reusable components so standard controls use shadcn primitives instead of custom ad hoc markup.

**Architecture:** The editor becomes a normal React component package with an internal shadcn component layer under `packages/editor/src/ui/`. The package may use shadcn/Radix/Tailwind during editor implementation, but published consumers still import only `@sebastianwessel/isostate-editor` and `@sebastianwessel/isostate-editor/style.css`; they must not run shadcn or configure Tailwind. Domain-specific editor surfaces remain custom only where shadcn has no equivalent: SVG canvas, selection overlay, grid snapping, scene resolver, command model, and YAML integration.

**Tech Stack:** React 19, shadcn/ui Radix base, Tailwind CSS v4 for editor CSS generation, Radix primitives, lucide-react, CodeMirror 6, Bun, Biome, bun:test.

---

## Ground Rules

- Do not migrate the core runtime package to shadcn, Tailwind, Radix, or React.
- Do not import editor UI dependencies from `packages/core`.
- Do not require consumers of `@sebastianwessel/isostate-editor` to have a `components.json`, Tailwind config, or shadcn CLI.
- Prefer official shadcn components whenever one exists: `Button`, `Tabs`, `Select`, `Slider`, `ScrollArea`, `Resizable`, `Separator`, `Tooltip`, `Dialog`, `DropdownMenu`, `ContextMenu`, `Collapsible`, `Accordion`, `Input`, `Textarea`, `Label`, `Badge`, `Switch`.
- Keep custom components only for isostate-specific behavior: `CanvasView`, `SelectionOverlay`, scene tree semantics, asset preview tiles, DSL command mapping, YAML editor wrapper.
- Each task must end with a passing focused test command before committing.

## Target File Structure

- Create `components.json`: shadcn project configuration scoped to the editor package.
- Create `packages/editor/src/lib/utils.ts`: `cn()` helper used by shadcn components.
- Create `packages/editor/src/ui/*.tsx`: shadcn-managed reusable primitives.
- Create `packages/editor/src/ui/editor-shell.tsx`: editor-specific layout composition built from shadcn primitives.
- Create `packages/editor/src/ui/form-row.tsx`: small editor form helper only if shadcn `Field` is insufficient for dense inspector rows.
- Modify `packages/editor/src/style.css`: become the editor Tailwind/shadcn entry CSS plus isostate canvas/domain styles.
- Modify `rollup.config.ts`: externalize editor peer dependencies deliberately and keep CSS build separate.
- Modify `package.json`: add Tailwind/shadcn build scripts and editor UI dependencies.
- Modify `packages/editor/package.json`: declare runtime editor dependencies and peer React dependencies.
- Modify `packages/editor/src/IsostateEditor.tsx`: replace custom tab/button/resizer/select layout with shadcn components.
- Modify `packages/editor/src/assets/AssetPanel.tsx`: replace custom controls with shadcn inputs, buttons, scroll area, badge, and tooltip.
- Modify `packages/editor/src/scenes/SceneTreePanel.tsx`: replace custom disclosure/buttons/separators with shadcn collapsible, scroll area, context menu, button, badge.
- Modify `packages/editor/src/inspector/InspectorPanel.tsx`: replace custom form controls with shadcn fields, inputs, select, switch, slider, separator, buttons, alert dialog for deletion.
- Modify `packages/editor/src/canvas/CanvasView.tsx`: keep domain implementation, replace toolbar buttons/sliders/tooltips with shadcn primitives.
- Modify `tests/editor/*.test.tsx`: update selectors away from custom CSS classes where behavior should be accessible-role based.
- Modify `website/src/pages/editor.astro`: keep importing the packaged editor CSS, not Tailwind source files.

---

### Task 1: Initialize shadcn for the editor package

**Files:**
- Create: `components.json`
- Create: `packages/editor/src/lib/utils.ts`
- Modify: `package.json`
- Modify: `packages/editor/package.json`

- [ ] **Step 1: Confirm the current shadcn state**

Run:

```bash
bunx --bun shadcn@latest info --json
```

Expected: `config` is `null` before this task.

- [ ] **Step 2: Add shadcn configuration**

Create `components.json` with this content:

```json
{
	"$schema": "https://ui.shadcn.com/schema.json",
	"style": "new-york",
	"rsc": false,
	"tsx": true,
	"tailwind": {
		"config": "",
		"css": "packages/editor/src/style.css",
		"baseColor": "neutral",
		"cssVariables": true,
		"prefix": "iso-"
	},
	"aliases": {
		"components": "@/packages/editor/src",
		"utils": "@/packages/editor/src/lib/utils",
		"ui": "@/packages/editor/src/ui",
		"lib": "@/packages/editor/src/lib",
		"hooks": "@/packages/editor/src/hooks"
	},
	"iconLibrary": "lucide"
}
```

- [ ] **Step 3: Add the `cn()` helper**

Create `packages/editor/src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Add editor UI dependencies**

Modify root `package.json` dev dependencies to include:

```json
{
	"class-variance-authority": "^0.7.1",
	"clsx": "^2.1.1",
	"lucide-react": "^0.468.0",
	"tailwind-merge": "^2.6.0",
	"tailwindcss": "^4.1.0",
	"tw-animate-css": "^1.3.0"
}
```

Modify `packages/editor/package.json` dependencies to include the runtime packages used by generated shadcn components:

```json
{
	"@sebastianwessel/isostate": "0.3.0",
	"class-variance-authority": "^0.7.1",
	"clsx": "^2.1.1",
	"lucide-react": "^0.468.0",
	"tailwind-merge": "^2.6.0"
}
```

- [ ] **Step 5: Install and verify config**

Run:

```bash
bun install
bunx --bun shadcn@latest info --json
```

Expected: shadcn reports `tailwind.css` as `packages/editor/src/style.css`, `iconLibrary` as `lucide`, and an empty component list.

- [ ] **Step 6: Run tests**

Run:

```bash
bun run typecheck
bun run lint
```

Expected: both commands pass.

- [ ] **Step 7: Commit**

```bash
git add components.json package.json bun.lock packages/editor/package.json packages/editor/src/lib/utils.ts
git commit -m "chore(editor): initialize shadcn"
```

---

### Task 2: Install the shadcn components the editor needs

**Files:**
- Create: `packages/editor/src/ui/button.tsx`
- Create: `packages/editor/src/ui/tabs.tsx`
- Create: `packages/editor/src/ui/select.tsx`
- Create: `packages/editor/src/ui/input.tsx`
- Create: `packages/editor/src/ui/label.tsx`
- Create: `packages/editor/src/ui/textarea.tsx`
- Create: `packages/editor/src/ui/slider.tsx`
- Create: `packages/editor/src/ui/switch.tsx`
- Create: `packages/editor/src/ui/separator.tsx`
- Create: `packages/editor/src/ui/scroll-area.tsx`
- Create: `packages/editor/src/ui/resizable.tsx`
- Create: `packages/editor/src/ui/tooltip.tsx`
- Create: `packages/editor/src/ui/dialog.tsx`
- Create: `packages/editor/src/ui/alert-dialog.tsx`
- Create: `packages/editor/src/ui/dropdown-menu.tsx`
- Create: `packages/editor/src/ui/context-menu.tsx`
- Create: `packages/editor/src/ui/collapsible.tsx`
- Create: `packages/editor/src/ui/badge.tsx`

- [ ] **Step 1: Fetch docs before adding components**

Run:

```bash
bunx --bun shadcn@latest docs button tabs select input label textarea slider switch separator scroll-area resizable tooltip dialog alert-dialog dropdown-menu context-menu collapsible badge
```

Expected: CLI prints official docs URLs for each component.

- [ ] **Step 2: Add components**

Run:

```bash
bunx --bun shadcn@latest add button tabs select input label textarea slider switch separator scroll-area resizable tooltip dialog alert-dialog dropdown-menu context-menu collapsible badge
```

Expected: files are created under `packages/editor/src/ui/`.

- [ ] **Step 3: Review generated imports**

Run:

```bash
rg '@/|@/packages/editor/src' packages/editor/src/ui
```

Expected: imports use the alias that TypeScript can resolve. If `@/` is not resolvable, replace generated imports with relative imports, for example:

```ts
import { cn } from '../lib/utils.ts';
```

- [ ] **Step 4: Add or update TypeScript path alias only if needed**

If generated imports use `@/`, modify `tsconfig.json`:

```json
{
	"compilerOptions": {
		"baseUrl": ".",
		"paths": {
			"@/*": ["./*"]
		}
	}
}
```

Do not add this alias if all generated imports were converted to relative imports.

- [ ] **Step 5: Verify generated component quality**

Run:

```bash
bun run typecheck
bun run lint
```

Expected: both pass. Fix generated code to satisfy Biome before committing.

- [ ] **Step 6: Commit**

```bash
git add components.json packages/editor/src/ui packages/editor/src/lib package.json bun.lock tsconfig.json
git commit -m "chore(editor): add shadcn primitives"
```

---

### Task 3: Convert editor CSS to shadcn/Tailwind tokens while preserving package CSS output

**Files:**
- Modify: `packages/editor/src/style.css`
- Modify: `package.json`
- Modify: `rollup.config.ts`
- Modify: `website/public/editor-style.css`

- [ ] **Step 1: Replace token definitions with shadcn-compatible variables**

At the top of `packages/editor/src/style.css`, use this shape:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *, [data-theme="dark"] *));

.isostate-editor {
	--background: 0 0% 100%;
	--foreground: 240 10% 3.9%;
	--card: 0 0% 100%;
	--card-foreground: 240 10% 3.9%;
	--popover: 0 0% 100%;
	--popover-foreground: 240 10% 3.9%;
	--primary: 240 5.9% 10%;
	--primary-foreground: 0 0% 98%;
	--secondary: 240 4.8% 95.9%;
	--secondary-foreground: 240 5.9% 10%;
	--muted: 240 4.8% 95.9%;
	--muted-foreground: 240 3.8% 46.1%;
	--accent: 240 4.8% 95.9%;
	--accent-foreground: 240 5.9% 10%;
	--destructive: 0 84.2% 60.2%;
	--destructive-foreground: 0 0% 98%;
	--border: 240 5.9% 90%;
	--input: 240 5.9% 90%;
	--ring: 240 5.9% 10%;
	--radius: 0.375rem;
}

.isostate-editor[data-theme="dark"] {
	--background: 240 10% 3.9%;
	--foreground: 0 0% 98%;
	--card: 240 10% 3.9%;
	--card-foreground: 0 0% 98%;
	--popover: 240 10% 3.9%;
	--popover-foreground: 0 0% 98%;
	--primary: 0 0% 98%;
	--primary-foreground: 240 5.9% 10%;
	--secondary: 240 3.7% 15.9%;
	--secondary-foreground: 0 0% 98%;
	--muted: 240 3.7% 15.9%;
	--muted-foreground: 240 5% 64.9%;
	--accent: 240 3.7% 15.9%;
	--accent-foreground: 0 0% 98%;
	--destructive: 0 62.8% 30.6%;
	--destructive-foreground: 0 0% 98%;
	--border: 240 3.7% 15.9%;
	--input: 240 3.7% 15.9%;
	--ring: 240 4.9% 83.9%;
}
```

Keep the canvas, SVG grid, CodeMirror, selection overlay, and website embedding selectors after the token block.

- [ ] **Step 2: Add a CSS build script**

Modify root `package.json` scripts:

```json
{
	"editor:css": "tailwindcss -i packages/editor/src/style.css -o packages/editor/dist/style.css --minify",
	"build": "bun run clean && tsx node_modules/rollup/dist/bin/rollup -c rollup.config.ts && bun scripts/build-browser-runtime.ts && tsc -p packages/core/tsconfig.json --emitDeclarationOnly --noCheck && tsc -p packages/cli/tsconfig.json --emitDeclarationOnly --noCheck && tsc -p packages/editor/tsconfig.json --emitDeclarationOnly --noCheck && bun run editor:css"
}
```

- [ ] **Step 3: Keep website CSS synced from the package source for static embedding**

After CSS changes, run:

```bash
cp packages/editor/src/style.css website/public/editor-style.css
```

This is temporary until the website imports `@sebastianwessel/isostate-editor/style.css` from a package build.

- [ ] **Step 4: Verify CSS build**

Run:

```bash
bun run build
bun run site:build
```

Expected: editor CSS is emitted at `packages/editor/dist/style.css`, website builds, and the core runtime size check remains unaffected.

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock rollup.config.ts packages/editor/src/style.css website/public/editor-style.css
git commit -m "build(editor): compile shadcn css"
```

---

### Task 4: Replace editor shell tabs, buttons, and pane resizing with shadcn primitives

**Files:**
- Modify: `packages/editor/src/IsostateEditor.tsx`
- Create: `packages/editor/src/ui/editor-shell.tsx`
- Modify: `tests/editor/mount-editor.test.tsx`

- [ ] **Step 1: Add a reusable shell component**

Create `packages/editor/src/ui/editor-shell.tsx`:

```tsx
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup
} from './resizable.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs.tsx';

export type EditorSidebarTab = 'assets' | 'attributes' | 'general';

type EditorShellProps = {
	activeTab: EditorSidebarTab;
	onTabChange: (tab: EditorSidebarTab) => void;
	canvas: React.ReactNode;
	assets: React.ReactNode;
	attributes: React.ReactNode;
	general: React.ReactNode;
	editor: React.ReactNode;
};

export function EditorShell({
	activeTab,
	onTabChange,
	canvas,
	assets,
	attributes,
	general,
	editor
}: EditorShellProps) {
	return (
		<ResizablePanelGroup direction="horizontal" className="isostate-editor-main">
			<ResizablePanel defaultSize={58} minSize={22} className="isostate-editor-canvas">
				{canvas}
			</ResizablePanel>
			<ResizableHandle withHandle />
			<ResizablePanel defaultSize={27} minSize={22} className="isostate-editor-sidebar">
				<Tabs value={activeTab} onValueChange={(value) => onTabChange(value as EditorSidebarTab)}>
					<TabsList className="isostate-sidebar-tabs">
						<TabsTrigger value="assets">Assets</TabsTrigger>
						<TabsTrigger value="attributes">Attributes</TabsTrigger>
						<TabsTrigger value="general">General</TabsTrigger>
					</TabsList>
					<TabsContent value="assets" className="isostate-sidebar-content">
						{assets}
					</TabsContent>
					<TabsContent value="attributes" className="isostate-sidebar-content">
						{attributes}
					</TabsContent>
					<TabsContent value="general" className="isostate-sidebar-content">
						{general}
					</TabsContent>
				</Tabs>
			</ResizablePanel>
			<ResizableHandle withHandle />
			<ResizablePanel defaultSize={15} minSize={14} className="isostate-editor-yaml">
				{editor}
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
```

- [ ] **Step 2: Replace custom shell markup in `IsostateEditor.tsx`**

Import and render `EditorShell`:

```tsx
import { EditorShell } from './ui/editor-shell.tsx';
```

Replace the custom `.isostate-editor-main`, pane resizer, and sidebar tab markup with:

```tsx
<EditorShell
	activeTab={workspace.uiState.sidebarTab}
	onTabChange={setSidebarTab}
	canvas={canvasContent}
	assets={assetsContent}
	attributes={attributesContent}
	general={generalContent}
	editor={yamlContent}
/>
```

Create `canvasContent`, `assetsContent`, `attributesContent`, `generalContent`, and `yamlContent` constants immediately before the return.

- [ ] **Step 3: Remove old pane resizing state**

Delete these state fields and handlers from `IsostateEditor.tsx`:

```ts
const [canvasPane, setCanvasPane] = useState(58);
const [sidebarPane, setSidebarPane] = useState(360);
const [attributeTreePane, setAttributeTreePane] = useState(56);
const [resizingPane, setResizingPane] = useState<'canvas' | 'sidebar' | 'attributes' | null>(null);
```

Keep the horizontal attributes split until Task 5 replaces it with nested `ResizablePanelGroup`.

- [ ] **Step 4: Update layout test expectations**

Modify `tests/editor/mount-editor.test.tsx` to assert roles and visible panels instead of custom resizer classes:

```tsx
expect(container.querySelector('.isostate-editor-canvas')).not.toBeNull();
expect(container.querySelector('.isostate-editor-sidebar')).not.toBeNull();
expect(container.querySelector('.isostate-editor-yaml')).not.toBeNull();
expect(screen.getByRole('tab', { name: 'Assets' })).toBeTruthy();
expect(screen.getByRole('tab', { name: 'Attributes' })).toBeTruthy();
expect(screen.getByRole('tab', { name: 'General' })).toBeTruthy();
```

- [ ] **Step 5: Verify**

Run:

```bash
bun test tests/editor/mount-editor.test.tsx
bun run typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 6: Commit**

```bash
git add packages/editor/src/IsostateEditor.tsx packages/editor/src/ui/editor-shell.tsx tests/editor/mount-editor.test.tsx
git commit -m "refactor(editor): use shadcn shell layout"
```

---

### Task 5: Migrate attributes split, scene tree chrome, and scene actions

**Files:**
- Modify: `packages/editor/src/IsostateEditor.tsx`
- Modify: `packages/editor/src/scenes/SceneTreePanel.tsx`
- Modify: `tests/editor/scene-tree.test.tsx`

- [ ] **Step 1: Replace custom horizontal split with shadcn resizable**

Inside the `attributesContent` constant in `IsostateEditor.tsx`, use:

```tsx
<ResizablePanelGroup direction="vertical" className="isostate-attributes-panel">
	<ResizablePanel defaultSize={56} minSize={24} className="isostate-attributes-tree">
		<SceneTreePanel workspace={workspace} onCommand={handleCommand} onSelect={handleSelect} />
	</ResizablePanel>
	<ResizableHandle withHandle />
	<ResizablePanel defaultSize={44} minSize={24} className="isostate-attributes-inspector">
		<InspectorPanel
			workspace={workspace}
			onCommand={handleCommand}
			onSelect={handleSelect}
			mode="attributes"
		/>
	</ResizablePanel>
</ResizablePanelGroup>
```

- [ ] **Step 2: Replace tree header action buttons**

In `SceneTreePanel.tsx`, import:

```tsx
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible.tsx';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '../ui/context-menu.tsx';
import { ScrollArea } from '../ui/scroll-area.tsx';
```

Replace the Add Scene button with:

```tsx
<Button type="button" size="sm" onClick={handleAddScene}>
	Add Scene
</Button>
```

Replace count pills with:

```tsx
<Badge variant="secondary">{sceneObjectCount}</Badge>
```

- [ ] **Step 3: Add context menu actions for scene rows**

Wrap each scene row with:

```tsx
<ContextMenu>
	<ContextMenuTrigger asChild>
		<div className={sceneClassName}>{sceneContent}</div>
	</ContextMenuTrigger>
	<ContextMenuContent>
		<ContextMenuItem onSelect={handleAddScene}>Add Scene</ContextMenuItem>
	</ContextMenuContent>
</ContextMenu>
```

Do not add duplicate/delete scene actions until command support exists.

- [ ] **Step 4: Verify drag/drop still works**

Run:

```bash
bun test tests/editor/scene-tree.test.tsx
```

Expected: scene, layer, element, and connection selection tests pass; layer drag reorder still passes.

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src/IsostateEditor.tsx packages/editor/src/scenes/SceneTreePanel.tsx tests/editor/scene-tree.test.tsx
git commit -m "refactor(editor): migrate scene tree chrome to shadcn"
```

---

### Task 6: Migrate inspector forms and destructive actions

**Files:**
- Modify: `packages/editor/src/inspector/InspectorPanel.tsx`
- Modify: `tests/editor/inspector.test.tsx`

- [ ] **Step 1: Replace custom inputs/selects/buttons with shadcn components**

In `InspectorPanel.tsx`, import:

```tsx
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog.tsx';
import { Button } from '../ui/button.tsx';
import { Input } from '../ui/input.tsx';
import { Label } from '../ui/label.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.tsx';
import { Separator } from '../ui/separator.tsx';
import { Slider } from '../ui/slider.tsx';
import { Switch } from '../ui/switch.tsx';
```

Replace native `<input>` text fields with:

```tsx
<Input id={inputId} value={value} onChange={handleChange} disabled={disabled} />
```

Replace native selects with:

```tsx
<Select value={value} onValueChange={handleValueChange} disabled={disabled}>
	<SelectTrigger id={selectId}>
		<SelectValue />
	</SelectTrigger>
	<SelectContent>
		{options.map((option) => (
			<SelectItem key={option.value} value={option.value}>
				{option.label}
			</SelectItem>
		))}
	</SelectContent>
</Select>
```

- [ ] **Step 2: Wrap destructive delete actions in alert dialogs**

Use this exact pattern for deleting elements and connections:

```tsx
<AlertDialog>
	<AlertDialogTrigger asChild>
		<Button type="button" variant="destructive" size="sm">
			Delete
		</Button>
	</AlertDialogTrigger>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle>Delete selected item?</AlertDialogTitle>
			<AlertDialogDescription>
				This creates a removal in the current scene. Inherited items remain available in earlier scenes.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel>Cancel</AlertDialogCancel>
			<AlertDialogAction onClick={onRemove}>Delete</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
```

- [ ] **Step 3: Update tests for alert confirmation**

In deletion tests, click the trigger and then the dialog action:

```tsx
fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
fireEvent.click(screen.getByRole('button', { name: 'Delete selected item?' }));
```

If the generated alert action has accessible name `Delete`, scope the second click to the dialog:

```tsx
const dialog = screen.getByRole('alertdialog');
fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
```

- [ ] **Step 4: Verify**

Run:

```bash
bun test tests/editor/inspector.test.tsx
bun run typecheck
```

Expected: inspector behavior remains unchanged, including inherited element and connection removals.

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src/inspector/InspectorPanel.tsx tests/editor/inspector.test.tsx
git commit -m "refactor(editor): migrate inspector controls to shadcn"
```

---

### Task 7: Migrate assets panel and canvas toolbar controls

**Files:**
- Modify: `packages/editor/src/assets/AssetPanel.tsx`
- Modify: `packages/editor/src/canvas/CanvasView.tsx`
- Modify: `tests/editor/asset-panel.test.tsx`
- Modify: `tests/editor/canvas.test.tsx`

- [ ] **Step 1: Replace asset panel actions and metadata chips**

In `AssetPanel.tsx`, use:

```tsx
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import { ScrollArea } from '../ui/scroll-area.tsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip.tsx';
```

Use `ScrollArea` around the asset list and `Badge` for asset group/type labels.

- [ ] **Step 2: Replace canvas toolbar with icon buttons and slider**

In `CanvasView.tsx`, use:

```tsx
import { Grid2X2, Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button.tsx';
import { Slider } from '../ui/slider.tsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip.tsx';
```

Render zoom/grid controls as:

```tsx
<TooltipProvider>
	<div className="isostate-canvas-controls">
		<Tooltip>
			<TooltipTrigger asChild>
				<Button type="button" variant="secondary" size="icon" onClick={zoomOut}>
					<Minus aria-hidden="true" />
					<span className="sr-only">Zoom out</span>
				</Button>
			</TooltipTrigger>
			<TooltipContent>Zoom out</TooltipContent>
		</Tooltip>
		<Tooltip>
			<TooltipTrigger asChild>
				<Button type="button" variant="secondary" size="icon" onClick={zoomIn}>
					<Plus aria-hidden="true" />
					<span className="sr-only">Zoom in</span>
				</Button>
			</TooltipTrigger>
			<TooltipContent>Zoom in</TooltipContent>
		</Tooltip>
		<Button type="button" variant="secondary" size="icon" onClick={resetViewport}>
			<RotateCcw aria-hidden="true" />
			<span className="sr-only">Reset viewport</span>
		</Button>
		<Button type="button" variant="secondary" size="icon" onClick={toggleGrid}>
			<Grid2X2 aria-hidden="true" />
			<span className="sr-only">Toggle grid</span>
		</Button>
		<Slider
			aria-label="Grid opacity"
			min={0}
			max={1}
			step={0.05}
			value={[gridOpacity]}
			onValueChange={([next]) => setGridOpacity(next ?? gridOpacity)}
		/>
	</div>
</TooltipProvider>
```

- [ ] **Step 3: Verify drag/drop and canvas pointer tests**

Run:

```bash
bun test tests/editor/asset-panel.test.tsx tests/editor/canvas.test.tsx
```

Expected: asset drag payload and canvas placement tests still pass.

- [ ] **Step 4: Commit**

```bash
git add packages/editor/src/assets/AssetPanel.tsx packages/editor/src/canvas/CanvasView.tsx tests/editor/asset-panel.test.tsx tests/editor/canvas.test.tsx
git commit -m "refactor(editor): migrate asset and canvas controls to shadcn"
```

---

### Task 8: Remove obsolete custom component CSS

**Files:**
- Modify: `packages/editor/src/style.css`
- Modify: `website/public/editor-style.css`

- [ ] **Step 1: Delete CSS for replaced custom components**

Remove selectors that duplicate shadcn components:

```text
.isostate-btn
.isostate-btn--primary
.isostate-btn--secondary
.isostate-btn--danger
.isostate-btn--sm
.isostate-btn--icon
.isostate-sidebar-tab
.isostate-select
.isostate-input
.isostate-pane-resizer
.isostate-attribute-split-resizer
```

Keep selectors for editor layout, SVG canvas, grid, scene tree domain rows, asset preview tiles, selection overlay, and CodeMirror.

- [ ] **Step 2: Sync website CSS**

Run:

```bash
cp packages/editor/src/style.css website/public/editor-style.css
```

- [ ] **Step 3: Verify no replaced classes remain in TSX**

Run:

```bash
rg 'isostate-btn|isostate-sidebar-tab|isostate-select|isostate-input|isostate-pane-resizer|isostate-attribute-split-resizer' packages/editor/src
```

Expected: no output.

- [ ] **Step 4: Verify**

Run:

```bash
bun run lint
bun run typecheck
bun test tests/editor
bun run build
bun run site:build
```

Expected: all pass. Existing site build chunk-size warnings are acceptable only if unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src/style.css website/public/editor-style.css
git commit -m "refactor(editor): remove obsolete custom control css"
```

---

### Task 9: Browser QA and final migration acceptance

**Files:**
- Modify tests only if browser QA exposes a real regression.

- [ ] **Step 1: Start the website**

Run:

```bash
bun run site:dev
```

Expected: Astro serves the website, normally on `http://localhost:4321/isostate/`.

- [ ] **Step 2: Browser-check the editor page**

Open:

```text
http://localhost:4321/isostate/editor/
```

Verify:

- Top navigation is styled correctly.
- Canvas, attributes pane, and YAML editor are all visible by default.
- Panes resize horizontally.
- Attributes pane tree/inspector split resizes vertically.
- Tabs are `Assets`, `Attributes`, `General`.
- Dragging a built-in or AWS asset into the scene creates an element at the dropped grid cell.
- Dragging an existing element moves it without offset drift.
- Zoom and pan work when content is outside the visible viewport.
- Scene tree shows inherited and scene-local elements/connections.
- Deleting inherited elements/connections creates current-scene removal deltas.
- General tab updates scene/camera settings.
- YAML editor remains highlighted and fills its pane.
- Dark/light toggle changes the canvas preview theme, not only the YAML editor.

- [ ] **Step 3: Capture final verification**

Run:

```bash
bun run lint
bun run typecheck
bun test
bun run build
bun run site:build
```

Expected: all pass. If `site:build` logs the known Shiki `svg` fallback or Vite chunk-size warning and no new warnings, note that in the final response.

- [ ] **Step 4: Commit any QA fixes**

If no code changed during QA, skip this step. If code changed:

```bash
git add packages/editor website/public tests/editor
git commit -m "fix(editor): resolve shadcn migration qa issues"
```

---

## Acceptance Criteria

- `packages/editor/src` uses shadcn components for every standard control that shadcn provides.
- Custom editor components remain only for domain-specific behavior: canvas, YAML wrapper, scene resolver, command model, asset preview semantics, and scene tree domain rows.
- No TSX uses obsolete custom classes for buttons, inputs, selects, tabs, or pane resizers.
- Published editor users still import the editor the same way:

```ts
import { mountEditor } from '@sebastianwessel/isostate-editor';
import '@sebastianwessel/isostate-editor/style.css';
```

- Consumers do not need to run shadcn or Tailwind.
- `@sebastianwessel/isostate` core runtime has no shadcn, Radix, Tailwind, lucide, or React dependency.
- Browser QA confirms no regression in drag/drop, moving elements, pan/zoom, scene sync, connection management, or YAML sync.

## Self-Review

- Spec coverage: The plan preserves the editor-only dependency boundary in `specs/00-stack.md`, keeps core runtime clean, and moves reusable UI to shadcn components.
- Placeholder scan: No implementation step uses TBD/TODO language; component lists and commands are explicit.
- Type consistency: The plan uses the current editor names `EditorWorkspace`, `IsostateEditor`, `AssetPanel`, `SceneTreePanel`, `InspectorPanel`, `CanvasView`, and `YamlEditor`.
