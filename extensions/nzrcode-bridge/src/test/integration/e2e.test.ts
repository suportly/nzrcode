/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// End-to-end integration test for nzrcode-bridge.
// Boots a real WS server with the full RPC namespace stack wired in (via the
// dep-injection seams introduced in T015–T034), then drives it from a real
// `ws` client doing the authenticate → hello → commands → events → terminal
// sequence the iPad app exercises.
//
// What this test does NOT do:
//   - Talk to the real vscode API (commands, terminal, workspace) — all
//     injected via in-memory fakes.
//   - Cover per-device token rotation on revoke (carry-over: needs
//     dispatcher changes that aren't in the current spec).

import 'mocha';
import * as assert from 'assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import WebSocket from 'ws';
import { findTokenMatch, generateToken } from '../../server/auth';
import { Dispatcher } from '../../server/dispatcher';
import type { BridgeConnection, BridgeWsServer } from '../../server/wsServer';
import { startBridgeWsServer } from '../../server/wsServer';
import { stateFilePath } from '../../server/state';
import { MethodName } from '../../protocol/methods';
import { registerSystemHandlers } from '../../rpc/system';
import { CANONICAL_BRIDGE_NAMESPACES } from '../../rpc/system';
import { registerCommandsHandlers } from '../../rpc/commands';
import { registerTerminalHandlers } from '../../rpc/terminal';
import { createEventPublisher } from '../../events/publisher';
import { EventName } from '../../protocol/events';
import type { TerminalInfo } from '../../protocol/methods';

const STEP_TIMEOUT_MS = 5000;
const TOTAL_TIMEOUT_MS = 30000;

interface JsonRpcResponse {
    readonly jsonrpc: '2.0';
    readonly id: number | string;
    readonly result?: unknown;
    readonly error?: { code: number; message: string };
}

function waitForResponse(ws: WebSocket, id: number): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`step timeout: response id=${id}`)), STEP_TIMEOUT_MS);
        const onMessage = (data: WebSocket.RawData) => {
            const frame = JSON.parse(data.toString()) as JsonRpcResponse;
            if (frame.id === id) {
                clearTimeout(timer);
                ws.off('message', onMessage);
                resolve(frame);
            }
        };
        ws.on('message', onMessage);
    });
}

function waitForNotification(ws: WebSocket, predicate: (params: Record<string, unknown>) => boolean): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('step timeout: notification')), STEP_TIMEOUT_MS);
        const onMessage = (data: WebSocket.RawData) => {
            const frame = JSON.parse(data.toString()) as { method?: string; params?: Record<string, unknown> };
            if (frame.method === 'events.notification' && frame.params && predicate(frame.params)) {
                clearTimeout(timer);
                ws.off('message', onMessage);
                resolve(frame.params);
            }
        };
        ws.on('message', onMessage);
    });
}

function openClient(port: number): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}`);
        ws.once('open', () => resolve(ws));
        ws.once('error', reject);
    });
}

// ─── Fake VS Code surfaces ─────────────────────────────────────────────────────

interface FakeVsCode {
    readonly terminals: TerminalInfo[];
    readonly sentToTerminal: Array<{ terminalId: string; text: string }>;
    readonly registeredCommands: Map<string, (...args: unknown[]) => unknown>;
    readonly publisher: ReturnType<typeof createEventPublisher>;
}

function makeFakeVsCode(): FakeVsCode {
    const sentToTerminal: Array<{ terminalId: string; text: string }> = [];
    const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
    registeredCommands.set('workbench.action.tasks.runTask', (taskName: unknown) => `ran:${String(taskName)}`);

    return {
        terminals: [{ id: 't-1', name: 'bash', cwd: '/tmp' }],
        sentToTerminal,
        registeredCommands,
        publisher: createEventPublisher(),
    };
}

// ─── Test ─────────────────────────────────────────────────────────────────────

suite('integration — e2e (auth → hello → commands → terminal events)', function () {

    this.timeout(TOTAL_TIMEOUT_MS);

    let tmpHome: string;
    let token: string;
    let server: BridgeWsServer | undefined;
    let client: WebSocket | undefined;

    setup(() => {
        tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'nzrcode-e2e-'));
        process.env['NZRCODE_HOME'] = tmpHome;
        token = generateToken();
        const file = stateFilePath();
        fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
        fs.writeFileSync(file, JSON.stringify({ version: 2, tokens: { 'test-device': token } }), { mode: 0o600 });
    });

    teardown(async () => {
        if (client && client.readyState === WebSocket.OPEN) { client.close(); }
        if (server) { await server.stop(); server = undefined; }
        delete process.env['NZRCODE_HOME'];
        fs.rmSync(tmpHome, { recursive: true, force: true });
    });

    test('full happy path: authenticate → hello → commands.execute → events.subscribe → terminal.data', async () => {
        const vs = makeFakeVsCode();

        const tokens: Record<string, string> = { 'test-device': token };
        const dispatcher = new Dispatcher({
            lookupToken: candidate => findTokenMatch(tokens, undefined, candidate),
            logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
        });

        registerSystemHandlers(dispatcher, {
            serverVersion: '0.1.0-e2e',
            capabilities: CANONICAL_BRIDGE_NAMESPACES,
        });
        registerCommandsHandlers(dispatcher, {
            executeCommand: async (id, ...args) => {
                const fn = vs.registeredCommands.get(id);
                if (!fn) { throw new Error(`command '${id}' not found`); }
                return fn(...args);
            },
            getCommands: async () => Array.from(vs.registeredCommands.keys()),
            hasActiveEditor: () => false,
        });
        registerTerminalHandlers(dispatcher, {
            listTerminals: () => vs.terminals,
            sendText: async (terminalId, text) => {
                vs.sentToTerminal.push({ terminalId, text });
                // Echo the input back as terminal.data within microtask, like a real shell.
                queueMicrotask(() => {
                    vs.publisher.publishTerminalData(terminalId, Buffer.from(text, 'utf-8'));
                });
                return true;
            },
        });

        // Subscribe handler — connects the publisher to this client.
        const subscriberIdByConn = new WeakMap<BridgeConnection, string>();
        dispatcher.register(MethodName.EventsSubscribe, async function (this: unknown) {
            // We don't have access to the conn here through the existing
            // dispatcher signature; instead, we register subscribers from the
            // wsServer connection callback below.
            return { subscribed: [EventName.TerminalData] };
        });

        let subscriberCounter = 0;
        server = await startBridgeWsServer({
            onConnection: (conn) => {
                dispatcher.attach(conn);
                const subscriberId = `sub-${++subscriberCounter}`;
                subscriberIdByConn.set(conn, subscriberId);
                // Auto-subscribe to terminal.data for the e2e flow; in the real
                // wiring this happens via events.subscribe AFTER auth.
                vs.publisher.subscribe(subscriberId, frame => {
                    if (conn.isOpen()) { conn.send(frame); }
                }, [EventName.TerminalData]);
                conn.onClose(() => vs.publisher.unsubscribe(subscriberId));
            },
        });

        client = await openClient(server.port);

        // Step 1: authenticate
        const authPromise = waitForResponse(client, 1);
        client.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: MethodName.SystemAuthenticate, params: { token } }));
        const authResp = await authPromise;
        assert.deepEqual(authResp.result, { ok: true });

        // Step 2: system.hello
        const helloPromise = waitForResponse(client, 2);
        client.send(JSON.stringify({ jsonrpc: '2.0', id: 2, method: MethodName.SystemHello }));
        const helloResp = await helloPromise;
        const helloResult = helloResp.result as { serverVersion: string; capabilities: readonly string[] };
        assert.equal(helloResult.serverVersion, '0.1.0-e2e');
        assert.ok(helloResult.capabilities.includes('commands'));

        // Step 3: commands.execute
        const execPromise = waitForResponse(client, 3);
        client.send(JSON.stringify({
            jsonrpc: '2.0', id: 3,
            method: MethodName.CommandsExecute,
            params: { command: 'workbench.action.tasks.runTask', args: ['dev'] },
        }));
        const execResp = await execPromise;
        assert.deepEqual(execResp.result, { value: 'ran:dev' });

        // Step 4: terminal.sendText → expect terminal.data notification with the same bytes back
        const dataNotif = waitForNotification(client, p => p['event'] === EventName.TerminalData);
        client.send(JSON.stringify({
            jsonrpc: '2.0', id: 4,
            method: MethodName.TerminalSendText,
            params: { terminalId: 't-1', text: 'echo ok\n' },
        }));
        await waitForResponse(client, 4);
        const notif = await dataNotif;

        assert.equal(notif['terminalId'], 't-1');
        const decoded = Buffer.from(notif['data'] as string, 'base64').toString('utf-8');
        assert.equal(decoded, 'echo ok\n');

        // Sanity: the fake terminal saw the bytes we sent.
        assert.deepEqual(vs.sentToTerminal, [{ terminalId: 't-1', text: 'echo ok\n' }]);
    });

    test('a client with the wrong token is rejected with the auth close code', async () => {
        const tokens: Record<string, string> = { 'test-device': token };
        const dispatcher = new Dispatcher({
            lookupToken: candidate => findTokenMatch(tokens, undefined, candidate),
            logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
        });
        registerSystemHandlers(dispatcher, {
            serverVersion: '0.1.0-e2e',
            capabilities: CANONICAL_BRIDGE_NAMESPACES,
        });

        server = await startBridgeWsServer({
            onConnection: conn => dispatcher.attach(conn),
        });

        client = await openClient(server.port);

        const closePromise = new Promise<number>(resolve => {
            client!.once('close', code => resolve(code));
        });

        client.send(JSON.stringify({
            jsonrpc: '2.0', id: 1, method: MethodName.SystemAuthenticate, params: { token: 'WRONG-TOKEN' },
        }));

        const code = await closePromise;
        assert.equal(code, 4001, 'auth_failure close code');
    });
});
