/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Handlers for the `tasks` namespace: list, run, cancel.
// `vscode.tasks` is injected via `TasksDeps` so the unit tests can run
// without an Extension Host.

import { Dispatcher } from '../server/dispatcher';
import type { Handler } from '../server/dispatcher';
import { MethodName } from '../protocol/methods';
import type { MethodParams, MethodResult, TaskInfo } from '../protocol/methods';

export interface TasksDeps {
    readonly list: () => readonly TaskInfo[];
    readonly run: (taskName: string) => Promise<string>;
    readonly cancel: (executionId: string) => Promise<boolean>;
}

export interface TasksHandlers {
    readonly list: Handler<MethodName.TasksList>;
    readonly run: Handler<MethodName.TasksRun>;
    readonly cancel: Handler<MethodName.TasksCancel>;
}

export function createTasksHandlers(deps: TasksDeps): TasksHandlers {

    const list: Handler<MethodName.TasksList> = async () => {
        return { tasks: deps.list() } as MethodResult[MethodName.TasksList];
    };

    const run: Handler<MethodName.TasksRun> = async (params: MethodParams[MethodName.TasksRun]) => {
        return { executionId: await deps.run(params.taskName) } as MethodResult[MethodName.TasksRun];
    };

    const cancel: Handler<MethodName.TasksCancel> = async (params: MethodParams[MethodName.TasksCancel]) => {
        return { cancelled: await deps.cancel(params.executionId) } as MethodResult[MethodName.TasksCancel];
    };

    return { list, run, cancel };
}

export function registerTasksHandlers(dispatcher: Dispatcher, deps: TasksDeps): void {
    const handlers = createTasksHandlers(deps);
    dispatcher.register(MethodName.TasksList, handlers.list);
    dispatcher.register(MethodName.TasksRun, handlers.run);
    dispatcher.register(MethodName.TasksCancel, handlers.cancel);
}
