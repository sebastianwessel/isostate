import type { ReactNode } from 'react';
import type { EditorWorkspace } from '../types.ts';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup
} from './resizable.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs.tsx';

type EditorSidebarTab = EditorWorkspace['uiState']['sidebarTab'];

interface EditorShellProps {
	activeTab: EditorSidebarTab;
	onTabChange: (tab: EditorSidebarTab) => void;
	canvasInvalid?: boolean;
	canvas: ReactNode;
	assets: ReactNode;
	attributes: ReactNode;
	general: ReactNode;
	editor: ReactNode;
}

export function EditorShell({
	activeTab,
	onTabChange,
	canvasInvalid = false,
	canvas,
	assets,
	attributes,
	general,
	editor
}: EditorShellProps) {
	return (
		<ResizablePanelGroup
			direction="horizontal"
			className="isostate-editor-main"
		>
			<ResizablePanel
				defaultSize={58}
				minSize={24}
				className={`isostate-editor-canvas ${canvasInvalid ? 'isostate-editor-canvas--invalid' : ''}`}
			>
				{canvas}
			</ResizablePanel>
			<ResizableHandle withHandle aria-label="Resize canvas pane" />
			<ResizablePanel
				defaultSize={27}
				minSize={22}
				className="isostate-editor-sidebar"
			>
				<Tabs
					value={activeTab}
					onValueChange={(value) => onTabChange(value as EditorSidebarTab)}
					className="isostate-sidebar-tabs-host"
				>
					<TabsList
						className="isostate-sidebar-tabs"
						aria-label="Editor panels"
					>
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
			<ResizableHandle withHandle aria-label="Resize attributes pane" />
			<ResizablePanel
				defaultSize={15}
				minSize={14}
				className="isostate-editor-yaml"
			>
				{editor}
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
