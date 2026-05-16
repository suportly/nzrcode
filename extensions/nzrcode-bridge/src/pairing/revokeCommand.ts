/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// `nzrcode-bridge.revokeIpad` command (feature 0018 — per-device tokens).
//
// Walks the user through revoking a paired device, tears down the live WS
// connections, and deletes the per-device token entry from `state.tokens`.
// Other paired devices keep their own tokens — they continue to authenticate
// successfully after the next reconnect.

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
    readonly removeDeviceToken: (deviceId: string) => Promise<void>;
    readonly remainingDevicesCount: () => number;
    readonly showInformationMessage: (message: string) => void;
    readonly now: () => number;
}

function buildSuccessMessage(deviceName: string, remaining: number): string {
    if (remaining === 0) {
        return `Revoked ${deviceName}. No other paired devices.`;
    }
    if (remaining === 1) {
        return `Revoked ${deviceName}. 1 other paired device stays connected.`;
    }
    return `Revoked ${deviceName}. ${remaining} other paired devices stay connected.`;
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
    await deps.removeDeviceToken(picked.deviceId);
    deps.showInformationMessage(buildSuccessMessage(picked.label, deps.remainingDevicesCount()));
}
