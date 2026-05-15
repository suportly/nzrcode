/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IStationRegistryService } from '../../../../platform/nzr/common/stationRegistry.js';
import { IMissionControlService } from './missionControl.js';
import { MissionControlService } from './missionControlService.js';
import { StationRegistryService } from './stationRegistryService.js';

registerSingleton(IStationRegistryService, StationRegistryService, InstantiationType.Delayed);
registerSingleton(IMissionControlService, MissionControlService, InstantiationType.Delayed);
