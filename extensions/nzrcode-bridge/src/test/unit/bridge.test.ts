/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { maybeStartBridge, BridgeRuntime } from '../../bridge';
import { generateToken } from '../../server/auth';
import { stateFilePath } from '../../server/state';
import type { Logger } from '../../server/dispatcher';

function makeLogger(): Logger {
    return {
        info: () => { /* silent */ },
        warn: () => { /* silent */ },
        error: () => { /* silent */ },
    };
}

function writeStateFile(token: string): string {
    const filePath = stateFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(filePath, JSON.stringify({ version: 1, token }), { mode: 0o600 });
    return filePath;
}

suite('bridge — maybeStartBridge', () => {

    let tmpHome: string;
    let runtimes: BridgeRuntime[];

    setup(() => {
        tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'nzrcode-bridge-unit-'));
        process.env['NZRCODE_HOME'] = tmpHome;
        runtimes = [];
    });

    teardown(async () => {
        for (const rt of runtimes) {
            await rt.stop();
        }
        delete process.env['NZRCODE_HOME'];
        fs.rmSync(tmpHome, { recursive: true, force: true });
    });

    test('returns undefined when bridge.json is absent', async () => {
        const result = await maybeStartBridge({ serverVersion: '1.0.0', logger: makeLogger() });
        assert.equal(result, undefined);
    });

    test('does NOT create the state file when bridge.json is absent', async () => {
        await maybeStartBridge({ serverVersion: '1.0.0', logger: makeLogger() });
        assert.equal(fs.existsSync(stateFilePath()), false);
    });

    test('starts a loopback WS server when bridge.json exists', async () => {
        writeStateFile(generateToken());

        const runtime = await maybeStartBridge({ serverVersion: '1.0.0', logger: makeLogger() });
        assert.ok(runtime, 'expected a runtime');
        runtimes.push(runtime);

        assert.ok(runtime.server.port > 0, 'expected an OS-assigned port');
    });

    test('persists the bound port to bridge.json as lastPort', async () => {
        writeStateFile(generateToken());

        const runtime = await maybeStartBridge({ serverVersion: '1.0.0', logger: makeLogger() });
        assert.ok(runtime);
        runtimes.push(runtime);

        const stored = JSON.parse(fs.readFileSync(stateFilePath(), 'utf-8')) as { lastPort: number };
        assert.equal(stored.lastPort, runtime.server.port);
    });

    test('registers the system.hello handler on the dispatcher', async () => {
        writeStateFile(generateToken());

        const runtime = await maybeStartBridge({ serverVersion: '1.0.0', logger: makeLogger() });
        assert.ok(runtime);
        runtimes.push(runtime);

        const methods = runtime.dispatcher.registeredMethods();
        assert.ok(methods.includes('system.hello' as never), `expected system.hello, got ${methods.join(',')}`);
    });
});
