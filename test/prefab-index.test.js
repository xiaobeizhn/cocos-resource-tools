const test = require('node:test');
const assert = require('node:assert/strict');

const { findAssetUsagesInPrefab } = require('../lib/prefab-index');

test('finds a component asset reference and reconstructs its node path', () => {
  const prefab = [
    { __type__: 'cc.Prefab', data: { __id__: 1 } },
    {
      __type__: 'cc.Node',
      _name: 'Root',
      _parent: null,
      _children: [{ __id__: 2 }],
      _components: [],
    },
    {
      __type__: 'cc.Node',
      _name: 'Icon',
      _parent: { __id__: 1 },
      _children: [],
      _components: [{ __id__: 3 }],
    },
    {
      __type__: 'cc.Sprite',
      node: { __id__: 2 },
      _spriteFrame: { __uuid__: 'target-uuid', __expectedType__: 'cc.SpriteFrame' },
    },
  ];

  assert.deepEqual(findAssetUsagesInPrefab(prefab, 'target-uuid'), [
    {
      nodePath: 'Root/Icon',
      componentType: 'cc.Sprite',
      propertyPath: '_spriteFrame',
    },
  ]);
});

test('matches nested references and keeps the property path', () => {
  const prefab = [
    { __type__: 'cc.Prefab', data: { __id__: 1 } },
    {
      __type__: 'cc.Node',
      _name: 'Root',
      _parent: null,
      _children: [],
      _components: [{ __id__: 2 }],
    },
    {
      __type__: 'game.CustomComponent',
      node: { __id__: 1 },
      variants: [{ icon: { __uuid__: 'target-uuid' } }],
    },
  ];

  assert.deepEqual(findAssetUsagesInPrefab(prefab, 'target-uuid'), [
    {
      nodePath: 'Root',
      componentType: 'game.CustomComponent',
      propertyPath: 'variants[0].icon',
    },
  ]);
});

test('does not report references belonging to another node', () => {
  const prefab = [
    { __type__: 'cc.Prefab', data: { __id__: 1 } },
    {
      __type__: 'cc.Node',
      _name: 'Root',
      _parent: null,
      _children: [],
      _components: [{ __id__: 2 }],
    },
    {
      __type__: 'cc.Sprite',
      node: { __id__: 1 },
      _spriteFrame: { __uuid__: 'another-uuid' },
    },
  ];

  assert.deepEqual(findAssetUsagesInPrefab(prefab, 'target-uuid'), []);
});

test('matches a selected file UUID against a referenced sub-asset UUID', () => {
  const prefab = [
    { __type__: 'cc.Prefab', data: { __id__: 1 } },
    {
      __type__: 'cc.Node',
      _name: 'Root',
      _parent: null,
      _children: [],
      _components: [{ __id__: 2 }],
    },
    {
      __type__: 'cc.Sprite',
      node: { __id__: 1 },
      _spriteFrame: { __uuid__: 'texture-uuid@frame-1' },
    },
  ];

  assert.deepEqual(findAssetUsagesInPrefab(prefab, 'texture-uuid'), [
    {
      nodePath: 'Root',
      componentType: 'cc.Sprite',
      propertyPath: '_spriteFrame',
    },
  ]);
});
