/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Integration smoke for Story 1 cenário 2: a paired client connects, authenticates,
// calls system.hello, and receives a typed response. The test wires the real
// modules together (state + wsServer + dispatcher + messageQueue + system handler)
// without going through the vscode.ExtensionContext lifecycle.

import 'mocha';
import * as assert from 'assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import WebSocket from 'ws';
import { maybeStartBridge, BridgeRuntime } from '../../bridge';
import { generateToken } from '../../server/auth';
import { stateFilePath } from '../../server/state';
import { MethodName } from '../../protocol/methods';
import type { Logger } from '../../server/dispatcher';

const HANDSHAKE_TIMEOUT_MS = 5000;

function silentLogger(): Logger {
    return { info: () => undefined, warn: () => undefined, error: () => undefined };
}

function writeStateFile(token: string): void {
    const filePath = stateFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(filePath, JSON.stringify({ version: 1, token }), { mode: 0o600 });
}

interface JsonRpcAnyResponse {
    readonly jsonrpc: '2.0';
    readonly id: number | string;
    readonly result?: unknown;
    readonly error?: { readonly code: number; readonly message: string };
}

function waitForResponse(ws: WebSocket, id: number): Promise<JsonRpcAnyResponse> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`response timeout for id=${id}`)), HANDSHAKE_TIMEOUT_MS);
        const onMessage = (data: WebSocket.RawData) => {
            const frame = JSON.parse(data.toString()) as JsonRpcAnyResponse;
            if (frame.id === id) {
                clearTimeout(timeout);
                ws.off('message', onMessage);
                resolve(frame);
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

suite('integration — handshake round-trip', () => {

    let tmpHome: string;
    let runtime: BridgeRuntime | undefined;
    let client: WebSocket | undefined;

    setup(() => {
        tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'nzrcode-handshake-'));
        process.env['NZRCODE_HOME'] = tmpHome;
    });

    teardown(async () => {
        if (client && client.readyState === WebSocket.OPEN) {
            client.close();
        }
        if (runtime) {
            await runtime.stop();
            runtime = undefined;
        }
        delete process.env['NZRCODE_HOME'];
        fs.rmSync(tmpHome, { recursive: true, force: true });
    });

    test('authenticates and answers system.hello within 5s', async () => {
        const token = generateToken();
        writeStateFile(token);

        runtime = await maybeStartBridge({ serverVersion: '0.1.0-test', logger: silentLogger() });
        assert.ok(runtime, 'bridge should start with state file present');

        client = await openClient(runtime.server.port);

        const authPromise = waitForResponse(client, 1);
        client.send(JSON.stringify({
            jsonrpc: '2.0', id: 1, method: MethodName.SystemAuthenticate, params: { token },
        }));
        const authResponse = await authPromise;
        assert.deepEqual(authResponse.result, { ok: true }, 'auth ok');

        const helloPromise = waitForResponse(client, 2);
        client.send(JSON.stringify({
            jsonrpc: '2.0', id: 2, method: MethodName.SystemHello,
        }));
        const helloResponse = await helloPromise;

        assert.ok(helloResponse.result, 'no error in hello response');
        const result = helloResponse.result as {
            serverVersion: string;
            capabilities: readonly string[];
            hostname: string;
            platform: string;
        };
        assert.equal(result.serverVersion, '0.1.0-test');
        assert.ok(result.capabilities.includes('commands'));
        assert.ok(result.capabilities.includes('notifications'));
        assert.equal(typeof result.hostname, 'string');
        assert.equal(typeof result.platform, 'string');
    });

    test('rejects a client that skips authentication', async () => {
        const token = generateToken();
        writeStateFile(token);

        runtime = await maybeStartBridge({ serverVersion: '0.1.0-test', logger: silentLogger() });
        assert.ok(runtime);

        client = await openClient(runtime.server.port);

        const closePromise = new Promise<{ code: number; reason: string }>(resolve => {
            client!.once('close', (code, reasonBuf) => resolve({ code, reason: reasonBuf.toString() }));
        });

        // First message is system.hello, not system.authenticate → server must close.
        client.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: MethodName.SystemHello }));

        const closeEvent = await closePromise;
        assert.equal(closeEvent.code, 4001, 'auth_failure close code');
    });
});
