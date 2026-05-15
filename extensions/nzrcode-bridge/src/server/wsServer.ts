/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Loopback-only WebSocket server for the nzrcode bridge.
// See Story 5 cenário 1 — the OS must refuse any bind attempt to a non-loopback
// interface from an external attacker; we guarantee that by never binding anything
// other than 127.0.0.1.

import { IncomingMessage } from 'http';
import { AddressInfo } from 'net';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';

/**
 * Options for the bridge WebSocket server. The host is hardcoded to
 * '127.0.0.1' and is NOT exposed as an option — binding any other
 * interface is a security regression (Story 5 cenário 1 / Article VI).
 */
export interface BridgeWsServerOptions {
    /** Preferred port; 0 means OS-assigned. Default 0. */
    readonly port?: number;
    /**
     * Called once per established TCP connection (BEFORE auth).
     * The handler owns this socket's lifecycle from this point.
     * Throwing here will close the socket with code 1011.
     */
    readonly onConnection: (conn: BridgeConnection) => void;
}

/** A live client connection. Wrapper around `ws.WebSocket` with stricter typing. */
export interface BridgeConnection {
    /** Returns true if the socket is OPEN. */
    readonly isOpen: () => boolean;
    /** Remote address of the connecting client (e.g. '127.0.0.1'). */
    readonly remoteAddress: string;
    /** Send a JSON string frame. Throws if the socket is not open. */
    readonly send: (frame: string) => void;
    /** Register a handler for incoming text frames. */
    readonly onMessage: (handler: (frame: string) => void) => void;
    /** Register a handler called once when the socket closes. */
    readonly onClose: (handler: (code: number, reason: string) => void) => void;
    /** Close with a WebSocket close code and reason text. */
    readonly close: (code: number, reason?: string) => void;
}

export interface BridgeWsServer {
    /** The port the server is bound to. Available only after start() resolves. */
    readonly port: number;
    /** Stop accepting new connections, close existing ones, return when done. */
    readonly stop: () => Promise<void>;
    /** Active connection count. */
    readonly connectionCount: () => number;
    /**
     * @internal — debug helper for tests. Returns the raw `wss.address()` so
     * tests can assert the bind address is 127.0.0.1 (Story 5 cenário 1).
     * @experimental Acceptable for test-layer introspection only.
     */
    readonly _address: () => AddressInfo | string | null;
}

/**
 * Build a BridgeConnection wrapper around a raw ws.WebSocket + HTTP request.
 * Extracted to keep startBridgeWsServer under the 40-line limit.
 */
function wrapConnection(ws: WebSocket, req: IncomingMessage): BridgeConnection {
    const remoteAddress =
        (req.socket as { remoteAddress?: string }).remoteAddress ?? '127.0.0.1';

    return {
        isOpen: () => ws.readyState === (ws as WebSocket & { OPEN: number }).OPEN,
        remoteAddress,
        send: (frame: string) => {
            if (ws.readyState !== (ws as WebSocket & { OPEN: number }).OPEN) {
                throw new Error('BridgeConnection.send: socket is not open');
            }
            ws.send(frame);
        },
        onMessage: (handler: (frame: string) => void) => {
            ws.on('message', (data: Buffer | string) => handler(data.toString()));
        },
        onClose: (handler: (code: number, reason: string) => void) => {
            ws.once('close', (code: number, reason: Buffer) =>
                handler(code, reason.toString()),
            );
        },
        close: (code: number, reason?: string) => {
            if (ws.readyState === (ws as WebSocket & { OPEN: number }).OPEN) {
                ws.close(code, reason);
            }
        },
    };
}

/** Graceful stop: send close frames, wait up to 1 s, then terminate stragglers. */
function gracefulStop(
    wss: InstanceType<typeof WebSocketServer>,
    connections: Set<{ conn: BridgeConnection; ws: WebSocket }>,
): Promise<void> {
    return new Promise(resolve => {
        // Close every open connection with 1001 "going away".
        for (const { conn, ws } of connections) {
            conn.close(1001, 'server shutting down');
            // Belt-and-suspenders: terminate after 1 s even if close frame is ignored.
            const handle = setTimeout(() => ws.terminate(), 1000);
            ws.once('close', () => clearTimeout(handle));
        }

        // Stop the server from accepting new connections.
        wss.close(() => resolve());

        // If all connections are already gone, wss.close callback fires only after
        // all clients have disconnected; the terminate timers above ensure that
        // happens within 1 s.
    });
}

/**
 * Start the loopback-only WebSocket server. Returns a started server
 * (port available, listening) or rejects with the underlying network
 * error. Caller is responsible for calling `stop()` when done.
 */
export function startBridgeWsServer(options: BridgeWsServerOptions): Promise<BridgeWsServer> {
    return new Promise((resolve, reject) => {
        const wss = new WebSocketServer({
            // security: loopback-only — see Story 5 cenário 1 / Article VI
            host: '127.0.0.1',
            port: options.port ?? 0,
        });

        const connections = new Set<{ conn: BridgeConnection; ws: WebSocket }>();

        wss.once('error', reject);

        wss.once('listening', () => {
            // Remove the pre-listen error handler so post-listen errors don't reject
            // an already-resolved promise.
            wss.off('error', reject);

            const addr = wss.address() as AddressInfo;

            wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
                const conn = wrapConnection(ws, req);
                const entry = { conn, ws };
                connections.add(entry);

                ws.once('close', () => connections.delete(entry));

                try {
                    options.onConnection(conn);
                } catch {
                    ws.close(1011, 'onConnection threw');
                }
            });

            resolve({
                port: addr.port,
                stop: () => gracefulStop(wss, connections),
                connectionCount: () => connections.size,
                _address: () => wss.address(),
            });
        });
    });
}
