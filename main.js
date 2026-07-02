'use strict';

const fs = require('fs');

/**
 * 将 uuid 规范化为“基础 uuid”（去掉子资源后缀 @xxx）。
 *
 * 依赖关系经常引用的是子资源（如 SpriteFrame / ImageAsset），其 uuid 形如
 * "xxxxxxxx@f9941"；而文件夹里被扫描的资源本身是文件级基础 uuid。
 * 统一去掉 @ 之后的内容，才能按“文件”级别进行匹配，避免误判为未引用。
 *
 * @param {string} uuid
 * @returns {string}
 */
function baseUuid(uuid) {
    if (!uuid) { return uuid; }
    const idx = uuid.indexOf('@');
    return idx >= 0 ? uuid.slice(0, idx) : uuid;
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
        await new Promise((r) => setTimeout(r, 600));
    }
    return [];
}

exports.methods = {
    /**
     * 打开清理面板（面板注册名为 default，用包名即可打开）。
     */
    openPanel() {
        Editor.Panel.open('resource-cleaner');
    },

    /**
     * 扫描：找出依赖资源文件夹（depDbPath）中、没有被指定 Prefab
     * （prefabInput，可为「文件夹」或「单个 .prefab 文件」）直接或间接依赖的资源。
     *
     * @param {string} prefabInput 例如 db://assets/prefabs 或 db://assets/prefabs/ui.prefab
     * @param {string} depDbPath   例如 db://assets/textures
     * @returns {Promise<object>} 扫描结果
     */
    async queryUnusedAssets(prefabInput, depDbPath) {
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
        //    query-asset-dependencies 第二个参数 'asset' 仅返回”资源依赖”，
        //    已自动排除脚本（Script）依赖，因此脚本不会进入引用集合。
        const referenced = new Set();
        const queue = prefabAssets.map((p) => p.uuid);

        while (queue.length) {
            const uuid = queue.shift();
            if (referenced.has(uuid)) { continue; }
            referenced.add(uuid);

            let deps = null;
            try {
                deps = await Editor.Message.request('asset-db', 'query-asset-dependencies', uuid, 'asset');
            } catch (e) {
                deps = null;
            }
            if (Array.isArray(deps)) {
                for (const dep of deps) {
                    if (!referenced.has(dep)) { queue.push(dep); }
                }
            }
        }

        // 3. 规范化为基础 uuid 集合（文件级），用于和文件夹 B 的资源做匹配
        const referencedBase = new Set();
        for (const u of referenced) { referencedBase.add(baseUuid(u)); }

        // 脚本属于逻辑代码，不在资源清理范围内：按扩展名或类型名识别并排除。
        const SCRIPT_EXT = /\.(ts|js|mjs|cjs|tsx|jsx)$/i;
        function isScriptAsset(a) {
            const name = String(a.name || '');
            const url = String(a.url || '');
            if (SCRIPT_EXT.test(name) || SCRIPT_EXT.test(url)) { return true; }
            const type = String(a.type || '');
            if (/script/i.test(type)) { return true; }
            return false;
        }

        // 4. 获取文件夹 B 中的所有资源（过滤文件夹、.meta、脚本）
        const depAssets = await queryAssetsWhenReady(depDbPath + '/**/*');
        const depFiles = depAssets.filter((a) =>
            a && !a.isDirectory && !String(a.name).endsWith('.meta') && !isScriptAsset(a)
        );
        // 统计被过滤掉的脚本数量（仅用于结果展示，确认过滤生效）
        const scriptsFiltered = depAssets.filter(
            (a) => a && !a.isDirectory && !String(a.name).endsWith('.meta') && isScriptAsset(a)
        ).length;

        // 5. 未被任何 Prefab 依赖的资源
        const unused = depFiles
            .filter((a) => !referencedBase.has(baseUuid(a.uuid)))
            .map((a) => ({
                uuid: a.uuid,
                url: a.url,                 // db:// 路径（带扩展名），用于显示
                name: a.name,
                displayName: a.displayName || a.name,
                type: a.type,
                file: a.file                // 绝对路径
            }));

        return {
            prefabCount: prefabAssets.length,
            referencedCount: referencedBase.size,
            total: depFiles.length,
            scriptsFiltered,
            unused
        };
    },

    /**
     * 删除选中的资源，同步删除对应的 .meta 文件。
     * 通过 asset-db 的 delete-asset 删除（其本身会一并删除 .meta），
     * 这里再做一次文件兜底，确保 .meta 被移除。
     *
     * @param {string[]} selectedUuids
     * @returns {Promise<object>}
     */
    async deleteSelected(selectedUuids) {
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
};

/**
 * 扩展加载时触发。
 */
exports.load = function () {
    console.log('[resource-cleaner] loaded');
};

/**
 * 扩展卸载时触发。
 */
exports.unload = function () {
    console.log('[resource-cleaner] unloaded');
};
