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
	rotateToken,
	saveState,
	stateFilePath,
} from '../../server/state';

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

let tmpHome: string;

suite('Bridge state — rotateToken', () => {
	setup(() => {
		tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'nzrcode-rotate-test-'));
		process.env['NZRCODE_HOME'] = tmpHome;
	});

	teardown(() => {
		delete process.env['NZRCODE_HOME'];
		fs.rmSync(tmpHome, { recursive: true, force: true });
	});

	test('rotateToken issues a fresh 43-char base64url token and persists it', () => {
		const original = loadOrCreateState();

		const rotated = rotateToken();

		assert.ok(TOKEN_RE.test(rotated.token), `Token "${rotated.token}" does not match regex`);
		assert.notEqual(rotated.token, original.token, 'Rotated token must differ from original');

		const onDisk = JSON.parse(fs.readFileSync(stateFilePath(), 'utf-8')) as { token: string };
		assert.equal(onDisk.token, rotated.token, 'On-disk token must match in-memory state');
	});

	test('rotateToken preserves lastPort across rotation', () => {
		const original = loadOrCreateState();
		saveState({ ...original, lastPort: 51234 });

		const rotated = rotateToken();

		assert.equal(rotated.lastPort, 51234);
		const onDisk = JSON.parse(fs.readFileSync(stateFilePath(), 'utf-8')) as { lastPort?: number };
		assert.equal(onDisk.lastPort, 51234);
	});

	test('rotateToken works without a prior loadOrCreateState call', () => {
		// Fresh tmpHome, no prior load.
		assert.equal(fs.existsSync(stateFilePath()), false, 'precondition: no state file');

		const rotated = rotateToken();

		assert.ok(TOKEN_RE.test(rotated.token));
		assert.equal(rotated.version, 1);
		assert.ok(fs.existsSync(stateFilePath()));
	});

	test('rotateToken keeps version at 1 (no schema change)', () => {
		loadOrCreateState();
		const rotated = rotateToken();
		assert.equal(rotated.version, 1);
	});
});
