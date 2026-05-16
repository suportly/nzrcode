/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Log-redaction utilities for the nzrcode bridge.
// Strip tokens, passwords, and binary content from any value before it is
// serialized to a log sink. Call redactForLogging(params) on every JSON-RPC
// request/response payload prior to logging.

import * as crypto from 'crypto';

/** Number of leading hex chars of the SHA-256 digest exposed by redactContent. */
const SHA256_PREFIX_LENGTH = 6;

/** Maximum number of visible chars in a redacted token before the ellipsis. */
const TOKEN_VISIBLE_PREFIX = 8;

// ---------------------------------------------------------------------------
// Sensitive key registry
// ---------------------------------------------------------------------------

/**
 * Exact key names (case-insensitive) whose values are redacted.
 * Add new entries here when a new namespace introduces a secret field.
 */
export const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
	'token',
	'apnstoken',
	'authtoken',
	'bridgetoken',
	'secret',
	'password',
	'apikey',
]);

// ---------------------------------------------------------------------------
// redactToken
// ---------------------------------------------------------------------------

/**
 * Truncate a secret-like string for safe logging.
 * Returns the first 8 chars followed by '…'. For strings <= 8 chars,
 * returns '…' (no echo — they could BE the entire secret).
 * Empty string is a special case: returns ''.
 */
export function redactToken(value: string): string {
	if (value.length === 0) {
		return '';
	}
	if (value.length <= TOKEN_VISIBLE_PREFIX) {
		return '…';
	}
	return value.slice(0, TOKEN_VISIBLE_PREFIX) + '…';
}

// ---------------------------------------------------------------------------
// redactContent
// ---------------------------------------------------------------------------

/**
 * Summarize a binary buffer (file contents) for safe logging.
 * Returns metadata only: byte count and a 6-hex-char prefix of the SHA-256
 * hash. The content itself never appears in the result.
 */
export function redactContent(content: Buffer | Uint8Array | string): {
	readonly bytes: number;
	readonly sha256Prefix: string;
} {
	let buf: Buffer;
	if (typeof content === 'string') {
		buf = Buffer.from(content, 'utf-8');
	} else if (Buffer.isBuffer(content)) {
		buf = content;
	} else {
		buf = Buffer.from(content);
	}

	const sha256Prefix = crypto.createHash('sha256').update(buf).digest('hex').slice(0, SHA256_PREFIX_LENGTH);
	return { bytes: buf.length, sha256Prefix };
}

// ---------------------------------------------------------------------------
// redactForLogging helpers
// ---------------------------------------------------------------------------

/** Returns true iff `value` is a plain object (Object or null-prototype). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object') {
		return false;
	}
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

// ---------------------------------------------------------------------------
// redactForLogging
// ---------------------------------------------------------------------------

/**
 * Recursively redact a value-tree for logging. Fields whose key matches
 * SENSITIVE_KEYS (case-insensitive) have their values replaced via
 * redactToken (if string) or '[redacted]' (otherwise). Arrays and plain
 * objects are recursed; class instances, functions, and other non-plain
 * types become '[non-serializable]'.
 *
 * Cycles are tolerated: any object already visited on the current path
 * collapses to '[circular]' instead of recursing forever.
 */
export function redactForLogging(value: unknown): unknown {
	return redactInner(value, new WeakSet<object>());
}

function redactInner(value: unknown, seen: WeakSet<object>): unknown {
	if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
		// primitives and null pass through
		return value;
	}

	if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
		return redactContent(value);
	}

	// Cycle guard: once we've seen this object on our path, stop.
	if (seen.has(value as object)) {
		return '[circular]';
	}
	seen.add(value as object);

	if (Array.isArray(value)) {
		return value.map(v => redactInner(v, seen));
	}

	if (isPlainObject(value)) {
		const result: Record<string, unknown> = {};
		for (const key of Object.keys(value)) {
			if (SENSITIVE_KEYS.has(key.toLowerCase())) {
				const raw = value[key];
				result[key] = typeof raw === 'string' ? redactToken(raw) : '[redacted]';
			} else {
				result[key] = redactInner(value[key], seen);
			}
		}
		return result;
	}

	// class instance, Date, RegExp, Map, Set, function, etc.
	return '[non-serializable]';
}

// ---------------------------------------------------------------------------
// logRequest
// ---------------------------------------------------------------------------

/**
 * Convenience: serialize a log line for an incoming JSON-RPC request,
 * with token-like fields auto-redacted via redactForLogging.
 *
 * Returned shape (stable key order for grep predictability):
 *   { method, paramsRedacted, remoteAddress? }
 */
export function logRequest(req: {
	readonly method: string;
	readonly params?: unknown;
	readonly remoteAddress?: string;
}): { readonly method: string; readonly paramsRedacted: unknown; readonly remoteAddress?: string } {
	return {
		method: req.method,
		paramsRedacted: redactForLogging(req.params),
		remoteAddress: req.remoteAddress,
	};
}
