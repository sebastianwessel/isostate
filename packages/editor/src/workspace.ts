import type {
	SceneDocument,
	ValidationReport
} from '@sebastianwessel/isostate';
import { ParseError } from '@sebastianwessel/isostate';
import {
	parseScene,
	validateScene
} from '@sebastianwessel/isostate/dsl/browser';
import type {
	EditorDiagnostic,
	EditorWorkspace,
	EditorWorkspaceInput
} from './types.ts';

function convertValidationReport(report: ValidationReport): EditorDiagnostic[] {
	const diagnostics: EditorDiagnostic[] = [];
	for (const error of report.errors) {
		diagnostics.push({
			code: error.code,
			message: error.message,
			severity: 'error',
			sceneId: error.sceneId,
			objectId: error.elementId ?? error.connectionId,
			line: error.location?.line,
			column: error.location?.column
		});
	}
	for (const warning of report.warnings) {
		diagnostics.push({
			code: warning.code,
			message: warning.message,
			severity: 'warning',
			sceneId: warning.sceneId,
			objectId: warning.elementId ?? warning.connectionId,
			line: warning.location?.line,
			column: warning.location?.column
		});
	}
	return diagnostics;
}

function convertParseError(err: ParseError): EditorDiagnostic {
	return {
		code: err.code,
		message: err.message,
		severity: 'error',
		line: typeof err.details?.line === 'number' ? err.details.line : undefined,
		column:
			typeof err.details?.column === 'number' ? err.details.column : undefined
	};
}

export function createEditorWorkspace(
	input: EditorWorkspaceInput
): EditorWorkspace {
	let document: SceneDocument | undefined;
	let diagnostics: EditorDiagnostic[] = [];

	try {
		document = parseScene(input.sourceYaml);
		const report = validateScene(document);
		diagnostics = convertValidationReport(report);
	} catch (err) {
		if (err instanceof ParseError) {
			diagnostics = [convertParseError(err)];
		} else {
			diagnostics = [
				{ code: 'UNKNOWN_ERROR', message: String(err), severity: 'error' }
			];
		}
		document = undefined;
	}

	const activeSceneId = input.activeSceneId ?? document?.scenes[0]?.id;

	return {
		name: input.name ?? 'Untitled',
		sourceYaml: input.sourceYaml,
		document,
		activeSceneId,
		selection: { objectIds: [], connectionIds: [], layerNames: [] },
		viewport: {
			pan: { x: 0, y: 0 },
			zoom: 1,
			showGrid: true,
			showFloor: true,
			gridOpacity: 0.7
		},
		editState: {
			readonly: false,
			dragging: false,
			dragPayload: undefined
		},
		lockedLayers: [],
		uiState: {
			sidebarWidth: 360,
			sidebarCollapsed: false,
			sidebarTab: 'assets',
			yamlCollapsed: false,
			theme: 'system',
			previewMode: 'edit',
			previewProgress: 0,
			assetBrowser: {
				recentAssetIds: [],
				searchQuery: '',
				selectedGroup: undefined,
				selectedTag: undefined
			}
		},
		history: [],
		diagnostics
	};
}
