/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IStationRegistryService } from '../../../../../platform/nzr/common/stationRegistry.js';
import { testWorkspace } from '../../../../../platform/workspace/test/common/testWorkspace.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { InMemoryTestFileService, TestContextService } from '../../../../test/common/workbenchTestServices.js';
import { StationRegistryService } from '../../common/stationRegistryService.js';
import { MissionControlService } from '../../common/missionControlService.js';

const WORKSPACE_ROOT = URI.file('/test-ws');

suite('MissionControlService', () => {

	const disposables = new DisposableStore();
	teardown(() => disposables.clear());
	ensureNoDisposablesAreLeakedInTestSuite();

	function build(): { mc: MissionControlService; registry: StationRegistryService } {
		const inst = disposables.add(new TestInstantiationService());
		inst.stub(IFileService, disposables.add(new InMemoryTestFileService()));
		inst.stub(IWorkspaceContextService, new TestContextService(testWorkspace(WORKSPACE_ROOT)));
		const registry = disposables.add(inst.createInstance(StationRegistryService));
		inst.stub(IStationRegistryService, registry);
		const mc = disposables.add(inst.createInstance(MissionControlService));
		return { mc, registry };
	}

	test('starts inactive with empty slots and 0x0 layout', () => {
		const { mc } = build();
		assert.strictEqual(mc.isActive, false);
		assert.deepStrictEqual(mc.slots, []);
		assert.deepStrictEqual(mc.layout, { cols: 0, rows: 0, capacity: 0, overflowScroll: false });
	});

	test('toggle flips state and emits onDidChangeActive', () => {
		const { mc } = build();
		const seen: boolean[] = [];
		disposables.add(mc.onDidChangeActive(v => seen.push(v)));

		mc.toggle();
		assert.strictEqual(mc.isActive, true);
		assert.deepStrictEqual(seen, [true]);

		mc.toggle();
		assert.strictEqual(mc.isActive, false);
		assert.deepStrictEqual(seen, [true, false]);
	});

	test('setActive is idempotent — no event when value is unchanged', () => {
		const { mc } = build();
		const seen: boolean[] = [];
		disposables.add(mc.onDidChangeActive(v => seen.push(v)));

		mc.setActive(false); // already false
		mc.setActive(false);
		assert.deepStrictEqual(seen, []);

		mc.setActive(true);
		mc.setActive(true); // still true
		assert.deepStrictEqual(seen, [true]);
	});

	test('adding stations fills the grid row-major and fires onDidChangeSlots', async () => {
		const { mc, registry } = build();
		let slotEvents = 0;
		disposables.add(mc.onDidChangeSlots(() => slotEvents++));

		const a = await registry.addStation({ repoPath: '/r/a', branch: 'main', preset: 'lean' });
		const b = await registry.addStation({ repoPath: '/r/b', branch: 'main', preset: 'lean' });
		const c = await registry.addStation({ repoPath: '/r/c', branch: 'main', preset: 'lean' });

		assert.ok(slotEvents >= 3, `expected >=3 slot events, got ${slotEvents}`);
		assert.strictEqual(mc.slots.length, 3);

		// 3 stations -> 2x2 grid; positions are row-major.
		assert.deepStrictEqual(mc.slots[0], { stationId: a.id, row: 0, col: 0 });
		assert.deepStrictEqual(mc.slots[1], { stationId: b.id, row: 0, col: 1 });
		assert.deepStrictEqual(mc.slots[2], { stationId: c.id, row: 1, col: 0 });

		assert.strictEqual(mc.layout.cols, 2);
		assert.strictEqual(mc.layout.rows, 2);
	});

	test('removing a station reflows remaining slots', async () => {
		const { mc, registry } = build();

		const a = await registry.addStation({ repoPath: '/r/a', branch: 'main', preset: 'lean' });
		const b = await registry.addStation({ repoPath: '/r/b', branch: 'main', preset: 'lean' });
		const c = await registry.addStation({ repoPath: '/r/c', branch: 'main', preset: 'lean' });
		const d = await registry.addStation({ repoPath: '/r/d', branch: 'main', preset: 'lean' });

		assert.strictEqual(mc.slots.length, 4);

		const removed = await registry.removeStation(a.id);
		assert.strictEqual(removed, true);

		// 3 left: b, c, d at (0,0), (0,1), (1,0).
		assert.strictEqual(mc.slots.length, 3);
		assert.deepStrictEqual(mc.slots[0], { stationId: b.id, row: 0, col: 0 });
		assert.deepStrictEqual(mc.slots[1], { stationId: c.id, row: 0, col: 1 });
		assert.deepStrictEqual(mc.slots[2], { stationId: d.id, row: 1, col: 0 });
	});

	test('seven stations trigger overflowScroll layout', async () => {
		const { mc, registry } = build();

		for (let i = 0; i < 7; i++) {
			await registry.addStation({ repoPath: `/r/${i}`, branch: 'main', preset: 'lean' });
		}

		assert.strictEqual(mc.slots.length, 7);
		assert.deepStrictEqual(mc.layout, { cols: 3, rows: 2, capacity: 6, overflowScroll: true });
		// 7th station's slot still computes a row/col (caller paints scroll).
		assert.strictEqual(mc.slots[6].row, 2);
		assert.strictEqual(mc.slots[6].col, 0);
	});
});
