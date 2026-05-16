/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import {
    TERMINAL_SIGNAL_BYTES,
    createTerminalHandlers,
} from '../../rpc/terminal';
import type { TerminalDeps } from '../../rpc/terminal';
import { BridgeErrorCode } from '../../protocol/errors';
import type { JsonRpcError } from '../../protocol/jsonrpc';
import type { TerminalInfo } from '../../protocol/methods';

function bridgeCodeOf(err: unknown): string | undefined {
    if (!(err instanceof Error)) { return undefined; }
    const data = (err as Error & { bridgeError?: JsonRpcError }).bridgeError?.data as
        | { bridgeCode?: string }
        | undefined;
    return data?.bridgeCode;
}

interface FakeTerminalState {
    readonly sent: Array<{ terminalId: string; text: string }>;
}

function makeDeps(opts: {
    terminals?: readonly TerminalInfo[];
}): { deps: TerminalDeps; state: FakeTerminalState } {
    const state: FakeTerminalState = { sent: [] };
    const deps: TerminalDeps = {
        listTerminals: () => opts.terminals ?? [],
        sendText: async (terminalId, text) => {
            state.sent.push({ terminalId, text });
            return true;
        },
    };
    return { deps, state };
}

suite('rpc/terminal', () => {

    suite('TERMINAL_SIGNAL_BYTES', () => {

        test('SIGINT maps to ASCII 0x03 (Ctrl-C)', () => {
            assert.equal(TERMINAL_SIGNAL_BYTES.SIGINT, '\x03');
        });

        test('SIGTERM maps to ASCII 0x1c (Ctrl-\\)', () => {
            assert.equal(TERMINAL_SIGNAL_BYTES.SIGTERM, '\x1c');
        });
    });

    suite('list', () => {

        test('returns the deps-reported terminals verbatim', async () => {
            const terminals: TerminalInfo[] = [
                { id: 't-1', name: 'bash', cwd: '/home/me' },
                { id: 't-2', name: 'zsh' },
            ];
            const { deps } = makeDeps({ terminals });
            const handlers = createTerminalHandlers(deps);

            const result = await handlers.list(undefined);

            assert.deepEqual(result.terminals, terminals);
        });
    });

    suite('sendText', () => {

        test('forwards the text to the deps', async () => {
            const { deps, state } = makeDeps({});
            const handlers = createTerminalHandlers(deps);

            await handlers.sendText({ terminalId: 't-1', text: 'ls -la\n' });

            assert.deepEqual(state.sent[0], { terminalId: 't-1', text: 'ls -la\n' });
        });

        test('does NOT interpret a literal Ctrl-C byte as a signal (cl-1)', async () => {
            const { deps, state } = makeDeps({});
            const handlers = createTerminalHandlers(deps);

            await handlers.sendText({ terminalId: 't-1', text: '\x03' });

            // Forwarded bit-equal to the deps; signal goes through `signal()`.
            assert.equal(state.sent[0].text, '\x03');
            assert.equal(state.sent.length, 1);
        });
    });

    suite('signal', () => {

        test('SIGINT injects 0x03 via sendText', async () => {
            const { deps, state } = makeDeps({});
            const handlers = createTerminalHandlers(deps);

            await handlers.signal({ terminalId: 't-1', signal: 'SIGINT' });

            assert.deepEqual(state.sent[0], { terminalId: 't-1', text: '\x03' });
        });

        test('SIGTERM injects 0x1c via sendText', async () => {
            const { deps, state } = makeDeps({});
            const handlers = createTerminalHandlers(deps);

            await handlers.signal({ terminalId: 't-1', signal: 'SIGTERM' });

            assert.deepEqual(state.sent[0], { terminalId: 't-1', text: '\x1c' });
        });

        test('unknown signal returns internal_error and never touches the terminal', async () => {
            const { deps, state } = makeDeps({});
            const handlers = createTerminalHandlers(deps);

            try {
                // The signal type forbids this at compile time; runtime callers
                // may still cheat through JSON, so the handler must defend.
                await handlers.signal({
                    terminalId: 't-1',
                    signal: 'SIGKILL' as 'SIGINT',
                });
                assert.fail('expected throw');
            } catch (err) {
                assert.equal(bridgeCodeOf(err), BridgeErrorCode.InternalError);
            }
            assert.equal(state.sent.length, 0, 'no bytes should reach the terminal');
        });
    });
});
