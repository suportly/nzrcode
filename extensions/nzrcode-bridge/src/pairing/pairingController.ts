/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// One-shot controller for the `system.register` RPC method.
// Bridges the on-the-wire register call into a Promise<PairingResult> that
// `runPairCommand` (pairCommand.ts) awaits.
//
// Semantics: the first `system.register` call resolves the controller's
// signal with the params. Subsequent calls succeed at the RPC layer
// (still return `{registered: true}` so the protocol contract stays
// stable) but do not re-resolve the signal. Pairing again requires a
// fresh controller — exactly what `startPairableBridge` does each time
// the user invokes `Pair iPad`.

import type { Handler } from '../server/dispatcher';
import { MethodName } from '../protocol/methods';
import type { PairingResult } from './pairCommand';

export class PairingController {

	private _resolve?: (result: PairingResult) => void;
	private _resolved = false;
	readonly pairingSignal: Promise<PairingResult>;

	constructor() {
		this.pairingSignal = new Promise<PairingResult>(resolve => {
			this._resolve = resolve;
		});
	}

	createHandler(): Handler<MethodName.SystemRegister> {
		return async params => {
			if (!this._resolved && this._resolve) {
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
