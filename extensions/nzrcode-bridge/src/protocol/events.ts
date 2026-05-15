/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// RPC event name registry.
// Each enum member's string value is the on-the-wire event identifier.

import { type TextRange } from './methods';

// ─── Event name enum ──────────────────────────────────────────────────────────

export const enum EventName {
    EditorChanged = 'editor.changed',
    EditorSelectionChanged = 'editor.selectionChanged',
    TerminalData = 'terminal.data',
    TerminalCreated = 'terminal.created',
    TerminalClosed = 'terminal.closed',
    ScmStatusChanged = 'scm.statusChanged',
    TasksStatusChanged = 'tasks.statusChanged',
    TasksCompleted = 'tasks.completed',
    DebugStopped = 'debug.stopped',
    ClaudeCodePermissionRequest = 'claudeCode.permissionRequest',
    ConnectionChanged = 'connection.changed',
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface EventPayload {
    [EventName.EditorChanged]: { readonly editorId: string; readonly path: string };
    [EventName.EditorSelectionChanged]: { readonly editorId: string; readonly selection: TextRange };
    /** data field contains base64-encoded terminal output */
    [EventName.TerminalData]: { readonly terminalId: string; readonly chunkSeq: number; readonly data: string };
    [EventName.TerminalCreated]: { readonly terminalId: string; readonly name: string };
    [EventName.TerminalClosed]: { readonly terminalId: string };
    [EventName.ScmStatusChanged]: {
        readonly stagedCount: number;
        readonly modifiedCount: number;
        readonly untrackedCount: number;
    };
    [EventName.TasksStatusChanged]: {
        readonly executionId: string;
        readonly status: 'running' | 'failed' | 'succeeded';
    };
    [EventName.TasksCompleted]: {
        readonly executionId: string;
        readonly taskName: string;
        readonly durationMs: number;
        readonly exitCode: number | null;
    };
    [EventName.DebugStopped]: {
        readonly sessionId: string;
        readonly reason: string;
        readonly frameId: number | null;
    };
    [EventName.ClaudeCodePermissionRequest]: {
        readonly requestId: string;
        readonly tool: string;
        readonly description: string;
    };
    [EventName.ConnectionChanged]: {
        readonly state: 'connected' | 'disconnected' | 'reconnecting';
        readonly deviceId?: string;
    };
}
