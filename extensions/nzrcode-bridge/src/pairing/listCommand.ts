/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// `nzrcode-bridge.listPairedDevices` command.
// Shows a QuickPick listing every device that has been paired with this
// extension, with a humanised "last seen" timestamp in the description.

import type { PairedDevice } from './pairedDevices';

export interface QuickPickEntry {
    readonly label: string;
    readonly description?: string;
}

export interface ListPairedDevicesDeps {
    readonly listDevices: () => readonly PairedDevice[];
    readonly showQuickPick: <T extends QuickPickEntry>(items: readonly T[]) => Promise<T | undefined>;
    readonly showInformationMessage: (message: string) => void;
    readonly now: () => number;
}

/** Format a millis-since-epoch as a coarse "N {unit} ago" string. */
export function humaniseLastSeen(lastSeenAt: number, now: number): string {
    const deltaMs = Math.max(0, now - lastSeenAt);
    const seconds = Math.floor(deltaMs / 1000);
    if (seconds < 5) { return 'just now'; }
    if (seconds < 60) { return `${seconds} seconds ago`; }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) { return `${minutes} minute${minutes === 1 ? '' : 's'} ago`; }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) { return `${hours} hour${hours === 1 ? '' : 's'} ago`; }
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
}

export async function runListPairedDevicesCommand(deps: ListPairedDevicesDeps): Promise<void> {
    const devices = deps.listDevices();
    if (devices.length === 0) {
        deps.showInformationMessage('No paired devices.');
        return;
    }

    const now = deps.now();
    const items: QuickPickEntry[] = devices.map(d => ({
        label: d.deviceName,
        description: humaniseLastSeen(d.lastSeenAt, now),
    }));

    await deps.showQuickPick(items);
}
