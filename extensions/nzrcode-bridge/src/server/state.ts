/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Persistent bridge state: load/migrate/save/delete ~/.nzrcode/bridge.json.
// Schema v2 (feature 0018) replaces the single shared token from v1 with a
// `tokens: Record<deviceId, string>` map so revoke can target one device
// without forcing every other paired client to re-pair. v1 files are
// migrated by dropping the shared token (paired devices must re-pair).
//
// The file is the authoritative source of truth; the module-level cache is
// a convenience for in-process consumers. Tokens are never logged — pass
// them through redactToken from logging.ts if you must surface one.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Regex matching every valid bridge token (43 base64url chars, no padding). */
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** Directory name that lives inside the home (or NZRCODE_HOME override). */
const STATE_DIR = '.nzrcode';

/** File name inside STATE_DIR. */
const STATE_FILE = 'bridge.json';

/** Current schema version. v1 files are migrated on load. */
const CURRENT_VERSION = 2 as const;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * On-disk shape of the bridge state file (~/.nzrcode/bridge.json, perm 0600).
 * v2 maps each paired deviceId to its own 32-byte base64url token. Empty
 * map means no devices are paired; the bridge accepts new pair attempts
 * via the in-memory pending-pair slot owned by `startPairableBridge`.
 */
export interface BridgeState {
	readonly tokens: Readonly<Record<string, string>>;
	readonly lastPort?: number;
	readonly version: 2;
}

/** Thrown on validation failures (bad JSON, wrong version, bad token). */
export class BridgeStateError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'BridgeStateError';
	}
}

// ---------------------------------------------------------------------------
// Module-level cache
// ---------------------------------------------------------------------------

/** Last state loaded into memory. Cleared by deleteState(). */
let _cached: BridgeState | undefined;

/**
 * Return the last state loaded by loadOrCreateState(), or undefined if no
 * state has been loaded yet in this process. Does NOT read from disk.
 */
export function getCurrentState(): BridgeState | undefined {
	return _cached;
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the state file path. Honors NZRCODE_HOME env override for testing;
 * default is os.homedir(). Always re-evaluates env on each call (not memoized).
 */
export function stateFilePath(): string {
	const base = process.env['NZRCODE_HOME'] ?? os.homedir();
	return path.join(base, STATE_DIR, STATE_FILE);
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function assertValidToken(token: unknown, label: string): asserts token is string {
	if (typeof token !== 'string' || !TOKEN_RE.test(token)) {
		throw new BridgeStateError(
			`Bridge state token (${label}) is invalid: expected 43-char base64url string`,
		);
	}
}

function assertValidTokens(value: unknown): asserts value is Record<string, string> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new BridgeStateError(`Bridge state tokens must be an object`);
	}
	for (const [deviceId, token] of Object.entries(value as Record<string, unknown>)) {
		if (typeof deviceId !== 'string' || deviceId.length === 0) {
			throw new BridgeStateError(`Bridge state tokens has an invalid deviceId key`);
		}
		assertValidToken(token, deviceId);
	}
}

/**
 * Validates `lastPort` if present. Accepts undefined (field is optional);
 * otherwise must be an integer in the TCP user range.
 */
function assertValidLastPort(value: unknown): asserts value is number | undefined {
	if (value === undefined) {
		return;
	}
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 65535) {
		throw new BridgeStateError(
			`Bridge state lastPort is invalid: expected integer in 1..65535, got ${JSON.stringify(value)}`,
		);
	}
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Parse and validate a JSON string into a BridgeState. Accepts v1 inputs by
 * migrating them (drops the shared token, bumps version to 2). Throws
 * BridgeStateError on invalid JSON, unknown version, or bad port.
 */
function parseState(raw: string): BridgeState {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new BridgeStateError(`Bridge state file contains invalid JSON`);
	}

	if (typeof parsed !== 'object' || parsed === null) {
		throw new BridgeStateError(`Bridge state file must be a JSON object`);
	}

	const obj = parsed as Record<string, unknown>;
	const version = obj['version'];
	assertValidLastPort(obj['lastPort']);

	if (version === 1) {
		// Migration: v1 had a single shared token. Drop it; every paired
		// device under v1 must re-pair. lastPort survives.
		return {
			tokens: {},
			version: CURRENT_VERSION,
			...(obj['lastPort'] !== undefined ? { lastPort: obj['lastPort'] as number } : {}),
		};
	}

	if (version !== CURRENT_VERSION) {
		throw new BridgeStateError(
			`Bridge state version is unsupported: expected 1 or 2, got ${JSON.stringify(version)}`,
		);
	}

	assertValidTokens(obj['tokens']);

	return {
		tokens: { ...(obj['tokens'] as Record<string, string>) },
		version: CURRENT_VERSION,
		...(obj['lastPort'] !== undefined ? { lastPort: obj['lastPort'] as number } : {}),
	};
}

/**
 * Load existing state from ~/.nzrcode/bridge.json, or create a fresh one
 * with an empty tokens map. The file is always rewritten with permission
 * 0600 after this call returns — even if the prior file had looser
 * permissions. v1 files are silently migrated to v2 (paired devices must
 * re-pair).
 */
export function loadOrCreateState(): BridgeState {
	const filePath = stateFilePath();
	const dir = path.dirname(filePath);

	fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

	if (!fs.existsSync(filePath)) {
		const fresh: BridgeState = { tokens: {}, version: CURRENT_VERSION };
		writeAtomic(filePath, fresh);
		_cached = fresh;
		return fresh;
	}

	const raw = fs.readFileSync(filePath, 'utf-8');
	const state = parseState(raw);

	// If we migrated, rewrite the file in the new shape.
	if (raw.includes('"version": 1')) {
		writeAtomic(filePath, state);
	}

	// Always re-apply 0600 to fix any permission drift.
	fs.chmodSync(filePath, 0o600);

	_cached = state;
	return state;
}

/**
 * Persist a mutated state. Writes atomically via tmp-rename. Permission
 * is always 0600.
 */
export function saveState(state: BridgeState): void {
	if (state.version !== CURRENT_VERSION) {
		throw new BridgeStateError(`saveState: unsupported version ${state.version}`);
	}
	assertValidTokens(state.tokens);
	assertValidLastPort(state.lastPort);

	const filePath = stateFilePath();
	const dir = path.dirname(filePath);
	fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

	writeAtomic(filePath, state);
	_cached = state;
}

/**
 * Delete the state file. No-op if the file doesn't exist.
 */
export function deleteState(): void {
	const filePath = stateFilePath();
	fs.rmSync(filePath, { force: true });
	_cached = undefined;
}

// ---------------------------------------------------------------------------
// Per-device token helpers
// ---------------------------------------------------------------------------

/**
 * Insert or replace the token for `deviceId`. Persists immediately. If
 * no state has been loaded in this process, runs `loadOrCreateState`
 * first so the call is total.
 */
export function addToken(deviceId: string, token: string): void {
	if (typeof deviceId !== 'string' || deviceId.length === 0) {
		throw new BridgeStateError(`addToken: deviceId must be a non-empty string`);
	}
	assertValidToken(token, deviceId);

	const previous = _cached ?? loadOrCreateState();
	const next: BridgeState = {
		...previous,
		tokens: { ...previous.tokens, [deviceId]: token },
	};
	saveState(next);
}

/**
 * Remove the token for `deviceId`. Returns true if an entry existed,
 * false otherwise (no-op in the false case).
 */
export function removeToken(deviceId: string): boolean {
	const previous = _cached ?? loadOrCreateState();
	if (!(deviceId in previous.tokens)) {
		return false;
	}
	const nextTokens = { ...previous.tokens };
	delete nextTokens[deviceId];
	saveState({ ...previous, tokens: nextTokens });
	return true;
}

/**
 * Return a defensive snapshot of the current tokens map. Mutating the
 * return value never affects on-disk state.
 */
export function getTokens(): Readonly<Record<string, string>> {
	const current = _cached ?? loadOrCreateState();
	return Object.freeze({ ...current.tokens });
}

// ---------------------------------------------------------------------------
// Atomic write helper
// ---------------------------------------------------------------------------

/**
 * Write `state` to `filePath` atomically: write to a tmp sibling, fsync the
 * file descriptor, then rename into place. Chmod to 0600 after rename.
 */
function writeAtomic(filePath: string, state: BridgeState): void {
	const tmp = `${filePath}.tmp`;
	const json = JSON.stringify(state, null, 2) + '\n';

	const fd = fs.openSync(tmp, 'w', 0o600);
	try {
		fs.writeSync(fd, json);
		fs.fsyncSync(fd);
	} finally {
		fs.closeSync(fd);
	}

	fs.renameSync(tmp, filePath);
	fs.chmodSync(filePath, 0o600);
}
