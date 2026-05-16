/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import {
    createNotificationsHandlers,
    PREFERENCES_KEY_PREFIX,
    isEventMuted,
} from '../../rpc/notifications';
import type { MutePreferences, NotificationsDeps } from '../../rpc/notifications';

// ─── In-memory storage fakes (mirror pairedDevices.test.ts) ──────────────────

interface FakeNotificationStore {
    readonly apnsTokens: Map<string, string>;
    readonly preferences: Map<string, MutePreferences>;
}

function makeDeps(): { deps: NotificationsDeps; store: FakeNotificationStore } {
    const store: FakeNotificationStore = {
        apnsTokens: new Map(),
        preferences: new Map(),
    };

    const deps: NotificationsDeps = {
        attachApnsToken: async (deviceId, apnsToken) => {
            store.apnsTokens.set(deviceId, apnsToken);
        },
        detachApnsToken: async (deviceId) => {
            store.apnsTokens.delete(deviceId);
        },
        savePreferences: async (deviceId, muted) => {
            store.preferences.set(deviceId, { muted });
        },
        getPreferences: async (deviceId) => store.preferences.get(deviceId),
    };

    return { deps, store };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

suite('rpc/notifications', () => {

    suite('PREFERENCES_KEY_PREFIX', () => {

        test('namespaces preference keys so they never collide with other state', () => {
            assert.equal(PREFERENCES_KEY_PREFIX, 'nzrcode-bridge.preferences:');
        });
    });

    suite('register', () => {

        test('stores the apnsToken via the deps and returns registered=true', async () => {
            const { deps, store } = makeDeps();
            const handlers = createNotificationsHandlers(deps);

            const result = await handlers.register({ deviceId: 'd-1', apnsToken: 'apns-1' });

            assert.deepEqual(result, { registered: true });
            assert.equal(store.apnsTokens.get('d-1'), 'apns-1');
        });

        test('a re-register with a new token overwrites the previous one', async () => {
            const { deps, store } = makeDeps();
            const handlers = createNotificationsHandlers(deps);

            await handlers.register({ deviceId: 'd-1', apnsToken: 'apns-OLD' });
            await handlers.register({ deviceId: 'd-1', apnsToken: 'apns-NEW' });

            assert.equal(store.apnsTokens.get('d-1'), 'apns-NEW');
        });
    });

    suite('unregister', () => {

        test('removes the apnsToken and returns unregistered=true', async () => {
            const { deps, store } = makeDeps();
            const handlers = createNotificationsHandlers(deps);

            await handlers.register({ deviceId: 'd-1', apnsToken: 'apns-1' });
            const result = await handlers.unregister({ deviceId: 'd-1' });

            assert.deepEqual(result, { unregistered: true });
            assert.equal(store.apnsTokens.has('d-1'), false);
        });

        test('is a no-op for an unknown device (idempotent)', async () => {
            const { deps } = makeDeps();
            const handlers = createNotificationsHandlers(deps);

            const result = await handlers.unregister({ deviceId: 'unknown' });

            assert.deepEqual(result, { unregistered: true });
        });
    });

    suite('preferences', () => {

        test('persists the muted list for a given device', async () => {
            const { deps, store } = makeDeps();
            const handlers = createNotificationsHandlers(deps);

            await handlers.preferences({ deviceId: 'd-1', muted: ['tasks.completed'] });

            assert.deepEqual(store.preferences.get('d-1'), { muted: ['tasks.completed'] });
        });

        test('overwrites previous preferences for the same device', async () => {
            const { deps, store } = makeDeps();
            const handlers = createNotificationsHandlers(deps);

            await handlers.preferences({ deviceId: 'd-1', muted: ['terminal.created'] });
            await handlers.preferences({ deviceId: 'd-1', muted: ['tasks.completed', 'debug.stopped'] });

            assert.deepEqual(store.preferences.get('d-1'), { muted: ['tasks.completed', 'debug.stopped'] });
        });

        test('preferences for different devices are independent', async () => {
            const { deps, store } = makeDeps();
            const handlers = createNotificationsHandlers(deps);

            await handlers.preferences({ deviceId: 'd-1', muted: ['tasks.completed'] });
            await handlers.preferences({ deviceId: 'd-2', muted: ['debug.stopped'] });

            assert.deepEqual(store.preferences.get('d-1'), { muted: ['tasks.completed'] });
            assert.deepEqual(store.preferences.get('d-2'), { muted: ['debug.stopped'] });
        });
    });

    suite('isEventMuted (mute policy)', () => {

        test('returns true when the event name is in the muted list', () => {
            const prefs: MutePreferences = { muted: ['tasks.completed'] };
            assert.equal(isEventMuted('tasks.completed', prefs), true);
        });

        test('returns false when the event is NOT in the muted list', () => {
            const prefs: MutePreferences = { muted: ['tasks.completed'] };
            assert.equal(isEventMuted('claudeCode.permissionRequest', prefs), false);
        });

        test('returns false when prefs are undefined (no opt-out applied)', () => {
            assert.equal(isEventMuted('tasks.completed', undefined), false);
        });

        test('supports namespace wildcards in the muted list', () => {
            const prefs: MutePreferences = { muted: ['terminal.*'] };
            assert.equal(isEventMuted('terminal.created', prefs), true);
            assert.equal(isEventMuted('terminal.closed', prefs), true);
            assert.equal(isEventMuted('tasks.completed', prefs), false);
        });
    });

    // The full push-dispatcher integration lives in T033. Here we wire the
    // mute policy through a minimal fake dispatcher to prove categories are
    // independent (Story 4 / cl-11 — preferences only filter their declared
    // categories, leaving the rest untouched).
    suite('mute dispatch (fake push dispatcher)', () => {

        test('a muted event produces zero dispatch calls for that device', async () => {
            const { deps } = makeDeps();
            const handlers = createNotificationsHandlers(deps);

            await handlers.preferences({ deviceId: 'd-1', muted: ['tasks.completed'] });

            const dispatched: Array<{ deviceId: string; event: string }> = [];
            async function fakeDispatch(deviceId: string, event: string): Promise<void> {
                const prefs = await deps.getPreferences(deviceId);
                if (isEventMuted(event, prefs)) { return; }
                dispatched.push({ deviceId, event });
            }

            await fakeDispatch('d-1', 'tasks.completed');

            assert.equal(dispatched.length, 0);
        });

        test('a non-muted event still dispatches for the same device (categories are independent)', async () => {
            const { deps } = makeDeps();
            const handlers = createNotificationsHandlers(deps);

            await handlers.preferences({ deviceId: 'd-1', muted: ['tasks.completed'] });

            const dispatched: Array<{ deviceId: string; event: string }> = [];
            async function fakeDispatch(deviceId: string, event: string): Promise<void> {
                const prefs = await deps.getPreferences(deviceId);
                if (isEventMuted(event, prefs)) { return; }
                dispatched.push({ deviceId, event });
            }

            await fakeDispatch('d-1', 'claudeCode.permissionRequest');

            assert.deepEqual(dispatched, [{ deviceId: 'd-1', event: 'claudeCode.permissionRequest' }]);
        });
    });
});
