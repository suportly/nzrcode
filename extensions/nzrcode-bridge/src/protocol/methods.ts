/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// RPC method name registry.
// Each enum member's string value is the on-the-wire method identifier.

// ─── Supporting types ─────────────────────────────────────────────────────────

export interface TextRange {
    readonly startLine: number;
    readonly startCol: number;
    readonly endLine: number;
    readonly endCol: number;
}

export interface EditOperation {
    readonly range: TextRange;
    readonly newText: string;
}

export interface WorkspaceFolderInfo {
    readonly name: string;
    readonly path: string;
}

export interface TerminalInfo {
    readonly id: string;
    readonly name: string;
    readonly cwd?: string;
}

export interface TaskInfo {
    readonly name: string;
    readonly source: string;
    readonly running: boolean;
}

export interface DebugVariable {
    readonly name: string;
    readonly value: string;
    readonly type: string;
}

// ─── Method name enum ─────────────────────────────────────────────────────────

export const enum MethodName {
    SystemHello = 'system.hello',
    SystemAuthenticate = 'system.authenticate',
    SystemRegister = 'system.register',

    CommandsExecute = 'commands.execute',
    CommandsList = 'commands.list',

    WorkspaceListFolders = 'workspace.listFolders',
    WorkspaceFindFiles = 'workspace.findFiles',
    WorkspaceReadFile = 'workspace.readFile',
    WorkspaceWriteFile = 'workspace.writeFile',

    EditorOpenFile = 'editor.openFile',
    EditorGetActive = 'editor.getActive',
    EditorApplyEdit = 'editor.applyEdit',
    EditorSetSelection = 'editor.setSelection',
    EditorRevealLine = 'editor.revealLine',

    TerminalList = 'terminal.list',
    TerminalSendText = 'terminal.sendText',
    TerminalSignal = 'terminal.signal',

    ScmStatus = 'scm.status',
    ScmDiff = 'scm.diff',
    ScmStage = 'scm.stage',
    ScmCommit = 'scm.commit',

    TasksList = 'tasks.list',
    TasksRun = 'tasks.run',
    TasksCancel = 'tasks.cancel',

    DebugStart = 'debug.start',
    DebugStop = 'debug.stop',
    DebugBreakpointAdd = 'debug.breakpointAdd',
    DebugVariables = 'debug.variables',

    NotificationsRegister = 'notifications.register',
    NotificationsUnregister = 'notifications.unregister',
    NotificationsPreferences = 'notifications.preferences',

    EventsSubscribe = 'events.subscribe',
    EventsUnsubscribe = 'events.unsubscribe',
}

// ─── Param types ──────────────────────────────────────────────────────────────

export interface MethodParams {
    [MethodName.SystemHello]: undefined;
    [MethodName.SystemAuthenticate]: { readonly token: string };
    [MethodName.SystemRegister]: { readonly deviceId: string; readonly deviceName: string; readonly apnsToken?: string };

    [MethodName.CommandsExecute]: { readonly command: string; readonly args?: readonly unknown[] };
    [MethodName.CommandsList]: undefined;

    [MethodName.WorkspaceListFolders]: undefined;
    [MethodName.WorkspaceFindFiles]: { readonly pattern: string; readonly maxResults?: number };
    [MethodName.WorkspaceReadFile]: { readonly path: string };
    [MethodName.WorkspaceWriteFile]: { readonly path: string; readonly contentBase64: string };

    [MethodName.EditorOpenFile]: { readonly path: string; readonly preview?: boolean };
    [MethodName.EditorGetActive]: undefined;
    [MethodName.EditorApplyEdit]: { readonly editorId: string; readonly edits: readonly EditOperation[] };
    [MethodName.EditorSetSelection]: { readonly editorId: string; readonly selection: TextRange };
    [MethodName.EditorRevealLine]: { readonly editorId: string; readonly line: number };

    [MethodName.TerminalList]: undefined;
    [MethodName.TerminalSendText]: { readonly terminalId: string; readonly text: string };
    [MethodName.TerminalSignal]: { readonly terminalId: string; readonly signal: 'SIGINT' | 'SIGTERM' };

    [MethodName.ScmStatus]: undefined;
    [MethodName.ScmDiff]: { readonly path: string };
    [MethodName.ScmStage]: { readonly paths: readonly string[] };
    [MethodName.ScmCommit]: { readonly message: string };

    [MethodName.TasksList]: undefined;
    [MethodName.TasksRun]: { readonly taskName: string };
    [MethodName.TasksCancel]: { readonly executionId: string };

    [MethodName.DebugStart]: { readonly configurationName: string };
    [MethodName.DebugStop]: { readonly sessionId: string };
    [MethodName.DebugBreakpointAdd]: { readonly path: string; readonly line: number };
    [MethodName.DebugVariables]: { readonly frameId: number };

    [MethodName.NotificationsRegister]: { readonly deviceId: string; readonly apnsToken: string };
    [MethodName.NotificationsUnregister]: { readonly deviceId: string };
    [MethodName.NotificationsPreferences]: { readonly deviceId: string; readonly muted: readonly string[] };

    [MethodName.EventsSubscribe]: { readonly patterns: readonly string[] };
    [MethodName.EventsUnsubscribe]: { readonly patterns: readonly string[] };
}

// ─── Result types ─────────────────────────────────────────────────────────────

export interface MethodResult {
    [MethodName.SystemHello]: {
        readonly serverVersion: string;
        readonly capabilities: readonly string[];
        readonly hostname: string;
        readonly platform: string;
    };
    [MethodName.SystemAuthenticate]: { readonly ok: true };
    [MethodName.SystemRegister]: { readonly registered: true };

    [MethodName.CommandsExecute]: { readonly value: unknown };
    [MethodName.CommandsList]: { readonly commands: readonly string[] };

    [MethodName.WorkspaceListFolders]: { readonly folders: readonly WorkspaceFolderInfo[] };
    [MethodName.WorkspaceFindFiles]: { readonly paths: readonly string[] };
    [MethodName.WorkspaceReadFile]: { readonly contentBase64: string; readonly byteCount: number };
    [MethodName.WorkspaceWriteFile]: { readonly byteCount: number };

    [MethodName.EditorOpenFile]: { readonly editorId: string };
    [MethodName.EditorGetActive]: { readonly editorId: string | null; readonly path: string | null };
    [MethodName.EditorApplyEdit]: { readonly applied: boolean };
    [MethodName.EditorSetSelection]: { readonly applied: boolean };
    [MethodName.EditorRevealLine]: { readonly applied: boolean };

    [MethodName.TerminalList]: { readonly terminals: readonly TerminalInfo[] };
    [MethodName.TerminalSendText]: { readonly sent: boolean };
    [MethodName.TerminalSignal]: { readonly sent: boolean };

    [MethodName.ScmStatus]: {
        readonly staged: readonly string[];
        readonly modified: readonly string[];
        readonly untracked: readonly string[];
    };
    [MethodName.ScmDiff]: { readonly diff: string };
    [MethodName.ScmStage]: { readonly staged: readonly string[] };
    [MethodName.ScmCommit]: { readonly commitId: string };

    [MethodName.TasksList]: { readonly tasks: readonly TaskInfo[] };
    [MethodName.TasksRun]: { readonly executionId: string };
    [MethodName.TasksCancel]: { readonly cancelled: boolean };

    [MethodName.DebugStart]: { readonly sessionId: string };
    [MethodName.DebugStop]: { readonly stopped: boolean };
    [MethodName.DebugBreakpointAdd]: { readonly breakpointId: string };
    [MethodName.DebugVariables]: { readonly variables: readonly DebugVariable[] };

    [MethodName.NotificationsRegister]: { readonly registered: boolean };
    [MethodName.NotificationsUnregister]: { readonly unregistered: boolean };
    [MethodName.NotificationsPreferences]: { readonly applied: boolean };

    [MethodName.EventsSubscribe]: { readonly subscribed: readonly string[] };
    [MethodName.EventsUnsubscribe]: { readonly unsubscribed: readonly string[] };
}
