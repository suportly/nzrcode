/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Handlers for the `editor` namespace: openFile, getActive, applyEdit,
// setSelection, revealLine. The vscode editor surface is injected via
// `EditorDeps` so unit tests can run outside an Extension Host.
//
// cl-5 caps `applyEdit` at 10 MiB of new text across the whole batch;
// the limit mirrors `workspace.writeFile` so a slow client cannot bypass
// back-pressure by going through the editor namespace.

import { Dispatcher } from '../server/dispatcher';
import type { Handler } from '../server/dispatcher';
import { MethodName } from '../protocol/methods';
import type {
    EditOperation,
    MethodParams,
    MethodResult,
    TextRange,
} from '../protocol/methods';
import { BridgeErrorCode, bridgeError } from '../protocol/errors';
import type { JsonRpcError } from '../protocol/jsonrpc';

export const MAX_EDITOR_APPLY_EDIT_BYTES = 10 * 1024 * 1024;

export interface OpenedEditor {
    readonly editorId: string;
    readonly path: string;
}

export interface EditorDeps {
    readonly openFile: (params: { path: string; preview?: boolean }) => Promise<OpenedEditor>;
    readonly getActive: () => OpenedEditor | null;
    readonly applyEdit: (editorId: string, edits: readonly EditOperation[]) => Promise<boolean>;
    readonly setSelection: (editorId: string, selection: TextRange) => Promise<boolean>;
    readonly revealLine: (editorId: string, line: number) => Promise<boolean>;
}

export interface EditorHandlers {
    readonly openFile: Handler<MethodName.EditorOpenFile>;
    readonly getActive: Handler<MethodName.EditorGetActive>;
    readonly applyEdit: Handler<MethodName.EditorApplyEdit>;
    readonly setSelection: Handler<MethodName.EditorSetSelection>;
    readonly revealLine: Handler<MethodName.EditorRevealLine>;
}

function throwBridge(code: BridgeErrorCode, data?: Record<string, unknown>): never {
    const err: Error & { bridgeError?: JsonRpcError } = new Error(code);
    err.bridgeError = data ? bridgeError(code, { data }) : bridgeError(code);
    throw err;
}

function editsTotalBytes(edits: readonly EditOperation[]): number {
    let total = 0;
    for (const edit of edits) {
        total += Buffer.byteLength(edit.newText, 'utf-8');
        if (total > MAX_EDITOR_APPLY_EDIT_BYTES) {
            return total;
        }
    }
    return total;
}

export function createEditorHandlers(deps: EditorDeps): EditorHandlers {

    const openFile: Handler<MethodName.EditorOpenFile> = async (params: MethodParams[MethodName.EditorOpenFile]) => {
        const opened = await deps.openFile({ path: params.path, preview: params.preview });
        return { editorId: opened.editorId } as MethodResult[MethodName.EditorOpenFile];
    };

    const getActive: Handler<MethodName.EditorGetActive> = async () => {
        const active = deps.getActive();
        if (!active) {
            return { editorId: null, path: null } as MethodResult[MethodName.EditorGetActive];
        }
        return { editorId: active.editorId, path: active.path } as MethodResult[MethodName.EditorGetActive];
    };

    const applyEdit: Handler<MethodName.EditorApplyEdit> = async (params: MethodParams[MethodName.EditorApplyEdit]) => {
        if (editsTotalBytes(params.edits) > MAX_EDITOR_APPLY_EDIT_BYTES) {
            throwBridge(BridgeErrorCode.PayloadTooLarge, { limit: MAX_EDITOR_APPLY_EDIT_BYTES });
        }
        const applied = await deps.applyEdit(params.editorId, params.edits);
        return { applied } as MethodResult[MethodName.EditorApplyEdit];
    };

    const setSelection: Handler<MethodName.EditorSetSelection> = async (params: MethodParams[MethodName.EditorSetSelection]) => {
        const applied = await deps.setSelection(params.editorId, params.selection);
        return { applied } as MethodResult[MethodName.EditorSetSelection];
    };

    const revealLine: Handler<MethodName.EditorRevealLine> = async (params: MethodParams[MethodName.EditorRevealLine]) => {
        const applied = await deps.revealLine(params.editorId, params.line);
        return { applied } as MethodResult[MethodName.EditorRevealLine];
    };

    return { openFile, getActive, applyEdit, setSelection, revealLine };
}

export function registerEditorHandlers(dispatcher: Dispatcher, deps: EditorDeps): void {
    const handlers = createEditorHandlers(deps);
    dispatcher.register(MethodName.EditorOpenFile, handlers.openFile);
    dispatcher.register(MethodName.EditorGetActive, handlers.getActive);
    dispatcher.register(MethodName.EditorApplyEdit, handlers.applyEdit);
    dispatcher.register(MethodName.EditorSetSelection, handlers.setSelection);
    dispatcher.register(MethodName.EditorRevealLine, handlers.revealLine);
}
