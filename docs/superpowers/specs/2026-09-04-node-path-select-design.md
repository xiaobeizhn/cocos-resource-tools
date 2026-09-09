# 设计：点击节点路径定位到节点树

日期：2026-09-04（2026-09-08 按实现结果修订，见文末「修订记录」）

> **历史文档。** 本文写于 `resource-usage` 还是独立扩展时。该扩展此后并入
> `resource-tools`：包名 `resource-usage` → `resource-tools`，面板名
> `Editor.Panel.open('resource-usage')` → `Editor.Panel.open('resource-tools.usage')`，
> 文中的 `panel.js` 即现在的 [panels/usage.js](../../../panels/usage.js)。
> 设计结论本身未变，正文保留原样不做改写。

## 背景

`resource-usage` 扩展在资源管理器里右键"查找 Prefab 引用节点"后，会在停靠面板（[panel.js](../../../panel.js)）里列出引用该资源的 Prefab、节点路径（如 `Root/Icon`）和组件属性。目前每条用法只是纯文本展示，只有 Prefab 级别的"打开预制体"按钮可点击。

## 需求

查找结果出来后，点击某条用法的节点路径文字，应该：

1. 打开该用法所在的预制体（若尚未打开，行为等同于点击"打开预制体"）。
2. 在编辑器的节点树（层级管理器）里直接选中对应节点。
3. 选中后把编辑器焦点带回 `resource-usage` 结果面板，方便继续浏览其它结果。

如果记录的节点在当前预制体里已经找不到了（比如扫描后节点被改名/删除），在面板里给出简短提示，不选中任何节点。定位失败的原因也要显示出来，不能表现为"点了没反应"。

## 技术方案

### 节点定位方式

预制体资源**无法**从文件里静态解析出可用于选中的节点 id：

- `__id__` 只是该 JSON 数组里的下标，仅在文件内部有意义。
- `_id` 在**场景文件**里才是持久 UUID；在**预制体文件**里恒为空串 `""`。预制体的节点身份存在 `_prefab` → `cc.PrefabInfo.fileId`。
- 预制体进入编辑模式后，编辑器分配的运行时 uuid 与 `_id`、`fileId` **都不相同**，而且每次重新加载预制体编辑场景都会**重新生成**（同一节点两次实测得到不同 uuid）。

**采用方案：** 拿扫描阶段记录的名字路径（`nodePath`），去 `Editor.Message.request('scene', 'query-node-tree')` 返回的实时节点树里匹配，取得该节点当前的运行时 uuid，再调用 `Editor.Selection.select('node', uuid)` 选中。

匹配规则：编辑器会把预制体根包在 `场景根 / should_hide_in_hierarchy / <预制体根>` 之下，所以按路径**后缀**匹配（在段边界上比对，避免 `ished` 命中 `Finished`）。用广度优先遍历，这样既能自然跳过上述包装层，又能在同名路径出现于多个深度时稳定地取最浅的一个。

**已否决方案：** 记录 `_id` 后直接 `Editor.Selection.select('node', _id)`。这是本文档初版的方案，前提就是错的——见上文与「修订记录」。重名兄弟节点的风险由完整路径匹配承担，不是靠 uuid 规避。

## 改动范围

### 数据层：`lib/prefab-index.js`

不改。`usage` 保持 `{ nodePath, componentType, propertyPath }`，`nodePath` 就是定位所需的全部信息。

### 节点树匹配：`lib/node-tree.js`（新增）

纯函数 `findNodeUuidByPath(tree, nodePath)`：在 `query-node-tree` 返回的树里按上述规则匹配，返回运行时 uuid，找不到返回 `null`。不涉及 IPC 或编辑器 API，可单测。

**测试：** `test/node-tree.test.js` 覆盖穿过 `should_hide_in_hierarchy` 包装层、预制体根自身、无包装层的场景树、路径不存在、名字段部分匹配不算命中、同名路径取最浅、空路径/空树。

### 面板层：`panel.js`

- `.node` 这一行（渲染 `usage.nodePath` 的 div）增加 hover 样式（`cursor: pointer` + 颜色变化与下划线）提示可点击。
- 点击时 `await Editor.Message.request('resource-usage', 'select-node', { prefabUuid: match.prefabUuid, nodePath: usage.nodePath })`：
  - 返回 falsy（定位失败）→ 在该条目下插入提示文字，复用现有 `.warning` 样式类。
  - 抛异常（消息未注册、主进程报错）→ 插入带具体原因的提示，并提示可尝试重启编辑器。
- 同时监听主进程广播的 `select-node-failed`，在对应条目下插入同样的提示。提示按 `prefabUuid + nodePath` 定位条目，同一条目重复触发时只更新不重复插入。

**必须 `await` + `try/catch`。** 早期版本直接丢弃这个 promise，导致主进程是旧版本时点击完全没反应，排查成本很高。

### 主进程：`main.js`

新增方法 `selectNode({ prefabUuid, nodePath })`：

1. `Editor.Message.request('asset-db', 'open-asset', prefabUuid)` 打开/聚焦该预制体的编辑模式（已在编辑时是幂等空操作）。
2. 轮询 `Editor.Message.request('scene', 'query-node-tree')` 并用 `findNodeUuidByPath` 解析路径，最多 10 次、间隔 200ms（约 2s 上限）。节点已在场景中时首次即命中，无额外延迟。
   - 解析到 uuid：`Editor.Selection.select('node', uuid)` 选中，返回 `true`。
   - 始终解析不到：跳过选中，返回 `false`。
3. 失败时 `Editor.Message.send('resource-usage', 'select-node-failed', { prefabUuid, nodePath })` 通知面板。
4. 无论成败，最后 `Editor.Panel.open('resource-usage')` 把焦点带回本面板（与 `findUsages` 搜索完成后的处理一致）。

`exports.load` 打一行版本日志，便于从 `<project>/temp/logs/project.log` 确认主进程跑的是哪个版本。

**关于步骤 2 的重试：** `open-asset` resolve 后预制体编辑场景不一定已加载完，故保留有界重试。若后续实测确认无时序问题，可把 `NODE_QUERY_RETRIES` 降为 1。

**测试：** `test/select-node.test.js` 用 stub 的 `Editor` 跑真实的 `selectNode`，节点树 fixture（`test/fixtures/card-group-item-tree.json`）从编辑器实时抓取后裁剪。覆盖成功选中（校验 `open-asset` 先于 `query-node-tree`、选中的 uuid、回焦面板）与路径失效（不选中、广播失败、仍回焦）。

### 配置：`package.json`

`contributions.messages` 新增：

- `select-node` → `selectNode`（主进程）
- `select-node-failed` → `default.selectNodeFailed`（面板）

另加 `scripts.test`：`node --test test/*.test.js`。

## 范围之外

- 不改变"打开预制体"按钮的现有行为。
- 不处理"预制体在扫描后已被移动/删除"之外的更极端场景（如资源数据库尚未刷新）——这类情况沿用 `open-asset` 现有的报错行为。
- 不解决重名兄弟节点的歧义：完整路径相同的两个节点无法区分，取匹配到的第一个。

## 修订记录

**2026-09-08：技术方案整体推翻重写。**

初版方案（记录 `_id` 直接选中）已实现并验证为**不可行**。实测证据：

| 来源 | `CardGroupItem/ProgressBar/Finished` 的标识 |
|---|---|
| prefab 文件 `_id` | `""`（该文件 8 个节点全为空串） |
| prefab 文件 `fileId` | `fbAvkntiJKpbViJfWClVUL` |
| 编辑器运行时 uuid | `f5ozb5gpFJra5BOEvndGKU`，一小时后重新加载变为 `47p05V0KZHOY+krHaY9W1p` |

初版前提"运行时 uuid 与序列化 `_id` 一致"只对场景文件成立，对预制体不成立。结果 `nodeUuid` 实际是 `""`，面板走空值分支直接提示"未找到"，从未真正发出消息。

因此改用初版否决的名字路径匹配——对预制体而言它不是回退方案，而是唯一可行方案。数据层的 `nodeUuid` 字段随之移除（对预制体恒为空，是死代码）。

同期修掉一个由此暴露的真实缺陷：面板不再静默吞掉 `Editor.Message.request` 的失败。
