/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import { Dispatcher } from '../../server/dispatcher';
import type { Logger } from '../../server/dispatcher';
import { generateToken } from '../../server/auth';
import { MethodName } from '../../protocol/methods';
import type { BridgeConnection } from '../../server/wsServer';

// ─── FakeConnection ───────────────────────────────────────────────────────────

class FakeConnection implements BridgeConnection {
    public sent: string[] = [];
    public closed: { code: number; reason: string } | undefined;
    private onMessageHandler?: (frame: string) => void;
    private onCloseHandler?: (code: number, reason: string) => void;

    readonly remoteAddress = '127.0.0.1';

    isOpen() { return this.closed === undefined; }

    send(frame: string) {
        if (this.closed) { throw new Error('closed'); }
        this.sent.push(frame);
    }

    onMessage(h: (f: string) => void) { this.onMessageHandler = h; }

    onClose(h: (c: number, r: string) => void) { this.onCloseHandler = h; }

    close(code: number, reason?: string) {
        if (this.closed) { return; }
        this.closed = { code, reason: reason ?? '' };
        this.onCloseHandler?.(code, reason ?? '');
    }

    /** Test helper: deliver a frame as if received from the client. */
    deliver(frame: string) { this.onMessageHandler?.(frame); }
}

// ─── FakeLogger ───────────────────────────────────────────────────────────────

type LogCall = { level: string; msg: string; fields: unknown };

function makeLogger(): { logger: Logger; calls: LogCall[] } {
    const calls: LogCall[] = [];
    const logger: Logger = {
        info: (msg, fields) => calls.push({ level: 'info', msg, fields }),
        warn: (msg, fields) => calls.push({ level: 'warn', msg, fields }),
        error: (msg, fields) => calls.push({ level: 'error', msg, fields }),
    };
    return { logger, calls };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(id: number, method: string, params?: unknown): string {
    return JSON.stringify({ jsonrpc: '2.0', id, method, ...(params !== undefined ? { params } : {}) });
}

function makeNotification(method: string, params?: unknown): string {
    return JSON.stringify({ jsonrpc: '2.0', method, ...(params !== undefined ? { params } : {}) });
}

function parseSent(conn: FakeConnection, index = 0): Record<string, unknown> {
    return JSON.parse(conn.sent[index]) as Record<string, unknown>;
}

function makeDispatcher(token: string, logger?: Logger): Dispatcher {
    const { logger: defaultLogger } = makeLogger();
    return new Dispatcher({ token, logger: logger ?? defaultLogger });
}

function attachFresh(token: string, logger?: Logger): { dispatcher: Dispatcher; conn: FakeConnection } {
    const dispatcher = makeDispatcher(token, logger);
    const conn = new FakeConnection();
    dispatcher.attach(conn);
    return { dispatcher, conn };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

suite('Dispatcher — authentication gate', () => {

    test('T01: first message is not system.authenticate → conn closed with 4001 and auth_failure error', () => {
        const token = generateToken();
        const { conn } = attachFresh(token);

        conn.deliver(makeRequest(1, MethodName.CommandsExecute, { command: 'workbench.action.files.save' }));

        assert.ok(conn.closed, 'connection should be closed');
        assert.equal(conn.closed?.code, 4001);
        assert.equal(conn.sent.length, 1);
        const response = parseSent(conn);
        assert.ok('error' in response, 'response must be an error');
        const error = response['error'] as Record<string, unknown>;
        assert.equal((error['data'] as Record<string, unknown>)['bridgeCode'], 'auth_failure');
    });

    test('T02: first message is JSON-RPC Notification (no id) system.authenticate → auth failure', () => {
        const token = generateToken();
        const { conn } = attachFresh(token);

        conn.deliver(makeNotification(MethodName.SystemAuthenticate, { token }));

        assert.ok(conn.closed, 'connection should be closed');
        assert.equal(conn.closed?.code, 4001);
        assert.equal(conn.sent.length, 1);
        const response = parseSent(conn);
        assert.ok('error' in response, 'response must be an error');
    });

    test('T03: system.authenticate with WRONG token → conn closed with 4001 and auth_failure', () => {
        const token = generateToken();
        const wrongToken = generateToken();
        const { conn } = attachFresh(token);

        conn.deliver(makeRequest(2, MethodName.SystemAuthenticate, { token: wrongToken }));

        assert.ok(conn.closed, 'connection should be closed');
        assert.equal(conn.closed?.code, 4001);
        assert.equal(conn.sent.length, 1);
        const response = parseSent(conn);
        assert.ok('error' in response, 'response must be an error');
    });

    test('T04: system.authenticate with VALID token → conn stays open; success response sent', () => {
        const token = generateToken();
        const { conn } = attachFresh(token);

        conn.deliver(makeRequest(3, MethodName.SystemAuthenticate, { token }));

        assert.equal(conn.closed, undefined, 'connection should remain open');
        assert.equal(conn.sent.length, 1);
        const response = parseSent(conn);
        assert.ok('result' in response, 'response must be a success');
        assert.deepEqual(response['result'], { ok: true });
    });

    test('T14: auth response carries the matching id from the client request', () => {
        const token = generateToken();
        const { conn } = attachFresh(token);
        const requestId = 99;

        conn.deliver(makeRequest(requestId, MethodName.SystemAuthenticate, { token }));

        const response = parseSent(conn);
        assert.equal(response['id'], requestId, 'response id must match request id');
    });
});

suite('Dispatcher — authenticated routing', () => {

    function authAndGet(token: string, logger?: Logger): { dispatcher: Dispatcher; conn: FakeConnection } {
        const { dispatcher, conn } = attachFresh(token, logger);
        conn.deliver(makeRequest(1, MethodName.SystemAuthenticate, { token }));
        conn.sent = []; // clear the auth response
        return { dispatcher, conn };
    }

    test('T05: unknown method returns command_not_found error', () => {
        const token = generateToken();
        const { conn } = authAndGet(token);

        conn.deliver(makeRequest(10, MethodName.CommandsExecute, { command: 'test' }));

        assert.equal(conn.sent.length, 1);
        const response = parseSent(conn);
        assert.ok('error' in response, 'response must be an error');
        const error = response['error'] as Record<string, unknown>;
        assert.equal((error['data'] as Record<string, unknown>)['bridgeCode'], 'command_not_found');
    });

    test('T06: registered method returns handler result; id round-trips', async () => {
        const token = generateToken();
        const { dispatcher, conn } = authAndGet(token);

        dispatcher.register(MethodName.CommandsList, async () => ({ commands: ['a', 'b'] }));

        conn.deliver(makeRequest(42, MethodName.CommandsList));

        // allow microtasks to flush
        await new Promise(resolve => setTimeout(resolve, 0));

        assert.equal(conn.sent.length, 1);
        const response = parseSent(conn);
        assert.equal(response['id'], 42, 'id must round-trip');
        assert.ok('result' in response, 'response must be a success');
        assert.deepEqual(response['result'], { commands: ['a', 'b'] });
    });

    test('T07: handler throws plain Error → responds with internal_error', async () => {
        const token = generateToken();
        const { dispatcher, conn } = authAndGet(token);

        dispatcher.register(MethodName.CommandsList, async () => {
            throw new Error('boom');
        });

        conn.deliver(makeRequest(5, MethodName.CommandsList));
        await new Promise(resolve => setTimeout(resolve, 0));

        assert.equal(conn.sent.length, 1);
        const response = parseSent(conn);
        assert.ok('error' in response, 'response must be an error');
        const error = response['error'] as Record<string, unknown>;
        assert.equal((error['data'] as Record<string, unknown>)['bridgeCode'], 'internal_error');
    });

    test('T08: handler throws JsonRpcError-shaped object → forwards that exact error', async () => {
        const token = generateToken();
        const { dispatcher, conn } = authAndGet(token);
        const customError = { code: -32099, message: 'custom bridge error', data: { detail: 'from handler' } };

        dispatcher.register(MethodName.CommandsList, async () => {
            throw customError;
        });

        conn.deliver(makeRequest(6, MethodName.CommandsList));
        await new Promise(resolve => setTimeout(resolve, 0));

        assert.equal(conn.sent.length, 1);
        const response = parseSent(conn);
        assert.ok('error' in response, 'response must be an error');
        const error = response['error'] as Record<string, unknown>;
        assert.equal(error['code'], customError.code);
        assert.equal(error['message'], customError.message);
    });

    test('T09: malformed JSON after auth → internal_error with id null; conn stays open', async () => {
        const token = generateToken();
        const { conn } = authAndGet(token);

        conn.deliver('{this is not valid json}');
        await new Promise(resolve => setTimeout(resolve, 0));

        assert.equal(conn.closed, undefined, 'connection must stay open');
        assert.equal(conn.sent.length, 1);
        const response = parseSent(conn);
        assert.ok('error' in response, 'response must be an error');
        assert.equal(response['id'], null, 'id must be null for parse errors');
    });

    test('T13: notifications from authenticated client are silently dropped (no response)', async () => {
        const token = generateToken();
        const { dispatcher, conn } = authAndGet(token);

        dispatcher.register(MethodName.CommandsList, async () => ({ commands: [] }));

        conn.deliver(makeNotification(MethodName.CommandsList));
        await new Promise(resolve => setTimeout(resolve, 0));

        assert.equal(conn.sent.length, 0, 'no response should be sent for notifications');
    });
});

suite('Dispatcher — token redaction in logs', () => {

    test('T10: token value never appears verbatim in any log call', () => {
        const token = generateToken();
        const { logger, calls } = makeLogger();
        const { conn } = attachFresh(token, logger);

        conn.deliver(makeRequest(1, MethodName.SystemAuthenticate, { token }));

        const serialized = JSON.stringify(calls);
        assert.equal(
            serialized.includes(token),
            false,
            `Token "${token.slice(0, 8)}…" must not appear verbatim in logs`,
        );
    });

    test('T10b: wrong token value never appears verbatim in any log call', () => {
        const token = generateToken();
        const wrongToken = generateToken();
        const { logger, calls } = makeLogger();
        const { conn } = attachFresh(token, logger);

        conn.deliver(makeRequest(1, MethodName.SystemAuthenticate, { token: wrongToken }));

        const serialized = JSON.stringify(calls);
        assert.equal(
            serialized.includes(wrongToken),
            false,
            'Wrong token must not appear verbatim in logs',
        );
    });
});

suite('Dispatcher — registry', () => {

    test('T11: register same method twice throws', () => {
        const dispatcher = makeDispatcher(generateToken());

        dispatcher.register(MethodName.CommandsList, async () => ({ commands: [] }));

        assert.throws(
            () => dispatcher.register(MethodName.CommandsList, async () => ({ commands: [] })),
            /already registered/,
        );
    });

    test('T12: registeredMethods lists every registered method; system.authenticate is NOT listed', () => {
        const dispatcher = makeDispatcher(generateToken());

        dispatcher.register(MethodName.CommandsList, async () => ({ commands: [] }));
        dispatcher.register(MethodName.WorkspaceListFolders, async () => ({ folders: [] }));

        const methods = dispatcher.registeredMethods();
        assert.ok(methods.includes(MethodName.CommandsList), 'commands.list must be listed');
        assert.ok(methods.includes(MethodName.WorkspaceListFolders), 'workspace.listFolders must be listed');
        assert.equal(methods.length, 2, 'only 2 registered methods');
        assert.ok(!methods.includes(MethodName.SystemAuthenticate), 'system.authenticate must NOT be in the list');
    });
});
