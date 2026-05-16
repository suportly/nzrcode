/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Event publisher with pattern-based subscriptions and per-terminal
// chunked streaming for `terminal.data` (cl-5 / cl-8).
//
// On the wire each event is a JSON-RPC notification with the well-known
// method `events.notification` and a typed `params` object whose `event`
// field carries the EventName. Terminal output larger than 64 KiB is split
// across multiple notifications carrying sequential chunkSeq values so the
// client can reassemble the stream losslessly.

import { EventName } from '../protocol/events';
import type { EventPayload } from '../protocol/events';

/** Maximum bytes of raw terminal output per `terminal.data` chunk (cl-5). */
export const MAX_EVENT_CHUNK_BYTES = 64 * 1024;

/** Wire-level RPC method clients see for every event the publisher emits. */
const EVENT_NOTIFICATION_METHOD = 'events.notification';

export type SendFn = (frame: string) => void;

interface Subscription {
    readonly subscriberId: string;
    readonly send: SendFn;
    patterns: Set<string>;
}

export interface EventPublisher {
    subscribe(subscriberId: string, send: SendFn, patterns: readonly string[]): void;
    unsubscribe(subscriberId: string, patterns?: readonly string[]): void;
    publish<E extends EventName>(event: E, payload: EventPayload[E]): void;
    publishTerminalData(terminalId: string, buffer: Buffer): void;
}

function patternMatches(pattern: string, eventName: string): boolean {
    if (pattern === '*') { return true; }
    if (!pattern.endsWith('*')) { return pattern === eventName; }
    const prefix = pattern.slice(0, -1);
    return eventName.startsWith(prefix);
}

function buildNotification(event: string, params: Record<string, unknown>): string {
    return JSON.stringify({
        jsonrpc: '2.0',
        method: EVENT_NOTIFICATION_METHOD,
        params: { event, ...params },
    });
}

export function createEventPublisher(): EventPublisher {
    const subscriptions = new Map<string, Subscription>();
    const terminalChunkSeq = new Map<string, number>();

    function deliver(eventName: string, frame: string): void {
        for (const sub of subscriptions.values()) {
            if (!Array.from(sub.patterns).some(p => patternMatches(p, eventName))) {
                continue;
            }
            try {
                sub.send(frame);
            } catch {
                // A subscriber whose socket has closed shouldn't block
                // delivery to the rest of the fan-out. Cleanup of the
                // dead subscription is the caller's responsibility (it
                // listens on connection.onClose and calls unsubscribe).
            }
        }
    }

    return {
        subscribe(subscriberId, send, patterns) {
            const existing = subscriptions.get(subscriberId);
            if (existing) {
                for (const p of patterns) { existing.patterns.add(p); }
                return;
            }
            subscriptions.set(subscriberId, {
                subscriberId,
                send,
                patterns: new Set(patterns),
            });
        },

        unsubscribe(subscriberId, patterns) {
            const existing = subscriptions.get(subscriberId);
            if (!existing) { return; }
            if (!patterns) {
                subscriptions.delete(subscriberId);
                return;
            }
            for (const p of patterns) { existing.patterns.delete(p); }
            if (existing.patterns.size === 0) {
                subscriptions.delete(subscriberId);
            }
        },

        publish(event, payload) {
            const frame = buildNotification(event, payload as unknown as Record<string, unknown>);
            deliver(event, frame);
        },

        publishTerminalData(terminalId, buffer) {
            if (buffer.length === 0) { return; }

            let offset = 0;
            while (offset < buffer.length) {
                const end = Math.min(offset + MAX_EVENT_CHUNK_BYTES, buffer.length);
                const slice = buffer.subarray(offset, end);
                const chunkSeq = terminalChunkSeq.get(terminalId) ?? 0;
                terminalChunkSeq.set(terminalId, chunkSeq + 1);

                const frame = buildNotification(EventName.TerminalData, {
                    terminalId,
                    chunkSeq,
                    data: slice.toString('base64'),
                });
                deliver(EventName.TerminalData, frame);

                offset = end;
            }
        },
    };
}
