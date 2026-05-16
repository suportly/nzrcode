/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Handler for the `system.hello` RPC. The iPad client calls this immediately
// after authenticating (Story 1 cenário 2) to discover what the bridge supports.

import * as os from 'os';
import { Dispatcher } from '../server/dispatcher';
import { MethodName } from '../protocol/methods';
import type { Handler } from '../server/dispatcher';

/**
 * Bridge namespaces exposed to clients. Order is part of the public contract:
 * clients render capability badges in this order. Keep alphabetical-by-feature
 * (commands → workspace → editor → terminal → scm → tasks → debug → notifications)
 * as enforced in the spec for T015.
 */
export const CANONICAL_BRIDGE_NAMESPACES = [
    'commands',
    'workspace',
    'editor',
    'terminal',
    'scm',
    'tasks',
    'debug',
    'notifications',
] as const;

export interface SystemHelloDeps {
    readonly serverVersion: string;
    readonly capabilities: readonly string[];
    /** Override for tests. Production should omit and let it default to `os.hostname`. */
    readonly hostname?: () => string;
    /** Override for tests. Production should omit and let it default to `process.platform`. */
    readonly platform?: () => string;
}

export function createSystemHelloHandler(deps: SystemHelloDeps): Handler<MethodName.SystemHello> {
    const hostname = deps.hostname ?? (() => os.hostname());
    const platform = deps.platform ?? (() => process.platform);

    return (_params) => ({
        serverVersion: deps.serverVersion,
        capabilities: deps.capabilities,
        hostname: hostname(),
        platform: platform(),
    });
}

/**
 * Register the bridge's system-level RPC handlers on the dispatcher.
 * Called from `activate()` once the dispatcher exists (T016).
 */
export function registerSystemHandlers(dispatcher: Dispatcher, deps: SystemHelloDeps): void {
    dispatcher.register(MethodName.SystemHello, createSystemHelloHandler(deps));
}
