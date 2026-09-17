const test = require('node:test');
const assert = require('node:assert/strict');

const { collectNodeNames, formatNodePath } = require('../lib/node-path');

function chain(...names) {
    let parent = null;
    return names.map((name) => (parent = { name, parent }));
}

test('collectNodeNames returns names below root, excluding root', () => {
    const [root, , , leaf] = chain('BloomMain', 'description', 'getReward', 'New RichText');
    assert.deepEqual(collectNodeNames(root, leaf), ['description', 'getReward', 'New RichText']);
});

test('collectNodeNames returns empty list for root itself', () => {
    const [root] = chain('BloomMain');
    assert.deepEqual(collectNodeNames(root, root), []);
});

test('collectNodeNames returns null when node is outside root', () => {
    const [, other] = chain('Scene', 'Other');
    const [root] = chain('BloomMain');
    assert.equal(collectNodeNames(root, other), null);
});

test('formatNodePath joins asset path without extension and node path', () => {
    assert.equal(
        formatNodePath('db://assets/modules/activities/bloom/prefabs/BloomMain.prefab', ['description', 'getReward', 'New RichText']),
        'assets\\modules\\activities\\bloom\\prefabs\\BloomMain/description/getReward/New RichText',
    );
});

test('formatNodePath returns only asset path for root node', () => {
    assert.equal(formatNodePath('db://assets/a/Main.scene', []), 'assets\\a\\Main');
});
