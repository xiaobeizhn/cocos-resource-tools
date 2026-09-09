'use strict';

/**
 * 子资源 uuid 的统一规则。
 *
 * Cocos 把一个文件里的子资源（SpriteFrame / ImageAsset / Texture2D …）编码成
 * `<文件级 uuid>@<后缀>`，例如 "a1b2c3d4-...@f9941"。清理侧拿到的是文件级 uuid，
 * 引用侧读到的往往是子资源 uuid，两边都要按这条规则对齐，因此收敛到这里。
 */

/**
 * 归一化为「文件级」uuid：去掉 `@` 之后的子资源后缀。
 *
 * @param {string} uuid
 * @returns {string} 传入为空值时原样返回
 */
function baseUuid(uuid) {
    if (!uuid) { return uuid; }
    const idx = uuid.indexOf('@');
    return idx >= 0 ? uuid.slice(0, idx) : uuid;
}

/**
 * 判断一处引用是否命中目标资源。
 *
 * 目标是文件级 uuid 时，它的任意子资源引用都算命中（选中一张 .png，prefab 里
 * 实际引用的是它的 SpriteFrame 子资源）；目标本身就是某个具体子资源时只接受全等，
 * 否则「查这一帧被谁用了」会退化成「查整个图集被谁用了」。
 *
 * @param {string} referenceUuid prefab 里读到的 __uuid__
 * @param {string} targetUuid    用户选中的资源 uuid
 * @returns {boolean}
 */
function matchesUuid(referenceUuid, targetUuid) {
    if (typeof referenceUuid !== 'string' || typeof targetUuid !== 'string') {
        return false;
    }
    if (referenceUuid === targetUuid) {
        return true;
    }
    return !targetUuid.includes('@') && referenceUuid.startsWith(`${targetUuid}@`);
}

module.exports = { baseUuid, matchesUuid };
