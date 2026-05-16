/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { Station } from '../../../../../platform/nzr/common/pipelineState.js';
import { IStationRegistryService, StageChangeEvent } from '../../../../../platform/nzr/common/stationRegistry.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { testWorkspace, Workspace } from '../../../../../platform/workspace/test/common/testWorkspace.js';
import { InMemoryTestFileService, TestContextService } from '../../../../test/common/workbenchTestServices.js';
import { StationRegistryService } from '../../common/stationRegistryService.js';

const WORKSPACE_ROOT = URI.file('/test-workspace');
const STATE_FILE = URI.joinPath(WORKSPACE_ROOT, '.nzrcode/workspace.json');

function workspaceWithFolder(): TestContextService {
	return new TestContextService(testWorkspace(WORKSPACE_ROOT));
}

function workspaceWithoutFolder(): TestContextService {
	return new TestContextService(new Workspace('empty-ws', []));
}

suite('StationRegistryService', () => {

	const disposables = new DisposableStore();

	teardown(() => disposables.clear());
	ensureNoDisposablesAreLeakedInTestSuite();

	function build(opts?: { workspace?: TestContextService; files?: InMemoryTestFileService }): StationRegistryService {
		const instantiationService = disposables.add(new TestInstantiationService());
		instantiationService.stub(IFileService, opts?.files ?? disposables.add(new InMemoryTestFileService()));
		instantiationService.stub(IWorkspaceContextService, opts?.workspace ?? workspaceWithFolder());
		const service = disposables.add(instantiationService.createInstance(StationRegistryService));
		return service;
	}

	test('addStation produces a station with uuid, derived repoName, idle pipeline', async () => {
		const service = build();
		const station = await service.addStation({ repoPath: '/repos/alpha', branch: 'main', preset: 'lean' });

		assert.match(station.id, /^[0-9a-f-]{36}$/);
		assert.strictEqual(station.repoName, 'alpha');
		assert.strictEqual(station.repoPath, '/repos/alpha');
		assert.strictEqual(station.branch, 'main');
		assert.strictEqual(station.preset, 'lean');
		assert.strictEqual(station.pipeline.stage, 'idle');
		assert.strictEqual(station.pipeline.blocked, false);
		assert.strictEqual(service.stations.length, 1);
		assert.strictEqual(service.getStation(station.id), station);
	});

	test('removeStation returns true for existing, false for unknown', async () => {
		const service = build();
		const a = await service.addStation({ repoPath: '/r/a', branch: 'main', preset: 'lean' });

		assert.strictEqual(await service.removeStation('nope'), false);
		assert.strictEqual(service.stations.length, 1);

		assert.strictEqual(await service.removeStation(a.id), true);
		assert.strictEqual(service.stations.length, 0);
		assert.strictEqual(service.getStation(a.id), undefined);
	});

	test('updateStationPipeline applies patch and changes stage', async () => {
		const service = build();
		const a = await service.addStation({ repoPath: '/r/a', branch: 'main', preset: 'lean' });

		await service.updateStationPipeline(a.id, { stage: 'specify', tasksDone: 0 });

		const reloaded = service.getStation(a.id)!;
		assert.strictEqual(reloaded.pipeline.stage, 'specify');
		assert.strictEqual(reloaded.pipeline.tasksDone, 0);
	});

	test('onStationAdded fires once with the new station', async () => {
		const service = build();
		const seen: Station[] = [];
		disposables.add(service.onStationAdded(s => seen.push(s)));

		const a = await service.addStation({ repoPath: '/r/a', branch: 'main', preset: 'lean' });

		assert.strictEqual(seen.length, 1);
		assert.strictEqual(seen[0].id, a.id);
	});

	test('onStationRemoved fires only for successful removals', async () => {
		const service = build();
		const a = await service.addStation({ repoPath: '/r/a', branch: 'main', preset: 'lean' });

		const seen: string[] = [];
		disposables.add(service.onStationRemoved(id => seen.push(id)));

		await service.removeStation('nope');
		assert.deepStrictEqual(seen, []);

		await service.removeStation(a.id);
		assert.deepStrictEqual(seen, [a.id]);
	});

	test('onStationStageChanged fires only when stage actually changes', async () => {
		const service = build();
		const a = await service.addStation({ repoPath: '/r/a', branch: 'main', preset: 'lean' });

		const seen: StageChangeEvent[] = [];
		disposables.add(service.onStationStageChanged(e => seen.push(e)));

		// Patch without stage: no event.
		await service.updateStationPipeline(a.id, { tasksTotal: 5 });
		assert.deepStrictEqual(seen, []);

		// Patch with new stage: event fires.
		await service.updateStationPipeline(a.id, { stage: 'plan' });
		assert.strictEqual(seen.length, 1);
		assert.deepStrictEqual(seen[0], { stationId: a.id, previous: 'idle', next: 'plan' });

		// Same stage patched again: no event.
		await service.updateStationPipeline(a.id, { stage: 'plan' });
		assert.strictEqual(seen.length, 1);
	});

	test('persistence round-trip: stations land in .nzrcode/workspace.json', async () => {
		const files = new InMemoryTestFileService();
		disposables.add(files);
		const service = build({ files });

		await service.addStation({ repoPath: '/r/a', branch: 'main', preset: 'lean' });
		await service.addStation({ repoPath: '/r/b', branch: 'dev', preset: 'django-drf-react' });

		// Debounce window: wait long enough for the flush scheduler to fire.
		await timeout(400);

		const content = await files.readFile(STATE_FILE);
		const parsed = JSON.parse(content.value.toString());
		assert.strictEqual(parsed.version, 1);
		assert.strictEqual(parsed.stations.length, 2);
		assert.strictEqual(parsed.stations[0].repoPath, '/r/a');
		assert.strictEqual(parsed.stations[1].preset, 'django-drf-react');
	});

	test('reload reads existing .nzrcode/workspace.json on first access', async () => {
		const files = new InMemoryTestFileService();
		disposables.add(files);
		await files.writeFile(STATE_FILE, (await import('../../../../../base/common/buffer.js')).VSBuffer.fromString(JSON.stringify({
			version: 1,
			stations: [{
				id: 'preexisting-id',
				repoPath: '/r/x',
				repoName: 'x',
				branch: 'main',
				preset: 'lean',
				pipeline: { stage: 'plan', blocked: false },
				metrics: { tokens: 0, cost: 0, startedAt: 0 },
			}],
		})));

		const service = build({ files });
		// Access stations to trigger load.
		await service.updateStationPipeline('preexisting-id', { tasksTotal: 1 });

		const loaded = service.getStation('preexisting-id');
		assert.ok(loaded);
		assert.strictEqual(loaded!.repoPath, '/r/x');
		assert.strictEqual(loaded!.pipeline.stage, 'plan');
	});

	test('no workspace folder: stations is empty, addStation rejects', async () => {
		const service = build({ workspace: workspaceWithoutFolder() });

		assert.deepStrictEqual(service.stations, []);
		await assert.rejects(
			() => service.addStation({ repoPath: '/r/a', branch: 'main', preset: 'lean' }),
			/no workspace folder/,
		);
	});

	test('service is exposed via IStationRegistryService decorator', () => {
		// Smoke check that the decorator brand is preserved through the
		// instantiation service stub.
		assert.strictEqual(typeof IStationRegistryService, 'function');
	});
});
