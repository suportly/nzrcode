/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Handlers for the `workspace` namespace: listFolders, findFiles, readFile, writeFile.
//
// Two security invariants enforced here (Article VI):
//   1. Every path is normalized + resolved, then checked against every workspace
//      folder. Anything outside returns `path_outside_workspace`.
//   2. Reads and writes ABOVE 10 MiB are rejected with `payload_too_large` and
//      `data.limit = MAX_WORKSPACE_PAYLOAD_BYTES`.
//
// Privacy invariant (Article VI / cl-9): readFile and writeFile log metadata
// only — `redactContent` from logging.ts is the single channel through which
// content metrics are surfaced. The raw bytes never reach the logger.

import * as path from 'path';
import { Dispatcher } from '../server/dispatcher';
import type { Handler, Logger } from '../server/dispatcher';
import { MethodName } from '../protocol/methods';
import type { MethodParams, MethodResult } from '../protocol/methods';
import { BridgeErrorCode, bridgeError } from '../protocol/errors';
import type { JsonRpcError } from '../protocol/jsonrpc';
import { redactContent } from '../logging';

export const MAX_WORKSPACE_PAYLOAD_BYTES = 10 * 1024 * 1024;

export interface WorkspaceFolderShape {
    readonly uri: { readonly fsPath: string };
    readonly name: string;
}

export interface WorkspaceFindResult {
    readonly fsPath: string;
}

export interface WorkspaceDeps {
    readonly workspaceFolders: () => readonly WorkspaceFolderShape[];
    readonly findFiles: (pattern: string, max?: number) => Promise<readonly WorkspaceFindResult[]> | Thenable<readonly WorkspaceFindResult[]>;
    readonly readFile: (fsPath: string) => Promise<Uint8Array> | Thenable<Uint8Array>;
    readonly writeFile: (fsPath: string, content: Uint8Array) => Promise<void> | Thenable<void>;
    readonly logger: Logger;
}

export interface WorkspaceHandlers {
    readonly listFolders: Handler<MethodName.WorkspaceListFolders>;
    readonly findFiles: Handler<MethodName.WorkspaceFindFiles>;
    readonly readFile: Handler<MethodName.WorkspaceReadFile>;
    readonly writeFile: Handler<MethodName.WorkspaceWriteFile>;
}

function throwBridge(code: BridgeErrorCode, data?: Record<string, unknown>): never {
    const err: Error & { bridgeError?: JsonRpcError } = new Error(code);
    err.bridgeError = data ? bridgeError(code, data) : bridgeError(code);
    throw err;
}

function isInsideWorkspace(targetPath: string, folders: readonly WorkspaceFolderShape[]): boolean {
    const resolved = path.resolve(targetPath);
    for (const folder of folders) {
        const rootResolved = path.resolve(folder.uri.fsPath);
        const rel = path.relative(rootResolved, resolved);
        if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
            return true;
        }
    }
    return false;
}

function ensureInsideWorkspace(targetPath: string, folders: readonly WorkspaceFolderShape[]): void {
    if (!isInsideWorkspace(targetPath, folders)) {
        throwBridge(BridgeErrorCode.PathOutsideWorkspace);
    }
}

export function createWorkspaceHandlers(deps: WorkspaceDeps): WorkspaceHandlers {

    const listFolders: Handler<MethodName.WorkspaceListFolders> = () => {
        const folders = deps.workspaceFolders().map(f => ({
            name: f.name,
            path: f.uri.fsPath,
        }));
        return { folders } as MethodResult[MethodName.WorkspaceListFolders];
    };

    const findFiles: Handler<MethodName.WorkspaceFindFiles> = async (params: MethodParams[MethodName.WorkspaceFindFiles]) => {
        const results = await deps.findFiles(params.pattern, params.maxResults);
        return { paths: results.map(r => r.fsPath) } as MethodResult[MethodName.WorkspaceFindFiles];
    };

    const readFile: Handler<MethodName.WorkspaceReadFile> = async (params: MethodParams[MethodName.WorkspaceReadFile]) => {
        ensureInsideWorkspace(params.path, deps.workspaceFolders());

        const bytes = await deps.readFile(params.path);
        const buf = Buffer.from(bytes);

        if (buf.length > MAX_WORKSPACE_PAYLOAD_BYTES) {
            throwBridge(BridgeErrorCode.PayloadTooLarge, { limit: MAX_WORKSPACE_PAYLOAD_BYTES });
        }

        deps.logger.info('fs.readFile', redactContent(buf));

        return {
            contentBase64: buf.toString('base64'),
            byteCount: buf.length,
        } as MethodResult[MethodName.WorkspaceReadFile];
    };

    const writeFile: Handler<MethodName.WorkspaceWriteFile> = async (params: MethodParams[MethodName.WorkspaceWriteFile]) => {
        ensureInsideWorkspace(params.path, deps.workspaceFolders());

        const content = Buffer.from(params.contentBase64, 'base64');
        if (content.length > MAX_WORKSPACE_PAYLOAD_BYTES) {
            throwBridge(BridgeErrorCode.PayloadTooLarge, { limit: MAX_WORKSPACE_PAYLOAD_BYTES });
        }

        await deps.writeFile(params.path, content);

        deps.logger.info('fs.writeFile', redactContent(content));

        return { byteCount: content.length } as MethodResult[MethodName.WorkspaceWriteFile];
    };

    return { listFolders, findFiles, readFile, writeFile };
}

export function registerWorkspaceHandlers(dispatcher: Dispatcher, deps: WorkspaceDeps): void {
    const handlers = createWorkspaceHandlers(deps);
    dispatcher.register(MethodName.WorkspaceListFolders, handlers.listFolders);
    dispatcher.register(MethodName.WorkspaceFindFiles, handlers.findFiles);
    dispatcher.register(MethodName.WorkspaceReadFile, handlers.readFile);
    dispatcher.register(MethodName.WorkspaceWriteFile, handlers.writeFile);
}
