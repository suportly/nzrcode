/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import * as os from 'os';
import {
    CANONICAL_BRIDGE_NAMESPACES,
    createSystemHelloHandler,
    registerSystemHandlers,
} from '../../rpc/system';
import { Dispatcher } from '../../server/dispatcher';
import type { Logger } from '../../server/dispatcher';
import { MethodName } from '../../protocol/methods';

function makeLogger(): Logger {
    return {
        info: () => { /* test logger: silent */ },
        warn: () => { /* test logger: silent */ },
        error: () => { /* test logger: silent */ },
    };
}

suite('rpc/system', () => {

    suite('CANONICAL_BRIDGE_NAMESPACES', () => {

        test('lists the 8 namespaces from the spec, in spec order', () => {
            assert.deepEqual(
                [...CANONICAL_BRIDGE_NAMESPACES],
                ['commands', 'workspace', 'editor', 'terminal', 'scm', 'tasks', 'debug', 'notifications'],
            );
        });
    });

    suite('createSystemHelloHandler', () => {

        test('returns the contract shape', async () => {
            const handler = createSystemHelloHandler({
                serverVersion: '1.2.3',
                capabilities: ['commands', 'editor'],
                hostname: () => 'test-host',
                platform: () => 'darwin',
            });

            const result = await handler(undefined);

            assert.deepEqual(result, {
                serverVersion: '1.2.3',
                capabilities: ['commands', 'editor'],
                hostname: 'test-host',
                platform: 'darwin',
            });
        });

        test('defaults hostname to os.hostname()', async () => {
            const handler = createSystemHelloHandler({
                serverVersion: '1.0.0',
                capabilities: [],
                platform: () => 'linux',
            });

            const result = await handler(undefined);

            assert.equal(result.hostname, os.hostname());
        });

        test('defaults platform to process.platform', async () => {
            const handler = createSystemHelloHandler({
                serverVersion: '1.0.0',
                capabilities: [],
                hostname: () => 'h',
            });

            const result = await handler(undefined);

            assert.equal(result.platform, process.platform);
        });

        test('does not leak internal state across calls (each call is fresh)', async () => {
            const handler = createSystemHelloHandler({
                serverVersion: '1.0.0',
                capabilities: ['a', 'b'],
                hostname: () => 'h',
                platform: () => 'p',
            });

            const r1 = await handler(undefined);
            const r2 = await handler(undefined);

            assert.notEqual(r1, r2, 'distinct objects per call');
            assert.deepEqual(r1, r2);
        });
    });

    suite('registerSystemHandlers', () => {

        test('registers system.hello on the dispatcher', () => {
            const dispatcher = new Dispatcher({ token: 't'.repeat(43), logger: makeLogger() });

            registerSystemHandlers(dispatcher, {
                serverVersion: '1.0.0',
                capabilities: CANONICAL_BRIDGE_NAMESPACES,
            });

            assert.ok(dispatcher.registeredMethods().includes(MethodName.SystemHello));
        });

        test('throws when called twice (idempotency is the caller\'s problem)', () => {
            const dispatcher = new Dispatcher({ token: 't'.repeat(43), logger: makeLogger() });

            registerSystemHandlers(dispatcher, {
                serverVersion: '1.0.0',
                capabilities: CANONICAL_BRIDGE_NAMESPACES,
            });

            assert.throws(() => registerSystemHandlers(dispatcher, {
                serverVersion: '1.0.0',
                capabilities: CANONICAL_BRIDGE_NAMESPACES,
            }), /already registered/);
        });
    });
});
