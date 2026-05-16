/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Wire VS Code's canonical event streams into the pushDispatcher (T034 / cl-3).
//
// Filters applied at the source:
//   - tasks.completed:           only when durationMs ≥ LONG_RUNNING_TASK_MS
//   - terminal exit:             only when exitCode is truthy / non-zero
//   - debug.stopped:             always (every stop is interesting to the user)
//   - claudeCode.permissionRequest: always
//   - connection.changed:        always
//
// Per-device mute is applied here BEFORE dispatching so the relay POST only
// carries devices that actually want the notification (cl-11).

import type { PushDispatcher } from '../push/pushDispatcher';
import type { PushEvent } from '../push/IPushProvider';
import type { PairedDevice } from '../pairing/pairedDevices';
import type { MutePreferences } from '../rpc/notifications';
import { isEventMuted } from '../rpc/notifications';

/** Minimum duration that promotes a task-ended event into a push (cl-3). */
export const LONG_RUNNING_TASK_MS = 30000;

/**
 * Minimal Event-shape compatible with VS Code's `Event<T>` (the value
 * returned by `vscode.tasks.onDidEndTask`, etc.). Tests pass an
 * in-memory emitter; production wiring passes the real VS Code event.
 */
export type EmitterLike<T> = {
    event: (listener: (value: T) => void) => { dispose(): void };
}['event'];

export interface CanonicalEventsDeps {
    readonly onTaskEnded: EmitterLike<{ taskName: string; durationMs: number; exitCode: number | null }>;
    readonly onShellEnded: EmitterLike<{ terminalId: string; exitCode: number | null }>;
    readonly onClaudePermissionRequest: EmitterLike<{ requestId: string; tool: string; description: string }>;
    readonly onDebugStopped: EmitterLike<{ sessionId: string; reason: string; frameId: number | null }>;
    readonly onConnectionChanged: EmitterLike<{ state: 'connected' | 'disconnected' | 'reconnecting'; deviceId?: string }>;
    readonly listPairedDevices: () => readonly PairedDevice[];
    readonly getPreferences: (deviceId: string) => Promise<MutePreferences | undefined>;
    readonly pushDispatcher: Pick<PushDispatcher, 'dispatch'>;
}

export interface Disposable {
    dispose(): void;
}

async function targetedDevices(
    deps: Pick<CanonicalEventsDeps, 'listPairedDevices' | 'getPreferences'>,
    event: PushEvent,
): Promise<readonly PairedDevice[]> {
    const all = deps.listPairedDevices();
    const allowed: PairedDevice[] = [];
    for (const d of all) {
        const prefs = await deps.getPreferences(d.deviceId);
        if (!isEventMuted(event.event, prefs)) { allowed.push(d); }
    }
    return allowed;
}

async function dispatchWithMute(deps: CanonicalEventsDeps, event: PushEvent): Promise<void> {
    const targets = await targetedDevices(deps, event);
    if (targets.length === 0) { return; }
    await deps.pushDispatcher.dispatch(targets, event);
}

export function wireCanonicalEvents(deps: CanonicalEventsDeps): Disposable {
    const disposables: Disposable[] = [];

    disposables.push(deps.onTaskEnded(taskEnd => {
        if (taskEnd.durationMs < LONG_RUNNING_TASK_MS) { return; }
        void dispatchWithMute(deps, {
            event: 'tasks.completed',
            payload: {
                taskName: taskEnd.taskName,
                durationMs: taskEnd.durationMs,
                exitCode: taskEnd.exitCode,
            },
        });
    }));

    disposables.push(deps.onShellEnded(shellEnd => {
        if (shellEnd.exitCode === null || shellEnd.exitCode === 0) { return; }
        void dispatchWithMute(deps, {
            event: 'terminal.exit',
            payload: {
                terminalId: shellEnd.terminalId,
                exitCode: shellEnd.exitCode,
            },
        });
    }));

    disposables.push(deps.onClaudePermissionRequest(req => {
        void dispatchWithMute(deps, {
            event: 'claudeCode.permissionRequest',
            payload: { requestId: req.requestId, tool: req.tool, description: req.description },
        });
    }));

    disposables.push(deps.onDebugStopped(stop => {
        void dispatchWithMute(deps, {
            event: 'debug.stopped',
            payload: { sessionId: stop.sessionId, reason: stop.reason, frameId: stop.frameId },
        });
    }));

    disposables.push(deps.onConnectionChanged(change => {
        void dispatchWithMute(deps, {
            event: 'connection.changed',
            payload: { state: change.state, deviceId: change.deviceId },
        });
    }));

    return {
        dispose() {
            for (const d of disposables) { d.dispose(); }
        },
    };
}
