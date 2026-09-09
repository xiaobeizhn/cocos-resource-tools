'use strict';

const { baseUuid } = require('./uuid');

/** 脚本按扩展名识别；asset-db 的 type 里带 script 的也算。 */
const SCRIPT_EXT = /\.(ts|js|mjs|cjs|tsx|jsx)$/i;

/**
 * 脚本属于逻辑代码，不在资源清理范围内。
 *
 * @param {{name?: string, url?: string, type?: string}} asset
 * @returns {boolean}
 */
function isScriptAsset(asset) {
    if (!asset) { return false; }
    const name = String(asset.name || '');
    const url = String(asset.url || '');
    if (SCRIPT_EXT.test(name) || SCRIPT_EXT.test(url)) { return true; }
    return /script/i.test(String(asset.type || ''));
}

/**
 * 把目标目录下的资源清单拆成「参与清理的文件」与「被忽略的脚本数」。
 * 目录与 .meta 直接丢弃，不计入任何一侧。
 *
 * @param {any[]} assets query-assets 的原始返回
 * @returns {{files: any[], scriptsFiltered: number}}
 */
function partitionDepAssets(assets) {
    const files = [];
    let scriptsFiltered = 0;

    for (const asset of Array.isArray(assets) ? assets : []) {
        if (!asset || asset.isDirectory) { continue; }
        if (String(asset.name || '').endsWith('.meta')) { continue; }
        if (isScriptAsset(asset)) { scriptsFiltered++; continue; }
        files.push(asset);
    }

    return { files, scriptsFiltered };
}

/**
 * 求差集：目标目录里没有出现在引用集合中的资源，即「未被使用」。
 * 两侧都按文件级 uuid 比较，否则子资源引用会让整个文件被误判为未使用。
 *
 * @param {any[]} depFiles 已过滤的目标目录资源
 * @param {Set<string>} referencedUuids 引用集合（可含子资源后缀）
 * @returns {object[]} 面板展示所需的精简结构
 */
function selectUnused(depFiles, referencedUuids) {
    const referencedBase = new Set();
    for (const uuid of referencedUuids || []) { referencedBase.add(baseUuid(uuid)); }

    return (depFiles || [])
        .filter((a) => !referencedBase.has(baseUuid(a.uuid)))
        .map((a) => ({
            uuid: a.uuid,
            url: a.url,                 // db:// 路径（带扩展名），用于显示
            name: a.name,
            displayName: a.displayName || a.name,
            type: a.type,
            file: a.file                // 绝对路径
        }));
}

/**
 * 引用集合归一化到文件级，用于结果摘要里的计数。
 *
 * @param {Set<string>|string[]} referencedUuids
 * @returns {Set<string>}
 */
function toBaseUuidSet(referencedUuids) {
    const set = new Set();
    for (const uuid of referencedUuids || []) { set.add(baseUuid(uuid)); }
    return set;
}

module.exports = { isScriptAsset, partitionDepAssets, selectUnused, toBaseUuidSet };
