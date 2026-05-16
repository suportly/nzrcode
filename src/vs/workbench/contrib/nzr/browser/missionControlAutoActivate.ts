/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Pure predicate for the Mission Control auto-activate behavior. The
 * contribution feeds in the resolved boolean inputs (setting value +
 * current activation state) so the rule lives in one testable line.
 *
 * Semantics: a `false` setting means "do not activate"; it does NOT
 * mean "force inactive". See spec 0014 cl-1.
 */
export interface IAutoActivateInputs {
	readonly setting: boolean;
	readonly isActive: boolean;
}

export function shouldAutoActivateMissionControl(inputs: IAutoActivateInputs): boolean {
	return inputs.setting && !inputs.isActive;
}
