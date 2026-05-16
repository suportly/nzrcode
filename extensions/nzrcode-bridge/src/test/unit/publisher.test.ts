/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import {
    MAX_EVENT_CHUNK_BYTES,
    createEventPublisher,
} from '../../events/publisher';
import { EventName } from '../../protocol/events';

interface CapturedFrame {
    readonly raw: string;
    readonly parsed: {
        readonly jsonrpc: '2.0';
        readonly method: 'events.notification';
        readonly params: {
            readonly event: string;
            readonly [k: string]: unknown;
        };
    };
}

function captureFrames(): { send: (raw: string) => void; frames: CapturedFrame[] } {
    const frames: CapturedFrame[] = [];
    const send = (raw: string) => {
        frames.push({ raw, parsed: JSON.parse(raw) as CapturedFrame['parsed'] });
    };
    return { send, frames };
}

function decodeData(frame: CapturedFrame): Buffer {
    return Buffer.from(frame.parsed.params['data'] as string, 'base64');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

suite('events/publisher', () => {

    test('MAX_EVENT_CHUNK_BYTES is exactly 64 KiB (cl-5)', () => {
        assert.equal(MAX_EVENT_CHUNK_BYTES, 64 * 1024);
    });

    suite('subscribe + publish', () => {

        test('a subscriber matching the event name receives a single notification', () => {
            const publisher = createEventPublisher();
            const a = captureFrames();
            publisher.subscribe('sub-a', a.send, [EventName.EditorChanged]);

            publisher.publish(EventName.EditorChanged, { editorId: 'editor-1', path: '/foo.ts' });

            assert.equal(a.frames.length, 1);
            assert.equal(a.frames[0].parsed.method, 'events.notification');
            assert.equal(a.frames[0].parsed.params.event, EventName.EditorChanged);
        });

        test('a subscriber with no matching pattern receives nothing', () => {
            const publisher = createEventPublisher();
            const a = captureFrames();
            publisher.subscribe('sub-a', a.send, [EventName.EditorChanged]);

            publisher.publish(EventName.TerminalClosed, { terminalId: 't-1' });

            assert.equal(a.frames.length, 0);
        });

        test('a wildcard "*" pattern matches every event', () => {
            const publisher = createEventPublisher();
            const a = captureFrames();
            publisher.subscribe('sub-a', a.send, ['*']);

            publisher.publish(EventName.EditorChanged, { editorId: 'e', path: '/p' });
            publisher.publish(EventName.TerminalClosed, { terminalId: 't' });

            assert.equal(a.frames.length, 2);
        });

        test('a namespace wildcard like "terminal.*" matches every event in that namespace', () => {
            const publisher = createEventPublisher();
            const a = captureFrames();
            publisher.subscribe('sub-a', a.send, ['terminal.*']);

            publisher.publish(EventName.TerminalClosed, { terminalId: 't' });
            publisher.publish(EventName.EditorChanged, { editorId: 'e', path: '/p' });

            assert.equal(a.frames.length, 1);
            assert.equal(a.frames[0].parsed.params.event, EventName.TerminalClosed);
        });

        test('multiple subscribers each receive their own copy', () => {
            const publisher = createEventPublisher();
            const a = captureFrames();
            const b = captureFrames();
            publisher.subscribe('sub-a', a.send, [EventName.EditorChanged]);
            publisher.subscribe('sub-b', b.send, [EventName.EditorChanged]);

            publisher.publish(EventName.EditorChanged, { editorId: 'e', path: '/p' });

            assert.equal(a.frames.length, 1);
            assert.equal(b.frames.length, 1);
        });

        test('a thrown send callback does NOT prevent delivery to other subscribers', () => {
            const publisher = createEventPublisher();
            const dead = () => { throw new Error('socket closed'); };
            const alive = captureFrames();

            publisher.subscribe('sub-dead', dead, ['*']);
            publisher.subscribe('sub-alive', alive.send, ['*']);

            publisher.publish(EventName.EditorChanged, { editorId: 'e', path: '/p' });

            assert.equal(alive.frames.length, 1);
        });
    });

    suite('unsubscribe', () => {

        test('removes all patterns for a subscriber when called with no patterns arg', () => {
            const publisher = createEventPublisher();
            const a = captureFrames();
            publisher.subscribe('sub-a', a.send, [EventName.EditorChanged, EventName.TerminalClosed]);

            publisher.unsubscribe('sub-a');

            publisher.publish(EventName.EditorChanged, { editorId: 'e', path: '/p' });
            publisher.publish(EventName.TerminalClosed, { terminalId: 't' });

            assert.equal(a.frames.length, 0);
        });

        test('removes only the specified patterns when patterns are provided', () => {
            const publisher = createEventPublisher();
            const a = captureFrames();
            publisher.subscribe('sub-a', a.send, [EventName.EditorChanged, EventName.TerminalClosed]);

            publisher.unsubscribe('sub-a', [EventName.EditorChanged]);

            publisher.publish(EventName.EditorChanged, { editorId: 'e', path: '/p' });
            publisher.publish(EventName.TerminalClosed, { terminalId: 't' });

            assert.equal(a.frames.length, 1);
            assert.equal(a.frames[0].parsed.params.event, EventName.TerminalClosed);
        });
    });

    suite('publishTerminalData (chunking)', () => {

        test('emits a single chunk when the payload fits within the limit', () => {
            const publisher = createEventPublisher();
            const a = captureFrames();
            publisher.subscribe('sub-a', a.send, [EventName.TerminalData]);

            const payload = Buffer.from('hello, world!\n', 'utf-8');
            publisher.publishTerminalData('t-1', payload);

            assert.equal(a.frames.length, 1);
            const decoded = decodeData(a.frames[0]);
            assert.deepEqual(decoded, payload);
            assert.equal(a.frames[0].parsed.params['chunkSeq'], 0);
            assert.equal(a.frames[0].parsed.params['terminalId'], 't-1');
        });

        test('splits ~100 KiB output into multiple 64 KiB chunks with sequential chunkSeq', () => {
            const publisher = createEventPublisher();
            const a = captureFrames();
            publisher.subscribe('sub-a', a.send, [EventName.TerminalData]);

            const payload = Buffer.alloc(100 * 1024, 0x41);
            publisher.publishTerminalData('t-1', payload);

            assert.ok(a.frames.length >= 2, `expected ≥ 2 chunks, got ${a.frames.length}`);

            const seqs = a.frames.map(f => f.parsed.params['chunkSeq'] as number);
            assert.deepEqual(seqs, seqs.slice().sort((x, y) => x - y), 'chunkSeq is monotonically non-decreasing');
            assert.deepEqual(seqs, Array.from({ length: seqs.length }, (_, i) => i), 'chunkSeq is 0..n contiguous');

            // Concatenated chunks decode bit-equal to the original input.
            const concat = Buffer.concat(a.frames.map(decodeData));
            assert.equal(concat.length, payload.length);
            assert.ok(concat.equals(payload), 'reassembled bytes match the original');
        });

        test('ANSI escape sequences arrive intact across the boundary (cl-8 raw)', () => {
            const publisher = createEventPublisher();
            const a = captureFrames();
            publisher.subscribe('sub-a', a.send, [EventName.TerminalData]);

            const ansi = Buffer.from('\x1b[31mRED\x1b[0m', 'utf-8');
            publisher.publishTerminalData('t-1', ansi);

            assert.equal(a.frames.length, 1);
            const decoded = decodeData(a.frames[0]);
            assert.ok(decoded.equals(ansi), 'ANSI bytes round-trip unchanged');
        });

        test('chunkSeq counter is per-terminal and monotonic across calls', () => {
            const publisher = createEventPublisher();
            const a = captureFrames();
            publisher.subscribe('sub-a', a.send, [EventName.TerminalData]);

            publisher.publishTerminalData('t-1', Buffer.from('first', 'utf-8'));
            publisher.publishTerminalData('t-1', Buffer.from('second', 'utf-8'));
            publisher.publishTerminalData('t-2', Buffer.from('other', 'utf-8'));

            const t1 = a.frames.filter(f => f.parsed.params['terminalId'] === 't-1');
            const t2 = a.frames.filter(f => f.parsed.params['terminalId'] === 't-2');

            assert.deepEqual(t1.map(f => f.parsed.params['chunkSeq']), [0, 1]);
            assert.deepEqual(t2.map(f => f.parsed.params['chunkSeq']), [0]);
        });

        test('terminal.data subscribers do NOT receive other event types', () => {
            const publisher = createEventPublisher();
            const a = captureFrames();
            publisher.subscribe('sub-a', a.send, [EventName.TerminalData]);

            publisher.publish(EventName.EditorChanged, { editorId: 'e', path: '/p' });

            assert.equal(a.frames.length, 0);
        });

        test('publishTerminalData with an empty buffer emits no chunks', () => {
            const publisher = createEventPublisher();
            const a = captureFrames();
            publisher.subscribe('sub-a', a.send, [EventName.TerminalData]);

            publisher.publishTerminalData('t-1', Buffer.alloc(0));

            assert.equal(a.frames.length, 0);
        });
    });
});
