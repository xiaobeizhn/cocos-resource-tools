const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

// 从编辑器实时抓取的预制体编辑模式节点树（已裁剪掉组件字段）。
const realTree = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/card-group-item-tree.json'), 'utf8'),
);

const PREFAB_UUID = 'ee5f1fed-23f0-4490-a890-f0561d4221b2';

function installEditorStub({ tree = realTree } = {}) {
  const calls = { requests: [], selected: null, sent: [], panelsOpened: [] };
  global.Editor = {
    Message: {
      async request(pkg, message, arg) {
        calls.requests.push([pkg, message, arg]);
        if (pkg === 'scene' && message === 'query-node-tree') {
          return tree;
        }
        return undefined;
      },
      send(pkg, message, arg) {
        calls.sent.push([pkg, message, arg]);
      },
    },
    Selection: {
      select(type, uuid) {
        calls.selected = [type, uuid];
      },
    },
    Panel: {
      open(name) {
        calls.panelsOpened.push(name);
      },
    },
  };
  return calls;
}

function loadMain() {
  const file = require.resolve('../main.js');
  delete require.cache[file];
  return require(file);
}

test.afterEach(() => {
  delete global.Editor;
});

test('selects the live node matching the recorded path and returns focus to the panel', async () => {
  const calls = installEditorStub();

  const selected = await loadMain().methods.selectNode({
    prefabUuid: PREFAB_UUID,
    nodePath: 'CardGroupItem/ProgressBar/Finished',
  });

  assert.equal(selected, true);
  // 必须先打开预制体，再去查节点树。
  assert.deepEqual(calls.requests[0], ['asset-db', 'open-asset', PREFAB_UUID]);
  assert.deepEqual(calls.requests[1], ['scene', 'query-node-tree', undefined]);
  // 选中的是实时节点树里 Finished 的运行时 uuid。
  assert.deepEqual(calls.selected, ['node', '47p05V0KZHOY+krHaY9W1p']);
  assert.deepEqual(calls.sent, []);
  assert.deepEqual(calls.panelsOpened, ['resource-tools.usage']);
});

test('reports failure and still returns focus when the path no longer exists', async () => {
  const calls = installEditorStub();

  const selected = await loadMain().methods.selectNode({
    prefabUuid: PREFAB_UUID,
    nodePath: 'CardGroupItem/ProgressBar/Renamed',
  });

  assert.equal(selected, false);
  assert.equal(calls.selected, null);
  assert.deepEqual(calls.sent, [
    ['resource-tools', 'select-node-failed', { prefabUuid: PREFAB_UUID, nodePath: 'CardGroupItem/ProgressBar/Renamed' }],
  ]);
  assert.deepEqual(calls.panelsOpened, ['resource-tools.usage']);
});
