'use strict';

const fs = require('fs');
const { collectReferencedUuids } = require('./lib/dependency-graph');
const { partitionDepAssets, selectUnused, toBaseUuidSet } = require('./lib/asset-filter');
const { findAssetUsagesInPrefab } = require('./lib/prefab-index');
const { findNodeUuidByPath } = require('./lib/node-tree');
const { formatNodePath } = require('./lib/node-path');

const PACKAGE = 'resource-tools';
const USAGE_PANEL = 'resource-tools.usage';

// ============================================================
// 通用
// ============================================================

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 等待 asset-db 就绪。query-assets 在 asset-db 未就绪时会返回 null 或抛错，
 * 这种情况下稍作等待后重试，避免扩展刚加载时扫描为空。
 *
 * @param {string} pattern
 * @param {number} [retries]
 * @returns {Promise<any[]>}
 */
async function queryAssetsWhenReady(pattern, retries = 5) {
    for (let i = 0; i < retries; i++) {
        let result = null;
        try {
            result = await Editor.Message.request('asset-db', 'query-assets', { pattern });
        } catch (e) {
            result = null;
        }
        if (result) { return result; }
        await delay(600);
    }
    return [];
}

// ============================================================
// 依赖清理（default 面板）
// ============================================================

/**
 * 最近一次从资源管理器右键进入时选中的 Prefab（或文件夹）路径。
 * 面板 ready 时会主动来取，避免面板尚未创建完成就收不到推送消息。
 * @type {string}
 */
let pendingPrefabPath = '';

/**
 * 资源管理器右键入口：以右键选中的资源作为「Prefab 路径」打开清理面板。
 *
 * @param {string} assetUuid 右键选中的资源 uuid
 * @returns {Promise<string>} 该资源的 db:// 路径
 */
async function openCleaner(assetUuid) {
    let assetInfo = null;
    try {
        assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', assetUuid);
    } catch (e) {
        assetInfo = null;
    }

    pendingPrefabPath = assetInfo && assetInfo.url ? String(assetInfo.url) : '';

    await Editor.Panel.open(PACKAGE);
    // 面板可能已经打开着（不会再走 ready），这里再推送一次保证路径同步
    Editor.Message.send(PACKAGE, 'apply-prefab-path', pendingPrefabPath);
    return pendingPrefabPath;
}

/**
 * 扫描：找出依赖资源文件夹（depDbPath）中、没有被指定 Prefab
 * （prefabInput，可为「文件夹」或「单个 .prefab 文件」）直接或间接依赖的资源。
 *
 * @param {string} prefabInput 例如 db://assets/prefabs 或 db://assets/prefabs/ui.prefab
 * @param {string} depDbPath   例如 db://assets/textures
 * @returns {Promise<object>} 扫描结果
 */
async function queryUnusedAssets(prefabInput, depDbPath) {
    prefabInput = String(prefabInput || '').trim().replace(/\/+$/, '');
    depDbPath = String(depDbPath || '').trim().replace(/\/+$/, '');

    if (!prefabInput || !depDbPath) {
        throw new Error('请填写 Prefab 文件夹/文件与依赖资源文件夹');
    }

    // 1. 获取作为依赖根的 Prefab：支持传入「单个 .prefab 文件」或「文件夹」。
    //    - 以 .prefab 结尾：按精确路径查询单个 Prefab 资源；
    //    - 否则视为文件夹，递归收集其下所有 .prefab。
    const isSinglePrefab = /\.prefab$/i.test(prefabInput);
    let prefabAssets = [];

    if (isSinglePrefab) {
        const exact = await queryAssetsWhenReady(prefabInput);
        prefabAssets = exact.filter((a) =>
            a && !a.isDirectory && String(a.url || '') === prefabInput
        );
        if (!prefabAssets.length) {
            return {
                prefabCount: 0,
                total: 0,
                unused: [],
                message: '没有找到 Prefab 文件「' + prefabInput + '」，请确认路径是否正确'
            };
        }
    } else {
        prefabAssets = await queryAssetsWhenReady(prefabInput + '/**/*.prefab');
        if (!prefabAssets.length) {
            return {
                prefabCount: 0,
                total: 0,
                unused: [],
                message: '在「' + prefabInput + '」下没有找到 .prefab 文件'
            };
        }
    }

    // 2. BFS 递归收集所有 Prefab 的直接 + 间接资源依赖（Prefab → 材质 → 贴图 …）
    //    query-asset-dependencies 第二个参数 'asset' 仅返回“资源依赖”，
    //    已自动排除脚本（Script）依赖，因此脚本不会进入引用集合。
    const referenced = await collectReferencedUuids(
        prefabAssets.map((p) => p.uuid),
        (uuid) => Editor.Message.request('asset-db', 'query-asset-dependencies', uuid, 'asset')
    );

    // 3. 获取文件夹 B 中的所有资源（过滤文件夹、.meta、脚本），再与引用集合求差集
    const depAssets = await queryAssetsWhenReady(depDbPath + '/**/*');
    const { files: depFiles, scriptsFiltered } = partitionDepAssets(depAssets);
    const unused = selectUnused(depFiles, referenced);

    return {
        prefabCount: prefabAssets.length,
        referencedCount: toBaseUuidSet(referenced).size,
        total: depFiles.length,
        scriptsFiltered,
        unused
    };
}

/**
 * 删除选中的资源，同步删除对应的 .meta 文件。
 * 通过 asset-db 的 delete-asset 删除（其本身会一并删除 .meta），
 * 这里再做一次文件兜底，确保 .meta 被移除。
 *
 * @param {string[]} selectedUuids
 * @returns {Promise<object>}
 */
async function deleteSelected(selectedUuids) {
    const uuids = Array.isArray(selectedUuids) ? selectedUuids : [];
    let deleted = 0;
    let failed = 0;
    const failedItems = [];

    for (const uuid of uuids) {
        // 先取出绝对路径（删除后 query-asset-info 会返回 null）
        let assetInfo = null;
        try {
            assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', uuid);
        } catch (e) {
            assetInfo = null;
        }

        const fileOnDisk = assetInfo && assetInfo.file ? assetInfo.file : null;
        const url = assetInfo && assetInfo.url ? assetInfo.url : uuid;

        try {
            await Editor.Message.request('asset-db', 'delete-asset', url);

            // 兜底：若 .meta 仍残留在磁盘上，手动删除
            if (fileOnDisk) {
                const metaPath = fileOnDisk + '.meta';
                try {
                    if (fs.existsSync(metaPath)) { fs.unlinkSync(metaPath); }
                } catch (e) {
                    // asset-db 通常已经删掉了 .meta，残留删除失败可忽略
                }
            }
            deleted++;
        } catch (err) {
            failed++;
            failedItems.push({
                uuid,
                name: assetInfo ? assetInfo.name : uuid,
                error: err && err.message ? err.message : String(err)
            });
        }
    }

    return { total: uuids.length, deleted, failed, failedItems };
}

// ============================================================
// 引用查询（usage 面板）
// ============================================================

let lastUsageResult = null;

const NODE_QUERY_RETRIES = 10;
const NODE_QUERY_INTERVAL = 200;

async function queryPrefabs() {
    const assets = await Editor.Message.request('asset-db', 'query-assets', {
        pattern: 'db://assets/**/*.prefab',
    });
    return Array.isArray(assets) ? assets.filter((asset) => asset && !asset.isDirectory) : [];
}

function scanPrefab(prefabAsset, assetUuid) {
    try {
        const content = fs.readFileSync(prefabAsset.file, 'utf8');
        const usages = findAssetUsagesInPrefab(JSON.parse(content), assetUuid);
        return usages.length ? { prefabUuid: prefabAsset.uuid, prefabUrl: prefabAsset.url, usages } : null;
    } catch (error) {
        return { error: prefabAsset.url + ': ' + (error.message || String(error)) };
    }
}

async function queryNodeUuid(nodePath) {
    try {
        const tree = await Editor.Message.request('scene', 'query-node-tree');
        return findNodeUuidByPath(tree, nodePath);
    } catch (error) {
        return null;
    }
}

// open-asset resolve 之后预制体编辑模式的场景不一定已经加载完，短暂重试几次再判定为找不到。
async function waitForNodeUuid(nodePath) {
    for (let attempt = 0; attempt < NODE_QUERY_RETRIES; attempt += 1) {
        const nodeUuid = await queryNodeUuid(nodePath);
        if (nodeUuid) {
            return nodeUuid;
        }
        if (attempt < NODE_QUERY_RETRIES - 1) {
            await delay(NODE_QUERY_INTERVAL);
        }
    }
    return null;
}

/**
 * 查找某个资源被哪些 Prefab 的哪些节点属性引用。
 * 资源右键菜单与清理面板的「🔍 引用」按钮共用此入口。
 *
 * @param {string} assetUuid
 * @returns {Promise<object>} 同时缓存到 lastUsageResult，供面板 ready 时拉取
 */
async function findUsages(assetUuid) {
    const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', assetUuid);
    if (!assetInfo || assetInfo.isDirectory) {
        lastUsageResult = { error: '请选择一个有效的资源文件。', matches: [] };
    } else {
        const prefabs = await queryPrefabs();
        const matches = [];
        const errors = [];

        for (const prefabAsset of prefabs) {
            const result = scanPrefab(prefabAsset, assetInfo.uuid);
            if (result && result.usages) {
                matches.push(result);
            } else if (result && result.error) {
                errors.push(result.error);
            }
        }

        lastUsageResult = {
            assetName: assetInfo.displayName || assetInfo.name,
            assetUrl: assetInfo.url,
            prefabCount: prefabs.length,
            errors,
            matches,
        };
    }

    // 面板首次打开会在 ready 里主动拉 get-last-result；
    // 面板已经开着时不再走 ready，所以这里补推一次。
    await Editor.Panel.open(USAGE_PANEL);
    Editor.Message.send(PACKAGE, 'render-result', lastUsageResult);
    return lastUsageResult;
}

// ============================================================
// 复制节点路径
// ============================================================

// 预制体编辑模式下编辑器把预制体根包在这个隐藏节点下
const PREFAB_EDIT_WRAPPER = 'should_hide_in_hierarchy';

/**
 * 层级管理器右键「复制节点路径」：资源相对路径 + 节点在资源内的路径写入系统剪贴板。
 *
 * @param {string} nodeUuid
 * @returns {Promise<string>} 复制的文本，失败返回空串
 */
async function copyNodePath(nodeUuid) {
    let location = null;
    try {
        location = await Editor.Message.request('scene', 'execute-scene-script', {
            name: PACKAGE,
            method: 'queryNodeLocation',
            args: [nodeUuid],
        });
    } catch (e) {
        console.error('[resource-tools] 查询节点失败:', e);
    }
    if (!location) {
        console.warn(`[resource-tools] 找不到节点 ${nodeUuid}`);
        return '';
    }

    let assetInfo = null;
    if (location.assetUuid) {
        assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', location.assetUuid).catch(() => null);
    }

    let text;
    if (assetInfo && assetInfo.url) {
        text = formatNodePath(assetInfo.url, location.names);
    } else {
        // 拿不到资源时至少复制节点路径，去掉预制体编辑模式的包装层
        const names = location.sceneNames.slice();
        if (names[0] === PREFAB_EDIT_WRAPPER) { names.shift(); }
        text = names.join('/');
        console.warn('[resource-tools] 未能确定节点所在资源，仅复制节点路径');
    }

    require('electron').clipboard.writeText(text);
    console.log(`[resource-tools] 已复制节点路径: ${text}`);
    return text;
}

// ============================================================

exports.methods = {
    // —— 复制节点路径 ——
    copyNodePath,

    // —— 依赖清理 ——
    openCleaner,

    /**
     * 面板 ready 时拉取右键选中的 Prefab 路径。
     * @returns {string}
     */
    getPendingPrefab() {
        return pendingPrefabPath;
    },

    queryUnusedAssets,
    deleteSelected,

    // —— 引用查询 ——
    findUsages,

    getLastResult() {
        return lastUsageResult;
    },

    async openPrefab(prefabUuid) {
        const prefabInfo = await Editor.Message.request('asset-db', 'query-asset-info', prefabUuid);
        if (prefabInfo) {
            await Editor.Message.request('asset-db', 'open-asset', prefabInfo.uuid);
        }
    },

    async selectNode({ prefabUuid, nodePath } = {}) {
        let selected = false;

        if (prefabUuid && nodePath) {
            try {
                await Editor.Message.request('asset-db', 'open-asset', prefabUuid);
                const nodeUuid = await waitForNodeUuid(nodePath);
                if (nodeUuid) {
                    Editor.Selection.select('node', nodeUuid);
                    selected = true;
                }
            } catch (error) {
                selected = false;
            }
        }

        if (!selected) {
            Editor.Message.send(PACKAGE, 'select-node-failed', { prefabUuid, nodePath });
        }

        Editor.Panel.open(USAGE_PANEL);
        return selected;
    },
};

/**
 * 扩展加载时触发。
 */
exports.load = function () {
    console.log('[resource-tools] loaded (copy node path)');
};

/**
 * 扩展卸载时触发。
 */
exports.unload = function () {
    console.log('[resource-tools] unloaded');
};
