'use strict';

/**
 * 资源管理器右键菜单：两个入口共用一个 assetMenu 贡献点
 * （Cocos 每个扩展只允许注册一个菜单脚本）。
 *
 * - 「Prefab 依赖清理」：在 .prefab 文件或文件夹上，以该资源作为依赖根打开清理面板
 * - 「查找 Prefab 引用节点」：在任意资源文件上，查这个资源被哪些节点属性引用
 *
 * @param {{uuid?: string, url?: string, isDirectory?: boolean}} assetInfo
 * @returns {object[]} 菜单项配置
 */
exports.onAssetMenu = function onAssetMenu(assetInfo) {
    const hasUuid = Boolean(assetInfo && assetInfo.uuid);
    const url = assetInfo && assetInfo.url ? String(assetInfo.url) : '';
    const isPrefab = /\.prefab$/i.test(url);
    const isDirectory = Boolean(assetInfo && assetInfo.isDirectory);

    return [
        {
            label: 'Prefab 依赖清理',
            // 只在单个 .prefab 文件、或可能存放 Prefab 的文件夹上显示
            visible: hasUuid && (isPrefab || isDirectory),
            click() {
                Editor.Message.request('resource-tools', 'open-cleaner', assetInfo.uuid);
            },
        },
        {
            label: '查找 Prefab 引用节点',
            // 目录没有可查的引用
            visible: hasUuid && !isDirectory,
            click() {
                Editor.Message.request('resource-tools', 'find-usages', assetInfo.uuid);
            },
        },
    ];
};
