/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import { createScmHandlers } from '../../rpc/scm';
import type { ScmDeps, ScmStatusReport } from '../../rpc/scm';

interface FakeScmState {
    status: ScmStatusReport;
    readonly diffs: Map<string, string>;
    readonly stageCalls: Array<readonly string[]>;
    readonly commitCalls: string[];
    nextCommitId: string;
}

function makeDeps(overrides?: Partial<FakeScmState>): { deps: ScmDeps; state: FakeScmState } {
    const state: FakeScmState = {
        status: overrides?.status ?? { staged: [], modified: [], untracked: [] },
        diffs: overrides?.diffs ?? new Map(),
        stageCalls: [],
        commitCalls: [],
        nextCommitId: overrides?.nextCommitId ?? 'deadbeefdeadbeef',
    };

    const deps: ScmDeps = {
        status: async () => state.status,
        diff: async (path) => state.diffs.get(path) ?? '',
        stage: async (paths) => {
            state.stageCalls.push(paths);
            const next: ScmStatusReport = {
                staged: [...state.status.staged, ...paths],
                modified: state.status.modified.filter(p => !paths.includes(p)),
                untracked: state.status.untracked.filter(p => !paths.includes(p)),
            };
            state.status = next;
            return paths;
        },
        commit: async (message) => {
            state.commitCalls.push(message);
            state.status = { staged: [], modified: state.status.modified, untracked: state.status.untracked };
            return state.nextCommitId;
        },
    };

    return { deps, state };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

suite('rpc/scm', () => {

    suite('status', () => {

        test('returns the staged/modified/untracked partition', async () => {
            const { deps } = makeDeps({
                status: {
                    staged: ['a.ts'],
                    modified: ['b.ts'],
                    untracked: ['c.txt'],
                },
            });
            const handlers = createScmHandlers(deps);

            const result = await handlers.status(undefined);

            assert.deepEqual(result, { staged: ['a.ts'], modified: ['b.ts'], untracked: ['c.txt'] });
        });

        test('returns empty arrays on a clean tree', async () => {
            const { deps } = makeDeps();
            const handlers = createScmHandlers(deps);

            const result = await handlers.status(undefined);

            assert.deepEqual(result, { staged: [], modified: [], untracked: [] });
        });
    });

    suite('diff', () => {

        test('returns the unified diff text for a given path', async () => {
            const expected = '--- a/foo.ts\n+++ b/foo.ts\n@@ -1 +1 @@\n-old\n+new\n';
            const { deps } = makeDeps({
                diffs: new Map([['foo.ts', expected]]),
            });
            const handlers = createScmHandlers(deps);

            const result = await handlers.diff({ path: 'foo.ts' });

            assert.equal(result.diff, expected);
        });

        test('returns an empty string when the path has no diff', async () => {
            const { deps } = makeDeps();
            const handlers = createScmHandlers(deps);

            const result = await handlers.diff({ path: 'unchanged.ts' });

            assert.equal(result.diff, '');
        });
    });

    suite('stage', () => {

        test('promotes modified files to staged', async () => {
            const { deps, state } = makeDeps({
                status: { staged: [], modified: ['b.ts', 'c.ts'], untracked: [] },
            });
            const handlers = createScmHandlers(deps);

            const result = await handlers.stage({ paths: ['b.ts'] });

            assert.deepEqual(result.staged, ['b.ts']);
            assert.deepEqual(state.stageCalls[0], ['b.ts']);
            assert.deepEqual(state.status.staged, ['b.ts']);
            assert.deepEqual(state.status.modified, ['c.ts']);
        });

        test('promotes untracked files to staged', async () => {
            const { deps, state } = makeDeps({
                status: { staged: [], modified: [], untracked: ['new.ts'] },
            });
            const handlers = createScmHandlers(deps);

            await handlers.stage({ paths: ['new.ts'] });

            assert.deepEqual(state.status.staged, ['new.ts']);
            assert.deepEqual(state.status.untracked, []);
        });
    });

    suite('commit', () => {

        test('creates a commit from the staged changes and returns the commitId', async () => {
            const { deps, state } = makeDeps({
                status: { staged: ['a.ts'], modified: [], untracked: [] },
                nextCommitId: 'cafebabecafebabe',
            });
            const handlers = createScmHandlers(deps);

            const result = await handlers.commit({ message: 'feat: x' });

            assert.equal(result.commitId, 'cafebabecafebabe');
            assert.deepEqual(state.commitCalls, ['feat: x']);
            assert.deepEqual(state.status.staged, []);
        });
    });
});
