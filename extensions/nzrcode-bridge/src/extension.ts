/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { maybeStartBridge, BridgeRuntime } from './bridge';
import type { Logger } from './server/dispatcher';

let _runtime: BridgeRuntime | undefined;

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

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const channel = vscode.window.createOutputChannel('NZRCode Bridge');
	context.subscriptions.push(channel);

	const extensionVersion = (context.extension?.packageJSON as { version?: string } | undefined)?.version ?? '0.0.0';

	_runtime = await maybeStartBridge({
		serverVersion: extensionVersion,
		logger: buildLogger(channel),
	});

	if (_runtime) {
		context.subscriptions.push({ dispose: () => { void _runtime?.stop(); } });
	}
}

export async function deactivate(): Promise<void> {
	if (_runtime) {
		await _runtime.stop();
		_runtime = undefined;
	}
}
