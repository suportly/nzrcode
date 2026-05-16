/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// IPushProvider — the provider seam (Article V).
// Every concrete push transport (relay HTTPS, in-band WS notification) implements
// this interface. The pushDispatcher (T033) composes providers via a fallback
// chain; tests inject FakePushProvider.

import type { PairedDevice } from '../pairing/pairedDevices';

export interface PushEvent {
    readonly event: string;
    readonly payload: Readonly<Record<string, unknown>>;
}

export interface IPushProvider {
    send(devices: readonly PairedDevice[], event: PushEvent): Promise<void>;
}
