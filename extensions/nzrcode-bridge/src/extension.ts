/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { maybeStartBridge, BridgeRuntime } from './bridge';
import { PairedDeviceStore } from './pairing/pairedDevices';
import { runListPairedDevicesCommand } from './pairing/listCommand';
import type { QuickPickEntry } from './pairing/listCommand';
import { runRevokeIpadCommand } from './pairing/revokeCommand';
import type { RevokeQuickPickItem } from './pairing/revokeCommand';
import { rotateToken } from './server/state';
import type { Logger } from './server/dispatcher';

let _runtime: BridgeRuntime | undefined;
let _store: PairedDeviceStore | undefined;

function buildLogger(channel: vscode.OutputChannel): Logger {
	const write = (level: string, msg: string, fields?: unknown): void => {
		const payload = fields === undefined ? '' : ` ${JSON.stringify(fields)}`;
		channel.appendLine(`[${level}] ${msg}${payload}`);
	};
	return {
		info: (msg, fields) => write('info', msg, fields),
		warn: (msg, fields) => write('warn', msg, fields),
		error: (msg, fields) => write('error', msg, fields),
	};
}

function registerListCommand(context: vscode.ExtensionContext, store: PairedDeviceStore): vscode.Disposable {
	return vscode.commands.registerCommand('nzrcode-bridge.listPairedDevices', async () => {
		await runListPairedDevicesCommand({
			listDevices: () => store.list(),
			showQuickPick: async <T extends QuickPickEntry>(items: readonly T[]): Promise<T | undefined> => {
				return vscode.window.showQuickPick([...items]);
			},
			showInformationMessage: (message) => { void vscode.window.showInformationMessage(message); },
			now: () => Date.now(),
		});
	});
}

function registerRevokeCommand(context: vscode.ExtensionContext, store: PairedDeviceStore): vscode.Disposable {
	return vscode.commands.registerCommand('nzrcode-bridge.revokeIpad', async () => {
		await runRevokeIpadCommand({
			listDevices: () => store.list(),
			showQuickPick: async <T extends RevokeQuickPickItem>(items: readonly T[]): Promise<T | undefined> => {
				return vscode.window.showQuickPick([...items]);
			},
			confirmRevoke: async (deviceName) => {
				const choice = await vscode.window.showWarningMessage(
					`Revoke ${deviceName}?`,
					{ modal: true },
					'Revoke',
				);
				return choice === 'Revoke';
			},
			revokeDevice: (deviceId) => store.revoke(deviceId),
			dropActiveConnections: async () => {
				if (_runtime) {
					await _runtime.stop();
					_runtime = undefined;
				}
			},
			rotateToken: async () => { rotateToken(); },
			showInformationMessage: (message) => { void vscode.window.showInformationMessage(message); },
			now: () => Date.now(),
		});
	});
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const channel = vscode.window.createOutputChannel('NZRCode Bridge');
	context.subscriptions.push(channel);

	const extensionVersion = (context.extension?.packageJSON as { version?: string } | undefined)?.version ?? '0.0.0';

	_store = new PairedDeviceStore({
		globalState: context.globalState,
		secrets: context.secrets,
	});

	_runtime = await maybeStartBridge({
		serverVersion: extensionVersion,
		logger: buildLogger(channel),
	});

	if (_runtime) {
		context.subscriptions.push({ dispose: () => { void _runtime?.stop(); } });
	}

	context.subscriptions.push(registerListCommand(context, _store));
	context.subscriptions.push(registerRevokeCommand(context, _store));
}

export async function deactivate(): Promise<void> {
	if (_runtime) {
		await _runtime.stop();
		_runtime = undefined;
	}
	_store = undefined;
}
