'use strict';

/**
 * 资源管理器右键菜单：在目标 Prefab（或存放 Prefab 的文件夹）上右键，
 * 直接以该资源作为「Prefab 路径」打开清理面板。
 *
 * @param {{uuid?: string, url?: string, isDirectory?: boolean}} assetInfo
 * @returns {object[]} 菜单项配置
 */
exports.onAssetMenu = function onAssetMenu(assetInfo) {
    const url = assetInfo && assetInfo.url ? String(assetInfo.url) : '';
    const isPrefab = /\.prefab$/i.test(url);
    const isDirectory = Boolean(assetInfo && assetInfo.isDirectory);

    return [{
        label: 'Prefab 依赖清理',
        // 只在单个 .prefab 文件、或可能存放 Prefab 的文件夹上显示
        visible: Boolean(assetInfo && assetInfo.uuid && (isPrefab || isDirectory)),
        click() {
            Editor.Message.request('resource-cleaner', 'open-cleaner', assetInfo.uuid);
        },
    }];
};
