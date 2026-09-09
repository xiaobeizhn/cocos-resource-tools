const test = require('node:test');
const assert = require('node:assert/strict');

const { findNodeUuidByPath } = require('../lib/node-tree');

// 预制体编辑模式下 query-node-tree 的真实形状：场景根 -> should_hide_in_hierarchy -> 预制体根。
function prefabEditTree() {
  return {
    name: 'CardGroupItem-scene',
    uuid: 'scene-uuid',
    children: [
      {
        name: 'should_hide_in_hierarchy',
        uuid: 'wrapper-uuid',
        children: [
          {
            name: 'CardGroupItem',
            uuid: 'root-uuid',
            children: [
              { name: 'Pic', uuid: 'pic-uuid', children: [] },
              {
                name: 'ProgressBar',
                uuid: 'bar-uuid',
                children: [
                  { name: 'Bar', uuid: 'inner-bar-uuid', children: [] },
                  { name: 'Finished', uuid: 'f5ozb5gpFJra5BOEvndGKU', children: [] },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

test('resolves a prefab node path to its runtime uuid through the hierarchy wrapper', () => {
  assert.equal(
    findNodeUuidByPath(prefabEditTree(), 'CardGroupItem/ProgressBar/Finished'),
    'f5ozb5gpFJra5BOEvndGKU',
  );
});

test('resolves the prefab root itself', () => {
  assert.equal(findNodeUuidByPath(prefabEditTree(), 'CardGroupItem'), 'root-uuid');
});

test('resolves a path when the prefab root is directly under the scene root', () => {
  const tree = {
    name: 'Scene',
    uuid: 'scene-uuid',
    children: [
      { name: 'Root', uuid: 'root-uuid', children: [{ name: 'Icon', uuid: 'icon-uuid', children: [] }] },
    ],
  };

  assert.equal(findNodeUuidByPath(tree, 'Root/Icon'), 'icon-uuid');
});

test('returns null when no node matches the path', () => {
  assert.equal(findNodeUuidByPath(prefabEditTree(), 'CardGroupItem/ProgressBar/Missing'), null);
});

test('does not match a partial trailing name segment', () => {
  assert.equal(findNodeUuidByPath(prefabEditTree(), 'CardGroupItem/ProgressBar/ished'), null);
});

test('prefers the shallowest match when the same path appears at two depths', () => {
  const tree = {
    name: 'Scene',
    uuid: 'scene-uuid',
    children: [
      { name: 'Root', uuid: 'shallow-uuid', children: [] },
      { name: 'Wrapper', uuid: 'wrapper-uuid', children: [{ name: 'Root', uuid: 'deep-uuid', children: [] }] },
    ],
  };

  assert.equal(findNodeUuidByPath(tree, 'Root'), 'shallow-uuid');
});

test('returns null for an empty path or a missing tree', () => {
  assert.equal(findNodeUuidByPath(prefabEditTree(), ''), null);
  assert.equal(findNodeUuidByPath(null, 'CardGroupItem'), null);
});
