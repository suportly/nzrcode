/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Bridge-specific error codes — typed catalog for every failure the bridge can return.
// Consumed by RPC handlers and the dispatcher for auth/parse failures.

import type { JsonRpcError } from './jsonrpc';

// ─── Error code enum ──────────────────────────────────────────────────────────

// Bridge-specific error codes — stable strings that clients can switch on.
// Maps to JSON-RPC error code range -32000..-32099 (Server error range, application-defined per spec).
export const enum BridgeErrorCode {
	CommandNotFound = 'command_not_found',
	NoActiveEditor = 'no_active_editor',
	PayloadTooLarge = 'payload_too_large',
	ClientTooSlow = 'client_too_slow',
	AuthFailure = 'auth_failure',
	PathOutsideWorkspace = 'path_outside_workspace',
	RelayUnavailable = 'relay_unavailable',
	InternalError = 'internal_error',
}

// ─── Numeric code table ───────────────────────────────────────────────────────

// JSON-RPC numeric codes for each bridge error.
// JSON-RPC reserves -32000..-32099 for application-defined server errors.
// Values are spaced so new errors can slot in without renumbering.
export const BRIDGE_ERROR_JSONRPC_CODE: Readonly<Record<BridgeErrorCode, number>> = {
	[BridgeErrorCode.AuthFailure]: -32001,
	[BridgeErrorCode.CommandNotFound]: -32010,
	[BridgeErrorCode.NoActiveEditor]: -32011,
	[BridgeErrorCode.PayloadTooLarge]: -32020,
	[BridgeErrorCode.ClientTooSlow]: -32021,
	[BridgeErrorCode.PathOutsideWorkspace]: -32030,
	[BridgeErrorCode.RelayUnavailable]: -32040,
	[BridgeErrorCode.InternalError]: -32000,
};

// ─── Default messages ─────────────────────────────────────────────────────────

export const BRIDGE_ERROR_DEFAULT_MESSAGE: Readonly<Record<BridgeErrorCode, string>> = {
	[BridgeErrorCode.AuthFailure]: 'Authentication failed.',
	[BridgeErrorCode.CommandNotFound]: 'Command not found.',
	[BridgeErrorCode.NoActiveEditor]: 'No active text editor.',
	[BridgeErrorCode.PayloadTooLarge]: 'Payload exceeds the maximum allowed size.',
	[BridgeErrorCode.ClientTooSlow]: 'Client is not consuming events fast enough; backlog exceeded.',
	[BridgeErrorCode.PathOutsideWorkspace]: 'Path is outside the workspace folders.',
	[BridgeErrorCode.RelayUnavailable]: 'Push relay service is unavailable.',
	[BridgeErrorCode.InternalError]: 'Internal error.',
};

// ─── Factory ──────────────────────────────────────────────────────────────────

// Opts-style overload: allows overriding message and/or passing data.
export function bridgeError(code: BridgeErrorCode, opts: { message?: string; data?: unknown }): JsonRpcError;
// Data-only shorthand: pass any object directly as extra data.
export function bridgeError(code: BridgeErrorCode, data?: unknown): JsonRpcError;
export function bridgeError(
	code: BridgeErrorCode,
	dataOrOpts?: unknown,
): JsonRpcError {
	let message = BRIDGE_ERROR_DEFAULT_MESSAGE[code];
	let extraData: Record<string, unknown> | undefined;

	if (dataOrOpts !== undefined && typeof dataOrOpts === 'object' && dataOrOpts !== null) {
		const candidate = dataOrOpts as Record<string, unknown>;
		// Detect the opts shape: only treat as opts when it has a `message` or `data` key
		// and no other unexpected keys (i.e. it looks like { message?, data? }).
		const keys = Object.keys(candidate);
		const isOpts =
			keys.length > 0 &&
			keys.every(k => k === 'message' || k === 'data') &&
			(keys.includes('message') || keys.includes('data'));

		if (isOpts) {
			if (typeof candidate['message'] === 'string') {
				message = candidate['message'];
			}
			if (candidate['data'] !== undefined) {
				const inner = candidate['data'];
				extraData =
					inner !== null && typeof inner === 'object' && !Array.isArray(inner)
						? (inner as Record<string, unknown>)
						: { value: inner };
			}
		} else {
			extraData = candidate;
		}
	} else if (dataOrOpts !== undefined) {
		extraData = { value: dataOrOpts };
	}

	// Canonical bridgeCode wins: spread extraData first so it cannot overwrite our value.
	const data: Record<string, unknown> = { ...extraData, bridgeCode: code };

	return {
		code: BRIDGE_ERROR_JSONRPC_CODE[code],
		message,
		data,
	};
}
