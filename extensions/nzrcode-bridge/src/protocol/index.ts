/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export {
	JsonRpcError,
	JsonRpcErrorResponse,
	JsonRpcId,
	JsonRpcMessage,
	JsonRpcNotification,
	JsonRpcRequest,
	JsonRpcResponse,
	JsonRpcSuccessResponse,
	ParseError,
	isErrorResponse,
	isNotification,
	isRequest,
	isResponse,
	isSuccessResponse,
	parseMessage,
	serializeErrorResponse,
	serializeNotification,
	serializeRequest,
	serializeResponse,
} from './jsonrpc';

export {
	MethodName,
	type MethodParams,
	type MethodResult,
	type EditOperation,
	type TextRange,
	type WorkspaceFolderInfo,
	type TerminalInfo,
	type TaskInfo,
	type DebugVariable,
} from './methods';

export {
	EventName,
	type EventPayload,
} from './events';

export {
	BridgeErrorCode,
	BRIDGE_ERROR_JSONRPC_CODE,
	BRIDGE_ERROR_DEFAULT_MESSAGE,
	bridgeError,
} from './errors';

export {
	QrDecodeError,
	encodeQrPayload,
	decodeQrPayload,
	type EndpointNet,
	type QrEndpoint,
	type QrPayloadV1,
} from './qr';
