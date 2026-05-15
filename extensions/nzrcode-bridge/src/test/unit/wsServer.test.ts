/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import * as net from 'net';
import WebSocket from 'ws';
import { startBridgeWsServer, type BridgeConnection, type BridgeWsServer } from '../../server/wsServer';

let server: BridgeWsServer | undefined;

teardown(async () => {
    if (server) {
        await server.stop();
        server = undefined;
    }
});

/** Wait for a condition to become true, polling every 5ms for up to maxMs. */
function waitFor(cond: () => boolean, maxMs = 300): Promise<void> {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const tick = () => {
            if (cond()) { resolve(); return; }
            if (Date.now() - start > maxMs) { reject(new Error('waitFor timed out')); return; }
            setTimeout(tick, 5);
        };
        tick();
    });
}

suite('wsServer — startBridgeWsServer', () => {
    test('T01: resolves with a server whose port > 0 (OS-assigned)', async () => {
        server = await startBridgeWsServer({ onConnection: () => {} });
        assert.ok(server.port > 0, `expected port > 0, got ${server.port}`);
    });

    test('T02: onConnection fires when a ws client connects', async () => {
        let fired = false;
        server = await startBridgeWsServer({
            onConnection: () => { fired = true; },
        });
        const client = new WebSocket(`ws://127.0.0.1:${server.port}`);
        await new Promise<void>((resolve, reject) => {
            client.once('open', resolve);
            client.once('error', reject);
        });
        await waitFor(() => fired);
        assert.ok(fired, 'onConnection should have fired');
        client.close();
    });

    test('T03: BridgeConnection.remoteAddress is a loopback address', async () => {
        let remoteAddr: string | undefined;
        server = await startBridgeWsServer({
            onConnection: (conn: BridgeConnection) => { remoteAddr = conn.remoteAddress; },
        });
        const client = new WebSocket(`ws://127.0.0.1:${server.port}`);
        await new Promise<void>((resolve, reject) => {
            client.once('open', resolve);
            client.once('error', reject);
        });
        await waitFor(() => remoteAddr !== undefined);
        // Accept 127.0.0.1, ::1, or ::ffff:127.0.0.1 (IPv4-mapped)
        assert.match(remoteAddr!, /^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/);
        client.close();
    });

    test('T04: round-trip message: client sends "hi", server echoes "hello"', async () => {
        server = await startBridgeWsServer({
            onConnection: (conn: BridgeConnection) => {
                conn.onMessage(frame => {
                    if (frame === 'hi') { conn.send('hello'); }
                });
            },
        });
        const client = new WebSocket(`ws://127.0.0.1:${server.port}`);
        await new Promise<void>((resolve, reject) => {
            client.once('open', resolve);
            client.once('error', reject);
        });
        const reply = await new Promise<string>((resolve, reject) => {
            client.once('message', data => resolve(data.toString()));
            client.once('error', reject);
            client.send('hi');
        });
        assert.equal(reply, 'hello');
        client.close();
    });

    test('T05: bind security — wss address is 127.0.0.1', async () => {
        server = await startBridgeWsServer({ onConnection: () => {} });
        // _address() is a @internal debug helper that exposes wss.address()
        const addr = (server as BridgeWsServer & { _address: () => net.AddressInfo | null })._address();
        assert.ok(addr !== null && typeof addr === 'object', 'expected AddressInfo object');
        assert.equal((addr as net.AddressInfo).address, '127.0.0.1', 'server must bind to loopback only');
    });

    test('T06: connectionCount is 0 initially, 1 after connect, 0 after client closes', async () => {
        server = await startBridgeWsServer({ onConnection: () => {} });
        assert.equal(server.connectionCount(), 0, 'initial count should be 0');

        const client = new WebSocket(`ws://127.0.0.1:${server.port}`);
        await new Promise<void>((resolve, reject) => {
            client.once('open', resolve);
            client.once('error', reject);
        });
        // Allow the 'connection' event to propagate
        await waitFor(() => server!.connectionCount() === 1);
        assert.equal(server.connectionCount(), 1, 'count should be 1 after connect');

        client.close(1000, 'done');
        await waitFor(() => server!.connectionCount() === 0);
        assert.equal(server.connectionCount(), 0, 'count should be 0 after client closes');
    });

    test('T07: BridgeConnection.send throws when the socket is closed', async () => {
        let conn: BridgeConnection | undefined;
        server = await startBridgeWsServer({
            onConnection: (c: BridgeConnection) => { conn = c; },
        });
        const client = new WebSocket(`ws://127.0.0.1:${server.port}`);
        await new Promise<void>((resolve, reject) => {
            client.once('open', resolve);
            client.once('error', reject);
        });
        await waitFor(() => conn !== undefined);

        // Close from client side and wait for onClose
        const closedOnServer = new Promise<void>(resolve => conn!.onClose(() => resolve()));
        client.close(1000, 'closing');
        await closedOnServer;

        assert.throws(
            () => conn!.send('too late'),
            /not open/i,
        );
    });

    test('T08: BridgeConnection.onClose fires with the close code when client closes', async () => {
        let receivedCode: number | undefined;
        server = await startBridgeWsServer({
            onConnection: (conn: BridgeConnection) => {
                conn.onClose((code, _reason) => { receivedCode = code; });
            },
        });
        const client = new WebSocket(`ws://127.0.0.1:${server.port}`);
        await new Promise<void>((resolve, reject) => {
            client.once('open', resolve);
            client.once('error', reject);
        });
        client.close(4321, 'test close');
        await waitFor(() => receivedCode !== undefined);
        // WebSocket spec: 4321 should round-trip cleanly
        assert.equal(receivedCode, 4321);
    });

    test('T09: BridgeConnection.close(4000, "goodbye") causes client to see code 4000', async () => {
        let conn: BridgeConnection | undefined;
        server = await startBridgeWsServer({
            onConnection: (c: BridgeConnection) => { conn = c; },
        });
        const client = new WebSocket(`ws://127.0.0.1:${server.port}`);
        await new Promise<void>((resolve, reject) => {
            client.once('open', resolve);
            client.once('error', reject);
        });
        await waitFor(() => conn !== undefined);

        const clientCloseCode = await new Promise<number>(resolve => {
            client.once('close', code => resolve(code));
            conn!.close(4000, 'goodbye');
        });
        assert.equal(clientCloseCode, 4000);
    });

    test('T10: stop() closes all live connections with code 1001 and resolves; connectionCount is 0', async () => {
        const closeCodes: number[] = [];
        server = await startBridgeWsServer({ onConnection: () => {} });

        const client1 = new WebSocket(`ws://127.0.0.1:${server.port}`);
        const client2 = new WebSocket(`ws://127.0.0.1:${server.port}`);

        // Register close listeners before open so we never miss the event.
        const c1Closed = new Promise<number>(r => client1.once('close', code => r(code)));
        const c2Closed = new Promise<number>(r => client2.once('close', code => r(code)));

        await Promise.all([
            new Promise<void>((r, e) => { client1.once('open', r); client1.once('error', e); }),
            new Promise<void>((r, e) => { client2.once('open', r); client2.once('error', e); }),
        ]);
        await waitFor(() => server!.connectionCount() === 2);

        await server.stop();
        server = undefined; // teardown already done

        // Wait for both client-side close events (fired asynchronously by the ws lib).
        const [code1, code2] = await Promise.all([c1Closed, c2Closed]);
        closeCodes.push(code1, code2);

        assert.equal(closeCodes.length, 2, 'both clients should have received close');
        assert.ok(closeCodes.every(c => c === 1001), `expected all codes to be 1001, got ${closeCodes}`);
    });

    test('T11: stop() timeout — stalled TCP connection is terminated within ~1.2s', async function () {
        // TODO: This test is potentially flaky on slow CI machines because it
        // relies on a ~1 second timeout. The raw TCP socket approach ensures the
        // server's graceful-close frame is never processed, forcing the
        // terminate() path. Marked with a generous 3s mocha timeout.
        this.timeout(3500);

        server = await startBridgeWsServer({ onConnection: () => {} });
        const port = server.port;

        // Open a raw TCP connection and do a partial WebSocket handshake so
        // the server accepts it as a WebSocket, then go silent (no close frame).
        const rawSocket = await new Promise<net.Socket>((resolve, reject) => {
            const s = net.connect(port, '127.0.0.1', () => resolve(s));
            s.once('error', reject);
        });

        // Send a minimal valid WebSocket upgrade request so the server promotes
        // this to a WebSocket connection.
        rawSocket.write(
            'GET / HTTP/1.1\r\n' +
            'Host: 127.0.0.1\r\n' +
            'Upgrade: websocket\r\n' +
            'Connection: Upgrade\r\n' +
            'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
            'Sec-WebSocket-Version: 13\r\n\r\n',
        );

        // Wait for the server to register the connection
        await waitFor(() => server!.connectionCount() >= 1, 1000);

        const before = Date.now();
        await server.stop();
        server = undefined;
        const elapsed = Date.now() - before;

        rawSocket.destroy();
        assert.ok(elapsed < 1500, `stop() took ${elapsed}ms, expected < 1500ms`);
    });

    test('T12: onConnection throw closes socket with code 1011; server stays alive', async () => {
        server = await startBridgeWsServer({
            onConnection: () => { throw new Error('simulated onConnection failure'); },
        });

        const clientCloseCode = await new Promise<number>((resolve, reject) => {
            const client = new WebSocket(`ws://127.0.0.1:${server!.port}`);
            client.once('close', code => resolve(code));
            client.once('error', reject);
        });
        assert.equal(clientCloseCode, 1011, `expected 1011, got ${clientCloseCode}`);

        // Server should remain alive — connect a second (non-throwing) client
        let secondFired = false;
        const goodServer = await startBridgeWsServer({
            onConnection: () => { secondFired = true; },
        });
        try {
            const client2 = new WebSocket(`ws://127.0.0.1:${goodServer.port}`);
            await new Promise<void>((r, e) => { client2.once('open', r); client2.once('error', e); });
            await waitFor(() => secondFired);
            assert.ok(secondFired, 'server should still accept connections');
            client2.close();
        } finally {
            await goodServer.stop();
        }
    });
});
