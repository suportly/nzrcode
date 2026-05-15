/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// QR pairing payload v1 — typed encoder/decoder for the JSON blob the desktop
// bridge embeds in the QR code shown during `nzrcode: Pair iPad`.

/** Network type for an endpoint advertised in the QR code. */
export type EndpointNet = 'lan' | 'tailscale' | 'mdns';

export interface QrEndpoint {
	readonly host: string;
	readonly port: number; // 1..65535
	readonly net: EndpointNet;
}

export interface QrPayloadV1 {
	readonly v: 1;
	readonly token: string; // base64url, 43 chars, matches /^[A-Za-z0-9_-]{43}$/
	readonly endpoints: readonly QrEndpoint[]; // length >= 1
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Required length of the base64url token embedded in every QR payload. */
const TOKEN_LENGTH = 43;

/** Maximum valid TCP/UDP port number. */
const MAX_PORT = 65535;

/** Regex that a valid base64url token must fully match. */
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** The set of valid network type strings. */
const VALID_NETS: ReadonlySet<string> = new Set<EndpointNet>(['lan', 'tailscale', 'mdns']);

// ─── Error class ──────────────────────────────────────────────────────────────

export class QrDecodeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'QrDecodeError';
	}
}

// ─── Encoder ──────────────────────────────────────────────────────────────────

/**
 * Encode a QrPayloadV1 as minified JSON. Field order is fixed (v → token →
 * endpoints) so QR ECC level stays consistent across payloads.
 * The producer is the bridge itself; input is trusted and not re-validated.
 */
export function encodeQrPayload(p: QrPayloadV1): string {
	const obj = {
		v: p.v,
		token: p.token,
		endpoints: p.endpoints.map(e => ({ host: e.host, port: e.port, net: e.net })),
	};
	return JSON.stringify(obj);
}

// ─── Decoder ──────────────────────────────────────────────────────────────────

/**
 * Validate and decode a raw QR string into a typed QrPayloadV1.
 * Throws QrDecodeError with a specific message for every constraint violation.
 */
export function decodeQrPayload(raw: string): QrPayloadV1 {
	let obj: unknown;
	try {
		obj = JSON.parse(raw);
	} catch (e) {
		throw new QrDecodeError(`qr payload is not valid JSON: ${(e as Error).message}`);
	}

	if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
		throw new QrDecodeError('qr payload must be a plain object');
	}

	const record = obj as Record<string, unknown>;

	if (record['v'] !== 1) {
		throw new QrDecodeError(`qr payload version mismatch: expected 1, got ${JSON.stringify(record['v'])}`);
	}

	if (typeof record['token'] !== 'string' || !TOKEN_RE.test(record['token'])) {
		throw new QrDecodeError(`qr payload token is not ${TOKEN_LENGTH}-char base64url`);
	}

	if (!Array.isArray(record['endpoints']) || record['endpoints'].length < 1) {
		throw new QrDecodeError('qr payload endpoints must be a non-empty array');
	}

	const endpoints: QrEndpoint[] = record['endpoints'].map((ep, i) => decodeEndpoint(ep, i));

	return { v: 1, token: record['token'], endpoints };
}

// ─── Endpoint helper ──────────────────────────────────────────────────────────

function decodeEndpoint(ep: unknown, index: number): QrEndpoint {
	if (ep === null || typeof ep !== 'object' || Array.isArray(ep)) {
		throw new QrDecodeError(`qr endpoint must be a plain object (index ${index})`);
	}

	const r = ep as Record<string, unknown>;

	if (typeof r['host'] !== 'string' || r['host'].length === 0) {
		throw new QrDecodeError(`qr endpoint host must be a non-empty string (index ${index})`);
	}

	const port = r['port'];
	if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > MAX_PORT) {
		throw new QrDecodeError(`qr endpoint port must be an integer in 1..${MAX_PORT} (index ${index})`);
	}

	if (typeof r['net'] !== 'string' || !VALID_NETS.has(r['net'])) {
		throw new QrDecodeError(`qr endpoint net must be one of lan, tailscale, mdns (index ${index})`);
	}

	return { host: r['host'], port, net: r['net'] as EndpointNet };
}
