/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Handlers for the `debug` namespace: start, stop, breakpointAdd, variables.
// `vscode.debug` API surface is injected via `DebugDeps` so unit tests can
// run without an Extension Host. Real adapter lives next to T034's canonical
// event wiring (debug.stopped is published by `events/canonical.ts`).

import { Dispatcher } from '../server/dispatcher';
import type { Handler } from '../server/dispatcher';
import { MethodName } from '../protocol/methods';
import type { DebugVariable, MethodParams, MethodResult } from '../protocol/methods';

export interface DebugDeps {
    readonly start: (configurationName: string) => Promise<string>;
    readonly stop: (sessionId: string) => Promise<boolean>;
    readonly addBreakpoint: (params: { path: string; line: number }) => Promise<string>;
    readonly variables: (frameId: number) => Promise<readonly DebugVariable[]>;
}

export interface DebugHandlers {
    readonly start: Handler<MethodName.DebugStart>;
    readonly stop: Handler<MethodName.DebugStop>;
    readonly breakpointAdd: Handler<MethodName.DebugBreakpointAdd>;
    readonly variables: Handler<MethodName.DebugVariables>;
}

export function createDebugHandlers(deps: DebugDeps): DebugHandlers {

    const start: Handler<MethodName.DebugStart> = async (params: MethodParams[MethodName.DebugStart]) => {
        return { sessionId: await deps.start(params.configurationName) } as MethodResult[MethodName.DebugStart];
    };

    const stop: Handler<MethodName.DebugStop> = async (params: MethodParams[MethodName.DebugStop]) => {
        return { stopped: await deps.stop(params.sessionId) } as MethodResult[MethodName.DebugStop];
    };

    const breakpointAdd: Handler<MethodName.DebugBreakpointAdd> = async (params: MethodParams[MethodName.DebugBreakpointAdd]) => {
        return { breakpointId: await deps.addBreakpoint({ path: params.path, line: params.line }) } as MethodResult[MethodName.DebugBreakpointAdd];
    };

    const variables: Handler<MethodName.DebugVariables> = async (params: MethodParams[MethodName.DebugVariables]) => {
        return { variables: await deps.variables(params.frameId) } as MethodResult[MethodName.DebugVariables];
    };

    return { start, stop, breakpointAdd, variables };
}

export function registerDebugHandlers(dispatcher: Dispatcher, deps: DebugDeps): void {
    const handlers = createDebugHandlers(deps);
    dispatcher.register(MethodName.DebugStart, handlers.start);
    dispatcher.register(MethodName.DebugStop, handlers.stop);
    dispatcher.register(MethodName.DebugBreakpointAdd, handlers.breakpointAdd);
    dispatcher.register(MethodName.DebugVariables, handlers.variables);
}
