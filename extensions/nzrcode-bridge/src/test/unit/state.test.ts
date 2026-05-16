/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
	loadOrCreateState,
	saveState,
	deleteState,
	stateFilePath,
	BridgeStateError,
} from '../../server/state';

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

let tmpHome: string;

suite('Bridge state', () => {
	setup(() => {
		tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'nzrcode-state-test-'));
		process.env['NZRCODE_HOME'] = tmpHome;
	});

	teardown(() => {
		delete process.env['NZRCODE_HOME'];
		fs.rmSync(tmpHome, { recursive: true, force: true });
	});

	// 1. stateFilePath() honors NZRCODE_HOME
	test('stateFilePath() returns a path under NZRCODE_HOME when env var is set', () => {
		const p = stateFilePath();
		assert.ok(p.startsWith(tmpHome), `Expected path under ${tmpHome}, got ${p}`);
		assert.ok(p.endsWith('bridge.json'), `Expected path ending in bridge.json, got ${p}`);
	});

	// 2. loadOrCreateState() creates the file when missing
	test('loadOrCreateState() creates state file with version:1, 43-char token, lastPort undefined', () => {
		const state = loadOrCreateState();
		assert.equal(state.version, 1);
		assert.ok(TOKEN_RE.test(state.token), `Token "${state.token}" does not match regex`);
		assert.equal(state.lastPort, undefined);
		assert.ok(fs.existsSync(stateFilePath()), 'State file should exist after loadOrCreateState');
	});

	// 3. Created file has permission 0o600
	test('created state file has permission 0o600', () => {
		if (process.platform === 'win32') {
			return; // Windows permissions differ — skip
		}
		loadOrCreateState();
		const stat = fs.statSync(stateFilePath());
		const mode = stat.mode & 0o777;
		assert.equal(mode, 0o600, `Expected 0o600 but got 0o${mode.toString(8)}`);
	});

	// 4. loadOrCreateState() called twice returns deep-equal state (same token)
	test('loadOrCreateState() called twice returns deep-equal state', () => {
		const first = loadOrCreateState();
		const second = loadOrCreateState();
		assert.deepEqual(first, second);
	});

	// 5. After chmod to 0o644, next loadOrCreateState() re-applies 0o600
	test('loadOrCreateState() re-applies 0o600 after permission drift to 0o644', () => {
		if (process.platform === 'win32') {
			return; // Windows permissions differ — skip
		}
		loadOrCreateState();
		const p = stateFilePath();
		fs.chmodSync(p, 0o644);
		// Verify drift occurred
		assert.equal(fs.statSync(p).mode & 0o777, 0o644, 'Pre-condition: should be 0o644');
		loadOrCreateState();
		const mode = fs.statSync(p).mode & 0o777;
		assert.equal(mode, 0o600, `Expected 0o600 after re-apply, got 0o${mode.toString(8)}`);
	});

	// 6. Throws BridgeStateError when file has invalid JSON
	test('loadOrCreateState() throws BridgeStateError when file exists but JSON is invalid', () => {
		const p = stateFilePath();
		fs.mkdirSync(path.dirname(p), { recursive: true });
		fs.writeFileSync(p, 'not-valid-json', { mode: 0o600 });
		assert.throws(() => loadOrCreateState(), BridgeStateError);
	});

	// 7. Throws BridgeStateError when version !== 1
	test('loadOrCreateState() throws BridgeStateError when version is not 1', () => {
		const p = stateFilePath();
		fs.mkdirSync(path.dirname(p), { recursive: true });
		const badState = { token: 'A'.repeat(43), version: 2 };
		fs.writeFileSync(p, JSON.stringify(badState), { mode: 0o600 });
		assert.throws(() => loadOrCreateState(), BridgeStateError);
	});

	// 8. Throws BridgeStateError when token doesn't match regex
	test('loadOrCreateState() throws BridgeStateError when token does not match regex', () => {
		const p = stateFilePath();
		fs.mkdirSync(path.dirname(p), { recursive: true });
		const badState = { token: 'not-a-valid-token!!!', version: 1 };
		fs.writeFileSync(p, JSON.stringify(badState), { mode: 0o600 });
		assert.throws(() => loadOrCreateState(), BridgeStateError);
	});

	// 9. saveState writes lastPort; loadOrCreateState reads it back
	test('saveState() writes lastPort; loadOrCreateState() reads it back', () => {
		const created = loadOrCreateState();
		saveState({ token: created.token, lastPort: 54321, version: 1 });
		const loaded = loadOrCreateState();
		assert.equal(loaded.lastPort, 54321);
		assert.equal(loaded.token, created.token);
	});

	// 10. saveState throws BridgeStateError for bad version or bad token
	test('saveState() throws BridgeStateError for bad version', () => {
		assert.throws(
			() => saveState({ token: 'A'.repeat(43), lastPort: undefined, version: 2 as unknown as 1 }),
			BridgeStateError,
		);
	});

	test('saveState() throws BridgeStateError for bad token', () => {
		assert.throws(
			() => saveState({ token: 'not!!valid', lastPort: undefined, version: 1 }),
			BridgeStateError,
		);
	});

	// 11. deleteState() removes file; next loadOrCreateState() creates fresh state with NEW token
	test('deleteState() removes file; next loadOrCreateState() creates fresh state with a new token', () => {
		const first = loadOrCreateState();
		deleteState();
		assert.ok(!fs.existsSync(stateFilePath()), 'File should not exist after deleteState');
		const second = loadOrCreateState();
		// Different token each time (astronomically unlikely to collide)
		assert.notEqual(first.token, second.token);
	});

	// 12. deleteState() is a no-op when the file doesn't exist
	test('deleteState() does not throw when file does not exist', () => {
		assert.doesNotThrow(() => deleteState());
	});

	// 13. Concurrency smoke: 5 serial calls all return the same token
	test('5 serial calls to loadOrCreateState() all return the same token', () => {
		const results = Array.from({ length: 5 }, () => loadOrCreateState());
		const tokens = results.map(s => s.token);
		const unique = new Set(tokens);
		assert.equal(unique.size, 1, 'All calls should return the same token');
	});

	// 14. loadOrCreateState() rejects lastPort outside 1..65535 range
	test('loadOrCreateState() throws when lastPort is 0', () => {
		const first = loadOrCreateState();
		fs.writeFileSync(stateFilePath(), JSON.stringify({ token: first.token, version: 1, lastPort: 0 }), { mode: 0o600 });
		assert.throws(() => loadOrCreateState(), BridgeStateError);
	});

	test('loadOrCreateState() throws when lastPort is a non-integer', () => {
		const first = loadOrCreateState();
		fs.writeFileSync(stateFilePath(), JSON.stringify({ token: first.token, version: 1, lastPort: 8080.5 }), { mode: 0o600 });
		assert.throws(() => loadOrCreateState(), BridgeStateError);
	});

	test('loadOrCreateState() throws when lastPort is a string', () => {
		const first = loadOrCreateState();
		fs.writeFileSync(stateFilePath(), JSON.stringify({ token: first.token, version: 1, lastPort: '8080' }), { mode: 0o600 });
		assert.throws(() => loadOrCreateState(), BridgeStateError);
	});

	// 15. saveState() validates lastPort symmetrically
	test('saveState() throws when lastPort exceeds 65535', () => {
		const valid = loadOrCreateState();
		assert.throws(
			() => saveState({ token: valid.token, version: 1, lastPort: 70000 }),
			BridgeStateError,
		);
	});
});
