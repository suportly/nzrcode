/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Handlers for the `notifications` namespace: register, unregister, preferences.
// Plus the canonical mute policy used by the push dispatcher (T033) to decide
// whether a given event should reach a given device.
//
// Storage split (cl-11):
//   - apnsToken      → SecretStorage (via pairedDevices.attachApnsToken)
//   - preferences    → globalState under `nzrcode-bridge.preferences:<deviceId>`
//
// The preference shape is intentionally minimal — only the muted list — so
// future feature toggles can grow it without a migration.

import { Dispatcher } from '../server/dispatcher';
import type { Handler } from '../server/dispatcher';
import { MethodName } from '../protocol/methods';
import type { MethodParams, MethodResult } from '../protocol/methods';

/** GlobalState key prefix for per-device notification preferences. */
export const PREFERENCES_KEY_PREFIX = 'nzrcode-bridge.preferences:';

export interface MutePreferences {
    readonly muted: readonly string[];
}

export interface NotificationsDeps {
    readonly attachApnsToken: (deviceId: string, apnsToken: string) => Promise<void>;
    readonly detachApnsToken: (deviceId: string) => Promise<void>;
    readonly savePreferences: (deviceId: string, muted: readonly string[]) => Promise<void>;
    readonly getPreferences: (deviceId: string) => Promise<MutePreferences | undefined>;
}

export interface NotificationsHandlers {
    readonly register: Handler<MethodName.NotificationsRegister>;
    readonly unregister: Handler<MethodName.NotificationsUnregister>;
    readonly preferences: Handler<MethodName.NotificationsPreferences>;
}

function patternMatches(pattern: string, eventName: string): boolean {
    if (pattern === '*') { return true; }
    if (!pattern.endsWith('*')) { return pattern === eventName; }
    return eventName.startsWith(pattern.slice(0, -1));
}

/**
 * Mute policy: returns true iff the given event should NOT be dispatched
 * to a client carrying the supplied preferences. Treats `undefined`
 * preferences as "no opt-out" (default-allow).
 */
export function isEventMuted(eventName: string, prefs: MutePreferences | undefined): boolean {
    if (!prefs) { return false; }
    return prefs.muted.some(pattern => patternMatches(pattern, eventName));
}

export function createNotificationsHandlers(deps: NotificationsDeps): NotificationsHandlers {

    const register: Handler<MethodName.NotificationsRegister> = async (params: MethodParams[MethodName.NotificationsRegister]) => {
        await deps.attachApnsToken(params.deviceId, params.apnsToken);
        return { registered: true } as MethodResult[MethodName.NotificationsRegister];
    };

    const unregister: Handler<MethodName.NotificationsUnregister> = async (params: MethodParams[MethodName.NotificationsUnregister]) => {
        await deps.detachApnsToken(params.deviceId);
        return { unregistered: true } as MethodResult[MethodName.NotificationsUnregister];
    };

    const preferences: Handler<MethodName.NotificationsPreferences> = async (params: MethodParams[MethodName.NotificationsPreferences]) => {
        await deps.savePreferences(params.deviceId, params.muted);
        return { applied: true } as MethodResult[MethodName.NotificationsPreferences];
    };

    return { register, unregister, preferences };
}

export function registerNotificationsHandlers(dispatcher: Dispatcher, deps: NotificationsDeps): void {
    const handlers = createNotificationsHandlers(deps);
    dispatcher.register(MethodName.NotificationsRegister, handlers.register);
    dispatcher.register(MethodName.NotificationsUnregister, handlers.unregister);
    dispatcher.register(MethodName.NotificationsPreferences, handlers.preferences);
}
