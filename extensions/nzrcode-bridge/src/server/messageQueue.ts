/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Per-connection outbound message queue with a 5 MB backlog cap.
// Once the underlying transport reports more than MAX_BACKLOG_BYTES bytes
// still pending in its send buffer, the connection is closed with the
// application close code 4002 / reason "client_too_slow" (BridgeErrorCode.ClientTooSlow).
//
// Why this exists: terminal.data and other high-frequency events can flood
// a slow iPad client. Without back-pressure, the extension host's memory
// grows unbounded. cl-5 fixes the cap at 5 MB.

/** Maximum outbound backlog (cl-5). */
export const MAX_BACKLOG_BYTES = 5 * 1024 * 1024;

/** Application-range WebSocket close code (RFC 6455 §7.4.2) for client_too_slow. */
export const WS_CLOSE_CLIENT_TOO_SLOW = 4002;

/** Subset of BridgeConnection the queue needs. Lets tests inject a FakeTransport. */
export interface MessageQueueTransport {
    isOpen(): boolean;
    send(frame: string): void;
    close(code: number, reason: string): void;
    /** Bytes still pending in the transport's send buffer (e.g. ws.bufferedAmount). */
    bufferedAmount(): number;
}

export interface MessageQueueOptions {
    readonly transport: MessageQueueTransport;
    /** Override for the backlog cap. Production callers should rely on the default. */
    readonly maxBacklogBytes?: number;
}

export interface MessageQueue {
    enqueue(frame: string): void;
    backlogBytes(): number;
    /** True once the queue has closed the transport due to backlog overflow. */
    isClosed(): boolean;
}

export function createMessageQueue(options: MessageQueueOptions): MessageQueue {
    const limit = options.maxBacklogBytes ?? MAX_BACKLOG_BYTES;
    const transport = options.transport;
    let closedByQueue = false;

    return {
        enqueue(frame: string): void {
            if (closedByQueue) { return; }
            if (!transport.isOpen()) { return; }

            transport.send(frame);

            if (transport.bufferedAmount() > limit) {
                closedByQueue = true;
                transport.close(WS_CLOSE_CLIENT_TOO_SLOW, 'client_too_slow');
            }
        },
        backlogBytes(): number {
            return transport.bufferedAmount();
        },
        isClosed(): boolean {
            return closedByQueue;
        },
    };
}
