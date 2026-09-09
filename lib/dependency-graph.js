'use strict';

/**
 * 从一批根资源出发，广度优先收集全部直接 + 间接的资源依赖
 * （Prefab → 材质 → 贴图 …）。
 *
 * 依赖查询作为参数注入，便于在编辑器之外测试；生产代码传入的是
 * `asset-db` 的 `query-asset-dependencies`（第二参 'asset' 只返回资源依赖，
 * 已自动排除脚本）。
 *
 * @param {string[]} rootUuids 作为依赖根的资源 uuid
 * @param {(uuid: string) => Promise<string[]|null>} queryDependencies 查询单个资源的直接依赖
 * @returns {Promise<Set<string>>} 根 + 全部依赖的 uuid 集合（含子资源后缀，未归一化）
 */
async function collectReferencedUuids(rootUuids, queryDependencies) {
    const referenced = new Set();
    const queue = Array.isArray(rootUuids) ? rootUuids.slice() : [];

    // 用游标出队而不是 shift()，避免大项目下 O(n²) 的数组搬移。
    for (let head = 0; head < queue.length; head++) {
        const uuid = queue[head];
        if (!uuid || referenced.has(uuid)) { continue; }
        referenced.add(uuid);

        let deps = null;
        try {
            deps = await queryDependencies(uuid);
        } catch (e) {
            // 单个资源查询失败只降级为「无依赖」，不能中断整轮扫描。
            deps = null;
        }
        if (Array.isArray(deps)) {
            for (const dep of deps) {
                if (!referenced.has(dep)) { queue.push(dep); }
            }
        }
    }

    return referenced;
}

module.exports = { collectReferencedUuids };
