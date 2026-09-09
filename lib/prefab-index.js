'use strict';

const { matchesUuid } = require('./uuid');

function findAssetUsagesInPrefab(prefab, targetUuid) {
  if (!Array.isArray(prefab) || !targetUuid) {
    return [];
  }

  const nodePaths = buildNodePaths(prefab);
  const usages = [];

  prefab.forEach((entry) => {
    if (!entry || typeof entry !== 'object' || !entry.node || typeof entry.node.__id__ !== 'number') {
      return;
    }

    const nodePath = nodePaths.get(entry.node.__id__);
    if (!nodePath) {
      return;
    }

    collectReferences(entry, targetUuid, '', (propertyPath) => {
      usages.push({
        nodePath,
        componentType: entry.__type__ || 'Unknown',
        propertyPath,
      });
    });
  });

  return usages;
}

function buildNodePaths(prefab) {
  const nodes = new Map();
  prefab.forEach((entry, index) => {
    if (entry && entry.__type__ === 'cc.Node') {
      nodes.set(index, entry);
    }
  });

  const paths = new Map();
  function pathFor(id, visiting = new Set()) {
    if (paths.has(id)) {
      return paths.get(id);
    }
    if (visiting.has(id) || !nodes.has(id)) {
      return null;
    }

    visiting.add(id);
    const node = nodes.get(id);
    const name = node._name || '<unnamed>';
    const parentId = node._parent && node._parent.__id__;
    const parentPath = typeof parentId === 'number' ? pathFor(parentId, visiting) : null;
    const path = parentPath ? `${parentPath}/${name}` : name;
    visiting.delete(id);
    paths.set(id, path);
    return path;
  }

  nodes.forEach((_, id) => pathFor(id));
  return paths;
}

function collectReferences(value, targetUuid, propertyPath, onMatch) {
  if (!value || typeof value !== 'object') {
    return;
  }
  if (matchesUuid(value.__uuid__, targetUuid)) {
    onMatch(propertyPath);
    return;
  }

  Object.entries(value).forEach(([key, child]) => {
    if (key === 'node' || key === '__prefab' || key === '__editorExtras__') {
      return;
    }
    const childPath = Array.isArray(value)
      ? `${propertyPath}[${key}]`
      : propertyPath
        ? `${propertyPath}.${key}`
        : key;
    collectReferences(child, targetUuid, childPath, onMatch);
  });
}

module.exports = { findAssetUsagesInPrefab };
