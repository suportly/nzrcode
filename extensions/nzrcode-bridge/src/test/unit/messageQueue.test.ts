/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import {
    createMessageQueue,
    MAX_BACKLOG_BYTES,
    WS_CLOSE_CLIENT_TOO_SLOW,
} from '../../server/messageQueue';
import type { MessageQueueTransport } from '../../server/messageQueue';

// ─── FakeTransport ────────────────────────────────────────────────────────────

class FakeTransport implements MessageQueueTransport {
    public sent: string[] = [];
    public closed: { code: number; reason: string } | undefined;
    public reportedBuffered = 0;

    isOpen(): boolean {
        return this.closed === undefined;
    }

    send(frame: string): void {
        if (this.closed) {
            throw new Error('FakeTransport.send: closed');
        }
        this.sent.push(frame);
        // Simulate the bytes piling up in the socket buffer until the test
        // explicitly drains it via `drain(n)`.
        this.reportedBuffered += Buffer.byteLength(frame, 'utf8');
    }

    close(code: number, reason: string): void {
        if (this.closed) { return; }
        this.closed = { code, reason };
    }

    bufferedAmount(): number {
        return this.reportedBuffered;
    }

    /** Test helper: simulate the OS draining `n` bytes from the socket buffer. */
    drain(n: number): void {
        this.reportedBuffered = Math.max(0, this.reportedBuffered - n);
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

suite('messageQueue', () => {

    test('exports the 5 MB constant verbatim per spec (cl-5)', () => {
        assert.equal(MAX_BACKLOG_BYTES, 5 * 1024 * 1024);
    });

    test('reserves a WS close code in the application range', () => {
        // RFC 6455 §7.4.2 — codes 4000-4999 are application-defined.
        assert.ok(WS_CLOSE_CLIENT_TOO_SLOW >= 4000 && WS_CLOSE_CLIENT_TOO_SLOW <= 4999);
    });

    test('forwards every enqueued frame to the transport while under threshold', () => {
        const transport = new FakeTransport();
        const queue = createMessageQueue({ transport });

        queue.enqueue('frame-1');
        queue.enqueue('frame-2');

        assert.deepEqual(transport.sent, ['frame-1', 'frame-2']);
        assert.equal(transport.closed, undefined);
        assert.equal(queue.isClosed(), false);
    });

    test('closes the transport with client_too_slow once backlog exceeds the limit', () => {
        const transport = new FakeTransport();
        const queue = createMessageQueue({ transport, maxBacklogBytes: 64 });

        // 65 bytes — one frame, transport reports 65 buffered, queue must trip.
        queue.enqueue('A'.repeat(65));

        assert.deepEqual(transport.closed, { code: WS_CLOSE_CLIENT_TOO_SLOW, reason: 'client_too_slow' });
        assert.equal(queue.isClosed(), true);
    });

    test('does not close while backlog stays at or below the limit', () => {
        const transport = new FakeTransport();
        const queue = createMessageQueue({ transport, maxBacklogBytes: 64 });

        queue.enqueue('A'.repeat(64));

        assert.equal(transport.closed, undefined);
        assert.equal(queue.isClosed(), false);
    });

    test('after overflow, further enqueue is a no-op (does not re-send or re-close)', () => {
        const transport = new FakeTransport();
        const queue = createMessageQueue({ transport, maxBacklogBytes: 16 });

        queue.enqueue('A'.repeat(17)); // triggers overflow
        const sendsAfterClose = transport.sent.length;
        const closedSnapshot = { ...transport.closed! };

        queue.enqueue('post-close-frame');

        assert.equal(transport.sent.length, sendsAfterClose, 'no extra sends after overflow close');
        assert.deepEqual(transport.closed, closedSnapshot, 'close was not re-invoked');
    });

    test('enqueue is silent when the transport is already closed externally', () => {
        const transport = new FakeTransport();
        const queue = createMessageQueue({ transport, maxBacklogBytes: 1024 });

        transport.close(1001, 'going away');

        // Must not throw, must not send.
        queue.enqueue('frame-after-external-close');
        assert.equal(transport.sent.length, 0);
    });

    test('terminal.data frames count toward the backlog (cl-5)', () => {
        const transport = new FakeTransport();
        const queue = createMessageQueue({ transport, maxBacklogBytes: 256 });

        const terminalDataFrame = JSON.stringify({
            jsonrpc: '2.0',
            method: 'events.notification',
            params: { event: 'terminal.data', terminalId: 't1', chunkSeq: 0, data: 'A'.repeat(300) },
        });

        queue.enqueue(terminalDataFrame);

        assert.deepEqual(transport.closed, { code: WS_CLOSE_CLIENT_TOO_SLOW, reason: 'client_too_slow' });
    });

    test('reports current backlog from the transport', () => {
        const transport = new FakeTransport();
        const queue = createMessageQueue({ transport });

        queue.enqueue('1234567890'); // 10 bytes
        assert.equal(queue.backlogBytes(), 10);

        transport.drain(7);
        assert.equal(queue.backlogBytes(), 3);
    });

    test('a drained client stays below the limit on the next enqueue', () => {
        const transport = new FakeTransport();
        const queue = createMessageQueue({ transport, maxBacklogBytes: 64 });

        // Fill nearly to the limit, then drain before the next enqueue.
        queue.enqueue('A'.repeat(60));
        transport.drain(60);
        queue.enqueue('B'.repeat(60));

        assert.equal(transport.closed, undefined);
        assert.equal(queue.isClosed(), false);
    });
});
