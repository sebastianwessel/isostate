import { Grid2X2, Moon, Paintbrush, Sun } from 'lucide-react';
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
import { Button } from './ui/button.tsx';
import { EditorShell } from './ui/editor-shell.tsx';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup
} from './ui/resizable.tsx';
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue
} from './ui/select.tsx';
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

export function IsostateEditor(props: IsostateEditorProps) {
	const {
		value,
		defaultValue,
		theme: propTheme = 'system',
		readonly = false,
		onChange,
		onValidate,
		onWorkspaceChange,
		assetManifestUrl,
		assetManifestUrls
	} = props;

	const [workspace, setWorkspace] = useState<EditorWorkspace>(() => {
		const yaml = value ?? defaultValue ?? DEFAULT_YAML;
		const initial = createEditorWorkspace({ sourceYaml: yaml });
		return initial;
	});
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

	const toggleTheme = () => {
		setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
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

	const activeTheme =
		workspace.uiState.theme === 'system' ? propTheme : workspace.uiState.theme;

	const resolvedTheme: 'light' | 'dark' =
		activeTheme === 'dark' ? 'dark' : 'light';

	const sceneOptions = workspace.document?.scenes ?? [];
	const isInvalid = !workspace.document;
	const canvasContent = (
		<>
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
		</>
	);
	const assetsContent = (
		<AssetPanel
			workspace={workspace}
			assetManifestUrl={assetManifestUrl}
			assetManifestUrls={assetManifestUrls}
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
	);
	const attributesContent = (
		<ResizablePanelGroup
			direction="vertical"
			className="isostate-attributes-panel"
		>
			<ResizablePanel
				defaultSize={56}
				minSize={24}
				className="isostate-attributes-tree"
			>
				<SceneTreePanel
					workspace={workspace}
					onCommand={handleCommand}
					onSelectScene={setActiveSceneId}
					onSelect={handleSelect}
					setWorkspace={(updater) => setWorkspace(updater)}
				/>
			</ResizablePanel>
			<ResizableHandle withHandle aria-label="Resize attributes split" />
			<ResizablePanel
				defaultSize={44}
				minSize={24}
				className="isostate-attributes-inspector"
			>
				<InspectorPanel
					workspace={workspace}
					onCommand={handleCommand}
					mode="attributes"
				/>
			</ResizablePanel>
		</ResizablePanelGroup>
	);
	const generalContent = (
		<InspectorPanel
			workspace={workspace}
			onCommand={handleCommand}
			mode="general"
		/>
	);
	const yamlContent = (
		<>
			<div className="isostate-editor-yaml-body">
				<YamlEditor
					value={workspace.sourceYaml}
					onChange={handleYamlChange}
					theme={resolvedTheme}
					readOnly={readonly}
					diagnostics={workspace.diagnostics}
				/>
			</div>
			<div className="isostate-editor-footer">
				<Button
					type="button"
					variant="secondary"
					size="sm"
					onClick={handleFormat}
				>
					<Paintbrush data-icon="inline-start" />
					Format
				</Button>
			</div>
		</>
	);

	return (
		<div
			className="isostate-editor"
			data-theme={activeTheme}
			data-readonly={readonly}
		>
			<div className="isostate-editor-topbar">
				<span className="isostate-editor-title">Isostate Editor</span>
				<div className="isostate-editor-toolbar">
					<Select
						value={workspace.activeSceneId ?? ''}
						onValueChange={setActiveSceneId}
					>
						<SelectTrigger size="sm" className="isostate-scene-select">
							<SelectValue placeholder="Scene" />
						</SelectTrigger>
						<SelectContent position="popper">
							<SelectGroup>
								{sceneOptions.map((s) => (
									<SelectItem key={s.id} value={s.id}>
										{s.id}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						onClick={toggleGrid}
					>
						<Grid2X2 data-icon="inline-start" />
						Grid
					</Button>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						onClick={toggleTheme}
						aria-label={`Preview ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
						aria-pressed={resolvedTheme === 'dark'}
					>
						{resolvedTheme === 'dark' ? (
							<Moon data-icon="inline-start" />
						) : (
							<Sun data-icon="inline-start" />
						)}
						{resolvedTheme === 'dark' ? 'Dark' : 'Light'}
					</Button>
				</div>
			</div>
			<div className="isostate-editor-body">
				<EditorShell
					activeTab={workspace.uiState.sidebarTab}
					onTabChange={setSidebarTab}
					canvasInvalid={isInvalid}
					canvas={canvasContent}
					assets={assetsContent}
					attributes={attributesContent}
					general={generalContent}
					editor={yamlContent}
				/>
			</div>
		</div>
	);
}
