/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import { createTasksHandlers } from '../../rpc/tasks';
import type { TasksDeps } from '../../rpc/tasks';
import type { TaskInfo } from '../../protocol/methods';

interface FakeTasksState {
    readonly tasks: readonly TaskInfo[];
    readonly executions: Map<string, string>;
    readonly cancelled: string[];
    runCounter: number;
}

function makeDeps(opts?: { tasks?: readonly TaskInfo[] }): { deps: TasksDeps; state: FakeTasksState } {
    const state: FakeTasksState = {
        tasks: opts?.tasks ?? [],
        executions: new Map(),
        cancelled: [],
        runCounter: 0,
    };

    const deps: TasksDeps = {
        list: () => state.tasks,
        run: async (taskName) => {
            state.runCounter += 1;
            const id = `exec-${state.runCounter}`;
            state.executions.set(id, taskName);
            return id;
        },
        cancel: async (executionId) => {
            if (!state.executions.has(executionId)) { return false; }
            state.cancelled.push(executionId);
            state.executions.delete(executionId);
            return true;
        },
    };

    return { deps, state };
}

suite('rpc/tasks', () => {

    suite('list', () => {

        test('returns the deps-reported tasks', async () => {
            const tasks: TaskInfo[] = [
                { name: 'dev', source: 'npm', running: false },
                { name: 'test', source: 'npm', running: true },
            ];
            const { deps } = makeDeps({ tasks });
            const handlers = createTasksHandlers(deps);

            const result = await handlers.list(undefined);

            assert.deepEqual(result.tasks, tasks);
        });

        test('returns an empty array when no tasks are declared', async () => {
            const { deps } = makeDeps();
            const handlers = createTasksHandlers(deps);

            const result = await handlers.list(undefined);

            assert.deepEqual(result.tasks, []);
        });
    });

    suite('run', () => {

        test('starts a task and returns a unique executionId', async () => {
            const { deps, state } = makeDeps();
            const handlers = createTasksHandlers(deps);

            const first = await handlers.run({ taskName: 'dev' });
            const second = await handlers.run({ taskName: 'test' });

            assert.notEqual(first.executionId, second.executionId);
            assert.equal(state.executions.get(first.executionId), 'dev');
            assert.equal(state.executions.get(second.executionId), 'test');
        });
    });

    suite('cancel', () => {

        test('cancels a known execution and returns cancelled=true', async () => {
            const { deps, state } = makeDeps();
            const handlers = createTasksHandlers(deps);

            const { executionId } = await handlers.run({ taskName: 'dev' });
            const result = await handlers.cancel({ executionId });

            assert.deepEqual(result, { cancelled: true });
            assert.deepEqual(state.cancelled, [executionId]);
        });

        test('returns cancelled=false for an unknown execution id', async () => {
            const { deps } = makeDeps();
            const handlers = createTasksHandlers(deps);

            const result = await handlers.cancel({ executionId: 'nope' });

            assert.deepEqual(result, { cancelled: false });
        });
    });
});
