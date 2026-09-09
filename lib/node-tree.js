'use strict';

// 预制体资源里的 cc.Node._id 恒为空串，编辑器打开预制体时又会给节点分配全新的运行时 uuid，
// 两者都无法从文件里预先算出，所以只能拿扫描时记录的名字路径去实时节点树里匹配。
function findNodeUuidByPath(tree, nodePath) {
  if (!tree || typeof nodePath !== 'string' || !nodePath) {
    return null;
  }

  const target = nodePath.split('/');
  const queue = [{ node: tree, path: [] }];

  // 广度优先：编辑器会把预制体根包在场景根和 should_hide_in_hierarchy 之下，
  // 按层遍历既能跳过这些包装层，又能在同名路径出现在多个深度时选中最浅的那个。
  while (queue.length) {
    const { node, path } = queue.shift();
    if (matchesTail(path, target)) {
      return node.uuid || null;
    }
    (node.children || []).forEach((child) => {
      queue.push({ node: child, path: path.concat(child.name) });
    });
  }

  return null;
}

function matchesTail(path, target) {
  if (path.length < target.length) {
    return false;
  }
  const offset = path.length - target.length;
  return target.every((segment, index) => path[offset + index] === segment);
}

module.exports = { findNodeUuidByPath };
