/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// FakePushProvider — in-memory IPushProvider used by tests across the push
// stack. Records every send() call so the test can assert on order, devices,
// and event payload. Does NOT throw — production fallback semantics live in
// the relay + in-band concrete providers (T031, T032).

import type { IPushProvider, PushEvent } from './IPushProvider';
import type { PairedDevice } from '../pairing/pairedDevices';

export interface FakePushCall {
    readonly devices: readonly PairedDevice[];
    readonly event: PushEvent;
    readonly ts: number;
}

export class FakePushProvider implements IPushProvider {

    public readonly calls: FakePushCall[] = [];

    async send(devices: readonly PairedDevice[], event: PushEvent): Promise<void> {
        this.calls.push({ devices: [...devices], event, ts: Date.now() });
    }

    reset(): void {
        this.calls.length = 0;
    }
}
