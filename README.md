# Cocos Resource Cleaner

一款 Cocos Creator 编辑器扩展，用于清理未被 Prefab 引用的资源文件，同步删除对应的 `.meta` 文件。

## 功能特性

- 🔍 **依赖扫描**：通过 BFS 递归收集指定 Prefab（支持文件夹或单个 `.prefab` 文件）的直接与间接依赖，精准定位未引用资源
- 📂 **路径自动补全**：输入框支持项目内文件夹路径自动补全，快速选择目标目录
- ✅ **批量选择删除**：支持全选 / 手动勾选 / 单击行切换选中，一键批量删除未使用资源
- 🖱️ **双击定位**：双击列表项可在 Cocos 资源管理器中定位并选中对应资源
- 👁 **预览按钮**：每项右侧预览按钮，单击在资源预览界面中显示该资源
- 🗑️ **同步清理 .meta**：删除资源时自动同步清理对应的 `.meta` 文件，避免残留
- 🛡️ **安全确认**：删除操作前弹出确认对话框，防止误删

## 环境要求

- Cocos Creator **≥ 3.8.0**

## 安装

1. 将 `resource-cleaner` 文件夹复制到项目的 `extensions/` 目录下：

```
your-project/
└── extensions/
    └── resource-cleaner/
        ├── main.js
        ├── panel.js
        └── package.json
```

2. 在 Cocos Creator 中重新加载编辑器，扩展会自动加载。

## 使用方法

1. 打开 Cocos Creator，在菜单栏点击 **扩展 → Prefab 依赖清理 → 打开清理面板**
2. 在面板中填写：
   - **Prefab 路径**：存放 Prefab 的目录路径（如 `db://assets/prefabs`），也支持填单个 `.prefab` 文件路径（如 `db://assets/prefabs/ui.prefab`），此时只分析该 Prefab 的依赖
   - **依赖资源文件夹**：需要清理的资源目录路径（如 `db://assets/textures`）
3. 点击 **开始扫描**，等待扫描完成
4. 勾选需要删除的未使用资源（支持全选）
5. 点击 **删除选中资源**，确认后执行删除

## 工作原理

1. 读取作为依赖根的 Prefab：若输入的是 `.prefab` 文件则只取该单个文件，若是文件夹则递归收集其下所有 `.prefab`
2. 通过 `asset-db` 的 `query-asset-dependencies` 接口，BFS 递归收集所有 Prefab 的直接和间接依赖（Prefab → 材质 → 贴图等）
3. 将依赖 uuid 规范化为文件级基础 uuid（去除子资源后缀 `@xxx`），确保匹配准确
4. 对比依赖资源文件夹中的所有资源，找出未被任何 Prefab 引用的资源
5. 删除时通过 `delete-asset` 接口删除资源，并兜底清理残留的 `.meta` 文件

## 注意事项

- ⚠️ 删除操作不可撤销，请仔细确认后再执行
- 扩展首次加载时 `asset-db` 可能未就绪，内部会自动重试等待
- 子资源（如 SpriteFrame）会被自动归并到文件级进行判断，不会误删

## License

MIT
