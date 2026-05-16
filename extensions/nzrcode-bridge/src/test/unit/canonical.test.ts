/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import {
    LONG_RUNNING_TASK_MS,
    wireCanonicalEvents,
} from '../../events/canonical';
import type {
    CanonicalEventsDeps,
    EmitterLike,
} from '../../events/canonical';
import { FakePushProvider } from '../../push/fakePushProvider';
import { PushDispatcher } from '../../push/pushDispatcher';
import type { PairedDevice } from '../../pairing/pairedDevices';
import type { MutePreferences } from '../../rpc/notifications';

// ─── EmitterLike implementation for tests ─────────────────────────────────────

function makeEmitter<T>(): EmitterLike<T> & { fire(value: T): void } {
    type Listener = (value: T) => void;
    const listeners = new Set<Listener>();
    return {
        event: (listener) => {
            listeners.add(listener);
            return { dispose: () => listeners.delete(listener) };
        },
        fire: (value: T) => {
            for (const l of [...listeners]) { l(value); }
        },
    };
}

function device(deviceId: string): PairedDevice {
    const t = Date.now();
    return { deviceId, deviceName: deviceId, pairedAt: t, lastSeenAt: t };
}

// ─── Shared harness ───────────────────────────────────────────────────────────

interface Harness {
    readonly deps: CanonicalEventsDeps;
    readonly emitters: {
        readonly taskEnded: ReturnType<typeof makeEmitter<{ taskName: string; durationMs: number; exitCode: number | null }>>;
        readonly shellEnded: ReturnType<typeof makeEmitter<{ terminalId: string; exitCode: number | null }>>;
        readonly claudePermission: ReturnType<typeof makeEmitter<{ requestId: string; tool: string; description: string }>>;
        readonly debugStopped: ReturnType<typeof makeEmitter<{ sessionId: string; reason: string; frameId: number | null }>>;
        readonly connectionChanged: ReturnType<typeof makeEmitter<{ state: 'connected' | 'disconnected' | 'reconnecting'; deviceId?: string }>>;
    };
    readonly relay: FakePushProvider;
    readonly inBand: FakePushProvider;
    readonly devices: PairedDevice[];
    readonly mutePrefs: Map<string, MutePreferences>;
}

function makeHarness(devices: readonly PairedDevice[] = [device('d-1')]): Harness {
    const taskEnded = makeEmitter<{ taskName: string; durationMs: number; exitCode: number | null }>();
    const shellEnded = makeEmitter<{ terminalId: string; exitCode: number | null }>();
    const claudePermission = makeEmitter<{ requestId: string; tool: string; description: string }>();
    const debugStopped = makeEmitter<{ sessionId: string; reason: string; frameId: number | null }>();
    const connectionChanged = makeEmitter<{ state: 'connected' | 'disconnected' | 'reconnecting'; deviceId?: string }>();

    const relay = new FakePushProvider();
    const inBand = new FakePushProvider();
    const dispatcher = new PushDispatcher({ relay, inBand });

    const mutePrefs = new Map<string, MutePreferences>();
    const deviceList = [...devices];

    const deps: CanonicalEventsDeps = {
        onTaskEnded: taskEnded.event,
        onShellEnded: shellEnded.event,
        onClaudePermissionRequest: claudePermission.event,
        onDebugStopped: debugStopped.event,
        onConnectionChanged: connectionChanged.event,
        listPairedDevices: () => deviceList,
        getPreferences: async (deviceId) => mutePrefs.get(deviceId),
        pushDispatcher: dispatcher,
    };

    return {
        deps,
        emitters: { taskEnded, shellEnded, claudePermission, debugStopped, connectionChanged },
        relay,
        inBand,
        devices: deviceList,
        mutePrefs,
    };
}

// ─── waitMicrotasks ───────────────────────────────────────────────────────────
// canonical wiring fires the dispatcher asynchronously; let the microtask
// queue drain before asserting on FakePushProvider.calls.

async function flush(): Promise<void> {
    await new Promise<void>(resolve => setImmediate(resolve));
    await new Promise<void>(resolve => setImmediate(resolve));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

suite('events/canonical', () => {

    test('LONG_RUNNING_TASK_MS is 30 000 ms (cl-3 threshold)', () => {
        assert.equal(LONG_RUNNING_TASK_MS, 30000);
    });

    suite('tasks.completed', () => {

        test('skips short tasks (duration < 30 s)', async () => {
            const h = makeHarness();
            const disposable = wireCanonicalEvents(h.deps);

            h.emitters.taskEnded.fire({ taskName: 'lint', durationMs: 100, exitCode: 0 });
            await flush();

            assert.equal(h.relay.calls.length, 0);
            disposable.dispose();
        });

        test('dispatches a single push for a long task (duration ≥ 30 s)', async () => {
            const h = makeHarness();
            const disposable = wireCanonicalEvents(h.deps);

            h.emitters.taskEnded.fire({ taskName: 'integration', durationMs: 35000, exitCode: 0 });
            await flush();

            assert.equal(h.relay.calls.length, 1);
            assert.equal(h.relay.calls[0].event.event, 'tasks.completed');
            const payload = h.relay.calls[0].event.payload as { taskName: string; durationMs: number };
            assert.equal(payload.taskName, 'integration');
            assert.equal(payload.durationMs, 35000);

            disposable.dispose();
        });
    });

    suite('terminal exit (non-zero)', () => {

        test('skips exitCode 0', async () => {
            const h = makeHarness();
            const disposable = wireCanonicalEvents(h.deps);

            h.emitters.shellEnded.fire({ terminalId: 't-1', exitCode: 0 });
            await flush();

            assert.equal(h.relay.calls.length, 0);
            disposable.dispose();
        });

        test('dispatches on non-zero exit codes', async () => {
            const h = makeHarness();
            const disposable = wireCanonicalEvents(h.deps);

            h.emitters.shellEnded.fire({ terminalId: 't-1', exitCode: 1 });
            await flush();

            assert.equal(h.relay.calls.length, 1);
            disposable.dispose();
        });
    });

    suite('debug.stopped + claudeCode.permissionRequest + connection.changed', () => {

        test('dispatches each canonical event exactly once', async () => {
            const h = makeHarness();
            const disposable = wireCanonicalEvents(h.deps);

            h.emitters.debugStopped.fire({ sessionId: 's-1', reason: 'breakpoint', frameId: 1 });
            h.emitters.claudePermission.fire({ requestId: 'r-1', tool: 'write_file', description: 'allow?' });
            h.emitters.connectionChanged.fire({ state: 'reconnecting' });
            await flush();

            assert.equal(h.relay.calls.length, 3);
            const events = h.relay.calls.map(c => c.event.event);
            assert.deepEqual(events, ['debug.stopped', 'claudeCode.permissionRequest', 'connection.changed']);

            disposable.dispose();
        });
    });

    suite('mute integration', () => {

        test('a device with the event muted is filtered out of the dispatch', async () => {
            const h = makeHarness([device('d-1'), device('d-2')]);
            h.mutePrefs.set('d-1', { muted: ['tasks.completed'] });
            const disposable = wireCanonicalEvents(h.deps);

            h.emitters.taskEnded.fire({ taskName: 'integration', durationMs: 35000, exitCode: 0 });
            await flush();

            assert.equal(h.relay.calls.length, 1);
            const targeted = h.relay.calls[0].devices.map(d => d.deviceId);
            assert.deepEqual(targeted, ['d-2'], 'd-1 muted, only d-2 receives');

            disposable.dispose();
        });

        test('skips dispatch entirely when EVERY device muted the event', async () => {
            const h = makeHarness();
            h.mutePrefs.set('d-1', { muted: ['tasks.completed'] });
            const disposable = wireCanonicalEvents(h.deps);

            h.emitters.taskEnded.fire({ taskName: 'integration', durationMs: 35000, exitCode: 0 });
            await flush();

            assert.equal(h.relay.calls.length, 0);
            disposable.dispose();
        });
    });

    suite('cleanup', () => {

        test('dispose() unsubscribes from every emitter', async () => {
            const h = makeHarness();
            const disposable = wireCanonicalEvents(h.deps);

            disposable.dispose();
            h.emitters.taskEnded.fire({ taskName: 't', durationMs: 35000, exitCode: 0 });
            await flush();

            assert.equal(h.relay.calls.length, 0, 'no dispatch after dispose');
        });
    });
});
