/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import {
    CANONICAL_REQUIRES_ACTIVE_EDITOR,
    createCommandsHandlers,
} from '../../rpc/commands';
import type { CommandsDeps } from '../../rpc/commands';
import { BridgeErrorCode } from '../../protocol/errors';
import type { JsonRpcError } from '../../protocol/jsonrpc';

interface FakeVsCommands {
    readonly registered: ReadonlyMap<string, (...args: unknown[]) => unknown>;
    readonly executeCalls: ReadonlyArray<{ id: string; args: readonly unknown[] }>;
}

function makeDeps(opts: {
    registered: Iterable<[string, (...args: unknown[]) => unknown]>;
    hasActiveEditor: boolean;
}): CommandsDeps & FakeVsCommands {
    const registered = new Map(opts.registered);
    const executeCalls: Array<{ id: string; args: readonly unknown[] }> = [];

    return {
        executeCommand: async (id: string, ...args: unknown[]) => {
            executeCalls.push({ id, args });
            const fn = registered.get(id);
            if (!fn) {
                throw new Error(`command '${id}' not found`);
            }
            return fn(...args);
        },
        getCommands: async () => Array.from(registered.keys()),
        hasActiveEditor: () => opts.hasActiveEditor,
        registered,
        executeCalls,
    };
}

function expectBridgeError(err: unknown): JsonRpcError {
    assert.ok(err instanceof Error, `expected Error, got ${typeof err}`);
    const data = (err as Error & { bridgeError?: JsonRpcError }).bridgeError;
    assert.ok(data, 'expected .bridgeError on thrown Error');
    return data;
}

suite('rpc/commands', () => {

    suite('CANONICAL_REQUIRES_ACTIVE_EDITOR', () => {

        test('lists the 9 commands from REQUIRES_ACTIVE_EDITOR.md', () => {
            assert.equal(CANONICAL_REQUIRES_ACTIVE_EDITOR.size, 9);
            const expected = [
                'editor.action.formatDocument',
                'editor.action.commentLine',
                'editor.action.rename',
                'editor.action.goToDeclaration',
                'editor.action.formatSelection',
                'editor.action.organizeImports',
                'editor.action.quickFix',
                'editor.action.showHover',
                'editor.action.revealDefinition',
            ];
            for (const cmd of expected) {
                assert.ok(CANONICAL_REQUIRES_ACTIVE_EDITOR.has(cmd), `missing ${cmd}`);
            }
        });
    });

    suite('execute', () => {

        test('forwards to vscode.commands.executeCommand with args', async () => {
            const deps = makeDeps({
                registered: [['workbench.action.tasks.runTask', (taskName: unknown) => `ran:${String(taskName)}`]],
                hasActiveEditor: false,
            });
            const handlers = createCommandsHandlers(deps);

            const result = await handlers.execute({ command: 'workbench.action.tasks.runTask', args: ['dev'] });

            assert.deepEqual(result, { value: 'ran:dev' });
            assert.equal(deps.executeCalls.length, 1);
            assert.deepEqual(deps.executeCalls[0], { id: 'workbench.action.tasks.runTask', args: ['dev'] });
        });

        test('returns command_not_found for unknown commands', async () => {
            const deps = makeDeps({ registered: [], hasActiveEditor: false });
            const handlers = createCommandsHandlers(deps);

            try {
                await handlers.execute({ command: 'nope.does.not.exist' });
                assert.fail('expected throw');
            } catch (err) {
                const bridgeError = expectBridgeError(err);
                assert.equal((bridgeError.data as { bridgeCode: string }).bridgeCode, BridgeErrorCode.CommandNotFound);
            }
        });

        test('returns no_active_editor for a required-editor command with no active editor', async () => {
            const deps = makeDeps({
                registered: [['editor.action.formatDocument', () => undefined]],
                hasActiveEditor: false,
            });
            const handlers = createCommandsHandlers(deps);

            try {
                await handlers.execute({ command: 'editor.action.formatDocument' });
                assert.fail('expected throw');
            } catch (err) {
                const bridgeError = expectBridgeError(err);
                assert.equal((bridgeError.data as { bridgeCode: string }).bridgeCode, BridgeErrorCode.NoActiveEditor);
            }
            // VS Code must NOT have been called when we short-circuit.
            assert.equal(deps.executeCalls.length, 0);
        });

        test('does invoke VS Code for required-editor command when an editor IS active', async () => {
            const deps = makeDeps({
                registered: [['editor.action.formatDocument', () => 'ok']],
                hasActiveEditor: true,
            });
            const handlers = createCommandsHandlers(deps);

            const result = await handlers.execute({ command: 'editor.action.formatDocument' });

            assert.deepEqual(result, { value: 'ok' });
            assert.equal(deps.executeCalls.length, 1);
        });

        test('executes commands with no args', async () => {
            const deps = makeDeps({
                registered: [['workbench.action.reloadWindow', () => undefined]],
                hasActiveEditor: false,
            });
            const handlers = createCommandsHandlers(deps);

            const result = await handlers.execute({ command: 'workbench.action.reloadWindow' });

            assert.deepEqual(result, { value: undefined });
            assert.deepEqual(deps.executeCalls[0].args, []);
        });

        test('respects an injected requiresActiveEditor override (for tests)', async () => {
            const deps = makeDeps({
                registered: [['some.test.command', () => 'ran']],
                hasActiveEditor: false,
            });
            const handlers = createCommandsHandlers({
                ...deps,
                requiresActiveEditor: new Set(['some.test.command']),
            });

            try {
                await handlers.execute({ command: 'some.test.command' });
                assert.fail('expected throw');
            } catch (err) {
                const bridgeError = expectBridgeError(err);
                assert.equal((bridgeError.data as { bridgeCode: string }).bridgeCode, BridgeErrorCode.NoActiveEditor);
            }
        });
    });

    suite('list', () => {

        test('returns commands without the leading-underscore filter', async () => {
            const deps = makeDeps({
                registered: [
                    ['workbench.action.openSettings', () => undefined],
                    ['_internal.command', () => undefined],
                    ['vscode.diff', () => undefined],
                ],
                hasActiveEditor: false,
            });
            const handlers = createCommandsHandlers(deps);

            const result = await handlers.list(undefined);

            // _internal must be hidden, the rest pass through.
            assert.ok(!result.commands.includes('_internal.command'));
            assert.ok(result.commands.includes('workbench.action.openSettings'));
            assert.ok(result.commands.includes('vscode.diff'));
        });

        test('returns a frozen / sorted snapshot (deterministic for clients)', async () => {
            const deps = makeDeps({
                registered: [
                    ['z.last', () => undefined],
                    ['a.first', () => undefined],
                    ['m.middle', () => undefined],
                ],
                hasActiveEditor: false,
            });
            const handlers = createCommandsHandlers(deps);

            const result = await handlers.list(undefined);

            assert.deepEqual([...result.commands], ['a.first', 'm.middle', 'z.last']);
        });
    });
});
