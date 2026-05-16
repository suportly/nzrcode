/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Orchestration for the `nzrcode-bridge.pairIpad` command.
//
// Flow (Story 1 cenários 1-3):
//   1. loadOrCreateState() — generates or reads the persistent token + dir.
//   2. startBridge(state)  — ensures the WS server is bound and gives us
//                            the assigned port + a one-shot pairing signal.
//   3. discoverEndpoints(port) — LAN + Tailscale, LAN-first.
//   4. open the QR webview embedding the v1 payload.
//   5. await the pairing signal — the WS auth handler resolves it after a
//      successful first message from a brand-new client.
//   6. register the device + attach apnsToken (if provided) + notify the user.
//
// Lifecycle: the webview is disposed exactly once, even when the user cancels.

import { buildQrPayloadFromEndpoints, renderQrWebviewHtml } from './qrModal';
import type { DiscoveredEndpoint } from './endpoints';
import type { BridgeState } from '../server/state';

export interface PairingResult {
    readonly deviceId: string;
    readonly deviceName?: string;
    readonly apnsToken?: string;
}

export interface BridgeRuntimeHandle {
    readonly port: number;
    /**
     * The token the QR payload should advertise: the in-memory pending
     * pair token that `startPairableBridge` minted for this flow. Once
     * the iPad calls `system.register`, the bridge promotes this token
     * into the persistent per-device tokens map (feature 0018) under
     * the real deviceId.
     */
    readonly token: string;
    readonly pairingSignal: Promise<PairingResult>;
    readonly dispose: () => Promise<void>;
}

export interface PairedDeviceLike {
    readonly deviceId: string;
    readonly deviceName: string;
    readonly pairedAt: number;
    readonly lastSeenAt: number;
}

export interface PairWebviewHandle {
    dispose(): void;
}

export interface PairCommandDeps {
    readonly loadOrCreateState: () => BridgeState;
    readonly startBridge: (state: BridgeState) => Promise<BridgeRuntimeHandle>;
    readonly discoverEndpoints: (port: number) => Promise<readonly DiscoveredEndpoint[]>;
    readonly openWebview: (html: string) => PairWebviewHandle;
    readonly registerDevice: (args: { deviceId: string; deviceName: string }) => Promise<PairedDeviceLike>;
    readonly attachApnsToken: (deviceId: string, apnsToken: string) => Promise<void>;
    readonly showInformationMessage: (message: string) => void;
}

const DEFAULT_DEVICE_NAME = 'iPad';

export async function runPairCommand(deps: PairCommandDeps): Promise<PairedDeviceLike> {
    const state = deps.loadOrCreateState();
    const bridge = await deps.startBridge(state);
    const endpoints = await deps.discoverEndpoints(bridge.port);
    const payload = buildQrPayloadFromEndpoints(bridge.token, endpoints);
    const html = renderQrWebviewHtml(payload);
    const webview = deps.openWebview(html);

    try {
        const result = await bridge.pairingSignal;

        const device = await deps.registerDevice({
            deviceId: result.deviceId,
            deviceName: result.deviceName ?? DEFAULT_DEVICE_NAME,
        });

        if (result.apnsToken) {
            await deps.attachApnsToken(device.deviceId, result.apnsToken);
        }

        deps.showInformationMessage(`Paired with ${device.deviceName}`);
        return device;
    } finally {
        webview.dispose();
    }
}
