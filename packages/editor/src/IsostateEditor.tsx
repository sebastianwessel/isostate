import { useCallback, useEffect, useState } from 'react';
import { AssetPanel } from './assets/AssetPanel.tsx';
import { CanvasView } from './canvas/CanvasView.tsx';
import {
	applyEditorCommand,
	createYamlEditCommand,
	createYamlFormatCommand
} from './commands.ts';
import { InspectorPanel } from './inspector/InspectorPanel.tsx';
import { SceneTreePanel } from './scenes/SceneTreePanel.tsx';
import type {
	EditorCommand,
	EditorSelection,
	EditorWorkspace,
	IsostateEditorProps
} from './types.ts';
import { createEditorWorkspace } from './workspace.ts';
import { YamlEditor } from './yaml-editor/YamlEditor.tsx';

const DEFAULT_YAML = `header:
  version: "1"
  assets: []
  layers:
    - name: default
scenes:
  - id: scene-1
    elements:
      - id: title
        asset: text
        at: [1, 1]
        layer: default
        text:
          value: Start building
          align: middle
          fontSize: 14
`;

const TABS: Array<{
	id: EditorWorkspace['uiState']['sidebarTab'];
	label: string;
}> = [
	{ id: 'assets', label: 'Assets' },
	{ id: 'attributes', label: 'Attributes' },
	{ id: 'general', label: 'General' }
];

export function IsostateEditor(props: IsostateEditorProps) {
	const {
		value,
		defaultValue,
		theme: propTheme = 'system',
		readonly = false,
		onChange,
		onValidate,
		onWorkspaceChange,
		assetManifestUrl
	} = props;

	const [workspace, setWorkspace] = useState<EditorWorkspace>(() => {
		const yaml = value ?? defaultValue ?? DEFAULT_YAML;
		const initial = createEditorWorkspace({ sourceYaml: yaml });
		return initial;
	});
	const [canvasPane, setCanvasPane] = useState(58);
	const [sidebarPane, setSidebarPane] = useState(360);
	const [attributeTreePane, setAttributeTreePane] = useState(56);
	const [resizingPane, setResizingPane] = useState<
		'canvas' | 'sidebar' | 'attributes' | null
	>(null);

	useEffect(() => {
		if (value === undefined) return;
		setWorkspace((prev) => {
			if (value === prev.sourceYaml) return prev;
			const next = createEditorWorkspace({
				sourceYaml: value,
				activeSceneId: prev.activeSceneId
			});
			return {
				...next,
				selection: prev.selection,
				viewport: prev.viewport,
				uiState: { ...next.uiState, theme: prev.uiState.theme },
				editState: {
					...next.editState,
					readonly: prev.editState.readonly
				},
				lockedLayers: prev.lockedLayers
			};
		});
	}, [value]);

	useEffect(() => {
		setWorkspace((prev) => {
			if (prev.uiState.theme === propTheme) return prev;
			return { ...prev, uiState: { ...prev.uiState, theme: propTheme } };
		});
	}, [propTheme]);

	useEffect(() => {
		setWorkspace((prev) => {
			if (prev.editState.readonly === readonly) {
				return prev;
			}
			return {
				...prev,
				editState: { ...prev.editState, readonly }
			};
		});
	}, [readonly]);

	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				clearDragPayload();
			}
		};
		window.addEventListener('keydown', handleKey);
		return () => window.removeEventListener('keydown', handleKey);
	}, []);

	const handleCommand = useCallback(
		(command: EditorCommand) => {
			const result = applyEditorCommand(workspace, command);
			setWorkspace(result.workspace);
			onWorkspaceChange?.(result.workspace);
			if (result.changed) {
				onChange?.({
					sourceYaml: result.workspace.sourceYaml,
					document: result.workspace.document,
					diagnostics: result.workspace.diagnostics,
					operation: {
						type: command.id
					} as unknown as import('./types.ts').EditorOperation
				});
				onValidate?.(result.workspace.diagnostics);
			}
		},
		[workspace, onChange, onValidate, onWorkspaceChange]
	);

	const handleSelect = useCallback(
		(selection: Partial<EditorSelection>) => {
			setWorkspace((prev) => {
				const next = {
					...prev,
					selection: { ...prev.selection, ...selection }
				};
				onWorkspaceChange?.(next);
				return next;
			});
		},
		[onWorkspaceChange]
	);

	const toggleGrid = () => {
		setWorkspace((prev) => {
			const next = {
				...prev,
				viewport: { ...prev.viewport, showGrid: !prev.viewport.showGrid }
			};
			onWorkspaceChange?.(next);
			return next;
		});
	};

	const setTheme = (t: 'light' | 'dark' | 'system') => {
		setWorkspace((prev) => {
			const next = { ...prev, uiState: { ...prev.uiState, theme: t } };
			onWorkspaceChange?.(next);
			return next;
		});
	};

	const setSidebarTab = (tab: EditorWorkspace['uiState']['sidebarTab']) => {
		setWorkspace((prev) => {
			const next = { ...prev, uiState: { ...prev.uiState, sidebarTab: tab } };
			onWorkspaceChange?.(next);
			return next;
		});
	};

	const setActiveSceneId = (sceneId: string) => {
		setWorkspace((prev) => {
			const next = {
				...prev,
				activeSceneId: sceneId,
				selection: {
					sceneId,
					objectIds: [],
					connectionIds: [],
					layerNames: []
				}
			};
			onWorkspaceChange?.(next);
			return next;
		});
	};

	const clearDragPayload = () => {
		setWorkspace((prev) => {
			if (prev.editState.dragPayload === undefined) return prev;
			const next = {
				...prev,
				editState: { ...prev.editState, dragPayload: undefined }
			};
			onWorkspaceChange?.(next);
			return next;
		});
	};

	const handleYamlChange = (newYaml: string) => {
		handleCommand(createYamlEditCommand(newYaml));
	};

	const handleFormat = () => {
		handleCommand(createYamlFormatCommand());
	};

	const handlePanePointerDown = (
		event: React.PointerEvent,
		pane: 'canvas' | 'sidebar' | 'attributes'
	) => {
		event.currentTarget.setPointerCapture(event.pointerId);
		setResizingPane(pane);
	};

	const handlePanePointerMove = (event: React.PointerEvent) => {
		if (!resizingPane) return;
		const parent = event.currentTarget.parentElement;
		const bounds = parent?.getBoundingClientRect();
		if (!bounds) return;
		if (resizingPane === 'sidebar') {
			const sidebar = event.currentTarget.previousElementSibling;
			const sidebarBounds = sidebar?.getBoundingClientRect();
			if (!sidebarBounds) return;
			setSidebarPane(
				Math.min(560, Math.max(320, event.clientX - sidebarBounds.left))
			);
			return;
		}
		if (resizingPane === 'attributes') {
			const next = ((event.clientY - bounds.top) / bounds.height) * 100;
			setAttributeTreePane(Math.min(75, Math.max(28, next)));
			return;
		}
		const isColumn =
			parent !== null &&
			getComputedStyle(parent).flexDirection.startsWith('column');
		const next = isColumn
			? ((event.clientY - bounds.top) / bounds.height) * 100
			: ((event.clientX - bounds.left) / bounds.width) * 100;
		setCanvasPane(Math.min(76, Math.max(32, next)));
	};

	const handlePanePointerUp = (event: React.PointerEvent) => {
		if (!resizingPane) return;
		setResizingPane(null);
		try {
			event.currentTarget.releasePointerCapture(event.pointerId);
		} catch {
			// Pointer capture may already be released by the browser.
		}
	};

	const activeTheme =
		workspace.uiState.theme === 'system' ? propTheme : workspace.uiState.theme;

	const resolvedTheme: 'light' | 'dark' =
		activeTheme === 'dark' ? 'dark' : 'light';

	const sceneOptions = workspace.document?.scenes ?? [];
	const isInvalid = !workspace.document;

	return (
		<div
			className="isostate-editor"
			data-theme={activeTheme}
			data-readonly={readonly}
		>
			<div className="isostate-editor-topbar">
				<span className="isostate-editor-title">Isostate Editor</span>
				<div className="isostate-editor-toolbar">
					<select
						className="isostate-select isostate-select--sm"
						value={workspace.activeSceneId ?? ''}
						onChange={(e) => setActiveSceneId(e.target.value)}
					>
						{sceneOptions.map((s) => (
							<option key={s.id} value={s.id}>
								{s.id}
							</option>
						))}
					</select>
					<button type="button" onClick={toggleGrid}>
						Grid
					</button>
					<button type="button" onClick={handleFormat}>
						Format
					</button>
					<button type="button" onClick={() => setTheme('light')}>
						Light
					</button>
					<button type="button" onClick={() => setTheme('dark')}>
						Dark
					</button>
				</div>
			</div>
			<div className="isostate-editor-body">
				<div
					className="isostate-editor-main"
					style={
						{
							'--isostate-canvas-pane': `${canvasPane}%`,
							'--isostate-sidebar-pane': `${sidebarPane}px`,
							'--isostate-attribute-tree-pane': `${attributeTreePane}%`
						} as React.CSSProperties
					}
				>
					<div
						className={`isostate-editor-canvas ${isInvalid ? 'isostate-editor-canvas--invalid' : ''}`}
					>
						<CanvasView
							workspace={workspace}
							onCommand={handleCommand}
							onSelect={handleSelect}
							onClearDragPayload={clearDragPayload}
							onViewportChange={(viewport) => {
								setWorkspace((prev) => {
									const next = { ...prev, viewport };
									onWorkspaceChange?.(next);
									return next;
								});
							}}
							theme={activeTheme}
						/>
						{isInvalid && (
							<div className="isostate-editor-canvas-overlay">
								<span>YAML invalid - canvas read-only</span>
							</div>
						)}
					</div>
					<hr
						className="isostate-pane-resizer"
						aria-orientation="vertical"
						aria-label="Resize canvas pane"
						aria-valuemin={32}
						aria-valuemax={76}
						aria-valuenow={Math.round(canvasPane)}
						tabIndex={0}
						onPointerDown={(event) => handlePanePointerDown(event, 'canvas')}
						onPointerMove={handlePanePointerMove}
						onPointerUp={handlePanePointerUp}
						onKeyDown={(event) => {
							if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
								setCanvasPane((value) => Math.max(32, value - 4));
							}
							if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
								setCanvasPane((value) => Math.min(76, value + 4));
							}
						}}
					/>
					<div className="isostate-editor-sidebar">
						<div className="isostate-sidebar-tabs">
							{TABS.map((tab) => (
								<button
									key={tab.id}
									type="button"
									className={`isostate-sidebar-tab ${workspace.uiState.sidebarTab === tab.id ? 'isostate-sidebar-tab--active' : ''}`}
									onClick={() => setSidebarTab(tab.id)}
								>
									{tab.label}
								</button>
							))}
						</div>
						<div
							className={`isostate-sidebar-content ${isInvalid ? 'isostate-sidebar-content--disabled' : ''}`}
						>
							{workspace.uiState.sidebarTab === 'assets' && (
								<AssetPanel
									workspace={workspace}
									assetManifestUrl={assetManifestUrl}
									activeAssetId={
										workspace.editState.dragPayload?.kind === 'asset'
											? workspace.editState.dragPayload.assetId
											: undefined
									}
									onDragAsset={(assetId) => {
										setWorkspace((prev) => ({
											...prev,
											editState: {
												...prev.editState,
												dragPayload: { kind: 'asset', assetId }
											}
										}));
									}}
									onClickAsset={(assetId) => {
										setWorkspace((prev) => ({
											...prev,
											editState: {
												...prev.editState,
												dragPayload: { kind: 'asset', assetId }
											}
										}));
									}}
								/>
							)}
							{workspace.uiState.sidebarTab === 'attributes' && (
								<div className="isostate-attributes-panel">
									<div className="isostate-attributes-tree">
										<SceneTreePanel
											workspace={workspace}
											onCommand={handleCommand}
											onSelectScene={setActiveSceneId}
											onSelect={handleSelect}
											setWorkspace={(updater) => setWorkspace(updater)}
										/>
									</div>
									<hr
										className="isostate-attribute-split-resizer"
										aria-orientation="horizontal"
										aria-label="Resize attributes split"
										aria-valuemin={28}
										aria-valuemax={75}
										aria-valuenow={Math.round(attributeTreePane)}
										tabIndex={0}
										onPointerDown={(event) =>
											handlePanePointerDown(event, 'attributes')
										}
										onPointerMove={handlePanePointerMove}
										onPointerUp={handlePanePointerUp}
										onKeyDown={(event) => {
											if (
												event.key === 'ArrowUp' ||
												event.key === 'ArrowLeft'
											) {
												setAttributeTreePane((value) =>
													Math.max(28, value - 4)
												);
											}
											if (
												event.key === 'ArrowDown' ||
												event.key === 'ArrowRight'
											) {
												setAttributeTreePane((value) =>
													Math.min(75, value + 4)
												);
											}
										}}
									/>
									<div className="isostate-attributes-inspector">
										<InspectorPanel
											workspace={workspace}
											onCommand={handleCommand}
											mode="attributes"
										/>
									</div>
								</div>
							)}
							{workspace.uiState.sidebarTab === 'general' && (
								<InspectorPanel
									workspace={workspace}
									onCommand={handleCommand}
									mode="general"
								/>
							)}
						</div>
					</div>
					<hr
						className="isostate-pane-resizer isostate-pane-resizer--sidebar"
						aria-orientation="vertical"
						aria-label="Resize attributes pane"
						aria-valuemin={320}
						aria-valuemax={560}
						aria-valuenow={Math.round(sidebarPane)}
						tabIndex={0}
						onPointerDown={(event) => handlePanePointerDown(event, 'sidebar')}
						onPointerMove={handlePanePointerMove}
						onPointerUp={handlePanePointerUp}
						onKeyDown={(event) => {
							if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
								setSidebarPane((value) => Math.max(320, value - 24));
							}
							if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
								setSidebarPane((value) => Math.min(560, value + 24));
							}
						}}
					/>
					<div className="isostate-editor-yaml">
						<YamlEditor
							value={workspace.sourceYaml}
							onChange={handleYamlChange}
							theme={resolvedTheme}
							readOnly={readonly}
							diagnostics={workspace.diagnostics}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
