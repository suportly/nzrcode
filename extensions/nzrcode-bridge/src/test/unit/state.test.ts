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
	BridgeStateError,
	deleteState,
	loadOrCreateState,
	saveState,
	stateFilePath,
} from '../../server/state';

const TOKEN = 'A'.repeat(43);

let tmpHome: string;

suite('Bridge state (v2 schema)', () => {
	setup(() => {
		tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'nzrcode-state-test-'));
		process.env['NZRCODE_HOME'] = tmpHome;
	});

	teardown(() => {
		delete process.env['NZRCODE_HOME'];
		fs.rmSync(tmpHome, { recursive: true, force: true });
	});

	test('stateFilePath() returns a path under NZRCODE_HOME when env var is set', () => {
		const p = stateFilePath();
		assert.ok(p.startsWith(tmpHome), `Expected path under ${tmpHome}, got ${p}`);
		assert.ok(p.endsWith('bridge.json'), `Expected path ending in bridge.json, got ${p}`);
	});

	test('loadOrCreateState() creates state file with version:2, empty tokens, lastPort undefined', () => {
		const state = loadOrCreateState();
		assert.equal(state.version, 2);
		assert.deepEqual(state.tokens, {});
		assert.equal(state.lastPort, undefined);
		assert.ok(fs.existsSync(stateFilePath()), 'State file should exist after loadOrCreateState');
	});

	test('created state file has permission 0o600', () => {
		if (process.platform === 'win32') {
			return;
		}
		loadOrCreateState();
		const stat = fs.statSync(stateFilePath());
		const mode = stat.mode & 0o777;
		assert.equal(mode, 0o600, `Expected 0o600 but got 0o${mode.toString(8)}`);
	});

	test('loadOrCreateState() called twice returns deep-equal state', () => {
		const first = loadOrCreateState();
		const second = loadOrCreateState();
		assert.deepEqual(first, second);
	});

	test('loadOrCreateState() re-applies 0o600 after permission drift to 0o644', () => {
		if (process.platform === 'win32') {
			return;
		}
		loadOrCreateState();
		const p = stateFilePath();
		fs.chmodSync(p, 0o644);
		assert.equal(fs.statSync(p).mode & 0o777, 0o644, 'Pre-condition: should be 0o644');
		loadOrCreateState();
		const mode = fs.statSync(p).mode & 0o777;
		assert.equal(mode, 0o600, `Expected 0o600 after re-apply, got 0o${mode.toString(8)}`);
	});

	test('loadOrCreateState() throws BridgeStateError when file exists but JSON is invalid', () => {
		const p = stateFilePath();
		fs.mkdirSync(path.dirname(p), { recursive: true });
		fs.writeFileSync(p, 'not-valid-json', { mode: 0o600 });
		assert.throws(() => loadOrCreateState(), BridgeStateError);
	});

	test('loadOrCreateState() throws BridgeStateError when version is unsupported (e.g. 99)', () => {
		const p = stateFilePath();
		fs.mkdirSync(path.dirname(p), { recursive: true });
		fs.writeFileSync(p, JSON.stringify({ tokens: {}, version: 99 }), { mode: 0o600 });
		assert.throws(() => loadOrCreateState(), BridgeStateError);
	});

	test('loadOrCreateState() throws BridgeStateError when a token entry does not match regex', () => {
		const p = stateFilePath();
		fs.mkdirSync(path.dirname(p), { recursive: true });
		const bad = { tokens: { 'd-1': 'not-a-valid-token!!!' }, version: 2 };
		fs.writeFileSync(p, JSON.stringify(bad), { mode: 0o600 });
		assert.throws(() => loadOrCreateState(), BridgeStateError);
	});

	test('saveState() writes lastPort; loadOrCreateState() reads it back', () => {
		const created = loadOrCreateState();
		saveState({ tokens: { 'd-1': TOKEN }, lastPort: 54321, version: 2 });
		const loaded = loadOrCreateState();
		assert.equal(loaded.lastPort, 54321);
		assert.deepEqual(loaded.tokens, { 'd-1': TOKEN });
		assert.equal(created.version, 2);
	});

	test('saveState() throws BridgeStateError for unsupported version', () => {
		assert.throws(
			() => saveState({ tokens: {}, lastPort: undefined, version: 1 as unknown as 2 }),
			BridgeStateError,
		);
	});

	test('saveState() throws BridgeStateError for a malformed token entry', () => {
		assert.throws(
			() => saveState({ tokens: { 'd-1': 'short' }, lastPort: undefined, version: 2 }),
			BridgeStateError,
		);
	});

	test('deleteState() removes file; next loadOrCreateState() creates fresh state with empty tokens', () => {
		loadOrCreateState();
		saveState({ tokens: { 'd-1': TOKEN }, version: 2 });
		deleteState();
		assert.ok(!fs.existsSync(stateFilePath()), 'File should not exist after deleteState');
		const second = loadOrCreateState();
		assert.deepEqual(second.tokens, {});
	});

	test('deleteState() does not throw when file does not exist', () => {
		assert.doesNotThrow(() => deleteState());
	});

	test('5 serial calls to loadOrCreateState() all return the same state', () => {
		loadOrCreateState();
		saveState({ tokens: { 'd-1': TOKEN }, version: 2 });
		const results = Array.from({ length: 5 }, () => loadOrCreateState());
		for (const r of results) {
			assert.deepEqual(r.tokens, { 'd-1': TOKEN });
		}
	});

	test('loadOrCreateState() throws when lastPort is 0', () => {
		fs.mkdirSync(path.dirname(stateFilePath()), { recursive: true });
		fs.writeFileSync(stateFilePath(), JSON.stringify({ tokens: {}, version: 2, lastPort: 0 }), { mode: 0o600 });
		assert.throws(() => loadOrCreateState(), BridgeStateError);
	});

	test('loadOrCreateState() throws when lastPort is a non-integer', () => {
		fs.mkdirSync(path.dirname(stateFilePath()), { recursive: true });
		fs.writeFileSync(stateFilePath(), JSON.stringify({ tokens: {}, version: 2, lastPort: 8080.5 }), { mode: 0o600 });
		assert.throws(() => loadOrCreateState(), BridgeStateError);
	});

	test('loadOrCreateState() throws when lastPort is a string', () => {
		fs.mkdirSync(path.dirname(stateFilePath()), { recursive: true });
		fs.writeFileSync(stateFilePath(), JSON.stringify({ tokens: {}, version: 2, lastPort: '8080' }), { mode: 0o600 });
		assert.throws(() => loadOrCreateState(), BridgeStateError);
	});

	test('saveState() throws when lastPort exceeds 65535', () => {
		assert.throws(
			() => saveState({ tokens: {}, version: 2, lastPort: 70000 }),
			BridgeStateError,
		);
	});
});
