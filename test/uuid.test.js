const test = require('node:test');
const assert = require('node:assert/strict');

const { baseUuid, matchesUuid } = require('../lib/uuid');

test('baseUuid strips the sub-asset suffix', () => {
  assert.equal(baseUuid('abc-123@f9941'), 'abc-123');
  assert.equal(baseUuid('abc-123'), 'abc-123');
});

test('baseUuid passes empty values through untouched', () => {
  assert.equal(baseUuid(''), '');
  assert.equal(baseUuid(undefined), undefined);
  assert.equal(baseUuid(null), null);
});

test('matchesUuid accepts an exact hit', () => {
  assert.equal(matchesUuid('abc-123', 'abc-123'), true);
  assert.equal(matchesUuid('abc-123@f9941', 'abc-123@f9941'), true);
});

// 选中一张 .png，prefab 里引用的其实是它的 SpriteFrame 子资源。
test('matchesUuid lets a file-level target catch its sub-assets', () => {
  assert.equal(matchesUuid('abc-123@f9941', 'abc-123'), true);
});

// 反过来不成立：查「这一帧被谁用了」不能退化成查整个图集。
test('matchesUuid keeps a sub-asset target exact', () => {
  assert.equal(matchesUuid('abc-123', 'abc-123@f9941'), false);
  assert.equal(matchesUuid('abc-123@aaaa', 'abc-123@f9941'), false);
});

// 前缀相同但不是子资源分隔符的两个 uuid 不能互相命中。
test('matchesUuid does not match on a bare prefix', () => {
  assert.equal(matchesUuid('abc-1234', 'abc-123'), false);
});

test('matchesUuid rejects non-string input', () => {
  assert.equal(matchesUuid(null, 'abc'), false);
  assert.equal(matchesUuid('abc', undefined), false);
  assert.equal(matchesUuid(123, 123), false);
});
