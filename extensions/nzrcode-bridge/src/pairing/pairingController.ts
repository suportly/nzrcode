/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// One-shot controller for the `system.register` RPC method.
// Bridges the on-the-wire register call into a Promise<PairingResult> that
// `runPairCommand` (pairCommand.ts) awaits.
//
// Promotion semantics (feature 0018): on the first register call, the
// controller invokes `onPair(deviceId)` so the caller can promote the
// in-memory pending-pair token into the persistent per-device tokens
// map (`state.addToken`). If `onPair` throws, the controller does NOT
// resolve the signal — a failed promotion must abort the pair flow.
//
// Subsequent calls succeed at the RPC layer (`{registered: true}`) but
// do not re-resolve the signal nor re-invoke `onPair`.

import type { Handler } from '../server/dispatcher';
import { MethodName } from '../protocol/methods';
import type { PairingResult } from './pairCommand';

export interface PairingControllerDeps {
	/**
	 * Called once when the first `system.register` arrives, BEFORE the
	 * pairing signal resolves. Receives the deviceId the client claims.
	 * Throwing prevents the signal from resolving — the pair flow will
	 * see its `pairingSignal` await hang until the user cancels.
	 */
	readonly onPair?: (deviceId: string) => void | Promise<void>;
}

export class PairingController {

	private _resolve?: (result: PairingResult) => void;
	private _resolved = false;
	private readonly _deps: PairingControllerDeps;
	readonly pairingSignal: Promise<PairingResult>;

	constructor(deps: PairingControllerDeps = {}) {
		this._deps = deps;
		this.pairingSignal = new Promise<PairingResult>(resolve => {
			this._resolve = resolve;
		});
	}

	createHandler(): Handler<MethodName.SystemRegister> {
		return async params => {
			if (!this._resolved && this._resolve) {
				if (this._deps.onPair) {
					await this._deps.onPair(params.deviceId);
				}
				this._resolved = true;
				this._resolve({
					deviceId: params.deviceId,
					deviceName: params.deviceName,
					apnsToken: params.apnsToken,
				});
			}
			return { registered: true };
		};
	}
}
