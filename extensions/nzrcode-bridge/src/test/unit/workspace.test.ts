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
    MAX_WORKSPACE_PAYLOAD_BYTES,
    createWorkspaceHandlers,
} from '../../rpc/workspace';
import type { WorkspaceDeps, WorkspaceFolderShape } from '../../rpc/workspace';
import { BridgeErrorCode } from '../../protocol/errors';
import type { JsonRpcError } from '../../protocol/jsonrpc';
import type { Logger } from '../../server/dispatcher';

function bridgeCodeOf(err: unknown): string | undefined {
    if (!(err instanceof Error)) { return undefined; }
    const data = (err as Error & { bridgeError?: JsonRpcError }).bridgeError?.data as
        | { bridgeCode?: string }
        | undefined;
    return data?.bridgeCode;
}

function bridgeDataOf(err: unknown): Record<string, unknown> | undefined {
    if (!(err instanceof Error)) { return undefined; }
    return ((err as Error & { bridgeError?: JsonRpcError }).bridgeError?.data as Record<string, unknown>) ?? undefined;
}

interface RecordingLogger extends Logger {
    readonly calls: ReadonlyArray<{ level: string; msg: string; fields: unknown }>;
}

function makeLogger(): RecordingLogger {
    const calls: Array<{ level: string; msg: string; fields: unknown }> = [];
    return {
        info: (msg, fields) => calls.push({ level: 'info', msg, fields }),
        warn: (msg, fields) => calls.push({ level: 'warn', msg, fields }),
        error: (msg, fields) => calls.push({ level: 'error', msg, fields }),
        calls,
    };
}

interface FakeVsFs {
    readonly storage: Map<string, Uint8Array>;
}

function makeDeps(opts: {
    folders: readonly { fsPath: string; name: string }[];
    logger: RecordingLogger;
    initialFiles?: Iterable<[string, Uint8Array | string]>;
}): WorkspaceDeps & FakeVsFs {
    const storage = new Map<string, Uint8Array>();
    for (const [fp, content] of opts.initialFiles ?? []) {
        storage.set(fp, typeof content === 'string' ? Buffer.from(content, 'utf-8') : content);
    }

    const folders: WorkspaceFolderShape[] = opts.folders.map(f => ({
        name: f.name,
        uri: { fsPath: f.fsPath },
    }));

    return {
        workspaceFolders: () => folders,
        findFiles: async (pattern: string) => {
            return Array.from(storage.keys())
                .filter(p => p.includes(pattern))
                .map(p => ({ fsPath: p }));
        },
        readFile: async (fsPath: string) => {
            const buf = storage.get(fsPath);
            if (!buf) { throw new Error(`ENOENT: ${fsPath}`); }
            return buf;
        },
        writeFile: async (fsPath: string, content: Uint8Array) => {
            storage.set(fsPath, Buffer.from(content));
        },
        logger: opts.logger,
        storage,
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

let tmpRoot: string;

suite('rpc/workspace', () => {

    setup(() => {
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nzrcode-ws-test-'));
    });

    teardown(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    test('MAX_WORKSPACE_PAYLOAD_BYTES is exactly 10 MiB (cl-5)', () => {
        assert.equal(MAX_WORKSPACE_PAYLOAD_BYTES, 10 * 1024 * 1024);
    });

    suite('listFolders', () => {

        test('returns the visible workspace folders by name + path', async () => {
            const logger = makeLogger();
            const folderA = path.join(tmpRoot, 'a');
            const folderB = path.join(tmpRoot, 'b');
            fs.mkdirSync(folderA);
            fs.mkdirSync(folderB);

            const deps = makeDeps({
                folders: [{ fsPath: folderA, name: 'a' }, { fsPath: folderB, name: 'b' }],
                logger,
            });
            const handlers = createWorkspaceHandlers(deps);

            const result = await handlers.listFolders(undefined);

            assert.deepEqual(result.folders, [
                { name: 'a', path: folderA },
                { name: 'b', path: folderB },
            ]);
        });
    });

    suite('readFile', () => {

        test('returns base64-encoded content plus byteCount', async () => {
            const logger = makeLogger();
            const folder = path.join(tmpRoot, 'ws');
            fs.mkdirSync(folder);
            const filePath = path.join(folder, 'hello.txt');

            const deps = makeDeps({
                folders: [{ fsPath: folder, name: 'ws' }],
                logger,
                initialFiles: [[filePath, 'Hello, world!']],
            });
            const handlers = createWorkspaceHandlers(deps);

            const result = await handlers.readFile({ path: filePath });

            const decoded = Buffer.from(result.contentBase64, 'base64').toString('utf-8');
            assert.equal(decoded, 'Hello, world!');
            assert.equal(result.byteCount, Buffer.byteLength('Hello, world!', 'utf-8'));
        });

        test('logs metadata only — never the file content (Article VI privacy)', async () => {
            const logger = makeLogger();
            const folder = path.join(tmpRoot, 'ws');
            fs.mkdirSync(folder);
            const filePath = path.join(folder, 'secret.env');
            const secret = 'SUPER_SECRET_VALUE';

            const deps = makeDeps({
                folders: [{ fsPath: folder, name: 'ws' }],
                logger,
                initialFiles: [[filePath, secret]],
            });
            const handlers = createWorkspaceHandlers(deps);

            await handlers.readFile({ path: filePath });

            // No log line, anywhere, contains the secret.
            for (const call of logger.calls) {
                const serialized = JSON.stringify(call);
                assert.ok(!serialized.includes(secret), `log leaked secret: ${serialized}`);
            }
            // Confirm the redacted metadata IS present so we know logging happened.
            const fsRead = logger.calls.find(c => c.msg === 'fs.readFile');
            assert.ok(fsRead, 'expected fs.readFile log');
            const fields = fsRead.fields as { bytes?: number; sha256Prefix?: string };
            assert.equal(fields.bytes, Buffer.byteLength(secret, 'utf-8'));
            assert.match(fields.sha256Prefix ?? '', /^[0-9a-f]{6}$/);
        });

        test('rejects a path outside the workspace folders with path_outside_workspace', async () => {
            const logger = makeLogger();
            const folder = path.join(tmpRoot, 'ws');
            fs.mkdirSync(folder);
            const outsidePath = path.join(tmpRoot, 'other', 'leak.txt');

            const deps = makeDeps({
                folders: [{ fsPath: folder, name: 'ws' }],
                logger,
            });
            const handlers = createWorkspaceHandlers(deps);

            try {
                await handlers.readFile({ path: outsidePath });
                assert.fail('expected throw');
            } catch (err) {
                assert.equal(bridgeCodeOf(err), BridgeErrorCode.PathOutsideWorkspace);
            }
        });
    });

    suite('writeFile', () => {

        test('writes within a workspace folder and reports byteCount', async () => {
            const logger = makeLogger();
            const folder = path.join(tmpRoot, 'ws');
            fs.mkdirSync(folder);
            const filePath = path.join(folder, 'out.txt');

            const deps = makeDeps({
                folders: [{ fsPath: folder, name: 'ws' }],
                logger,
            });
            const handlers = createWorkspaceHandlers(deps);

            const payload = Buffer.from('hello-payload', 'utf-8').toString('base64');
            const result = await handlers.writeFile({ path: filePath, contentBase64: payload });

            assert.equal(result.byteCount, Buffer.byteLength('hello-payload', 'utf-8'));
            assert.equal(deps.storage.get(filePath)?.toString(), 'hello-payload');
        });

        test('rejects a path outside the workspace folders', async () => {
            const logger = makeLogger();
            const folder = path.join(tmpRoot, 'ws');
            fs.mkdirSync(folder);
            const outside = path.join(tmpRoot, 'leak.txt');

            const deps = makeDeps({
                folders: [{ fsPath: folder, name: 'ws' }],
                logger,
            });
            const handlers = createWorkspaceHandlers(deps);

            try {
                await handlers.writeFile({ path: outside, contentBase64: '' });
                assert.fail('expected throw');
            } catch (err) {
                assert.equal(bridgeCodeOf(err), BridgeErrorCode.PathOutsideWorkspace);
            }
        });

        test('rejects a payload larger than 10 MiB with data.limit=10485760', async () => {
            const logger = makeLogger();
            const folder = path.join(tmpRoot, 'ws');
            fs.mkdirSync(folder);
            const filePath = path.join(folder, 'big.bin');

            const deps = makeDeps({
                folders: [{ fsPath: folder, name: 'ws' }],
                logger,
            });
            const handlers = createWorkspaceHandlers(deps);

            const overLimit = Buffer.alloc(MAX_WORKSPACE_PAYLOAD_BYTES + 1, 0x41).toString('base64');

            try {
                await handlers.writeFile({ path: filePath, contentBase64: overLimit });
                assert.fail('expected throw');
            } catch (err) {
                assert.equal(bridgeCodeOf(err), BridgeErrorCode.PayloadTooLarge);
                const data = bridgeDataOf(err);
                assert.equal((data as { limit?: number })?.limit, MAX_WORKSPACE_PAYLOAD_BYTES);
            }
        });

        test('does NOT log the written content (Article VI privacy)', async () => {
            const logger = makeLogger();
            const folder = path.join(tmpRoot, 'ws');
            fs.mkdirSync(folder);
            const filePath = path.join(folder, 'creds.txt');
            const secret = 'ANOTHER_SECRET_TOKEN';

            const deps = makeDeps({
                folders: [{ fsPath: folder, name: 'ws' }],
                logger,
            });
            const handlers = createWorkspaceHandlers(deps);

            await handlers.writeFile({
                path: filePath,
                contentBase64: Buffer.from(secret).toString('base64'),
            });

            for (const call of logger.calls) {
                const serialized = JSON.stringify(call);
                assert.ok(!serialized.includes(secret), `write log leaked secret: ${serialized}`);
            }
        });
    });

    suite('findFiles', () => {

        test('returns matching paths within the workspace', async () => {
            const logger = makeLogger();
            const folder = path.join(tmpRoot, 'ws');
            fs.mkdirSync(folder);
            const filePath = path.join(folder, 'a.ts');

            const deps = makeDeps({
                folders: [{ fsPath: folder, name: 'ws' }],
                logger,
                initialFiles: [[filePath, 'export const x = 1;']],
            });
            const handlers = createWorkspaceHandlers(deps);

            const result = await handlers.findFiles({ pattern: 'a.ts' });

            assert.ok(result.paths.includes(filePath));
        });
    });
});
