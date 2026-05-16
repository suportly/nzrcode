/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import {
    PUSH_RELAY_TIMEOUT_MS,
    PUSH_RELAY_URL,
    RelayUnavailableError,
    RelayPushProvider,
} from '../../push/relayPushProvider';
import type { HttpPostClient } from '../../push/relayPushProvider';
import type { PushEvent } from '../../push/IPushProvider';
import type { PairedDevice } from '../../pairing/pairedDevices';

function device(deviceId: string): PairedDevice {
    const t = Date.now();
    return { deviceId, deviceName: deviceId, pairedAt: t, lastSeenAt: t };
}

function event(): PushEvent {
    return { event: 'tasks.completed', payload: { executionId: 'e-1' } };
}

interface CapturedPost {
    readonly url: string;
    readonly body: string;
    readonly timeoutMs: number;
}

interface LoggerCall {
    readonly level: string;
    readonly msg: string;
    readonly fields: unknown;
}

function makeLogger(): { logger: { info: (m: string, f?: unknown) => void; warn: (m: string, f?: unknown) => void; error: (m: string, f?: unknown) => void }; calls: LoggerCall[] } {
    const calls: LoggerCall[] = [];
    return {
        logger: {
            info: (msg, fields) => calls.push({ level: 'info', msg, fields }),
            warn: (msg, fields) => calls.push({ level: 'warn', msg, fields }),
            error: (msg, fields) => calls.push({ level: 'error', msg, fields }),
        },
        calls,
    };
}

function httpPostStub(opts: {
    statusCode?: number;
    rejectWith?: Error;
    delayMs?: number;
}): { httpPost: HttpPostClient; captured: CapturedPost[] } {
    const captured: CapturedPost[] = [];
    const httpPost: HttpPostClient = async (url, body, timeoutMs) => {
        captured.push({ url, body, timeoutMs });
        if (opts.delayMs !== undefined) {
            await new Promise(resolve => setTimeout(resolve, opts.delayMs));
        }
        if (opts.rejectWith) { throw opts.rejectWith; }
        return { statusCode: opts.statusCode ?? 200 };
    };
    return { httpPost, captured };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

suite('push/RelayPushProvider', () => {

    test('constants match the spec', () => {
        assert.equal(PUSH_RELAY_URL, 'https://push-relay.nzrcode.dev/v1/push');
        assert.equal(PUSH_RELAY_TIMEOUT_MS, 3000);
    });

    test('POSTs the relay endpoint with the apnsTokens + payload body (2xx resolves)', async () => {
        const { httpPost, captured } = httpPostStub({ statusCode: 200 });
        const provider = new RelayPushProvider({
            httpPost,
            getApnsTokens: async () => ['apns-1', 'apns-2'],
        });

        await provider.send([device('d-1'), device('d-2')], event());

        assert.equal(captured.length, 1);
        assert.equal(captured[0].url, PUSH_RELAY_URL);
        assert.equal(captured[0].timeoutMs, PUSH_RELAY_TIMEOUT_MS);

        const body = JSON.parse(captured[0].body) as { apnsTokens: string[]; payload: PushEvent };
        assert.deepEqual(body.apnsTokens, ['apns-1', 'apns-2']);
        assert.equal(body.payload.event, 'tasks.completed');
    });

    test('rejects with RelayUnavailableError on HTTP 5xx', async () => {
        const { httpPost } = httpPostStub({ statusCode: 503 });
        const provider = new RelayPushProvider({
            httpPost,
            getApnsTokens: async () => ['apns-1'],
        });

        await assert.rejects(provider.send([device('d-1')], event()), RelayUnavailableError);
    });

    test('rejects with RelayUnavailableError on timeout/transport error', async () => {
        const { httpPost } = httpPostStub({ rejectWith: Object.assign(new Error('socket timeout'), { code: 'ETIMEDOUT' }) });
        const provider = new RelayPushProvider({
            httpPost,
            getApnsTokens: async () => ['apns-1'],
        });

        await assert.rejects(provider.send([device('d-1')], event()), RelayUnavailableError);
    });

    test('logs the apnsToken count but NEVER the apnsTokens themselves (Article VI)', async () => {
        const { logger, calls } = makeLogger();
        const { httpPost } = httpPostStub({ statusCode: 200 });
        const provider = new RelayPushProvider({
            httpPost,
            getApnsTokens: async () => ['apns-SECRET-1', 'apns-SECRET-2'],
            logger,
        });

        await provider.send([device('d-1')], event());

        const serialized = JSON.stringify(calls);
        assert.ok(!serialized.includes('apns-SECRET-1'), 'log must not contain raw apnsToken');
        assert.ok(!serialized.includes('apns-SECRET-2'), 'log must not contain raw apnsToken');
        const sent = calls.find(c => c.msg === 'push.relay.sent');
        assert.ok(sent, 'expected a relay-sent log line');
        const fields = sent.fields as { count: number };
        assert.equal(fields.count, 2);
    });
});
