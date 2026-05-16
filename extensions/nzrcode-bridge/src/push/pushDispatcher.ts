/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// PushDispatcher — orchestrates the relay → in-band fallback chain (cl-7).
// No circuit breaker (YAGNI): every dispatch tries the relay first; on
// failure of any kind, it falls back to the in-band provider. Both the
// relay and the in-band path are best-effort — a final in-band failure
// is swallowed so that canonical event handlers never propagate notification
// errors up into VS Code's idle-loop or extension host.

import type { IPushProvider, PushEvent } from './IPushProvider';
import type { PairedDevice } from '../pairing/pairedDevices';

export interface PushDispatcherDeps {
    readonly relay: IPushProvider;
    readonly inBand: IPushProvider;
}

export class PushDispatcher {

    constructor(private readonly _deps: PushDispatcherDeps) {}

    async dispatch(devices: readonly PairedDevice[], event: PushEvent): Promise<void> {
        try {
            await this._deps.relay.send(devices, event);
            return;
        } catch {
            // Fall through to in-band.
        }

        try {
            await this._deps.inBand.send(devices, event);
        } catch {
            // Swallow — notifications are best-effort.
        }
    }
}
