#!/usr/bin/env node
// Generate NZRCode platform icons from resources/nzrcode-brand/wordmark.svg.
//
// Usage:
//   node build/lib/nzrcode/generate-icons.mjs --write
//   node build/lib/nzrcode/generate-icons.mjs --check
//
// --write rasterises the SVG into the four platform icon files declared below,
// using ImageMagick's `convert` (system dependency, available in CI and on
// every Linux/macOS dev box) and builds the .icns container by hand from
// 512px and 1024px PNGs. No new NPM dependency is added.
//
// --check verifies the icon files exist and are not empty. Byte-for-byte
// determinism between `--write` runs is NOT asserted because ImageMagick's
// output drifts across versions; the SVG source is the canonical artefact
// (test/nzrcode-brand/test_icons_exist.sh pins its sha256).

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const SVG = join(ROOT, 'resources', 'nzrcode-brand', 'wordmark.svg');

const OUTPUTS = {
	'resources/linux/nzrcode.png': { size: 512 },
	'resources/win32/nzrcode_70x70.png': { size: 70 },
	'resources/win32/nzrcode_150x150.png': { size: 150 },
	'resources/darwin/nzrcode.icns': { kind: 'icns' },
};

const ICNS_CHUNKS = [
	{ type: 'ic09', size: 512 },
	{ type: 'ic10', size: 1024 },
];

function renderPng(size) {
	const tmp = join(tmpdir(), `nzrcode-icon-${size}-${process.pid}.png`);
	execFileSync('convert', [
		'-background', 'none',
		'-density', '384',
		SVG,
		'-resize', `${size}x${size}`,
		'-strip',
		tmp,
	]);
	const buf = readFileSync(tmp);
	rmSync(tmp);
	return buf;
}

function buildIcns(chunkBuffers) {
	let bodySize = 0;
	for (const [, buf] of chunkBuffers) {
		bodySize += 8 + buf.length;
	}
	const totalSize = 8 + bodySize;
	const out = Buffer.alloc(totalSize);
	out.write('icns', 0, 4, 'ascii');
	out.writeUInt32BE(totalSize, 4);
	let offset = 8;
	for (const [type, buf] of chunkBuffers) {
		out.write(type, offset, 4, 'ascii');
		out.writeUInt32BE(8 + buf.length, offset + 4);
		buf.copy(out, offset + 8);
		offset += 8 + buf.length;
	}
	return out;
}

function ensureDir(path) {
	mkdirSync(dirname(path), { recursive: true });
}

function writeAll() {
	if (!existsSync(SVG)) {
		console.error(`error: source SVG missing: ${SVG}`);
		process.exit(1);
	}
	for (const [rel, spec] of Object.entries(OUTPUTS)) {
		const dest = join(ROOT, rel);
		ensureDir(dest);
		if (spec.kind === 'icns') {
			const chunks = ICNS_CHUNKS.map(c => [c.type, renderPng(c.size)]);
			writeFileSync(dest, buildIcns(chunks));
		} else {
			writeFileSync(dest, renderPng(spec.size));
		}
		console.log(`wrote ${rel}`);
	}
}

function checkAll() {
	let fail = 0;
	for (const rel of Object.keys(OUTPUTS)) {
		const path = join(ROOT, rel);
		if (!existsSync(path)) {
			console.error(`missing: ${rel}`);
			fail = 1;
			continue;
		}
		const size = statSync(path).size;
		if (size < 64) {
			console.error(`suspiciously small (${size} bytes): ${rel}`);
			fail = 1;
		}
	}
	if (!fail) {
		console.log('ok — all icon files present and non-empty');
	}
	process.exit(fail);
}

const mode = process.argv[2];
if (mode === '--write') {
	writeAll();
} else if (mode === '--check') {
	checkAll();
} else {
	console.error('usage: generate-icons.mjs --write|--check');
	process.exit(2);
}
