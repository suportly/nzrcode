/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Coordinator that wires state → wsServer → dispatcher → namespace handlers.
// Owns lazy activation: only binds the WS port when the state file already
// exists (T016). The Pair iPad command (T028) calls loadOrCreateState() and
// then re-invokes maybeStartBridge() to start serving the new device.

import * as fs from 'fs';
import { startBridgeWsServer } from './server/wsServer';
import type { BridgeWsServer } from './server/wsServer';
import { Dispatcher } from './server/dispatcher';
import type { Logger } from './server/dispatcher';
import { loadOrCreateState, saveState, stateFilePath } from './server/state';
import { CANONICAL_BRIDGE_NAMESPACES, registerSystemHandlers } from './rpc/system';
import { MethodName } from './protocol/methods';
import { PairingController } from './pairing/pairingController';
import type { BridgeRuntimeHandle } from './pairing/pairCommand';

export interface BridgeStartDeps {
    readonly serverVersion: string;
    readonly logger: Logger;
}

export interface BridgeRuntime {
    readonly server: BridgeWsServer;
    readonly dispatcher: Dispatcher;
    readonly stop: () => Promise<void>;
}

/**
 * Start the bridge if (and only if) the state file already exists on disk.
 * Returns `undefined` when no state file is present — that signals the user
 * has never run `nzrcode: Pair iPad`, and we must not bind a port preemptively
 * (cl-2 / ADR-4: zero attack surface until the user opts in).
 */
export async function maybeStartBridge(deps: BridgeStartDeps): Promise<BridgeRuntime | undefined> {
    if (!fs.existsSync(stateFilePath())) {
        return undefined;
    }

    const state = loadOrCreateState();

    const dispatcher = new Dispatcher({ token: state.token, logger: deps.logger });
    registerSystemHandlers(dispatcher, {
        serverVersion: deps.serverVersion,
        capabilities: CANONICAL_BRIDGE_NAMESPACES,
    });

    const server = await startBridgeWsServer({
        onConnection: conn => dispatcher.attach(conn),
    });

    saveState({ ...state, lastPort: server.port });

    return {
        server,
        dispatcher,
        stop: () => server.stop(),
    };
}

/**
 * Start the bridge for a fresh pair flow. Unlike `maybeStartBridge`, this
 * always binds — the caller (the `Pair iPad` palette command) is the user
 * opt-in signal. Returns a runtime handle whose `pairingSignal` resolves
 * the first time the connecting client calls `system.register` after
 * successful authentication.
 *
 * Lifecycle is owned by the caller: `dispose()` stops the WS server.
 */
export async function startPairableBridge(deps: BridgeStartDeps): Promise<BridgeRuntimeHandle> {
    const state = loadOrCreateState();

    const dispatcher = new Dispatcher({ token: state.token, logger: deps.logger });
    registerSystemHandlers(dispatcher, {
        serverVersion: deps.serverVersion,
        capabilities: CANONICAL_BRIDGE_NAMESPACES,
    });

    const controller = new PairingController();
    dispatcher.register(MethodName.SystemRegister, controller.createHandler());

    const server = await startBridgeWsServer({
        onConnection: conn => dispatcher.attach(conn),
    });

    saveState({ ...state, lastPort: server.port });

    return {
        port: server.port,
        pairingSignal: controller.pairingSignal,
        dispose: () => server.stop(),
    };
}
