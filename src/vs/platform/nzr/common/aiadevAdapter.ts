/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { IDisposable } from '../../../base/common/lifecycle.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import {
	AdapterError,
	AiadevResult,
	ClarifyMarkersDetectedEvent,
	InitArgs,
	PreflightArgs,
	RunArgs,
	SpecChangedEvent,
} from './aiadev.js';

export const IAiadevAdapter = createDecorator<IAiadevAdapter>('nzrAiadevAdapter');

/**
 * Headless adapter that runs the `aiadev` CLI for structural commands
 * and watches `specs/<slug>/spec.md` for `[NEEDS CLARIFICATION:cl-N ...]`
 * markers. Slash-command pipeline progression (specify, clarify, plan,
 * tasks, implement) goes through Claude Code — feature 0005 owns that.
 */
export interface IAiadevAdapter {
	readonly _serviceBrand: undefined;

	readonly onSpecChanged: Event<SpecChangedEvent>;
	readonly onClarifyMarkersDetected: Event<ClarifyMarkersDetectedEvent>;
	readonly onAdapterError: Event<AdapterError>;

	runPreflight(args: PreflightArgs): Promise<AiadevResult>;
	runValidate(args: RunArgs): Promise<AiadevResult>;
	runSync(args: RunArgs): Promise<AiadevResult>;
	runInit(args: InitArgs): Promise<AiadevResult>;

	/**
	 * Subscribe to spec changes under `<repoPath>/specs/<slug>/spec.md`.
	 * Returns a disposable that tears down the underlying file watcher.
	 */
	attachSpecWatcher(stationId: string, repoPath: string): IDisposable;
}
