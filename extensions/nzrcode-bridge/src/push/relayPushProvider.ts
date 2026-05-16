/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// RelayPushProvider — HTTPS POST to the centralised relay (cl-7). Wraps the
// transport error semantics: any transport failure or HTTP 5xx surfaces as
// `RelayUnavailableError`, which the pushDispatcher (T033) uses as its
// fallback trigger.
//
// Article VI: apnsTokens NEVER appear in logs — only the count.

import type { IPushProvider, PushEvent } from './IPushProvider';
import type { PairedDevice } from '../pairing/pairedDevices';

export const PUSH_RELAY_URL = 'https://push-relay.nzrcode.dev/v1/push';
export const PUSH_RELAY_TIMEOUT_MS = 3000;

export class RelayUnavailableError extends Error {
    constructor(reason: string, public readonly cause?: unknown) {
        super(`Push relay unavailable: ${reason}`);
        this.name = 'RelayUnavailableError';
    }
}

export type HttpPostClient = (
    url: string,
    body: string,
    timeoutMs: number,
) => Promise<{ readonly statusCode: number }>;

export interface RelayLogger {
    info(msg: string, fields?: unknown): void;
    warn(msg: string, fields?: unknown): void;
    error(msg: string, fields?: unknown): void;
}

export interface RelayPushProviderDeps {
    readonly httpPost: HttpPostClient;
    readonly getApnsTokens: (devices: readonly PairedDevice[]) => Promise<readonly string[]>;
    readonly logger?: RelayLogger;
}

export class RelayPushProvider implements IPushProvider {

    constructor(private readonly _deps: RelayPushProviderDeps) {}

    async send(devices: readonly PairedDevice[], event: PushEvent): Promise<void> {
        const apnsTokens = await this._deps.getApnsTokens(devices);
        const body = JSON.stringify({ apnsTokens, payload: event });

        let response: { statusCode: number };
        try {
            response = await this._deps.httpPost(PUSH_RELAY_URL, body, PUSH_RELAY_TIMEOUT_MS);
        } catch (err) {
            this._deps.logger?.warn('push.relay.failed', {
                event: event.event,
                count: apnsTokens.length,
                reason: 'transport',
            });
            throw new RelayUnavailableError('transport error', err);
        }

        if (response.statusCode >= 500) {
            this._deps.logger?.warn('push.relay.failed', {
                event: event.event,
                count: apnsTokens.length,
                statusCode: response.statusCode,
            });
            throw new RelayUnavailableError(`HTTP ${response.statusCode}`);
        }

        if (response.statusCode >= 400) {
            throw new Error(`Push relay rejected: HTTP ${response.statusCode}`);
        }

        this._deps.logger?.info('push.relay.sent', {
            event: event.event,
            count: apnsTokens.length,
        });
    }
}
