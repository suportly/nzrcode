/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// `nzrcode-bridge.revokeIpad` command.
// Walks the user through revoking a paired device, tears down the live
// WS connections, and rotates the shared bridge token so any leaked
// copy of the previous token (in the revoked device's keychain, a
// screenshot of the QR, etc.) can no longer authenticate.
//
// Per-device tokens (so revoke removes only one device's token, leaving
// the others paired) are tracked as decision-0015-1 in the feature 0015
// spec — that refactor needs a `bridge.json` schema bump and is out of
// scope here.

import type { PairedDevice } from './pairedDevices';
import { humaniseLastSeen } from './listCommand';

export interface RevokeQuickPickItem {
    readonly label: string;
    readonly description: string;
    readonly deviceId: string;
}

export interface RevokeIpadDeps {
    readonly listDevices: () => readonly PairedDevice[];
    readonly showQuickPick: <T extends RevokeQuickPickItem>(items: readonly T[]) => Promise<T | undefined>;
    readonly confirmRevoke: (deviceName: string) => Promise<boolean>;
    readonly revokeDevice: (deviceId: string) => Promise<void>;
    readonly dropActiveConnections: () => Promise<void>;
    readonly rotateToken: () => Promise<void>;
    readonly showInformationMessage: (message: string) => void;
    readonly now: () => number;
}

export async function runRevokeIpadCommand(deps: RevokeIpadDeps): Promise<void> {
    const devices = deps.listDevices();
    if (devices.length === 0) {
        deps.showInformationMessage('No paired devices to revoke.');
        return;
    }

    const now = deps.now();
    const items: RevokeQuickPickItem[] = devices.map(d => ({
        label: d.deviceName,
        description: humaniseLastSeen(d.lastSeenAt, now),
        deviceId: d.deviceId,
    }));

    const picked = await deps.showQuickPick(items);
    if (!picked) { return; }

    const confirmed = await deps.confirmRevoke(picked.label);
    if (!confirmed) { return; }

    await deps.revokeDevice(picked.deviceId);
    await deps.dropActiveConnections();
    await deps.rotateToken();
    deps.showInformationMessage(`Revoked ${picked.label}. Token rotated — other paired devices must re-pair.`);
}
