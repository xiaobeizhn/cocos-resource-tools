const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isScriptAsset,
  partitionDepAssets,
  selectUnused,
  toBaseUuidSet,
} = require('../lib/asset-filter');

test('isScriptAsset recognises scripts by extension', () => {
  for (const name of ['Foo.ts', 'Foo.js', 'Foo.mjs', 'Foo.cjs', 'Foo.tsx', 'Foo.jsx']) {
    assert.equal(isScriptAsset({ name }), true, name);
  }
  assert.equal(isScriptAsset({ url: 'db://assets/scripts/Foo.TS' }), true);
});

test('isScriptAsset recognises scripts by asset type', () => {
  assert.equal(isScriptAsset({ name: 'Foo', type: 'cc.Script' }), true);
  assert.equal(isScriptAsset({ name: 'Foo', type: 'typescript' }), true);
});

test('isScriptAsset leaves real resources alone', () => {
  assert.equal(isScriptAsset({ name: 'icon.png', type: 'cc.ImageAsset' }), false);
  assert.equal(isScriptAsset({ name: 'ui.prefab', type: 'cc.Prefab' }), false);
  assert.equal(isScriptAsset(null), false);
});

test('partitionDepAssets drops directories and .meta, and counts scripts separately', () => {
  const { files, scriptsFiltered } = partitionDepAssets([
    { uuid: '1', name: 'icon.png' },
    { uuid: '2', name: 'sub', isDirectory: true },
    { uuid: '3', name: 'icon.png.meta' },
    { uuid: '4', name: 'Player.ts' },
    { uuid: '5', name: 'bgm.mp3' },
    null,
  ]);

  assert.deepEqual(files.map((f) => f.uuid), ['1', '5']);
  // 目录和 .meta 不计入任何一侧，只有脚本被单独统计
  assert.equal(scriptsFiltered, 1);
});

test('partitionDepAssets survives a missing asset list', () => {
  assert.deepEqual(partitionDepAssets(undefined), { files: [], scriptsFiltered: 0 });
});

test('selectUnused returns exactly the assets absent from the reference set', () => {
  const files = [
    { uuid: 'used', url: 'db://assets/a.png', name: 'a.png', type: 'cc.ImageAsset', file: '/a.png' },
    { uuid: 'orphan', url: 'db://assets/b.png', name: 'b.png', type: 'cc.ImageAsset', file: '/b.png' },
  ];

  const unused = selectUnused(files, new Set(['used']));

  assert.deepEqual(unused, [{
    uuid: 'orphan',
    url: 'db://assets/b.png',
    name: 'b.png',
    displayName: 'b.png',
    type: 'cc.ImageAsset',
    file: '/b.png',
  }]);
});

// 依赖查询回来的是 SpriteFrame 子资源 uuid，目录扫描拿到的是文件级 uuid。
// 不做归一化的话，每一张被引用的图都会被报成未使用 —— 这是最危险的误删路径。
test('selectUnused matches a sub-asset reference against its file-level asset', () => {
  const files = [{ uuid: 'tex-1', url: 'db://assets/a.png', name: 'a.png' }];

  const unused = selectUnused(files, new Set(['tex-1@f9941']));

  assert.deepEqual(unused, []);
});

test('selectUnused falls back to name when displayName is missing', () => {
  const unused = selectUnused([{ uuid: 'x', name: 'a.png' }], new Set());
  assert.equal(unused[0].displayName, 'a.png');
});

test('selectUnused handles empty inputs', () => {
  assert.deepEqual(selectUnused([], new Set(['a'])), []);
  assert.deepEqual(selectUnused(undefined, undefined), []);
});

test('toBaseUuidSet collapses sub-assets of one file into a single entry', () => {
  const set = toBaseUuidSet(['tex-1@f9941', 'tex-1@6c48a', 'other']);
  assert.deepEqual([...set].sort(), ['other', 'tex-1']);
});
