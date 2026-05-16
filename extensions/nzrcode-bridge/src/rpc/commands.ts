/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Handlers for the `commands` namespace: execute + list.
// The `vscode.commands` API surface is injected via `CommandsDeps` so unit
// tests can run outside an Extension Host (cl-9 / Article II).
// REQUIRES_ACTIVE_EDITOR.md documents the canonical list of commands that
// require `vscode.window.activeTextEditor` to be set; calling them without
// an editor short-circuits to `no_active_editor` rather than surfacing the
// internal VS Code exception to the iPad client.

import { Dispatcher } from '../server/dispatcher';
import type { Handler } from '../server/dispatcher';
import { MethodName } from '../protocol/methods';
import type { MethodParams, MethodResult } from '../protocol/methods';
import { BridgeErrorCode, bridgeError } from '../protocol/errors';
import type { JsonRpcError } from '../protocol/jsonrpc';

/**
 * Commands that require an active text editor. Keep in sync with
 * `extensions/nzrcode-bridge/REQUIRES_ACTIVE_EDITOR.md`.
 */
export const CANONICAL_REQUIRES_ACTIVE_EDITOR: ReadonlySet<string> = new Set([
    'editor.action.formatDocument',
    'editor.action.commentLine',
    'editor.action.rename',
    'editor.action.goToDeclaration',
    'editor.action.formatSelection',
    'editor.action.organizeImports',
    'editor.action.quickFix',
    'editor.action.showHover',
    'editor.action.revealDefinition',
]);

export interface CommandsDeps {
    readonly executeCommand: (id: string, ...args: unknown[]) => Promise<unknown> | Thenable<unknown>;
    readonly getCommands: (filterInternal?: boolean) => Promise<string[]> | Thenable<string[]>;
    readonly hasActiveEditor: () => boolean;
    readonly requiresActiveEditor?: ReadonlySet<string>;
}

export interface CommandsHandlers {
    readonly execute: Handler<MethodName.CommandsExecute>;
    readonly list: Handler<MethodName.CommandsList>;
}

/**
 * Errors thrown by handlers carry a `bridgeError` property so the dispatcher
 * can translate them into a JSON-RPC error response without leaking stack traces.
 */
function throwBridge(code: BridgeErrorCode, message?: string): never {
    const error: Error & { bridgeError?: JsonRpcError } = new Error(message ?? code);
    error.bridgeError = message ? bridgeError(code, { message }) : bridgeError(code);
    throw error;
}

function isCommandNotFoundError(err: unknown): boolean {
    if (!(err instanceof Error)) { return false; }
    return /command\s+['"]?[^'"]+['"]?\s+not\s+found/i.test(err.message);
}

export function createCommandsHandlers(deps: CommandsDeps): CommandsHandlers {
    const requires = deps.requiresActiveEditor ?? CANONICAL_REQUIRES_ACTIVE_EDITOR;

    const execute: Handler<MethodName.CommandsExecute> = async (params: MethodParams[MethodName.CommandsExecute]) => {
        const { command, args = [] } = params;

        if (requires.has(command) && !deps.hasActiveEditor()) {
            throwBridge(BridgeErrorCode.NoActiveEditor);
        }

        try {
            const value = await deps.executeCommand(command, ...args);
            return { value } as MethodResult[MethodName.CommandsExecute];
        } catch (err) {
            if (isCommandNotFoundError(err)) {
                throwBridge(BridgeErrorCode.CommandNotFound, `Command '${command}' not found.`);
            }
            throw err;
        }
    };

    const list: Handler<MethodName.CommandsList> = async () => {
        const all = await deps.getCommands(true);
        const publishable = all
            .filter(id => !id.startsWith('_'))
            .sort((a, b) => a.localeCompare(b));
        return { commands: publishable } as MethodResult[MethodName.CommandsList];
    };

    return { execute, list };
}

export function registerCommandsHandlers(dispatcher: Dispatcher, deps: CommandsDeps): void {
    const handlers = createCommandsHandlers(deps);
    dispatcher.register(MethodName.CommandsExecute, handlers.execute);
    dispatcher.register(MethodName.CommandsList, handlers.list);
}
