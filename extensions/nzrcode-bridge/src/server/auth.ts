/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Bridge token generation and constant-time validation.
// Tokens are 32 random bytes encoded as base64url (43 chars, no padding).
// All secret comparisons MUST go through crypto.timingSafeEqual to prevent
// timing-side-channel leakage of the stored token value.

import * as crypto from 'crypto';

/** Number of raw random bytes in every bridge token. */
const TOKEN_BYTE_LENGTH = 32;

/** Expected length of the base64url-encoded token string (no padding). */
const TOKEN_STRING_LENGTH = 43;

/** Regex that every valid token must fully match. */
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/**
 * Generate a fresh bridge token: 32 random bytes encoded as base64url
 * (43 chars; no padding). The encoding matches QR payload v1 token regex
 * /^[A-Za-z0-9_-]{43}$/ from protocol/qr.ts.
 */
export function generateToken(): string {
	return crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('base64url');
}

/**
 * Constant-time comparison of a stored token against a candidate string.
 * Returns true only on exact match. Returns false (no throw) for malformed
 * inputs: wrong length, invalid base64url chars, decode failure.
 *
 * Uses `crypto.timingSafeEqual` on the raw byte buffers to defeat
 * timing-side-channel inference of the stored token.
 */
export function validateToken(stored: string, candidate: string): boolean {
	// Length check first: both must be exactly TOKEN_STRING_LENGTH chars.
	// This early return is safe because lengths are public information —
	// the protocol mandates exactly 43 chars, so any other length is invalid.
	if (stored.length !== TOKEN_STRING_LENGTH || candidate.length !== TOKEN_STRING_LENGTH) {
		return false;
	}

	// Reject any chars outside the base64url alphabet before decoding.
	// Buffer.from with 'base64url' silently drops unknown chars on some Node
	// versions, which would produce a shorter buffer and defeat timingSafeEqual.
	if (!TOKEN_RE.test(stored) || !TOKEN_RE.test(candidate)) {
		return false;
	}

	let storedBuf: Buffer;
	let candidateBuf: Buffer;
	try {
		storedBuf = Buffer.from(stored, 'base64url');
		candidateBuf = Buffer.from(candidate, 'base64url');
	} catch {
		// Decoding failures on malformed input: return false without leaking.
		return false;
	}

	// Defensive: both should be TOKEN_BYTE_LENGTH bytes after decoding 43 base64url chars.
	if (storedBuf.length !== TOKEN_BYTE_LENGTH || candidateBuf.length !== TOKEN_BYTE_LENGTH) {
		return false;
	}

	// Constant-time byte-for-byte comparison. Do NOT use === or == on the
	// strings — that leaks timing information about the stored token.
	return crypto.timingSafeEqual(storedBuf, candidateBuf);
}
