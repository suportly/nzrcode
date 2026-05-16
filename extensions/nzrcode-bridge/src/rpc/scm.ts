/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Handlers for the `scm` namespace: status, diff, stage, commit.
// The VS Code git API surface is injected via `ScmDeps` so unit tests can
// run outside an Extension Host. The real adapter wires through the
// `vscode.git` extension API.

import { Dispatcher } from '../server/dispatcher';
import type { Handler } from '../server/dispatcher';
import { MethodName } from '../protocol/methods';
import type { MethodParams, MethodResult } from '../protocol/methods';

export interface ScmStatusReport {
    readonly staged: readonly string[];
    readonly modified: readonly string[];
    readonly untracked: readonly string[];
}

export interface ScmDeps {
    readonly status: () => Promise<ScmStatusReport>;
    readonly diff: (path: string) => Promise<string>;
    readonly stage: (paths: readonly string[]) => Promise<readonly string[]>;
    readonly commit: (message: string) => Promise<string>;
}

export interface ScmHandlers {
    readonly status: Handler<MethodName.ScmStatus>;
    readonly diff: Handler<MethodName.ScmDiff>;
    readonly stage: Handler<MethodName.ScmStage>;
    readonly commit: Handler<MethodName.ScmCommit>;
}

export function createScmHandlers(deps: ScmDeps): ScmHandlers {

    const status: Handler<MethodName.ScmStatus> = async () => {
        const report = await deps.status();
        return {
            staged: report.staged,
            modified: report.modified,
            untracked: report.untracked,
        } as MethodResult[MethodName.ScmStatus];
    };

    const diff: Handler<MethodName.ScmDiff> = async (params: MethodParams[MethodName.ScmDiff]) => {
        return { diff: await deps.diff(params.path) } as MethodResult[MethodName.ScmDiff];
    };

    const stage: Handler<MethodName.ScmStage> = async (params: MethodParams[MethodName.ScmStage]) => {
        return { staged: await deps.stage(params.paths) } as MethodResult[MethodName.ScmStage];
    };

    const commit: Handler<MethodName.ScmCommit> = async (params: MethodParams[MethodName.ScmCommit]) => {
        return { commitId: await deps.commit(params.message) } as MethodResult[MethodName.ScmCommit];
    };

    return { status, diff, stage, commit };
}

export function registerScmHandlers(dispatcher: Dispatcher, deps: ScmDeps): void {
    const handlers = createScmHandlers(deps);
    dispatcher.register(MethodName.ScmStatus, handlers.status);
    dispatcher.register(MethodName.ScmDiff, handlers.diff);
    dispatcher.register(MethodName.ScmStage, handlers.stage);
    dispatcher.register(MethodName.ScmCommit, handlers.commit);
}
