/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert/strict';
import { EventName, MethodName, type EventPayload, type MethodParams, type MethodResult } from '../../../protocol';

// ─── Compile-time exhaustiveness checks ──────────────────────────────────────
// These assignments do nothing at runtime but cause a TypeScript error if any
// MethodName key is missing from MethodParams, MethodResult, or EventPayload.

export const _methodParamsExhaustive: { [K in MethodName]: MethodParams[K] } = null as unknown as {
    [K in MethodName]: MethodParams[K];
};

export const _methodResultExhaustive: { [K in MethodName]: MethodResult[K] } = null as unknown as {
    [K in MethodName]: MethodResult[K];
};

export const _eventPayloadExhaustive: { [K in EventName]: EventPayload[K] } = null as unknown as {
    [K in EventName]: EventPayload[K];
};

// ─── MethodName enum values ───────────────────────────────────────────────────

suite('MethodName enum values match on-the-wire identifiers', () => {
    test('system method names equal their wire string values', () => {
        assert.equal(MethodName.SystemHello, 'system.hello');
        assert.equal(MethodName.SystemAuthenticate, 'system.authenticate');
    });

    test('commands method names equal their wire string values', () => {
        assert.equal(MethodName.CommandsExecute, 'commands.execute');
        assert.equal(MethodName.CommandsList, 'commands.list');
    });

    test('workspace method names equal their wire string values', () => {
        assert.equal(MethodName.WorkspaceListFolders, 'workspace.listFolders');
        assert.equal(MethodName.WorkspaceFindFiles, 'workspace.findFiles');
        assert.equal(MethodName.WorkspaceReadFile, 'workspace.readFile');
        assert.equal(MethodName.WorkspaceWriteFile, 'workspace.writeFile');
    });

    test('editor method names equal their wire string values', () => {
        assert.equal(MethodName.EditorOpenFile, 'editor.openFile');
        assert.equal(MethodName.EditorGetActive, 'editor.getActive');
        assert.equal(MethodName.EditorApplyEdit, 'editor.applyEdit');
        assert.equal(MethodName.EditorSetSelection, 'editor.setSelection');
        assert.equal(MethodName.EditorRevealLine, 'editor.revealLine');
    });

    test('terminal method names equal their wire string values', () => {
        assert.equal(MethodName.TerminalList, 'terminal.list');
        assert.equal(MethodName.TerminalSendText, 'terminal.sendText');
        assert.equal(MethodName.TerminalSignal, 'terminal.signal');
    });

    test('scm method names equal their wire string values', () => {
        assert.equal(MethodName.ScmStatus, 'scm.status');
        assert.equal(MethodName.ScmDiff, 'scm.diff');
        assert.equal(MethodName.ScmStage, 'scm.stage');
        assert.equal(MethodName.ScmCommit, 'scm.commit');
    });

    test('tasks method names equal their wire string values', () => {
        assert.equal(MethodName.TasksList, 'tasks.list');
        assert.equal(MethodName.TasksRun, 'tasks.run');
        assert.equal(MethodName.TasksCancel, 'tasks.cancel');
    });

    test('debug method names equal their wire string values', () => {
        assert.equal(MethodName.DebugStart, 'debug.start');
        assert.equal(MethodName.DebugStop, 'debug.stop');
        assert.equal(MethodName.DebugBreakpointAdd, 'debug.breakpointAdd');
        assert.equal(MethodName.DebugVariables, 'debug.variables');
    });

    test('notifications method names equal their wire string values', () => {
        assert.equal(MethodName.NotificationsRegister, 'notifications.register');
        assert.equal(MethodName.NotificationsUnregister, 'notifications.unregister');
        assert.equal(MethodName.NotificationsPreferences, 'notifications.preferences');
    });

    test('events method names equal their wire string values', () => {
        assert.equal(MethodName.EventsSubscribe, 'events.subscribe');
        assert.equal(MethodName.EventsUnsubscribe, 'events.unsubscribe');
    });
});

// ─── EventName enum values ────────────────────────────────────────────────────

suite('EventName enum values match on-the-wire identifiers', () => {
    test('editor event names equal their wire string values', () => {
        assert.equal(EventName.EditorChanged, 'editor.changed');
        assert.equal(EventName.EditorSelectionChanged, 'editor.selectionChanged');
    });

    test('terminal event names equal their wire string values', () => {
        assert.equal(EventName.TerminalData, 'terminal.data');
        assert.equal(EventName.TerminalCreated, 'terminal.created');
        assert.equal(EventName.TerminalClosed, 'terminal.closed');
    });

    test('scm event names equal their wire string values', () => {
        assert.equal(EventName.ScmStatusChanged, 'scm.statusChanged');
    });

    test('tasks event names equal their wire string values', () => {
        assert.equal(EventName.TasksStatusChanged, 'tasks.statusChanged');
        assert.equal(EventName.TasksCompleted, 'tasks.completed');
    });

    test('debug event names equal their wire string values', () => {
        assert.equal(EventName.DebugStopped, 'debug.stopped');
    });

    test('claudeCode event names equal their wire string values', () => {
        assert.equal(EventName.ClaudeCodePermissionRequest, 'claudeCode.permissionRequest');
    });

    test('connection event names equal their wire string values', () => {
        assert.equal(EventName.ConnectionChanged, 'connection.changed');
    });
});
