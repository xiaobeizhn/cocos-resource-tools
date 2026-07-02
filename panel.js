'use strict';

module.exports = Editor.Panel.define({
    template: `
        <div class="container">
            <div class="header">
                <h2>Prefab 依赖清理工具</h2>
                <p class="tip">删除依赖资源文件夹中，没有被指定 Prefab（文件夹或单个 .prefab 文件，直接或间接）引用的资源。</p>
            </div>

            <div class="folder-select">
                <div class="row">
                    <label>Prefab 路径</label>
                    <div class="input-wrap">
                        <ui-input id="prefabPath" placeholder="文件夹如 db://assets/prefabs 或文件如 db://assets/prefabs/ui.prefab"></ui-input>
                        <div class="autocomplete" id="prefabAC"></div>
                    </div>
                </div>
                <div class="row">
                    <label>依赖资源文件夹</label>
                    <div class="input-wrap">
                        <ui-input id="depPath" placeholder="例如 db://assets/textures"></ui-input>
                        <div class="autocomplete" id="depAC"></div>
                    </div>
                </div>
                <ui-button id="btnScan" class="btn-primary">开始扫描</ui-button>
            </div>

            <div class="loading" id="loading" style="display:none;">扫描中，请稍候…</div>

            <div class="result-area" id="resultArea" style="display:none;">
                <div class="summary" id="summaryText"></div>

                <div class="toolbar">
                    <label class="checkbox-all">
                        <ui-checkbox id="checkAll"></ui-checkbox>
                        <span>全选</span>
                    </label>
                    <span class="selected-count" id="selectedCount">已选择 0 项</span>
                </div>

                <div class="file-list" id="fileList"></div>

                <div class="action-bar">
                    <ui-button id="btnDelete" class="btn-danger" disabled>删除选中资源</ui-button>
                </div>
            </div>
        </div>
    `,

    style: `
        * { box-sizing: border-box; }
        .container {
            display: flex;
            flex-direction: column;
            height: 100%;
            padding: 14px 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: #ddd;
            background: #2a2a2a;
            overflow: hidden;
        }
        .header { flex-shrink: 0; }
        .header h2 {
            margin: 0 0 4px 0;
            font-size: 15px;
            color: #fff;
        }
        .header .tip {
            margin: 0 0 12px 0;
            font-size: 11px;
            color: #888;
            line-height: 1.5;
        }
        .folder-select {
            flex-shrink: 0;
            background: #333;
            padding: 10px 12px;
            border-radius: 4px;
            margin-bottom: 12px;
        }
        .row {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }
        .row label {
            width: 110px;
            flex-shrink: 0;
            font-size: 12px;
            color: #aaa;
        }
        .input-wrap {
            position: relative;
            flex: 1;
        }
        .input-wrap ui-input {
            width: 100%;
        }
        .btn-primary {
            width: 100%;
            margin-top: 6px;
        }
        .loading {
            flex-shrink: 0;
            text-align: center;
            padding: 18px 0;
            color: #888;
            font-size: 13px;
        }

        /* 结果区：占满剩余高度，列表内部滚动，按钮永远可见 */
        .result-area {
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;
            border-top: 1px solid #444;
            padding-top: 12px;
        }
        .summary {
            flex-shrink: 0;
            margin-bottom: 10px;
            font-size: 12px;
            color: #e0e0e0;
            line-height: 1.6;
        }
        .summary .warn { color: #ff9f43; }
        .toolbar {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            padding: 6px 4px;
            border-bottom: 1px solid #444;
            margin-bottom: 6px;
        }
        .checkbox-all {
            display: flex;
            align-items: center;
            cursor: pointer;
            font-size: 12px;
            color: #fff;
        }
        .checkbox-all span { margin-left: 6px; }
        .selected-count {
            margin-left: auto;
            font-size: 11px;
            color: #888;
        }
        .file-list {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
        }
        .file-item {
            display: flex;
            align-items: center;
            padding: 7px 8px;
            border-bottom: 1px solid #3a3a3a;
            font-size: 12px;
            cursor: pointer;
        }
        .file-item:hover { background: #333; }
        .file-item ui-checkbox {
            margin-right: 10px;
            flex-shrink: 0;
        }
        .preview-btn {
            flex-shrink: 0;
            margin-left: 8px;
            padding: 3px 9px;
            font-size: 11px;
            color: #ccc;
            background: #3a3a3a;
            border: 1px solid #555;
            border-radius: 3px;
            cursor: pointer;
            white-space: nowrap;
        }
        .preview-btn:hover {
            background: #3a6ea5;
            color: #fff;
            border-color: #3a6ea5;
        }
        .file-info { flex: 1; min-width: 0; }
        .file-name {
            color: #fff;
            font-weight: 500;
            margin-bottom: 1px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .file-name .type-tag {
            color: #888;
            font-weight: 400;
            font-size: 11px;
            margin-left: 6px;
        }
        .file-path {
            color: #888;
            font-size: 11px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .empty {
            text-align: center;
            color: #888;
            padding: 24px 0;
            font-size: 12px;
        }
        .action-bar {
            flex-shrink: 0;
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid #444;
            text-align: center;
        }
        .btn-danger { min-width: 220px; }

        /* 自动补全下拉框 */
        .autocomplete {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            z-index: 1000;
            max-height: 220px;
            overflow-y: auto;
            background: #1e1e1e;
            border: 1px solid #555;
            border-radius: 0 0 4px 4px;
            box-shadow: 0 4px 10px rgba(0,0,0,.5);
        }
        .autocomplete .ac-item {
            padding: 6px 10px;
            font-size: 12px;
            color: #ccc;
            cursor: pointer;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .autocomplete .ac-item.active,
        .autocomplete .ac-item:hover {
            background: #3a6ea5;
            color: #fff;
        }
        .autocomplete .ac-empty {
            padding: 8px 10px;
            font-size: 11px;
            color: #666;
        }
    `,

    $: {
        prefabPath: '#prefabPath',
        depPath: '#depPath',
        prefabAC: '#prefabAC',
        depAC: '#depAC',
        btnScan: '#btnScan',
        loading: '#loading',
        resultArea: '#resultArea',
        summaryText: '#summaryText',
        checkAll: '#checkAll',
        selectedCount: '#selectedCount',
        fileList: '#fileList',
        btnDelete: '#btnDelete'
    },

    ready() {
        const $ = this.$;

        $.prefabPath.value = 'db://assets/prefabs';
        $.depPath.value = 'db://assets/textures';

        /** @type {Array<object>} */
        let unusedAssets = [];
        /** @type {Set<string>} */
        const selectedUuids = new Set();

        // ---------------- 路径自动补全 ----------------
        /** 查询项目内全部资源的 { url, isDirectory }（带缓存，供各下拉框共享）。 */
        let allAssetUrlsCache = null;
        async function loadAllAssetUrls() {
            if (allAssetUrlsCache) { return allAssetUrlsCache; }
            let all = [];
            try {
                all = await Editor.Message.request('asset-db', 'query-assets', {
                    pattern: 'db://assets/**/*'
                });
            } catch (e) {
                all = [];
            }
            allAssetUrlsCache = (all || [])
                .filter((a) => a && a.url)
                .map((a) => ({ url: a.url, isDirectory: !!a.isDirectory }));
            return allAssetUrlsCache;
        }

        /** 依赖资源文件夹输入：只提示文件夹路径。 */
        async function loadFolderOptions() {
            const all = await loadAllAssetUrls();
            const set = new Set(all.filter((a) => a.isDirectory).map((a) => a.url));
            set.add('db://assets');
            return Array.from(set).sort();
        }

        /**
         * Prefab 输入：既支持文件夹，也支持单个 .prefab 文件，
         * 因此候选项同时包含文件夹与所有 .prefab 文件路径。
         */
        async function loadPrefabOptions() {
            const all = await loadAllAssetUrls();
            const set = new Set();
            for (const a of all) {
                if (a.isDirectory) {
                    set.add(a.url);
                } else if (/\.prefab$/i.test(a.url)) {
                    set.add(a.url);
                }
            }
            set.add('db://assets');
            return Array.from(set).sort();
        }

        /**
         * 给一个 ui-input 挂上自动补全下拉框。
         * @param {HTMLElement} input  ui-input 宿主元素
         * @param {HTMLElement} drop   下拉框容器
         * @param {() => Promise<string[]>} loadOptions  返回候选项数组的函数（自带缓存）
         */
        function attachAutocomplete(input, drop, loadOptions) {
            let filtered = [];
            let active = -1;
            let suppressBlur = false;
            /** @type {string[] | null} null 表示尚未加载 */
            let options = null;

            function ensureLoaded() {
                if (options) { return Promise.resolve(options); }
                return loadOptions().then((opts) => {
                    options = (opts || []).slice();
                    return options;
                });
            }

            // 写入 ui-input 值：同时更新宿主属性与 shadow DOM 内部原生输入框。
            // 关键点——直接改内部 input 的 value，这样即便 ui-input 在失焦时
            // “回读内部值再提交”，读到的也是新值，不会被回退成旧文本。
            function setInputValue(val) {
                input.value = val;
                let inner = null;
                try { inner = input.shadowRoot ? input.shadowRoot.querySelector('input,textarea') : null; } catch (e) { inner = null; }
                if (!inner) { try { inner = input.$input; } catch (e) { inner = null; } }
                if (!inner) { try { inner = input.querySelector('input,textarea'); } catch (e) { inner = null; } }
                if (inner) { inner.value = val; }
            }

            // 取事件真正触发的原生 input（兼容 shadow DOM），读实时输入值
            function liveValue(e) {
                const t = e && e.composedPath ? e.composedPath()[0] : (e && e.target);
                return (t && typeof t.value === 'string') ? t.value : (input.value || '');
            }

            function doFilter(val) {
                const v = String(val || '').toLowerCase();
                const opts = options || [];
                if (!v) {
                    filtered = opts.slice(0, 30);
                } else {
                    const starts = [];
                    const includes = [];
                    for (const o of opts) {
                        const ol = o.toLowerCase();
                        if (ol.startsWith(v)) { starts.push(o); }
                        else if (ol.includes(v)) { includes.push(o); }
                    }
                    filtered = starts.concat(includes).slice(0, 30);
                }
                active = filtered.length ? 0 : -1;
            }

            function render() {
                drop.innerHTML = '';
                if (!filtered.length) {
                    const empty = document.createElement('div');
                    empty.className = 'ac-empty';
                    empty.textContent = options === null ? '加载中…' : '无匹配项';
                    drop.appendChild(empty);
                    drop.style.display = 'block';
                    return;
                }
                filtered.forEach((opt, i) => {
                    const div = document.createElement('div');
                    div.className = 'ac-item' + (i === active ? ' active' : '');
                    div.textContent = opt;
                    // mousedown 阻止 input 失焦（保证后续 click 仍命中且不触发
                    // ui-input 失焦时的值回退）；真正写入放到 click。
                    div.addEventListener('mousedown', (ev) => {
                        ev.preventDefault();
                        suppressBlur = true;
                    });
                    div.addEventListener('click', () => {
                        setInputValue(opt);
                        try { input.focus(); } catch (e) {}
                        suppressBlur = false;
                        hide();
                    });
                    drop.appendChild(div);
                });
                drop.style.display = 'block';
            }

            function show(val) { doFilter(val); render(); }
            function hide() { drop.style.display = 'none'; active = -1; }

            input.addEventListener('focus', () => {
                ensureLoaded().then(() => show(input.value || ''));
            });
            input.addEventListener('input', (e) => {
                if (options === null) { ensureLoaded().then(() => show(liveValue(e))); }
                else { show(liveValue(e)); }
            });

            input.addEventListener('keydown', (e) => {
                const open = drop.style.display === 'block';
                if (e.key === 'ArrowDown') {
                    if (!open) { ensureLoaded().then(() => show(liveValue(e))); return; }
                    if (filtered.length) {
                        e.preventDefault();
                        active = (active + 1) % filtered.length;
                        render();
                    }
                } else if (e.key === 'ArrowUp') {
                    if (open && filtered.length) {
                        e.preventDefault();
                        active = (active - 1 + filtered.length) % filtered.length;
                        render();
                    }
                } else if (e.key === 'Enter') {
                    if (open && active >= 0) {
                        e.preventDefault();
                        setInputValue(filtered[active]);
                        hide();
                    }
                } else if (e.key === 'Escape') {
                    hide();
                }
            });

            input.addEventListener('blur', () => {
                if (suppressBlur) { return; }
                setTimeout(hide, 150);
            });
        }

        attachAutocomplete($.prefabPath, $.prefabAC, loadPrefabOptions);
        attachAutocomplete($.depPath, $.depAC, loadFolderOptions);

        // 点击下拉框以外区域时关闭
        document.addEventListener('click', (e) => {
            if (!e.target.closest || (!e.target.closest('#prefabPath') && !e.target.closest('#prefabAC') &&
                !e.target.closest('#depPath') && !e.target.closest('#depAC'))) {
                $.prefabAC.style.display = 'none';
                $.depAC.style.display = 'none';
            }
        });

        // ---------------- UI 辅助 ----------------
        function setCheckbox(el, checked) {
            if (!el) { return; }
            el.checked = !!checked;
        }

        /**
         * 在 Cocos 中选中并显示指定资源（属性检查器 / 资源预览区）。
         * 只设置选中状态，不主动切换面板焦点，避免本面板被遮挡/隐藏。
         */
        function selectAssetForPreview(uuid) {
            if (!uuid) { return; }
            try {
                Editor.Selection.select('asset', [uuid]);
            } catch (e) {
                try { Editor.Selection.select('asset', uuid); } catch (e2) { /* ignore */ }
            }
        }

        function renderFileList() {
            $.fileList.innerHTML = '';
            if (!unusedAssets.length) {
                const empty = document.createElement('div');
                empty.className = 'empty';
                empty.textContent = '没有发现未使用的资源 🎉';
                $.fileList.appendChild(empty);
                return;
            }

            // 单击 / 双击区分计时器
            let clickTimer = null;

            unusedAssets.forEach((asset) => {
                const item = document.createElement('div');
                item.className = 'file-item';
                item.dataset.uuid = asset.uuid;

                const checkbox = document.createElement('ui-checkbox');
                checkbox.checked = selectedUuids.has(asset.uuid);
                checkbox.dataset.uuid = asset.uuid;
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) { selectedUuids.add(asset.uuid); }
                    else { selectedUuids.delete(asset.uuid); }
                    updateUI();
                });

                const info = document.createElement('div');
                info.className = 'file-info';

                const name = document.createElement('div');
                name.className = 'file-name';
                const typeTag = asset.type ? ('<span class="type-tag">' + asset.type + '</span>') : '';
                name.innerHTML = asset.displayName + typeTag;

                const p = document.createElement('div');
                p.className = 'file-path';
                p.textContent = asset.url;
                p.title = asset.url; // hover 显示完整路径

                info.appendChild(name);
                info.appendChild(p);

                item.appendChild(checkbox);
                item.appendChild(info);

                // 预览按钮：单击在资源预览界面中选中并显示该资源
                const previewBtn = document.createElement('button');
                previewBtn.className = 'preview-btn';
                previewBtn.type = 'button';
                previewBtn.title = '在资源预览界面中显示';
                previewBtn.textContent = '👁 预览';
                previewBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // 阻止冒泡到行的单击/双击逻辑，避免误触选中
                    selectAssetForPreview(asset.uuid);
                });
                item.appendChild(previewBtn);

                // 单击行：切换选中（延迟 150ms 以区分双击）
                // 双击行：在资源管理器中定位该资源
                item.addEventListener('click', (e) => {
                    // 点击 checkbox / 预览按钮本身不触发行的选中切换
                    const path = e.composedPath ? e.composedPath() : [e.target];
                    if (path.some((el) => el.tagName === 'UI-CHECKBOX' || el.tagName === 'BUTTON')) { return; }

                    if (clickTimer) {
                        // 第二次点击 → 双击
                        clearTimeout(clickTimer);
                        clickTimer = null;
                        // 双击：在资源管理器中选中并定位该资源
                        selectAssetForPreview(asset.uuid);
                    } else {
                        // 第一次点击 → 等待判断是否双击
                        clickTimer = setTimeout(() => {
                            clickTimer = null;
                            // 单击：切换选中状态
                            const uuid = asset.uuid;
                            if (selectedUuids.has(uuid)) {
                                selectedUuids.delete(uuid);
                                checkbox.checked = false;
                            } else {
                                selectedUuids.add(uuid);
                                checkbox.checked = true;
                            }
                            updateUI();
                        }, 150);
                    }
                });

                $.fileList.appendChild(item);
            });
        }

        function updateUI() {
            const count = selectedUuids.size;
            $.selectedCount.textContent = '已选择 ' + count + ' 项';
            $.btnDelete.disabled = count === 0;

            const all = unusedAssets.length > 0 && count === unusedAssets.length;
            setCheckbox($.checkAll, all);
            if ($.checkAll) {
                $.checkAll.indeterminate = count > 0 && count < unusedAssets.length;
            }
        }

        // ---------------- 扫描 ----------------
        $.btnScan.addEventListener('click', async () => {
            const prefabPath = String($.prefabPath.value || '').trim();
            const depPath = String($.depPath.value || '').trim();
            if (!prefabPath || !depPath) {
                alert('请填写 Prefab 路径与依赖资源文件夹');
                return;
            }

            $.loading.style.display = 'block';
            $.resultArea.style.display = 'none';
            $.btnScan.disabled = true;

            try {
                const data = await Editor.Message.request(
                    'resource-cleaner', 'query-unused-assets', prefabPath, depPath
                );

                unusedAssets = Array.isArray(data.unused) ? data.unused : [];
                selectedUuids.clear();

                if (data.message) {
                    $.summaryText.innerHTML = '<span class="warn">' + data.message + '</span>';
                } else {
                    const scriptInfo = data.scriptsFiltered
                        ? '　·　已忽略脚本：<b>' + data.scriptsFiltered + '</b>'
                        : '';
                    $.summaryText.innerHTML =
                        'Prefab 数量：<b>' + data.prefabCount + '</b>　·　' +
                        '依赖资源总数：<b>' + data.total + '</b>　·　' +
                        '未使用：<b style="color:#ff6b6b">' + unusedAssets.length + '</b>' +
                        scriptInfo;
                }

                renderFileList();
                updateUI();
                $.loading.style.display = 'none';
                $.resultArea.style.display = 'flex';
            } catch (err) {
                $.loading.style.display = 'none';
                alert('扫描失败：' + (err && err.message ? err.message : err));
            } finally {
                $.btnScan.disabled = false;
            }
        });

        // ---------------- 全选 ----------------
        $.checkAll.addEventListener('change', (e) => {
            const checked = e.target.checked;
            if (checked) { unusedAssets.forEach((a) => selectedUuids.add(a.uuid)); }
            else { selectedUuids.clear(); }
            $.fileList.querySelectorAll('ui-checkbox').forEach((cb) => {
                if (cb.dataset.uuid) { setCheckbox(cb, checked); }
            });
            updateUI();
        });

        // ---------------- 删除 ----------------
        $.btnDelete.addEventListener('click', async () => {
            if (selectedUuids.size === 0) { return; }
            const ok = confirm('确定删除选中的 ' + selectedUuids.size + ' 个资源吗？\n（将同步删除对应的 .meta 文件，操作不可撤销）');
            if (!ok) { return; }

            const originText = '删除选中资源';
            $.btnDelete.disabled = true;
            $.btnDelete.textContent = '删除中…';

            try {
                const data = await Editor.Message.request(
                    'resource-cleaner', 'delete-selected', Array.from(selectedUuids)
                );

                const failedSet = new Set((data.failedItems || []).map((it) => it.uuid));
                const removed = [];
                selectedUuids.forEach((uuid) => { if (!failedSet.has(uuid)) { removed.push(uuid); } });
                unusedAssets = unusedAssets.filter((a) => !removed.includes(a.uuid));
                selectedUuids.clear();

                renderFileList();
                updateUI();

                let msg = '删除完成：成功 ' + data.deleted + ' 个，失败 ' + data.failed + ' 个。';
                if (data.failed > 0) {
                    msg += '\n失败项：\n' + data.failedItems.map((it) => '· ' + (it.name || it.uuid) + ' — ' + it.error).join('\n');
                }
                alert(msg);
            } catch (err) {
                alert('删除失败：' + (err && err.message ? err.message : err));
            } finally {
                $.btnDelete.disabled = false;
                $.btnDelete.textContent = originText;
            }
        });
    },

    beforeClose() {},
    close() {}
});
