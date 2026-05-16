/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// JSON-RPC dispatcher with authentication gate.
// Sits between BridgeConnection (wsServer.ts) and namespace handler functions.
// Enforces: first message MUST be system.authenticate with a valid token.
// Subsequent messages route by method name to registered handlers.

import {
    parseMessage,
    serializeResponse,
    serializeErrorResponse,
    isRequest,
    isNotification,
    ParseError,
} from '../protocol/jsonrpc';
import type { JsonRpcId, JsonRpcError } from '../protocol/jsonrpc';
import { MethodName } from '../protocol/methods';
import type { MethodParams, MethodResult } from '../protocol/methods';
import { BridgeErrorCode, bridgeError } from '../protocol/errors';
import type { TokenLookupResult } from './auth';
import { logRequest } from '../logging';
import type { BridgeConnection } from './wsServer';

// ─── Public types ─────────────────────────────────────────────────────────────

export type Logger = {
    readonly info: (msg: string, fields?: unknown) => void;
    readonly warn: (msg: string, fields?: unknown) => void;
    readonly error: (msg: string, fields?: unknown) => void;
};

/**
 * A handler implements one RPC method. Receives the typed params, returns the
 * typed result (or throws to produce a JsonRpcError via thrown.bridgeError(...)).
 */
export type Handler<M extends MethodName> = (
    params: MethodParams[M],
) => Promise<MethodResult[M]> | MethodResult[M];

export interface DispatcherDeps {
    /**
     * Look up an inbound candidate token against the per-device tokens
     * map (and any in-flight pair-time slot the caller owns).
     * Returns the matched device identity, or undefined on miss.
     */
    readonly lookupToken: (candidate: string) => TokenLookupResult | undefined;
    /** Structured logger. Pass console-compat or a vscode.OutputChannel adapter. */
    readonly logger: Logger;
}

// ─── WS close codes ───────────────────────────────────────────────────────────

/** Custom WebSocket close code: authentication failure (RFC 6455 §7.4.2 range 4000–4999). */
const WS_CLOSE_AUTH_FAILURE = 4001;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function isJsonRpcError(value: unknown): value is JsonRpcError {
    return (
        value !== null &&
        typeof value === 'object' &&
        typeof (value as Record<string, unknown>)['code'] === 'number' &&
        typeof (value as Record<string, unknown>)['message'] === 'string'
    );
}

function sendError(conn: BridgeConnection, id: JsonRpcId | null, error: JsonRpcError): void {
    if (conn.isOpen()) {
        conn.send(serializeErrorResponse(id, error));
    }
}

function closeWithAuthFailure(conn: BridgeConnection, id: JsonRpcId | null, logger: Logger, remoteAddress: string, reason: string): void {
    sendError(conn, id, bridgeError(BridgeErrorCode.AuthFailure));
    logger.warn('rpc.auth_failure', { remoteAddress, reason });
    conn.close(WS_CLOSE_AUTH_FAILURE, 'auth_failure');
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export class Dispatcher {
    private readonly _deps: DispatcherDeps;
    private readonly _handlers = new Map<MethodName, Handler<MethodName>>();

    constructor(deps: DispatcherDeps) {
        this._deps = deps;
    }

    /** Register a handler for an RPC method. Throws if the method is already registered. */
    register<M extends MethodName>(method: M, handler: Handler<M>): void {
        if (this._handlers.has(method)) {
            throw new Error(`Dispatcher: method "${method}" is already registered`);
        }
        this._handlers.set(method, handler as unknown as Handler<MethodName>);
    }

    /** Returns the list of registered method names (for `system.hello` capabilities). */
    registeredMethods(): readonly MethodName[] {
        return Array.from(this._handlers.keys());
    }

    /** Attach this dispatcher to a fresh client connection. Owns the conn's onMessage/onClose hooks. */
    attach(conn: BridgeConnection): void {
        let authenticated = false;

        conn.onMessage((frame: string) => {
            if (!authenticated) {
                this._handleUnauthenticated(conn, frame, () => { authenticated = true; });
            } else {
                void this._handleAuthenticated(conn, frame);
            }
        });
    }

    // ─── Unauthenticated state ─────────────────────────────────────────────────

    private _handleUnauthenticated(
        conn: BridgeConnection,
        frame: string,
        onSuccess: () => void,
    ): void {
        const { lookupToken, logger } = this._deps;
        const remoteAddress = conn.remoteAddress;

        let parsed;
        try {
            parsed = parseMessage(frame);
        } catch (err) {
            if (err instanceof ParseError) {
                closeWithAuthFailure(conn, null, logger, remoteAddress, 'malformed_json');
                return;
            }
            throw err;
        }

        // Must be a Request (has id), method system.authenticate
        if (!isRequest(parsed) || parsed.method !== MethodName.SystemAuthenticate) {
            const id = isRequest(parsed) ? parsed.id : null;
            closeWithAuthFailure(conn, id, logger, remoteAddress, 'wrong_first_message');
            return;
        }

        const params = parsed.params as MethodParams[MethodName.SystemAuthenticate] | undefined;
        const candidateToken = params?.token;

        logger.info('rpc.request', {
            remoteAddress,
            ...logRequest({ method: parsed.method, params, remoteAddress }),
        });

        if (typeof candidateToken !== 'string') {
            closeWithAuthFailure(conn, parsed.id, logger, remoteAddress, 'invalid_token');
            return;
        }
        const lookup = lookupToken(candidateToken);
        if (!lookup) {
            closeWithAuthFailure(conn, parsed.id, logger, remoteAddress, 'invalid_token');
            return;
        }

        if ('deviceId' in lookup) {
            conn._setAuthenticatedDeviceId(lookup.deviceId);
        }

        conn.send(serializeResponse<MethodResult[MethodName.SystemAuthenticate]>(parsed.id, { ok: true }));
        onSuccess();
    }

    // ─── Authenticated state ───────────────────────────────────────────────────

    private async _handleAuthenticated(conn: BridgeConnection, frame: string): Promise<void> {
        const { logger } = this._deps;
        const remoteAddress = conn.remoteAddress;

        let parsed;
        try {
            parsed = parseMessage(frame);
        } catch {
            sendError(conn, null, bridgeError(BridgeErrorCode.InternalError));
            return;
        }

        // Silently drop notifications and responses from client
        if (isNotification(parsed) || (!isRequest(parsed))) {
            return;
        }

        const method = parsed.method as MethodName;
        const params = parsed.params;

        logger.info('rpc.request', {
            remoteAddress,
            ...logRequest({ method, params, remoteAddress }),
        });

        await this._dispatchRequest(conn, parsed.id, method, params);
    }

    // ─── Request dispatch ──────────────────────────────────────────────────────

    private async _dispatchRequest(
        conn: BridgeConnection,
        id: JsonRpcId,
        method: MethodName,
        params: unknown,
    ): Promise<void> {
        const { logger } = this._deps;
        const handler = this._handlers.get(method);

        if (!handler) {
            sendError(conn, id, bridgeError(BridgeErrorCode.CommandNotFound, { method }));
            return;
        }

        try {
            const result = await handler(params as MethodParams[MethodName]);
            if (conn.isOpen()) {
                conn.send(serializeResponse(id, result));
            }
        } catch (err) {
            logger.error('rpc.handler_error', { method, error: String(err) });
            const error = isJsonRpcError(err)
                ? err
                : bridgeError(BridgeErrorCode.InternalError, { detail: String(err) });
            sendError(conn, id, error);
        }
    }
}
