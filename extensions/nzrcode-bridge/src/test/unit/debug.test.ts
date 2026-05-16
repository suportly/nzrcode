/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import { createDebugHandlers } from '../../rpc/debug';
import type { DebugDeps } from '../../rpc/debug';
import type { DebugVariable } from '../../protocol/methods';

interface FakeDebugState {
    readonly started: string[];
    readonly stopped: string[];
    readonly breakpoints: Array<{ path: string; line: number; breakpointId: string }>;
    readonly variables: Map<number, readonly DebugVariable[]>;
    sessionCounter: number;
    breakpointCounter: number;
}

function makeDeps(opts?: { variables?: Map<number, readonly DebugVariable[]> }): { deps: DebugDeps; state: FakeDebugState } {
    const state: FakeDebugState = {
        started: [],
        stopped: [],
        breakpoints: [],
        variables: opts?.variables ?? new Map(),
        sessionCounter: 0,
        breakpointCounter: 0,
    };

    const deps: DebugDeps = {
        start: async (configurationName) => {
            state.sessionCounter += 1;
            const sessionId = `session-${state.sessionCounter}`;
            state.started.push(configurationName);
            return sessionId;
        },
        stop: async (sessionId) => {
            state.stopped.push(sessionId);
            return true;
        },
        addBreakpoint: async ({ path, line }) => {
            state.breakpointCounter += 1;
            const breakpointId = `bp-${state.breakpointCounter}`;
            state.breakpoints.push({ path, line, breakpointId });
            return breakpointId;
        },
        variables: async (frameId) => state.variables.get(frameId) ?? [],
    };

    return { deps, state };
}

suite('rpc/debug', () => {

    suite('start', () => {

        test('starts a configuration and returns a sessionId', async () => {
            const { deps, state } = makeDeps();
            const handlers = createDebugHandlers(deps);

            const result = await handlers.start({ configurationName: 'launch-node' });

            assert.match(result.sessionId, /^session-/);
            assert.deepEqual(state.started, ['launch-node']);
        });

        test('issues distinct session ids for successive starts', async () => {
            const { deps } = makeDeps();
            const handlers = createDebugHandlers(deps);

            const a = await handlers.start({ configurationName: 'a' });
            const b = await handlers.start({ configurationName: 'b' });

            assert.notEqual(a.sessionId, b.sessionId);
        });
    });

    suite('stop', () => {

        test('forwards the session id to deps and returns stopped=true', async () => {
            const { deps, state } = makeDeps();
            const handlers = createDebugHandlers(deps);

            const result = await handlers.stop({ sessionId: 'session-1' });

            assert.deepEqual(result, { stopped: true });
            assert.deepEqual(state.stopped, ['session-1']);
        });
    });

    suite('breakpointAdd', () => {

        test('adds a breakpoint at the requested path and line', async () => {
            const { deps, state } = makeDeps();
            const handlers = createDebugHandlers(deps);

            const result = await handlers.breakpointAdd({ path: '/src/a.ts', line: 42 });

            assert.match(result.breakpointId, /^bp-/);
            assert.deepEqual(state.breakpoints[0], { path: '/src/a.ts', line: 42, breakpointId: result.breakpointId });
        });
    });

    suite('variables', () => {

        test('returns the variables reported for a given stack frame', async () => {
            const vars: readonly DebugVariable[] = [
                { name: 'x', value: '42', type: 'number' },
                { name: 'msg', value: 'hi', type: 'string' },
            ];
            const variables = new Map<number, readonly DebugVariable[]>([[1001, vars]]);
            const { deps } = makeDeps({ variables });
            const handlers = createDebugHandlers(deps);

            const result = await handlers.variables({ frameId: 1001 });

            assert.deepEqual(result.variables, vars);
        });

        test('returns an empty array when the frame has no variables', async () => {
            const { deps } = makeDeps();
            const handlers = createDebugHandlers(deps);

            const result = await handlers.variables({ frameId: 999 });

            assert.deepEqual(result.variables, []);
        });
    });
});
