'use strict';

/**
 * 层级管理器节点右键菜单。
 *
 * - 「复制节点路径」：把「所在预制体相对路径 + 节点在预制体内的路径」复制到剪贴板，方便贴给 AI
 *
 * @param {{uuid?: string}} node
 * @returns {object[]} 菜单项配置
 */
exports.onNodeMenu = function onNodeMenu(node) {
    return [
        {
            label: '复制节点路径',
            click() {
                const uuid = (node && node.uuid) || Editor.Selection.getLastSelected('node');
                if (uuid) {
                    Editor.Message.request('resource-tools', 'copy-node-path', uuid);
                }
            },
        },
    ];
};
