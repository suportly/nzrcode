/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import { runListPairedDevicesCommand } from '../../pairing/listCommand';
import type { ListPairedDevicesDeps } from '../../pairing/listCommand';
import { runRevokeIpadCommand } from '../../pairing/revokeCommand';
import type { RevokeIpadDeps, RevokeQuickPickItem } from '../../pairing/revokeCommand';
import type { PairedDevice } from '../../pairing/pairedDevices';

const ONE_HOUR_MS = 60 * 60 * 1000;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

function device(deviceId: string, deviceName: string, lastSeenAt: number): PairedDevice {
    return {
        deviceId,
        deviceName,
        pairedAt: lastSeenAt - ONE_HOUR_MS,
        lastSeenAt,
    };
}

// ─── List command ─────────────────────────────────────────────────────────────

suite('pairing/listCommand', () => {

    function makeDeps(opts: { devices?: readonly PairedDevice[]; pickResult?: { label: string } | undefined }): {
        deps: ListPairedDevicesDeps;
        shownItems: Array<{ label: string; description?: string }>;
        infoMessages: string[];
    } {
        const shownItems: Array<{ label: string; description?: string }> = [];
        const infoMessages: string[] = [];

        const deps: ListPairedDevicesDeps = {
            listDevices: () => opts.devices ?? [],
            showQuickPick: async (items) => {
                for (const it of items) {
                    shownItems.push({ label: it.label, description: it.description });
                }
                return opts.pickResult;
            },
            showInformationMessage: (msg) => { infoMessages.push(msg); },
            now: () => Date.now(),
        };
        return { deps, shownItems, infoMessages };
    }

    test('shows an information message when no devices are paired', async () => {
        const { deps, shownItems, infoMessages } = makeDeps({ devices: [] });

        await runListPairedDevicesCommand(deps);

        assert.equal(shownItems.length, 0, 'no QuickPick when list is empty');
        assert.equal(infoMessages.length, 1);
        assert.match(infoMessages[0], /no.*device/i);
    });

    test('renders one QuickPick item per paired device with deviceName as label', async () => {
        const now = Date.now();
        const { deps, shownItems } = makeDeps({
            devices: [
                device('d-1', 'Alair iPad', now - 30 * 1000),
                device('d-2', 'Conference iPad', now - ONE_HOUR_MS),
            ],
        });

        await runListPairedDevicesCommand(deps);

        assert.equal(shownItems.length, 2);
        assert.deepEqual(shownItems.map(i => i.label), ['Alair iPad', 'Conference iPad']);
    });

    test('humanises lastSeenAt in the description', async () => {
        const now = Date.now();
        const { deps, shownItems } = makeDeps({
            devices: [
                device('d-1', 'Recent iPad', now - 5 * 1000),
                device('d-2', 'Old iPad', now - TWO_DAYS_MS),
            ],
        });
        // Override `now` to make the humaniser deterministic.
        const fixedNow = now;
        deps.now = () => fixedNow;

        await runListPairedDevicesCommand(deps);

        assert.match(shownItems[0].description ?? '', /seconds? ago|just now/i);
        assert.match(shownItems[1].description ?? '', /day/i);
    });
});

// ─── Revoke command ───────────────────────────────────────────────────────────

suite('pairing/revokeCommand', () => {

    interface RevokeRecorder {
        droppedConnections: number;
    }

    function makeDeps(opts: {
        devices?: readonly PairedDevice[];
        pickedDeviceId?: string;
        confirmRevoke?: boolean;
    }): {
        deps: RevokeIpadDeps;
        revoked: string[];
        recorder: RevokeRecorder;
        infoMessages: string[];
    } {
        const revoked: string[] = [];
        const recorder: RevokeRecorder = { droppedConnections: 0 };
        const infoMessages: string[] = [];

        const deps: RevokeIpadDeps = {
            listDevices: () => opts.devices ?? [],
            showQuickPick: async (items) => {
                if (opts.pickedDeviceId === undefined) { return undefined; }
                return (items as readonly RevokeQuickPickItem[]).find(i => i.deviceId === opts.pickedDeviceId);
            },
            confirmRevoke: async () => opts.confirmRevoke ?? true,
            revokeDevice: async (deviceId) => { revoked.push(deviceId); },
            dropActiveConnections: async () => { recorder.droppedConnections += 1; },
            showInformationMessage: (msg) => { infoMessages.push(msg); },
            now: () => Date.now(),
        };

        return { deps, revoked, recorder, infoMessages };
    }

    test('shows an information message and exits early when there are no devices', async () => {
        const { deps, revoked, recorder, infoMessages } = makeDeps({ devices: [] });

        await runRevokeIpadCommand(deps);

        assert.equal(revoked.length, 0);
        assert.equal(recorder.droppedConnections, 0);
        assert.equal(infoMessages.length, 1);
        assert.match(infoMessages[0], /no.*device/i);
    });

    test('revokes the selected device and drops active connections', async () => {
        const { deps, revoked, recorder, infoMessages } = makeDeps({
            devices: [device('d-1', 'Alair iPad', Date.now())],
            pickedDeviceId: 'd-1',
            confirmRevoke: true,
        });

        await runRevokeIpadCommand(deps);

        assert.deepEqual(revoked, ['d-1']);
        assert.equal(recorder.droppedConnections, 1);
        assert.match(infoMessages.at(-1) ?? '', /revoked|removed/i);
    });

    test('does NOT revoke when the user cancels the QuickPick', async () => {
        const { deps, revoked, recorder } = makeDeps({
            devices: [device('d-1', 'Alair iPad', Date.now())],
            pickedDeviceId: undefined,
        });

        await runRevokeIpadCommand(deps);

        assert.equal(revoked.length, 0);
        assert.equal(recorder.droppedConnections, 0);
    });

    test('does NOT revoke when the user declines the confirmation prompt', async () => {
        const { deps, revoked, recorder } = makeDeps({
            devices: [device('d-1', 'Alair iPad', Date.now())],
            pickedDeviceId: 'd-1',
            confirmRevoke: false,
        });

        await runRevokeIpadCommand(deps);

        assert.equal(revoked.length, 0);
        assert.equal(recorder.droppedConnections, 0);
    });
});
