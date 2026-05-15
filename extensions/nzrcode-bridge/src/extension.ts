/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { loadOrCreateState } from './server/state';

export function activate(_context: vscode.ExtensionContext): void {
	// Load (or create) the persisted bridge state. The WS server is NOT started
	// here — that lands in T016 (lazy bind based on pairedDevices presence).
	loadOrCreateState();
}

export function deactivate(): void {
	// No-op; real teardown lands in T016.
}
