'use strict';

/**
 * 从 node 沿 parent 往上收集名字，直到 root（不含 root 本身）。
 * node 不在 root 之下时返回 null。
 *
 * @param {{name: string, parent: any}} root
 * @param {{name: string, parent: any}} node
 * @returns {string[] | null}
 */
function collectNodeNames(root, node) {
    const names = [];
    let current = node;
    while (current && current !== root) {
        names.unshift(current.name);
        current = current.parent;
    }
    return current === root ? names : null;
}

/**
 * 拼出「资源相对路径（去扩展名）/ 节点在资源内的路径」。
 * 资源根节点本身就用文件名代表，所以 names 不含根节点名。
 *
 * formatNodePath('db://assets/a/BloomMain.prefab', ['description', 'New RichText'])
 *   => 'assets\\a\\BloomMain/description/New RichText'
 *
 * @param {string} assetUrl db:// 形式的资源 url
 * @param {string[]} names
 * @returns {string}
 */
function formatNodePath(assetUrl, names) {
    const file = String(assetUrl)
        .replace(/^db:\/\//, '')
        .replace(/\.[^./]+$/, '')
        .replace(/\//g, '\\');
    return names && names.length ? `${file}/${names.join('/')}` : file;
}

module.exports = { collectNodeNames, formatNodePath };
