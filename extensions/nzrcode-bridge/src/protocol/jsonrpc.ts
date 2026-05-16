/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// JSON-RPC 2.0 envelope types and message framing.
// Specification: https://www.jsonrpc.org/specification

// ─── Error codes ─────────────────────────────────────────────────────────────

const JSONRPC_VERSION = '2.0' as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type JsonRpcId = string | number;

export interface JsonRpcRequest<P = unknown> {
	readonly jsonrpc: '2.0';
	readonly id: JsonRpcId;
	readonly method: string;
	readonly params?: P;
}

export interface JsonRpcNotification<P = unknown> {
	readonly jsonrpc: '2.0';
	readonly method: string;
	readonly params?: P;
}

export interface JsonRpcError {
	readonly code: number;
	readonly message: string;
	readonly data?: unknown;
}

export interface JsonRpcSuccessResponse<R = unknown> {
	readonly jsonrpc: '2.0';
	readonly id: JsonRpcId;
	readonly result: R;
}

export interface JsonRpcErrorResponse {
	readonly jsonrpc: '2.0';
	readonly id: JsonRpcId | null;
	readonly error: JsonRpcError;
}

export type JsonRpcResponse<R = unknown> = JsonRpcSuccessResponse<R> | JsonRpcErrorResponse;
export type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;

// ─── ParseError ──────────────────────────────────────────────────────────────

export class ParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ParseError';
	}
}

// ─── Internal helpers ────────────────────────────────────────────────────────

type RawObject = Record<string, unknown>;

function assertObject(value: unknown, context: string): asserts value is RawObject {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new ParseError(`${context}: expected an object`);
	}
}

function validateVersion(raw: RawObject): void {
	if (raw['jsonrpc'] !== JSONRPC_VERSION) {
		throw new ParseError(`jsonrpc field must be "2.0", got: ${String(raw['jsonrpc'])}`);
	}
}

function validateId(id: unknown): id is JsonRpcId {
	return typeof id === 'string' || typeof id === 'number';
}

function validateErrorShape(error: unknown): error is JsonRpcError {
	if (error === null || typeof error !== 'object' || Array.isArray(error)) {
		return false;
	}
	const e = error as RawObject;
	return typeof e['code'] === 'number' && typeof e['message'] === 'string';
}

// ─── parseMessage helpers ────────────────────────────────────────────────────

function parseResponse(obj: RawObject): JsonRpcResponse {
	const hasResult = 'result' in obj;
	const hasError = 'error' in obj;

	if (hasResult && hasError) {
		throw new ParseError('A response must not contain both "result" and "error"');
	}

	const id = obj['id'];
	if (id !== null && !validateId(id)) {
		throw new ParseError(`Response id must be a string, number, or null`);
	}

	if (hasError) {
		if (!validateErrorShape(obj['error'])) {
			throw new ParseError('"error" field must have numeric "code" and string "message"');
		}
		const response: JsonRpcErrorResponse = {
			jsonrpc: JSONRPC_VERSION,
			id: (id as JsonRpcId | null) ?? null,
			error: obj['error'] as JsonRpcError,
		};
		return response;
	}

	const response: JsonRpcSuccessResponse = {
		jsonrpc: JSONRPC_VERSION,
		id: id as JsonRpcId,
		result: obj['result'],
	};
	return response;
}

function parseRequestOrNotification(obj: RawObject): JsonRpcRequest | JsonRpcNotification {
	if (typeof obj['method'] !== 'string') {
		throw new ParseError('Message must have a string "method" field or be a valid response');
	}

	if ('id' in obj) {
		const id = obj['id'];
		if (!validateId(id)) {
			throw new ParseError(`Request id must be a string or number`);
		}
		const request: JsonRpcRequest = {
			jsonrpc: JSONRPC_VERSION,
			id: id,
			method: obj['method'],
			...(obj['params'] !== undefined ? { params: obj['params'] } : {}),
		};
		return request;
	}

	const notification: JsonRpcNotification = {
		jsonrpc: JSONRPC_VERSION,
		method: obj['method'],
		...(obj['params'] !== undefined ? { params: obj['params'] } : {}),
	};
	return notification;
}

// ─── parseMessage ────────────────────────────────────────────────────────────

export function parseMessage(raw: string): JsonRpcMessage {
	if (raw.trim() === '') {
		throw new ParseError('Cannot parse empty string');
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new ParseError(`Invalid JSON: ${raw}`);
	}

	assertObject(parsed, 'message');
	validateVersion(parsed);

	if ('result' in parsed || 'error' in parsed) {
		return parseResponse(parsed);
	}

	return parseRequestOrNotification(parsed);
}

// ─── Serializers ─────────────────────────────────────────────────────────────

export function serializeRequest<P>(id: JsonRpcId, method: string, params?: P): string {
	const msg: JsonRpcRequest<P> = {
		jsonrpc: JSONRPC_VERSION,
		id,
		method,
		...(params !== undefined ? { params } : {}),
	};
	return JSON.stringify(msg);
}

export function serializeNotification<P>(method: string, params?: P): string {
	const msg: JsonRpcNotification<P> = {
		jsonrpc: JSONRPC_VERSION,
		method,
		...(params !== undefined ? { params } : {}),
	};
	return JSON.stringify(msg);
}

export function serializeResponse<R>(id: JsonRpcId, result: R): string {
	const msg: JsonRpcSuccessResponse<R> = {
		jsonrpc: JSONRPC_VERSION,
		id,
		result,
	};
	return JSON.stringify(msg);
}

export function serializeErrorResponse(id: JsonRpcId | null, error: JsonRpcError): string {
	const msg: JsonRpcErrorResponse = {
		jsonrpc: JSONRPC_VERSION,
		id,
		error,
	};
	return JSON.stringify(msg);
}

// ─── Type guards ─────────────────────────────────────────────────────────────

export function isRequest(m: JsonRpcMessage): m is JsonRpcRequest {
	return 'method' in m && 'id' in m;
}

export function isNotification(m: JsonRpcMessage): m is JsonRpcNotification {
	return 'method' in m && !('id' in m);
}

export function isResponse(m: JsonRpcMessage): m is JsonRpcResponse {
	return 'result' in m || 'error' in m;
}

export function isSuccessResponse(m: JsonRpcResponse): m is JsonRpcSuccessResponse {
	return 'result' in m;
}

export function isErrorResponse(m: JsonRpcResponse): m is JsonRpcErrorResponse {
	return 'error' in m;
}
