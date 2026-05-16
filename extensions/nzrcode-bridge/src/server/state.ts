/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Persistent bridge state: load/create/save/delete ~/.nzrcode/bridge.json.
// The file is the authoritative source of truth; the module-level cache is a
// convenience for in-process consumers. The auth token is NEVER logged — pass
// it through redactToken from logging.ts if you must surface it in a message.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateToken } from './auth';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Regex matching every valid bridge token (43 base64url chars, no padding). */
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** Directory name that lives inside the home (or NZRCODE_HOME override). */
const STATE_DIR = '.nzrcode';

/** File name inside STATE_DIR. */
const STATE_FILE = 'bridge.json';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * On-disk shape of the bridge state file (~/.nzrcode/bridge.json, perm 0600).
 * Token is regenerated only on `nzrcode: Revoke iPad` or if the file is
 * manually deleted (cl-2: no auto-rotation in MVP).
 */
export interface BridgeState {
	readonly token: string;
	readonly lastPort?: number;
	readonly version: 1;
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

function assertValidToken(token: unknown): asserts token is string {
	if (typeof token !== 'string' || !TOKEN_RE.test(token)) {
		throw new BridgeStateError(
			`Bridge state token is invalid: expected 43-char base64url string`,
		);
	}
}

function assertVersion1(version: unknown): asserts version is 1 {
	if (version !== 1) {
		throw new BridgeStateError(
			`Bridge state version is unsupported: expected 1, got ${JSON.stringify(version)}`,
		);
	}
}

/**
 * Validates `lastPort` if present. Accepts undefined (field is optional);
 * otherwise must be an integer in the TCP user range. Mirrors the port
 * validation in protocol/qr.ts so the two contracts can't drift.
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
 * Parse and validate a JSON string into a BridgeState.
 * Throws BridgeStateError on invalid JSON, wrong version, bad token, or bad port.
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
	assertVersion1(obj['version']);
	assertValidToken(obj['token']);
	assertValidLastPort(obj['lastPort']);

	return {
		token: obj['token'] as string,
		version: 1,
		...(obj['lastPort'] !== undefined ? { lastPort: obj['lastPort'] as number } : {}),
	};
}

/**
 * Load existing state from ~/.nzrcode/bridge.json, or create a fresh one
 * with a freshly generated token. The file is always rewritten with
 * permission 0600 after this call returns — even if the prior file had
 * looser permissions (e.g. 0644 from a previous bug).
 *
 * Honors NZRCODE_HOME env override for testing; default is os.homedir().
 *
 * Returns the in-memory state. Throws BridgeStateError if the file exists
 * with bad JSON or with version != 1 — caller decides whether to delete and retry.
 */
export function loadOrCreateState(): BridgeState {
	const filePath = stateFilePath();
	const dir = path.dirname(filePath);

	fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

	if (!fs.existsSync(filePath)) {
		const fresh: BridgeState = { token: generateToken(), version: 1 };
		writeAtomic(filePath, fresh);
		_cached = fresh;
		return fresh;
	}

	const raw = fs.readFileSync(filePath, 'utf-8');
	const state = parseState(raw);

	// Always re-apply 0600 to fix any permission drift.
	fs.chmodSync(filePath, 0o600);

	_cached = state;
	return state;
}

/**
 * Persist a mutated state (e.g. lastPort just changed). Writes atomically
 * via tmp-rename. Permission is always 0600.
 */
export function saveState(state: BridgeState): void {
	assertVersion1(state.version);
	assertValidToken(state.token);
	assertValidLastPort(state.lastPort);

	const filePath = stateFilePath();
	const dir = path.dirname(filePath);
	fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

	writeAtomic(filePath, state);
	_cached = state;
}

/**
 * Delete the state file (used by `nzrcode: Revoke iPad` after revoking
 * paired devices). No-op if the file doesn't exist.
 */
export function deleteState(): void {
	const filePath = stateFilePath();
	fs.rmSync(filePath, { force: true });
	_cached = undefined;
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
