'use strict';

module.exports = Editor.Panel.define({
  template: `
    <div class="container">
      <div id="summary" class="summary">从资源管理器右键执行“查找 Prefab 引用节点”。</div>
      <div id="results" class="results"></div>
    </div>
  `,

  style: `
    * { box-sizing: border-box; }
    .container { height: 100%; padding: 12px; overflow: hidden; color: #d8d8d8; }
    .summary { padding: 9px 10px; margin-bottom: 10px; background: #303030; border: 1px solid #454545; font-size: 12px; line-height: 1.5; }
    .results { height: calc(100% - 54px); overflow: auto; }
    .prefab { margin-bottom: 10px; border: 1px solid #454545; background: #292929; }
    .prefab-head { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #353535; }
    .prefab-path { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: #fff; }
    .usage { padding: 7px 10px; border-top: 1px solid #3b3b3b; font-size: 12px; }
    .node { color: #9ecbff; cursor: pointer; }
    .node:hover { color: #fff; text-decoration: underline; }
    .property { color: #d9d9d9; margin-top: 3px; font-family: monospace; }
    .empty { padding: 26px 10px; text-align: center; color: #999; font-size: 12px; }
    .warning { color: #f0b366; }
  `,

  $: {
    summary: '#summary',
    results: '#results',
  },

  methods: {
    renderResult(result) {
      renderResult(this, result);
    },
    selectNodeFailed({ prefabUuid, nodePath } = {}) {
      showNodeWarning(findUsageItem(prefabUuid, nodePath));
    },
  },

  async ready() {
    const result = await Editor.Message.request('resource-tools', 'get-last-result');
    renderResult(this, result);
  },
});

// 每次渲染重建：prefabUuid + nodePath -> 该条用法的 DOM 节点，用于把失败提示插到正确的条目下。
let usageItems = [];

function usageKey(prefabUuid, nodePath) {
  return `${prefabUuid}::${nodePath}`;
}

function findUsageItem(prefabUuid, nodePath) {
  const key = usageKey(prefabUuid, nodePath);
  const found = usageItems.find((entry) => entry.key === key);
  return found ? found.item : null;
}

function showNodeWarning(item, message) {
  if (!item) {
    return;
  }
  const warning = item.querySelector('.warning') || item.appendChild(document.createElement('div'));
  warning.className = 'warning';
  warning.textContent = message || '未找到该节点，可能已被修改。';
}

function renderResult(panel, result) {
  const summary = panel.$.summary;
  const results = panel.$.results;
  results.replaceChildren();
  usageItems = [];

  if (!result) {
    return;
  }
  if (result.error) {
    summary.textContent = result.error;
    return;
  }

  const usageCount = result.matches.reduce((total, match) => total + match.usages.length, 0);
  summary.textContent = `${result.assetName}：在 ${result.prefabCount} 个 Prefab 中找到 ${usageCount} 处节点引用。`;

  if (!result.matches.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '没有找到直接序列化在 Prefab 中的引用。';
    results.appendChild(empty);
    return;
  }

  result.matches.forEach((match) => {
    const group = document.createElement('section');
    group.className = 'prefab';

    const head = document.createElement('div');
    head.className = 'prefab-head';
    const path = document.createElement('div');
    path.className = 'prefab-path';
    path.textContent = match.prefabUrl;
    path.title = match.prefabUrl;
    const openButton = document.createElement('ui-button');
    openButton.textContent = '打开预制体';
    openButton.addEventListener('click', () => {
      Editor.Message.request('resource-tools', 'open-prefab', match.prefabUuid);
    });
    head.append(path, openButton);
    group.appendChild(head);

    match.usages.forEach((usage) => {
      const item = document.createElement('div');
      item.className = 'usage';
      const node = document.createElement('div');
      node.className = 'node';
      node.textContent = usage.nodePath;
      node.title = '点击在层级管理器中选中该节点';
      node.addEventListener('click', async () => {
        try {
          const selected = await Editor.Message.request('resource-tools', 'select-node', {
            prefabUuid: match.prefabUuid,
            nodePath: usage.nodePath,
          });
          if (!selected) {
            showNodeWarning(item);
          }
        } catch (error) {
          // 消息未注册或主进程报错时不能静默失败，否则点击看起来毫无反应。
          // 最常见的原因是改完扩展代码没有重启编辑器，主进程仍是旧版本。
          showNodeWarning(item, `定位失败：${error && error.message ? error.message : error}（可尝试重启编辑器）`);
        }
      });
      usageItems.push({ key: usageKey(match.prefabUuid, usage.nodePath), item });
      const property = document.createElement('div');
      property.className = 'property';
      property.textContent = `${usage.componentType}.${usage.propertyPath}`;
      item.append(node, property);
      group.appendChild(item);
    });

    results.appendChild(group);
  });
}
