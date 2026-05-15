/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import {
	QrDecodeError,
	encodeQrPayload,
	decodeQrPayload,
	type QrPayloadV1,
} from '../../../protocol/qr';

// A valid 43-char base64url token used throughout tests.
const VALID_TOKEN = 'A'.repeat(43);

// A valid minimal payload with one endpoint.
const VALID_PAYLOAD: QrPayloadV1 = {
	v: 1,
	token: VALID_TOKEN,
	endpoints: [{ host: '192.168.1.10', port: 8443, net: 'lan' }],
};

suite('QR payload codec', () => {
	// ── encodeQrPayload ────────────────────────────────────────────────────────

	test('encodeQrPayload returns minified JSON parseable back to the same shape (round-trip shape)', () => {
		const raw = encodeQrPayload(VALID_PAYLOAD);
		// Must be minified — no spaces
		assert.ok(!raw.includes(' '), 'encoded string should contain no spaces');
		const parsed = JSON.parse(raw);
		assert.equal(parsed.v, 1);
		assert.equal(parsed.token, VALID_TOKEN);
		assert.equal(parsed.endpoints.length, 1);
		assert.equal(parsed.endpoints[0].host, '192.168.1.10');
		assert.equal(parsed.endpoints[0].port, 8443);
		assert.equal(parsed.endpoints[0].net, 'lan');
	});

	// ── decodeQrPayload — valid inputs ─────────────────────────────────────────

	test('decodeQrPayload accepts a valid minimal payload (1 endpoint)', () => {
		const raw = JSON.stringify({ v: 1, token: VALID_TOKEN, endpoints: [{ host: '10.0.0.1', port: 9000, net: 'lan' }] });
		const result = decodeQrPayload(raw);
		assert.equal(result.v, 1);
		assert.equal(result.token, VALID_TOKEN);
		assert.equal(result.endpoints.length, 1);
		assert.equal(result.endpoints[0].net, 'lan');
	});

	test('decodeQrPayload accepts a payload with 3 endpoints (one of each net type)', () => {
		const raw = JSON.stringify({
			v: 1,
			token: VALID_TOKEN,
			endpoints: [
				{ host: '192.168.0.5', port: 8080, net: 'lan' },
				{ host: '100.64.1.2', port: 8080, net: 'tailscale' },
				{ host: 'mydevice.local', port: 8080, net: 'mdns' },
			],
		});
		const result = decodeQrPayload(raw);
		assert.equal(result.endpoints.length, 3);
		assert.equal(result.endpoints[0].net, 'lan');
		assert.equal(result.endpoints[1].net, 'tailscale');
		assert.equal(result.endpoints[2].net, 'mdns');
	});

	// ── decodeQrPayload — JSON parse failures ──────────────────────────────────

	test('decodeQrPayload throws QrDecodeError on raw that is not valid JSON', () => {
		assert.throws(
			() => decodeQrPayload('not json at all'),
			(err: unknown) => {
				assert.ok(err instanceof QrDecodeError);
				assert.match(err.message, /not valid JSON/);
				return true;
			},
		);
	});

	// ── decodeQrPayload — version field ───────────────────────────────────────

	test('decodeQrPayload throws when v is 0 (wrong version number)', () => {
		const raw = JSON.stringify({ v: 0, token: VALID_TOKEN, endpoints: [{ host: 'h', port: 1, net: 'lan' }] });
		assert.throws(
			() => decodeQrPayload(raw),
			(err: unknown) => {
				assert.ok(err instanceof QrDecodeError);
				assert.match(err.message, /version mismatch/);
				return true;
			},
		);
	});

	test('decodeQrPayload throws when v is "1" (string instead of number)', () => {
		const raw = JSON.stringify({ v: '1', token: VALID_TOKEN, endpoints: [{ host: 'h', port: 1, net: 'lan' }] });
		assert.throws(
			() => decodeQrPayload(raw),
			(err: unknown) => {
				assert.ok(err instanceof QrDecodeError);
				assert.match(err.message, /version mismatch/);
				return true;
			},
		);
	});

	// ── decodeQrPayload — token field ─────────────────────────────────────────

	test('decodeQrPayload throws when token is missing', () => {
		const raw = JSON.stringify({ v: 1, endpoints: [{ host: 'h', port: 1, net: 'lan' }] });
		assert.throws(
			() => decodeQrPayload(raw),
			(err: unknown) => {
				assert.ok(err instanceof QrDecodeError);
				assert.match(err.message, /token/);
				return true;
			},
		);
	});

	test('decodeQrPayload throws when token is 42 chars (too short)', () => {
		const raw = JSON.stringify({ v: 1, token: 'A'.repeat(42), endpoints: [{ host: 'h', port: 1, net: 'lan' }] });
		assert.throws(
			() => decodeQrPayload(raw),
			(err: unknown) => {
				assert.ok(err instanceof QrDecodeError);
				assert.match(err.message, /token/);
				return true;
			},
		);
	});

	test('decodeQrPayload throws when token is 44 chars (too long)', () => {
		const raw = JSON.stringify({ v: 1, token: 'A'.repeat(44), endpoints: [{ host: 'h', port: 1, net: 'lan' }] });
		assert.throws(
			() => decodeQrPayload(raw),
			(err: unknown) => {
				assert.ok(err instanceof QrDecodeError);
				assert.match(err.message, /token/);
				return true;
			},
		);
	});

	test('decodeQrPayload throws when token contains invalid char "+" (not base64url)', () => {
		// Replace last char with '+' which is base64 but not base64url
		const raw = JSON.stringify({ v: 1, token: 'A'.repeat(42) + '+', endpoints: [{ host: 'h', port: 1, net: 'lan' }] });
		assert.throws(
			() => decodeQrPayload(raw),
			(err: unknown) => {
				assert.ok(err instanceof QrDecodeError);
				assert.match(err.message, /token/);
				return true;
			},
		);
	});

	// ── decodeQrPayload — endpoints field ─────────────────────────────────────

	test('decodeQrPayload throws when endpoints is missing', () => {
		const raw = JSON.stringify({ v: 1, token: VALID_TOKEN });
		assert.throws(
			() => decodeQrPayload(raw),
			(err: unknown) => {
				assert.ok(err instanceof QrDecodeError);
				assert.match(err.message, /endpoints/);
				return true;
			},
		);
	});

	test('decodeQrPayload throws when endpoints is an empty array', () => {
		const raw = JSON.stringify({ v: 1, token: VALID_TOKEN, endpoints: [] });
		assert.throws(
			() => decodeQrPayload(raw),
			(err: unknown) => {
				assert.ok(err instanceof QrDecodeError);
				assert.match(err.message, /endpoints/);
				return true;
			},
		);
	});

	// ── decodeQrPayload — endpoint port validation ────────────────────────────

	test('decodeQrPayload throws when endpoint port is 0 (below minimum)', () => {
		const raw = JSON.stringify({ v: 1, token: VALID_TOKEN, endpoints: [{ host: 'h', port: 0, net: 'lan' }] });
		assert.throws(
			() => decodeQrPayload(raw),
			(err: unknown) => {
				assert.ok(err instanceof QrDecodeError);
				assert.match(err.message, /port/);
				return true;
			},
		);
	});

	test('decodeQrPayload throws when endpoint port is 65536 (above maximum)', () => {
		const raw = JSON.stringify({ v: 1, token: VALID_TOKEN, endpoints: [{ host: 'h', port: 65536, net: 'lan' }] });
		assert.throws(
			() => decodeQrPayload(raw),
			(err: unknown) => {
				assert.ok(err instanceof QrDecodeError);
				assert.match(err.message, /port/);
				return true;
			},
		);
	});

	test('decodeQrPayload throws when endpoint port is 8080.5 (non-integer)', () => {
		const raw = JSON.stringify({ v: 1, token: VALID_TOKEN, endpoints: [{ host: 'h', port: 8080.5, net: 'lan' }] });
		assert.throws(
			() => decodeQrPayload(raw),
			(err: unknown) => {
				assert.ok(err instanceof QrDecodeError);
				assert.match(err.message, /port/);
				return true;
			},
		);
	});

	// ── decodeQrPayload — endpoint net validation ─────────────────────────────

	test('decodeQrPayload throws when endpoint net is "wifi" (not in enum)', () => {
		const raw = JSON.stringify({ v: 1, token: VALID_TOKEN, endpoints: [{ host: 'h', port: 80, net: 'wifi' }] });
		assert.throws(
			() => decodeQrPayload(raw),
			(err: unknown) => {
				assert.ok(err instanceof QrDecodeError);
				assert.match(err.message, /net/);
				return true;
			},
		);
	});

	// ── decodeQrPayload — endpoint host validation ────────────────────────────

	test('decodeQrPayload throws when endpoint host is empty string', () => {
		const raw = JSON.stringify({ v: 1, token: VALID_TOKEN, endpoints: [{ host: '', port: 80, net: 'lan' }] });
		assert.throws(
			() => decodeQrPayload(raw),
			(err: unknown) => {
				assert.ok(err instanceof QrDecodeError);
				assert.match(err.message, /host/);
				return true;
			},
		);
	});

	test('decodeQrPayload throws when endpoint is not a plain object (null)', () => {
		const raw = JSON.stringify({ v: 1, token: VALID_TOKEN, endpoints: [null] });
		assert.throws(
			() => decodeQrPayload(raw),
			(err: unknown) => {
				assert.ok(err instanceof QrDecodeError);
				assert.match(err.message, /endpoint must be a plain object/);
				return true;
			},
		);
	});

	test('decodeQrPayload throws when endpoint is not a plain object (array)', () => {
		const raw = JSON.stringify({ v: 1, token: VALID_TOKEN, endpoints: [['192.168.1.1', 8080, 'lan']] });
		assert.throws(
			() => decodeQrPayload(raw),
			(err: unknown) => {
				assert.ok(err instanceof QrDecodeError);
				assert.match(err.message, /endpoint must be a plain object/);
				return true;
			},
		);
	});

	// ── Round-trip ────────────────────────────────────────────────────────────

	test('round-trip: decodeQrPayload(encodeQrPayload(p)) returns deep-equal p', () => {
		const p: QrPayloadV1 = {
			v: 1,
			token: VALID_TOKEN,
			endpoints: [
				{ host: '192.168.1.100', port: 8443, net: 'lan' },
				{ host: '100.64.0.1', port: 8443, net: 'tailscale' },
			],
		};
		const result = decodeQrPayload(encodeQrPayload(p));
		assert.deepEqual(result, p);
	});
});
