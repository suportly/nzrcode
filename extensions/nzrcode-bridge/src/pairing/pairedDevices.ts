/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Paired-device registry.
// Metadata (deviceId, deviceName, timestamps) lives in vscode.Memento (globalState) —
// inspectable, listable. APNs push tokens live ONLY in SecretStorage (encrypted keychain).
// Article VI (cl-11): apnsToken MUST NEVER be written to globalState.

import type * as vscode from 'vscode';

/**
 * Metadata for a paired client device. Stored in extension global state
 * (vscode.Memento) — visible by inspecting the extension's storage.
 * Never contains the apnsToken (cl-11): that lives in SecretStorage.
 */
export interface PairedDevice {
	readonly deviceId: string;
	readonly deviceName: string;
	readonly pairedAt: number;      // ms since epoch
	readonly lastSeenAt: number;    // ms since epoch
}

/**
 * Storage adapter that the device store depends on. In production we wire
 * vscode.ExtensionContext.globalState (Memento) and vscode.ExtensionContext.secrets
 * (SecretStorage). In tests, callers pass an in-memory fake.
 *
 * The interface is intentionally minimal — only the surfaces we use.
 */
export interface PairedDeviceStorageDeps {
	readonly globalState: Pick<vscode.Memento, 'get' | 'update'>;
	readonly secrets: Pick<vscode.SecretStorage, 'get' | 'store' | 'delete'>;
}

export interface RegisterArgs {
	readonly deviceId: string;
	readonly deviceName: string;
}

/** Storage key used in vscode.Memento (globalState). Exposed for test introspection. */
export const PAIRED_DEVICES_KEY = 'nzrcode-bridge.paired-devices';

/** Prefix for SecretStorage keys: `paired-device:<deviceId>` -> apnsToken. */
export const SECRET_KEY_PREFIX = 'paired-device:';

// ---------------------------------------------------------------------------
// PairedDeviceStore
// ---------------------------------------------------------------------------

export class PairedDeviceStore {
	private readonly _deps: PairedDeviceStorageDeps;

	/**
	 * In-memory mirror of globalState. All reads go here; all writes update
	 * this mirror AND persist via globalState.update (cl-11: never contains
	 * apnsToken).
	 */
	private _devices: PairedDevice[];

	constructor(deps: PairedDeviceStorageDeps) {
		this._deps = deps;
		this._devices = deps.globalState.get<PairedDevice[]>(PAIRED_DEVICES_KEY) ?? [];
	}

	/**
	 * Register a new device or update an existing one's deviceName + lastSeenAt.
	 * Preserves pairedAt for existing devices.
	 */
	async register(args: RegisterArgs): Promise<PairedDevice> {
		const now = Date.now();
		const existing = this._devices.find(d => d.deviceId === args.deviceId);

		let updated: PairedDevice;
		if (existing) {
			updated = {
				deviceId: existing.deviceId,
				deviceName: args.deviceName,
				pairedAt: existing.pairedAt,
				lastSeenAt: now,
			};
			this._devices = this._devices.map(d => d.deviceId === args.deviceId ? updated : d);
		} else {
			updated = {
				deviceId: args.deviceId,
				deviceName: args.deviceName,
				pairedAt: now,
				lastSeenAt: now,
			};
			this._devices = [...this._devices, updated];
		}

		await this._persist();
		return updated;
	}

	/**
	 * Attach an APNs push token to a device. Stored ONLY in SecretStorage (cl-11).
	 *
	 * Note: does NOT verify that the device is registered — order independence;
	 * the pairing protocol may send the APNs token before the final register
	 * handshake completes.
	 */
	async attachApnsToken(deviceId: string, apnsToken: string): Promise<void> {
		await this._deps.secrets.store(`${SECRET_KEY_PREFIX}${deviceId}`, apnsToken);
	}

	/** Read the APNs token for a device (from SecretStorage). Returns undefined if absent. */
	async getApnsToken(deviceId: string): Promise<string | undefined> {
		return this._deps.secrets.get(`${SECRET_KEY_PREFIX}${deviceId}`);
	}

	/**
	 * Return all devices' metadata as a defensive shallow copy.
	 * Never includes apnsToken — that field is not part of PairedDevice.
	 */
	list(): readonly PairedDevice[] {
		return [...this._devices];
	}

	/**
	 * Update lastSeenAt for a device. No-op if device is not registered.
	 * Uses an immutable update (creates a new object) to avoid mutating records.
	 */
	async touch(deviceId: string): Promise<void> {
		const idx = this._devices.findIndex(d => d.deviceId === deviceId);
		if (idx === -1) {
			return; // No-op — device not registered
		}

		const existing = this._devices[idx];
		const updated: PairedDevice = { ...existing, lastSeenAt: Date.now() };
		this._devices = [
			...this._devices.slice(0, idx),
			updated,
			...this._devices.slice(idx + 1),
		];
		await this._persist();
	}

	/**
	 * Revoke a device: remove both metadata AND secret.
	 * Both operations run even if one fails; errors are rethrown at the end.
	 */
	async revoke(deviceId: string): Promise<void> {
		this._devices = this._devices.filter(d => d.deviceId !== deviceId);

		let metaError: unknown;
		let secretError: unknown;

		try {
			await this._persist();
		} catch (err) {
			metaError = err;
		}

		try {
			await this._deps.secrets.delete(`${SECRET_KEY_PREFIX}${deviceId}`);
		} catch (err) {
			secretError = err;
		}

		if (metaError !== undefined) {
			throw metaError;
		}
		if (secretError !== undefined) {
			throw secretError;
		}
	}

	/**
	 * Drop ALL devices and secrets.
	 * Used by `nzrcode: Revoke iPad` "all" path.
	 */
	async clear(): Promise<void> {
		const toDelete = [...this._devices];
		this._devices = [];

		for (const device of toDelete) {
			await this._deps.secrets.delete(`${SECRET_KEY_PREFIX}${device.deviceId}`);
		}

		await this._deps.globalState.update(PAIRED_DEVICES_KEY, undefined);
	}

	/** Persist the in-memory mirror to globalState. (cl-11: no apnsToken in payload.) */
	private async _persist(): Promise<void> {
		await this._deps.globalState.update(PAIRED_DEVICES_KEY, this._devices);
	}
}
