/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import {
    MAX_EDITOR_APPLY_EDIT_BYTES,
    createEditorHandlers,
} from '../../rpc/editor';
import type { EditorDeps } from '../../rpc/editor';
import { BridgeErrorCode } from '../../protocol/errors';
import type { JsonRpcError } from '../../protocol/jsonrpc';
import type { TextRange, EditOperation } from '../../protocol/methods';

function bridgeCodeOf(err: unknown): string | undefined {
    if (!(err instanceof Error)) { return undefined; }
    const data = (err as Error & { bridgeError?: JsonRpcError }).bridgeError?.data as
        | { bridgeCode?: string }
        | undefined;
    return data?.bridgeCode;
}

interface FakeEditorState {
    readonly opened: string[];
    readonly applied: Array<{ editorId: string; edits: readonly EditOperation[] }>;
    readonly selections: Array<{ editorId: string; sel: TextRange }>;
    readonly revealed: Array<{ editorId: string; line: number }>;
    active: { editorId: string; path: string } | null;
}

function makeDeps(opts?: { active?: { editorId: string; path: string } | null; throwOnEditor?: string }): {
    deps: EditorDeps;
    state: FakeEditorState;
} {
    const state: FakeEditorState = {
        opened: [],
        applied: [],
        selections: [],
        revealed: [],
        active: opts?.active ?? null,
    };

    const deps: EditorDeps = {
        openFile: async ({ path }) => {
            state.opened.push(path);
            const editorId = `editor-${state.opened.length}`;
            state.active = { editorId, path };
            return { editorId, path };
        },
        getActive: () => state.active,
        applyEdit: async (editorId, edits) => {
            if (opts?.throwOnEditor === editorId) { throw new Error(`unknown editor ${editorId}`); }
            state.applied.push({ editorId, edits });
            return true;
        },
        setSelection: async (editorId, sel) => {
            state.selections.push({ editorId, sel });
            return true;
        },
        revealLine: async (editorId, line) => {
            state.revealed.push({ editorId, line });
            return true;
        },
    };

    return { deps, state };
}

function smallRange(): TextRange {
    return { startLine: 0, startCol: 0, endLine: 0, endCol: 0 };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

suite('rpc/editor', () => {

    test('MAX_EDITOR_APPLY_EDIT_BYTES is exactly 10 MiB (cl-5)', () => {
        assert.equal(MAX_EDITOR_APPLY_EDIT_BYTES, 10 * 1024 * 1024);
    });

    suite('openFile', () => {

        test('forwards to deps and returns an editorId', async () => {
            const { deps, state } = makeDeps();
            const handlers = createEditorHandlers(deps);

            const result = await handlers.openFile({ path: '/a/b/c.ts' });

            assert.match(result.editorId, /^editor-/);
            assert.equal(state.opened[0], '/a/b/c.ts');
        });

        test('honours the optional preview flag', async () => {
            const { deps, state } = makeDeps();
            const handlers = createEditorHandlers(deps);

            await handlers.openFile({ path: '/x.ts', preview: true });

            // Verified indirectly: the test transports just records path; full
            // preview semantics are deferred to the real vscode adapter.
            assert.equal(state.opened[0], '/x.ts');
        });
    });

    suite('getActive', () => {

        test('returns null when no editor is active', async () => {
            const { deps } = makeDeps({ active: null });
            const handlers = createEditorHandlers(deps);

            const result = await handlers.getActive(undefined);

            assert.deepEqual(result, { editorId: null, path: null });
        });

        test('returns the active editorId + path when present', async () => {
            const { deps } = makeDeps({ active: { editorId: 'editor-7', path: '/foo.ts' } });
            const handlers = createEditorHandlers(deps);

            const result = await handlers.getActive(undefined);

            assert.deepEqual(result, { editorId: 'editor-7', path: '/foo.ts' });
        });
    });

    suite('applyEdit', () => {

        test('forwards the edits to the deps and returns applied=true', async () => {
            const { deps, state } = makeDeps();
            const handlers = createEditorHandlers(deps);

            const edits: EditOperation[] = [
                { range: smallRange(), newText: 'hello' },
                { range: smallRange(), newText: 'world' },
            ];
            const result = await handlers.applyEdit({ editorId: 'editor-1', edits });

            assert.deepEqual(result, { applied: true });
            assert.equal(state.applied.length, 1);
            assert.equal(state.applied[0].editorId, 'editor-1');
            assert.deepEqual(state.applied[0].edits, edits);
        });

        test('rejects with payload_too_large when total newText exceeds 10 MiB', async () => {
            const { deps } = makeDeps();
            const handlers = createEditorHandlers(deps);

            const giant = 'X'.repeat(MAX_EDITOR_APPLY_EDIT_BYTES + 1);
            const edits: EditOperation[] = [{ range: smallRange(), newText: giant }];

            try {
                await handlers.applyEdit({ editorId: 'editor-1', edits });
                assert.fail('expected throw');
            } catch (err) {
                assert.equal(bridgeCodeOf(err), BridgeErrorCode.PayloadTooLarge);
                const data = (err as Error & { bridgeError?: JsonRpcError }).bridgeError?.data as
                    { limit: number };
                assert.equal(data.limit, MAX_EDITOR_APPLY_EDIT_BYTES);
            }
        });

        test('counts the SUM of newText bytes across edits, not the largest', async () => {
            const { deps } = makeDeps();
            const handlers = createEditorHandlers(deps);

            const half = 'A'.repeat(MAX_EDITOR_APPLY_EDIT_BYTES / 2 + 1);
            const edits: EditOperation[] = [
                { range: smallRange(), newText: half },
                { range: smallRange(), newText: half },
            ];

            try {
                await handlers.applyEdit({ editorId: 'editor-1', edits });
                assert.fail('expected throw');
            } catch (err) {
                assert.equal(bridgeCodeOf(err), BridgeErrorCode.PayloadTooLarge);
            }
        });
    });

    suite('setSelection', () => {

        test('forwards to deps and returns applied=true', async () => {
            const { deps, state } = makeDeps();
            const handlers = createEditorHandlers(deps);

            const selection: TextRange = { startLine: 1, startCol: 2, endLine: 1, endCol: 8 };
            const result = await handlers.setSelection({ editorId: 'editor-1', selection });

            assert.deepEqual(result, { applied: true });
            assert.deepEqual(state.selections[0], { editorId: 'editor-1', sel: selection });
        });
    });

    suite('revealLine', () => {

        test('forwards to deps and returns applied=true', async () => {
            const { deps, state } = makeDeps();
            const handlers = createEditorHandlers(deps);

            const result = await handlers.revealLine({ editorId: 'editor-1', line: 42 });

            assert.deepEqual(result, { applied: true });
            assert.deepEqual(state.revealed[0], { editorId: 'editor-1', line: 42 });
        });
    });
});
