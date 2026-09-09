const test = require('node:test');
const assert = require('node:assert/strict');

const { collectReferencedUuids } = require('../lib/dependency-graph');

/** 用一张静态依赖表冒充 asset-db 的 query-asset-dependencies。 */
function graphQuery(graph, calls) {
  return async (uuid) => {
    if (calls) { calls.push(uuid); }
    return graph[uuid] || [];
  };
}

test('collects roots plus their transitive dependencies', async () => {
  // prefab -> material -> texture，跨两层
  const graph = { prefab: ['material'], material: ['texture'], texture: [] };

  const referenced = await collectReferencedUuids(['prefab'], graphQuery(graph));

  assert.deepEqual([...referenced].sort(), ['material', 'prefab', 'texture']);
});

test('walks every root', async () => {
  const graph = { a: ['shared'], b: ['shared'], shared: [] };

  const referenced = await collectReferencedUuids(['a', 'b'], graphQuery(graph));

  assert.deepEqual([...referenced].sort(), ['a', 'b', 'shared']);
});

test('terminates on a dependency cycle', async () => {
  const graph = { a: ['b'], b: ['c'], c: ['a'] };

  const referenced = await collectReferencedUuids(['a'], graphQuery(graph));

  assert.deepEqual([...referenced].sort(), ['a', 'b', 'c']);
});

test('queries each asset only once even when reached from several roots', async () => {
  const graph = { a: ['shared'], b: ['shared'], shared: [] };
  const calls = [];

  await collectReferencedUuids(['a', 'b'], graphQuery(graph, calls));

  assert.deepEqual(calls.sort(), ['a', 'b', 'shared']);
});

// 单个资源查询失败只能降级为「无依赖」，否则一个坏资源会让整轮扫描白跑，
// 扫描结果会把一大批其实被引用的资源报成未使用。
test('treats a failing dependency query as no dependencies and keeps going', async () => {
  const query = async (uuid) => {
    if (uuid === 'broken') { throw new Error('asset-db exploded'); }
    return { a: ['broken'], broken: ['never-reached'], b: [] }[uuid] || [];
  };

  const referenced = await collectReferencedUuids(['a', 'b'], query);

  assert.deepEqual([...referenced].sort(), ['a', 'b', 'broken']);
});

test('tolerates a non-array dependency reply', async () => {
  const referenced = await collectReferencedUuids(['a'], async () => null);

  assert.deepEqual([...referenced], ['a']);
});

test('handles empty and missing root lists', async () => {
  assert.equal((await collectReferencedUuids([], async () => [])).size, 0);
  assert.equal((await collectReferencedUuids(undefined, async () => [])).size, 0);
});
