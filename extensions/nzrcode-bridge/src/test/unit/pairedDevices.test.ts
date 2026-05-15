/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import {
	PairedDeviceStore,
	PAIRED_DEVICES_KEY,
	SECRET_KEY_PREFIX,
	type PairedDevice,
	type PairedDeviceStorageDeps,
} from '../../pairing/pairedDevices';

// ---------------------------------------------------------------------------
// In-memory fakes
// ---------------------------------------------------------------------------

class InMemoryMemento {
	private readonly store = new Map<string, unknown>();

	keys(): readonly string[] {
		return Array.from(this.store.keys());
	}

	get<T>(key: string): T | undefined;
	get<T>(key: string, defaultValue: T): T;
	get<T>(key: string, defaultValue?: T): T | undefined {
		return (this.store.has(key) ? this.store.get(key) : defaultValue) as T | undefined;
	}

	update(key: string, value: unknown): Thenable<void> {
		if (value === undefined) {
			this.store.delete(key);
		} else {
			this.store.set(key, value);
		}
		return Promise.resolve();
	}
}

class InMemorySecretStorage {
	public readonly storage = new Map<string, string>();

	async get(key: string): Promise<string | undefined> {
		return this.storage.get(key);
	}

	async store(key: string, value: string): Promise<void> {
		this.storage.set(key, value);
	}

	async delete(key: string): Promise<void> {
		this.storage.delete(key);
	}

	onDidChange = (_listener: unknown) => ({ dispose() { /* no-op */ } });
}

function makeDeps(): {
	deps: PairedDeviceStorageDeps;
	memento: InMemoryMemento;
	secrets: InMemorySecretStorage;
} {
	const memento = new InMemoryMemento();
	const secrets = new InMemorySecretStorage();
	return {
		deps: {
			globalState: memento as unknown as PairedDeviceStorageDeps['globalState'],
			secrets: secrets as unknown as PairedDeviceStorageDeps['secrets'],
		},
		memento,
		secrets,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite('PairedDeviceStore', () => {
	// 1. New store with empty globalState → list() returns []
	test('new store with empty globalState → list() returns []', () => {
		const { deps } = makeDeps();
		const store = new PairedDeviceStore(deps);
		assert.deepEqual(store.list(), []);
	});

	// 2. register() adds a record; subsequent list() returns one element
	test('register() adds a record with current timestamps; list() returns one element', async () => {
		const { deps } = makeDeps();
		const store = new PairedDeviceStore(deps);
		const before = Date.now();
		const device = await store.register({ deviceId: 'dev-1', deviceName: 'My iPad' });
		const after = Date.now();

		assert.equal(device.deviceId, 'dev-1');
		assert.equal(device.deviceName, 'My iPad');
		assert.ok(device.pairedAt >= before && device.pairedAt <= after, 'pairedAt out of range');
		assert.ok(device.lastSeenAt >= before && device.lastSeenAt <= after, 'lastSeenAt out of range');

		const list = store.list();
		assert.equal(list.length, 1);
		assert.deepEqual(list[0], device);
	});

	// 3. register() called twice with same deviceId → still 1 entry; deviceName updated
	test('register() twice with same deviceId → 1 entry; deviceName reflects second call', async () => {
		const { deps } = makeDeps();
		const store = new PairedDeviceStore(deps);
		await store.register({ deviceId: 'dev-1', deviceName: 'Old Name' });
		await store.register({ deviceId: 'dev-1', deviceName: 'New Name' });

		const list = store.list();
		assert.equal(list.length, 1);
		assert.equal(list[0].deviceName, 'New Name');
	});

	// 4. register() updates lastSeenAt but preserves pairedAt on re-register
	test('register() on re-register updates lastSeenAt but preserves pairedAt', async () => {
		const { deps } = makeDeps();
		const store = new PairedDeviceStore(deps);
		const first = await store.register({ deviceId: 'dev-1', deviceName: 'iPad' });
		await new Promise(r => setTimeout(r, 5));
		const second = await store.register({ deviceId: 'dev-1', deviceName: 'iPad Pro' });

		assert.equal(second.pairedAt, first.pairedAt, 'pairedAt should be preserved');
		assert.ok(second.lastSeenAt >= first.lastSeenAt, 'lastSeenAt should be updated');
	});

	// 5. attachApnsToken() stores under correct SecretStorage key
	test('attachApnsToken() stores token under paired-device:<deviceId> key in SecretStorage', async () => {
		const { deps, secrets } = makeDeps();
		const store = new PairedDeviceStore(deps);
		await store.attachApnsToken('dev-1', 'apns-token-abc123');

		assert.equal(secrets.storage.get(`${SECRET_KEY_PREFIX}dev-1`), 'apns-token-abc123');
	});

	// 6. getApnsToken() returns the previously stored token; undefined for unknown device
	test('getApnsToken() returns stored token; undefined for unknown device', async () => {
		const { deps } = makeDeps();
		const store = new PairedDeviceStore(deps);
		await store.attachApnsToken('dev-1', 'my-apns-token');

		assert.equal(await store.getApnsToken('dev-1'), 'my-apns-token');
		assert.equal(await store.getApnsToken('unknown'), undefined);
	});

	// 7. cl-11 isolation: APNs token NEVER lands in globalState
	test('cl-11: after register + attachApnsToken, globalState array elements do not contain apnsToken', async () => {
		const { deps, memento } = makeDeps();
		const store = new PairedDeviceStore(deps);
		await store.register({ deviceId: 'dev-1', deviceName: 'iPad' });
		await store.attachApnsToken('dev-1', 'secret-apns-token');

		const stored = memento.get<PairedDevice[]>(PAIRED_DEVICES_KEY) ?? [];
		for (const entry of stored) {
			assert.ok(
				!Object.prototype.hasOwnProperty.call(entry, 'apnsToken'),
				`Found apnsToken in globalState entry: ${JSON.stringify(entry)}`,
			);
		}
	});

	// 8. list() items contain only the expected keys
	test('list() items contain only {deviceId, deviceName, pairedAt, lastSeenAt} — no extra keys', async () => {
		const { deps } = makeDeps();
		const store = new PairedDeviceStore(deps);
		await store.register({ deviceId: 'dev-1', deviceName: 'iPad' });
		await store.attachApnsToken('dev-1', 'secret-token');

		const [item] = store.list();
		const keys = Object.keys(item).sort();
		assert.deepEqual(keys, ['deviceId', 'deviceName', 'lastSeenAt', 'pairedAt']);
	});

	// 9. touch() updates lastSeenAt after a small delay
	test('touch() updates lastSeenAt by at least 1 ms after a small delay', async () => {
		const { deps } = makeDeps();
		const store = new PairedDeviceStore(deps);
		const device = await store.register({ deviceId: 'dev-1', deviceName: 'iPad' });
		const before = device.lastSeenAt;

		await new Promise(r => setTimeout(r, 5));
		await store.touch('dev-1');

		const updated = store.list()[0];
		assert.ok(updated.lastSeenAt >= before + 1, `lastSeenAt not updated: ${before} → ${updated.lastSeenAt}`);
	});

	// 10. touch() for unknown deviceId is a no-op
	test('touch() for unknown deviceId is a no-op (no throw, no side effect)', async () => {
		const { deps } = makeDeps();
		const store = new PairedDeviceStore(deps);
		await assert.doesNotReject(() => store.touch('non-existent-device'));
		assert.equal(store.list().length, 0);
	});

	// 11. revoke() removes from list() AND from secrets
	test('revoke() removes device from list() and APNs token from secrets', async () => {
		const { deps } = makeDeps();
		const store = new PairedDeviceStore(deps);
		await store.register({ deviceId: 'dev-1', deviceName: 'iPad' });
		await store.attachApnsToken('dev-1', 'apns-token');

		await store.revoke('dev-1');

		assert.equal(store.list().length, 0);
		assert.equal(await store.getApnsToken('dev-1'), undefined);
	});

	// 12. revoke() for unknown deviceId does NOT throw
	test('revoke() for unknown deviceId does not throw', async () => {
		const { deps } = makeDeps();
		const store = new PairedDeviceStore(deps);
		await assert.doesNotReject(() => store.revoke('non-existent'));
	});

	// 13. clear() removes all devices and secrets
	test('clear() removes all devices and secrets; list() is [] and getApnsToken returns undefined', async () => {
		const { deps } = makeDeps();
		const store = new PairedDeviceStore(deps);
		await store.register({ deviceId: 'dev-1', deviceName: 'iPad 1' });
		await store.register({ deviceId: 'dev-2', deviceName: 'iPad 2' });
		await store.attachApnsToken('dev-1', 'token-1');
		await store.attachApnsToken('dev-2', 'token-2');

		await store.clear();

		assert.deepEqual(store.list(), []);
		assert.equal(await store.getApnsToken('dev-1'), undefined);
		assert.equal(await store.getApnsToken('dev-2'), undefined);
	});

	// 14. Persistence: second store with same memento/secrets reflects first store's writes
	test('second PairedDeviceStore with same deps reflects what the first wrote', async () => {
		const { deps } = makeDeps();
		const storeA = new PairedDeviceStore(deps);
		await storeA.register({ deviceId: 'dev-1', deviceName: 'iPad' });
		await storeA.attachApnsToken('dev-1', 'apns-persistent');

		// Create a second store backed by the same memento + secrets
		const storeB = new PairedDeviceStore(deps);
		const list = storeB.list();
		assert.equal(list.length, 1);
		assert.equal(list[0].deviceId, 'dev-1');
		assert.equal(await storeB.getApnsToken('dev-1'), 'apns-persistent');
	});

	// 15. Constructor isolation: mutating list() return value does not affect store state
	test('mutating list() return value does not affect store internal state', async () => {
		const { deps } = makeDeps();
		const store = new PairedDeviceStore(deps);
		await store.register({ deviceId: 'dev-1', deviceName: 'iPad' });

		const list = store.list() as PairedDevice[];
		list.splice(0, 1); // remove the item from the returned array

		// Store's internal state should be unchanged
		assert.equal(store.list().length, 1);
	});
});
