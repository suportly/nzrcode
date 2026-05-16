/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Handlers for the `terminal` namespace: list, sendText, signal.
// cl-1 requires a DEDICATED `signal` method instead of "magic byte" detection
// inside `sendText` — that way a script that legitimately needs to type a
// Ctrl-C escape into the shell can still do so.

import { Dispatcher } from '../server/dispatcher';
import type { Handler } from '../server/dispatcher';
import { MethodName } from '../protocol/methods';
import type { MethodParams, MethodResult, TerminalInfo } from '../protocol/methods';
import { BridgeErrorCode, bridgeError } from '../protocol/errors';
import type { JsonRpcError } from '../protocol/jsonrpc';

/** Control bytes injected by `signal()`. SIGINT → Ctrl-C; SIGTERM → Ctrl-\\. */
export const TERMINAL_SIGNAL_BYTES: Readonly<Record<'SIGINT' | 'SIGTERM', string>> = {
    SIGINT: '\x03',
    SIGTERM: '\x1c',
};

export interface TerminalDeps {
    readonly listTerminals: () => readonly TerminalInfo[];
    readonly sendText: (terminalId: string, text: string) => Promise<boolean>;
}

export interface TerminalHandlers {
    readonly list: Handler<MethodName.TerminalList>;
    readonly sendText: Handler<MethodName.TerminalSendText>;
    readonly signal: Handler<MethodName.TerminalSignal>;
}

function throwBridge(code: BridgeErrorCode, message?: string): never {
    const err: Error & { bridgeError?: JsonRpcError } = new Error(message ?? code);
    err.bridgeError = message ? bridgeError(code, { message }) : bridgeError(code);
    throw err;
}

export function createTerminalHandlers(deps: TerminalDeps): TerminalHandlers {

    const list: Handler<MethodName.TerminalList> = async () => {
        return { terminals: deps.listTerminals() } as MethodResult[MethodName.TerminalList];
    };

    const sendText: Handler<MethodName.TerminalSendText> = async (params: MethodParams[MethodName.TerminalSendText]) => {
        const sent = await deps.sendText(params.terminalId, params.text);
        return { sent } as MethodResult[MethodName.TerminalSendText];
    };

    const signal: Handler<MethodName.TerminalSignal> = async (params: MethodParams[MethodName.TerminalSignal]) => {
        const byte = TERMINAL_SIGNAL_BYTES[params.signal];
        if (typeof byte !== 'string') {
            throwBridge(BridgeErrorCode.InternalError, `Unknown terminal signal: ${String(params.signal)}`);
        }
        await deps.sendText(params.terminalId, byte);
        return { sent: true } as MethodResult[MethodName.TerminalSignal];
    };

    return { list, sendText, signal };
}

export function registerTerminalHandlers(dispatcher: Dispatcher, deps: TerminalDeps): void {
    const handlers = createTerminalHandlers(deps);
    dispatcher.register(MethodName.TerminalList, handlers.list);
    dispatcher.register(MethodName.TerminalSendText, handlers.sendText);
    dispatcher.register(MethodName.TerminalSignal, handlers.signal);
}
