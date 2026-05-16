/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// `nzrcode-bridge.revokeIpad` command.
// Walks the user through revoking a paired device and tears down the live
// WS connections so the revoked client can't keep streaming events.
//
// Spec contract (Story 5 cenário 3):
//   - QuickPick lists active devices (deviceName + humanised lastSeen).
//   - On selection + confirmation → pairedDevices.revoke(id).
//   - Drop active WS connections in ≤ 2 s (callers wire that to wsServer.stopAll).
//
// The follow-up dispatcher work — making subsequent auth attempts from the
// revoked device fail — needs per-device tokens; tracked separately.

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
    deps.showInformationMessage(`Revoked ${picked.label}.`);
}
