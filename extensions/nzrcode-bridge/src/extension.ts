/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { maybeStartBridge, startPairableBridge, BridgeRuntime } from './bridge';
import { PairedDeviceStore } from './pairing/pairedDevices';
import { runListPairedDevicesCommand } from './pairing/listCommand';
import type { QuickPickEntry } from './pairing/listCommand';
import { runPairCommand } from './pairing/pairCommand';
import type { PairWebviewHandle } from './pairing/pairCommand';
import { runRevokeIpadCommand } from './pairing/revokeCommand';
import type { RevokeQuickPickItem } from './pairing/revokeCommand';
import { discoverEndpoints } from './pairing/endpoints';
import { loadOrCreateState, removeToken } from './server/state';
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

function registerListCommand(_context: vscode.ExtensionContext, store: PairedDeviceStore): vscode.Disposable {
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

function openPairWebview(): PairWebviewHandle & { setHtml: (html: string) => void } {
	const panel = vscode.window.createWebviewPanel(
		'nzrcodeBridgePair',
		'NZRCode: Pair iPad',
		vscode.ViewColumn.One,
		{ enableScripts: false, retainContextWhenHidden: true },
	);
	return {
		setHtml: (html) => { panel.webview.html = html; },
		dispose: () => panel.dispose(),
	};
}

function registerPairCommand(
	store: PairedDeviceStore,
	channel: vscode.OutputChannel,
	extensionVersion: string,
): vscode.Disposable {
	return vscode.commands.registerCommand('nzrcode-bridge.pairIpad', async () => {
		try {
			await runPairCommand({
				loadOrCreateState: () => loadOrCreateState(),
				startBridge: async (_state) => startPairableBridge({
					serverVersion: extensionVersion,
					logger: buildLogger(channel),
				}),
				discoverEndpoints: (port) => discoverEndpoints({ port }),
				openWebview: (html) => {
					const handle = openPairWebview();
					handle.setHtml(html);
					return { dispose: handle.dispose };
				},
				registerDevice: (args) => store.register(args),
				attachApnsToken: (deviceId, apnsToken) => store.attachApnsToken(deviceId, apnsToken),
				showInformationMessage: (message) => { void vscode.window.showInformationMessage(message); },
			});
		} catch (err) {
			const reason = err instanceof Error ? err.message : String(err);
			void vscode.window.showErrorMessage(`Pair iPad failed: ${reason}`);
		}
	});
}

function registerRevokeCommand(_context: vscode.ExtensionContext, store: PairedDeviceStore): vscode.Disposable {
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
			removeDeviceToken: async (deviceId) => { removeToken(deviceId); },
			remainingDevicesCount: () => store.list().length,
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

	context.subscriptions.push(registerPairCommand(_store, channel, extensionVersion));
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
