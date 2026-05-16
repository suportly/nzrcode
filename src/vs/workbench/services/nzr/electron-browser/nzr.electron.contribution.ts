/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IAiadevAdapter } from '../../../../platform/nzr/common/aiadevAdapter.js';
import { AiadevAdapter } from './aiadevAdapter.js';

registerSingleton(IAiadevAdapter, AiadevAdapter, InstantiationType.Delayed);
