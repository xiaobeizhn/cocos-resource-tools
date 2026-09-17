'use strict';

// 场景进程脚本：只有这里能拿到引擎节点对象（_prefab、parent 等）。
const { director } = require('cc');
const { collectNodeNames } = require('./lib/node-path');

function findNode(root, uuid) {
    const stack = [root];
    while (stack.length) {
        const node = stack.pop();
        if (node.uuid === uuid) { return node; }
        stack.push(...node.children);
    }
    return null;
}

function prefabAssetUuid(prefabRoot) {
    const asset = prefabRoot && prefabRoot._prefab && prefabRoot._prefab.asset;
    return asset ? (asset._uuid || asset.uuid || '') : '';
}

module.exports = {
    load() {},
    unload() {},
    methods: {
        /**
         * 查节点所在的资源和它在资源内的名字路径。
         * 优先取最近的预制体实例根（嵌套预制体里的节点定位到子预制体），否则退回场景。
         *
         * @param {string} uuid
         * @returns {{assetUuid: string, names: string[], sceneNames: string[]} | null}
         */
        queryNodeLocation(uuid) {
            const scene = director.getScene();
            const node = scene && findNode(scene, uuid);
            if (!node) { return null; }

            const sceneNames = collectNodeNames(scene, node) || [node.name];
            const prefabRoot = node._prefab && node._prefab.root;
            const assetUuid = prefabAssetUuid(prefabRoot);
            const names = assetUuid ? collectNodeNames(prefabRoot, node) : null;
            if (names) {
                return { assetUuid, names, sceneNames };
            }
            return { assetUuid: scene.uuid || '', names: sceneNames, sceneNames };
        },
    },
};
