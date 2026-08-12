/* ============================================
   晚心游戏 - 应用逻辑
   - 分类导航 / 资源浏览 / 搜索
   - 管理员后台：分类 & 链接 CRUD
   - 数据持久化：服务端 data.json（管理员修改后所有访问者同步）
   - 支持图片上传作为分类图标
   ============================================ */

// ============================================
// 1. 默认数据（离线/API 失败时的兜底）
// ============================================

const defaultData = {
  categories: [
    {
      id: 'games', name: '游戏推荐', icon: '🎮', desc: '精品游戏资源与攻略',
      items: [
        { id: 'g1', title: '原神', desc: '开放世界冒险游戏', icon: '🌟', link: 'https://ys.mihoyo.com', link2: '', tags: ['角色扮演', '开放世界', '免费'] },
        { id: 'g2', title: '我的世界', desc: '无限创造力的沙盒游戏', icon: '⛏️', link: 'https://www.minecraft.net', link2: '', tags: ['沙盒', '创造', '生存'] },
        { id: 'g3', title: '英雄联盟', desc: '全球最受欢迎的MOBA竞技游戏', icon: '⚔️', link: 'https://lol.qq.com', link2: '', tags: ['MOBA', '竞技', '免费'] },
      ],
    },
    {
      id: 'movies', name: '影视推荐', icon: '🎬', desc: '热门电影电视剧推荐',
      items: [
        { id: 'm1', title: '示例影片 A', desc: '一部精彩的电影作品', icon: '🎥', link: 'https://example.com/movie-a', link2: '', tags: ['电影', '动作'] },
        { id: 'm2', title: '示例剧集 B', desc: '一部热门的电视剧', icon: '📺', link: 'https://example.com/show-b', link2: '', tags: ['电视剧', '悬疑'] },
      ],
    },
    {
      id: 'anime', name: '动漫推荐', icon: '🎨', desc: '热门动漫番剧推荐',
      items: [
        { id: 'a1', title: '示例动漫 A', desc: '一部高人气动漫作品', icon: '🐉', link: 'https://example.com/anime-a', link2: '', tags: ['热血', '冒险'] },
        { id: 'a2', title: '示例动漫 B', desc: '一部治愈系动漫', icon: '🌸', link: 'https://example.com/anime-b', link2: '', tags: ['治愈', '日常'] },
      ],
    },
    {
      id: 'music', name: '音乐推荐', icon: '🎵', desc: '好听的音乐与歌单',
      items: [
        { id: 'mu1', title: '示例歌单 A', desc: '一个精选歌单', icon: '🎧', link: 'https://example.com/playlist-a', link2: '', tags: ['华语', '流行'] },
        { id: 'mu2', title: '示例歌单 B', desc: '放松心情的纯音乐', icon: '🎹', link: 'https://example.com/playlist-b', link2: '', tags: ['纯音乐', '放松'] },
      ],
    },
    {
      id: 'tools', name: '实用工具', icon: '🔧', desc: '好用的在线工具与资源',
      items: [
        { id: 't1', title: '示例工具 A', desc: '一个实用的在线工具', icon: '🧰', link: 'https://example.com/tool-a', link2: '', tags: ['在线工具', '免费'] },
        { id: 't2', title: '示例工具 B', desc: '另一个好用的资源站', icon: '📦', link: 'https://example.com/tool-b', link2: '', tags: ['资源', '效率'] },
      ],
    },
    {
      id: 'others', name: '其他推荐', icon: '📦', desc: '更多有趣的内容',
      items: [
        { id: 'o1', title: '更多内容即将上线', desc: '敬请期待', icon: '✨', link: '', link2: '', tags: ['即将上线'] },
      ],
    },
  ],
};

let adminPassword = '';

// ============================================
// 2. 服务端数据层 + localStorage 缓存加速
// ============================================

const LS_CACHE_KEY = 'wx_site_data_v2';
const LS_TS_KEY = 'wx_site_ts_v2';

function _loadLocalCache() {
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    if (!raw) return null;
    const cats = JSON.parse(raw);
    if (cats && Array.isArray(cats) && cats.length > 0) return cats;
  } catch (e) { /* ignore */ }
  return null;
}

function _saveLocalCache(categories) {
  try {
    localStorage.setItem(LS_CACHE_KEY, JSON.stringify(categories));
    localStorage.setItem(LS_TS_KEY, Date.now().toString());
  } catch (e) { /* localStorage 满则跳过 */ }
}

// 标记"刚刚保存过"的时间戳（用于防御 KV 延迟）
function _markJustSaved() {
  try { localStorage.setItem('wx_saved_at', Date.now().toString()); } catch (e) { /* ignore */ }
}

function _clearLocalCache() {
  try { localStorage.removeItem(LS_CACHE_KEY); localStorage.removeItem(LS_TS_KEY); } catch (e) { /* ignore */ }
}

async function loadData() {
  try {
    // 优先尝试带缓存头的请求，若数据未变则 304 瞬间返回
    const resp = await fetch('/api/data?_t=' + Date.now());
    if (resp.ok) {
      const json = await resp.json();
      if (json && json.categories && Array.isArray(json.categories)) {
        console.log('[loadData] 服务端返回分类数:', json.categories.length);
        _saveLocalCache(json.categories);
        return json.categories;
      }
    }
  } catch (e) {
    console.warn('从服务端加载数据失败，使用缓存兜底:', e.message);
  }
  // 离线或网络故障：优先用缓存
  const cached = _loadLocalCache();
  if (cached) return cached;
  return JSON.parse(JSON.stringify(defaultData.categories));
}

async function saveData() {
  if (!adminPassword) {
    showToast('登录已过期，请重新登录');
    return false;
  }

  return await attemptSave(3); // 最多重试 3 次
}

async function attemptSave(retriesLeft) {
  try {
    const body = JSON.stringify({ password: adminPassword, categories: state.categories });
    const bodySize = (body.length / 1024).toFixed(0);
    console.log('[saveData] 准备保存，数据大小: ' + bodySize + 'KB，分类数: ' + state.categories.length + '，剩余重试: ' + retriesLeft);

    // 对大请求体进行 gzip 压缩，大幅减少传输时间
    let compressedBody = body;
    let useGzip = body.length > 50000; // 超过 50KB 才压缩
    if (useGzip) {
      try {
        const stream = new Blob([body]).stream().pipeThrough(new CompressionStream('gzip'));
        compressedBody = await new Response(stream).blob();
        console.log('[saveData] 压缩后: ' + (compressedBody.size / 1024).toFixed(0) + 'KB (节省 ' + (100 - (compressedBody.size / body.length * 100)).toFixed(0) + '%)');
      } catch (compressErr) {
        console.warn('[saveData] 压缩失败，发送原始数据:', compressErr.message);
        useGzip = false;
      }
    }

    const headers = useGzip
      ? { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }
      : { 'Content-Type': 'application/json' };

    const resp = await fetch('/api/save', {
      method: 'POST',
      headers: headers,
      body: useGzip ? compressedBody : body,
    });
    const json = await resp.json();
    if (json.success) {
      updateLastSaveTime();
      console.log('[saveData] 服务器确认保存成功');
      _saveLocalCache(state.categories);
      _markJustSaved();
      return true;
    } else {
      showToast(json.message || '保存失败');
      console.warn('[saveData] 服务器返回失败:', json.message);
      return false;
    }
  } catch (e) {
    console.error('[saveData] 错误:', e.message);
    if (retriesLeft > 1) {
      const waitMs = Math.pow(2, 3 - retriesLeft) * 1000; // 1s, 2s, 4s 退避
      console.log('[saveData] ' + waitMs/1000 + 's 后重试...');
      showToast('保存中，请稍候...');
      await new Promise(r => setTimeout(r, waitMs));
      return attemptSave(retriesLeft - 1);
    }
    showToast('保存失败，请检查服务器连接');
    return false;
  }
}

// ============================================
// 自动批量保存：连续删除/编辑时合并为一次请求
// ============================================

const SAVE_DEBOUNCE_MS = 600;   // 停止操作后多久保存
const SAVE_MAX_WAIT_MS = 2500;  // 最多等待多久强制保存

let saveDebounceTimer = null;
let saveMaxWaitTimer = null;
let saveInProgress = false;
let pendingSavePromise = null;
let pendingSaveResolve = null;
let pendingSnapshot = null;

function _takePendingSnapshot() {
  if (!pendingSnapshot) {
    pendingSnapshot = JSON.parse(JSON.stringify(state.categories));
  }
}

/**
 * 请求保存：将多次连续修改合并为一次服务器请求
 * 返回 Promise<boolean>，在真正保存完成后 resolve
 */
function requestSave() {
  if (!adminPassword) {
    showToast('登录已过期，请重新登录');
    return Promise.resolve(false);
  }

  _takePendingSnapshot();

  if (!pendingSavePromise) {
    pendingSavePromise = new Promise((resolve) => { pendingSaveResolve = resolve; });
  }

  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => flushSave(), SAVE_DEBOUNCE_MS);

  if (!saveMaxWaitTimer) {
    saveMaxWaitTimer = setTimeout(() => flushSave(), SAVE_MAX_WAIT_MS);
  }

  return pendingSavePromise;
}

async function flushSave() {
  if (saveInProgress) {
    setTimeout(() => flushSave(), 200);
    return;
  }

  if (saveDebounceTimer) { clearTimeout(saveDebounceTimer); saveDebounceTimer = null; }
  if (saveMaxWaitTimer) { clearTimeout(saveMaxWaitTimer); saveMaxWaitTimer = null; }

  saveInProgress = true;
  showToast('保存中，请稍候...');

  const ok = await saveData();

  saveInProgress = false;

  const resolveFn = pendingSaveResolve;
  pendingSaveResolve = null;
  pendingSavePromise = null;
  if (resolveFn) resolveFn(ok);

  if (ok) {
    pendingSnapshot = null;
    updateLastSaveTime();
    showToast('保存成功');
  } else if (pendingSnapshot) {
    // 保存失败，恢复到本次批量操作前的状态
    state.categories = pendingSnapshot;
    pendingSnapshot = null;
    renderCategoryTabs();
    renderHomeItems('all');
    refreshAllAdminViews();
    alert('❌ 保存到服务器失败！\n\n可能原因：云隧道连接不稳定，请稍后重试。\n\n数据已恢复到保存前状态。');
  }
}

// 离开页面前若还有未保存的修改，先尝试保存
window.addEventListener('beforeunload', (e) => {
  if (saveDebounceTimer || saveInProgress) {
    flushSave();
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});

// ============================================
// 3. 图片上传到服务器
// ============================================

async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  try {
    const resp = await fetch('/api/upload', { method: 'POST', body: formData });
    const json = await resp.json();
    if (json.success) return json.url;
    console.warn('图片上传失败:', json.message);
    return null;
  } catch (e) {
    console.warn('图片上传失败（服务器可能未启动上传接口）:', e.message);
    return null;
  }
}

/**
 * Canvas 压缩图片为缩略图（最大 512×512，质量 0.85）
 * 适配 2x Retina 屏幕，清晰度接近原图，单张约 15-30KB
 */
function compressImage(file, maxWidth = 512, maxHeight = 512, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      // 等比例缩放到限制尺寸以内
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], file.name, { type: blob.type || 'image/png' }));
        } else {
          resolve(file); // 兜底：使用原文件
        }
      }, file.type || 'image/png', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // 兜底：使用原文件
    };
    img.src = objectUrl;
  });
}

// ============================================
// 4. 图标渲染辅助函数
// ============================================

function isImageIcon(icon) {
  return icon && (icon.startsWith('data:image/') || icon.startsWith('/uploads/') || icon.startsWith('/img/') || icon.startsWith('http'));
}

function renderIconHTML(icon, cssClass) {
  if (!icon) return '';
  if (isImageIcon(icon)) {
    const style = 'max-width:64px;max-height:64px;width:auto;height:auto;object-fit:cover;border-radius:8px;vertical-align:middle;display:inline-block;';
    return `<img src="${escHtml(icon)}" class="${cssClass || ''}" alt="" loading="lazy" style="${style}" onerror="this.style.display='none'">`;
  }
  return icon;
}

// 首页大卡片封面专用：图片铺满容器，不留空白
function renderCoverIconHTML(icon) {
  if (!icon) return '<span style="font-size:3rem;opacity:.6;">🎮</span>';
  if (isImageIcon(icon)) {
    return `<img src="${escHtml(icon)}" alt="" loading="lazy" onerror="this.style.display='none'">`;
  }
  return `<span class="cover-emoji">${icon}</span>`;
}

// ============================================
// 5. 数据访问层
// ============================================

async function fetchCategories() {
  return state.categories;
}

async function fetchCategoryById(categoryId) {
  return state.categories.find(c => c.id === categoryId) || null;
}

async function searchItems(keyword) {
  const results = [];
  const kw = keyword.toLowerCase();
  state.categories.forEach(cat => {
    cat.items.forEach(item => {
      if (item.title.toLowerCase().includes(kw) ||
          item.desc.toLowerCase().includes(kw) ||
          cat.name.toLowerCase().includes(kw) ||
          (item.tags && item.tags.some(t => t.toLowerCase().includes(kw)))) {
        results.push({ ...item, categoryName: cat.name, categoryId: cat.id });
      }
    });
  });
  return results;
}

// ============================================
// 6. 视图状态管理
// ============================================

const state = {
  currentView: 'home',
  currentCategoryId: null,
  categories: [],
  adminTab: 'categories',
  editingCategoryId: null,
  editingItemId: null,
};

// 首页当前选中的分类标签 ID，'all' 表示全部
let currentHomeCategoryId = 'all';

// ============================================
// 7. 前台 UI 渲染
// ============================================

// 渲染首页分类标签（全部 + 各分类）
function renderCategoryTabs() {
  const tabs = document.getElementById('categoryTabs');
  if (!tabs) return;
  const allBtn = `<div class="category-tab ${currentHomeCategoryId === 'all' ? 'active' : ''}" data-cat="all" onclick="switchHomeCategory('all')">🏠 全部</div>`;
  const catBtns = state.categories.map(cat => `
    <div class="category-tab ${currentHomeCategoryId === cat.id ? 'active' : ''}" data-cat="${cat.id}" onclick="switchHomeCategory('${cat.id}')">
      ${renderIconHTML(cat.icon, '')}${cat.name}
    </div>
  `).join('');
  tabs.innerHTML = allBtn + catBtns;
}

// 切换首页分类标签
function switchHomeCategory(catId) {
  currentHomeCategoryId = catId;
  renderCategoryTabs();
  renderHomeItems(catId);
}

// 渲染首页大卡片资源列表
function renderHomeItems(catId, searchQuery) {
  const list = document.getElementById('homeItemList');
  const empty = document.getElementById('homeEmptyState');
  if (!list) return;

  let items = [];
  if (catId === 'all') {
    state.categories.forEach(cat => {
      cat.items.forEach(item => items.push({ ...item, categoryId: cat.id }));
    });
  } else {
    const cat = state.categories.find(c => c.id === catId);
    if (cat) items = cat.items.map(item => ({ ...item, categoryId: cat.id }));
  }

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    items = items.filter(item =>
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.desc && item.desc.toLowerCase().includes(q)) ||
      (item.tags && item.tags.some(t => t.toLowerCase().includes(q)))
    );
  }

  const hasItems = items.length > 0;
  list.style.display = hasItems ? '' : 'none';
  if (empty) empty.style.display = hasItems ? 'none' : '';
  if (!hasItems) return;

  list.innerHTML = items.map(item => `
    <div class="large-item-card" onclick="openItemModal('${item.categoryId}', '${item.id}')">
      <div class="large-item-cover">
        ${renderCoverIconHTML(item.icon)}
        ${item.tags && item.tags.length ? `<div class="cover-tags">${item.tags.slice(0, 3).map(t => `<span>${t}</span>`).join('')}</div>` : ''}
      </div>
      <div class="large-item-info">
        <div class="large-item-title">${item.title}</div>
      </div>
    </div>
  `).join('');
}

// 兼容旧逻辑：分类网格已不在首页使用，保留函数避免报错
function renderCategoryCards() {
  const grid = document.getElementById('categoryGrid');
  if (!grid) return;
  grid.innerHTML = state.categories.map(cat => `
    <div class="category-card" onclick="navigateToCategory('${cat.id}')">
      <div class="category-card-icon">${renderIconHTML(cat.icon, '')}</div>
      <div class="category-card-name">${cat.name}</div>
      <div class="category-card-count">${cat.items.length} 个资源</div>
    </div>
  `).join('');
}

function renderCategoryDetail(category) {
  if (!category) return;
  const header = document.getElementById('categoryHeader');
  header.innerHTML = `
    <span class="category-header-icon">${renderIconHTML(category.icon, '')}</span>
    <h2 class="category-header-name">${category.name}</h2>
    <p class="category-header-desc">${category.desc}</p>
  `;
  const hasItems = category.items && category.items.length > 0;
  document.getElementById('itemList').style.display = hasItems ? '' : 'none';
  document.getElementById('emptyState').style.display = hasItems ? 'none' : '';
  if (!hasItems) return;
  document.getElementById('itemList').innerHTML = category.items.map(item => `
    <div class="item-card" onclick="openItemModal('${category.id}', '${item.id}')">
      <div class="item-cover">${renderIconHTML(item.icon, '')}</div>
      <div class="item-info">
        <div class="item-title">${item.title}</div>
        <div class="item-desc">${item.desc}</div>
        ${item.tags && item.tags.length ? `<div class="item-tags">${item.tags.map(t => `<span class="item-tag">${t}</span>`).join('')}</div>` : ''}
      </div>
      <div class="item-arrow">›</div>
    </div>
  `).join('');
}

function renderBreadcrumb() {
  const bc = document.getElementById('breadcrumb');
  if (state.currentView === 'home') {
    bc.innerHTML = `<span class="breadcrumb-item active" data-view="home">🏠 首页</span>`;
  } else if (state.currentView === 'category' && state.currentCategoryId) {
    const cat = state.categories.find(c => c.id === state.currentCategoryId);
    bc.innerHTML = `
      <span class="breadcrumb-item" data-view="home">🏠 首页</span>
      <span class="breadcrumb-sep">›</span>
      <span class="breadcrumb-item active">${cat ? renderIconHTML(cat.icon, '') + ' ' + cat.name : '分类'}</span>`;
  } else if (state.currentView === 'about') {
    bc.innerHTML = `
      <span class="breadcrumb-item" data-view="home">🏠 首页</span>
      <span class="breadcrumb-sep">›</span>
      <span class="breadcrumb-item active">📖 关于本站</span>`;
  } else if (state.currentView === 'admin') {
    bc.innerHTML = `
      <span class="breadcrumb-item" data-view="home">🏠 首页</span>
      <span class="breadcrumb-sep">›</span>
      <span class="breadcrumb-item active">⚙️ 后台管理</span>`;
  }
  bc.querySelectorAll('.breadcrumb-item[data-view]').forEach(el => {
    el.addEventListener('click', () => navigateTo('home'));
  });
}

// ============================================
// 8. 视图切换
// ============================================

function switchView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  let targetId = 'view' + viewName.charAt(0).toUpperCase() + viewName.slice(1);
  if (viewName === 'admin') targetId = 'viewAdmin';
  const target = document.getElementById(targetId);
  if (target) target.classList.add('active');
  state.currentView = viewName;
  renderBreadcrumb();
  // 首页置顶横幅仅在首页显示
  const homeHero = document.getElementById('homeHero');
  if (homeHero) homeHero.classList.toggle('hero-hidden', viewName !== 'home');
  // 搜索栏在所有视图都可见，但清空搜索结果
  const results = document.getElementById('searchResults');
  const input = document.getElementById('searchInput');
  if (results) { results.classList.remove('show'); results.innerHTML = ''; }
  if (input) input.value = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function navigateTo(viewName) {
  switchView(viewName);
  if (viewName === 'home') {
    currentHomeCategoryId = 'all';
    renderCategoryTabs();
    renderHomeItems('all');
  }
  if (viewName === 'admin') refreshAllAdminViews();
}

async function navigateToCategory(categoryId) {
  const category = await fetchCategoryById(categoryId);
  if (!category) return;
  state.currentCategoryId = categoryId;
  switchView('category');
  renderCategoryDetail(category);
}

// ============================================
// 9. 前台链接弹窗
// ============================================

// 全局下载次数（存于服务器 KV，所有访客共享）
async function fetchDownloadCount(itemId) {
  try {
    const res = await fetch(`/api/download-count?id=${encodeURIComponent(itemId)}`, { cache: 'no-store' });
    const data = await res.json();
    return (data && typeof data.count === 'number') ? data.count : 0;
  } catch (e) {
    return 0;
  }
}

async function incrementDownloadCount(itemId) {
  try {
    const res = await fetch('/api/download-count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId }),
    });
    const data = await res.json();
    const el = document.getElementById('downloadCount-' + itemId);
    if (el && data && typeof data.count === 'number') {
      el.textContent = data.count + '次下载';
    }
  } catch (e) { /* ignore */ }
}

function openItemModal(categoryId, itemId) {
  const cat = state.categories.find(c => c.id === categoryId);
  if (!cat) return;
  const item = cat.items.find(i => i.id === itemId);
  if (!item) return;
  if (!item.link) { showToast('该资源暂无链接，敬请期待~'); return; }
  const overlay = document.getElementById('modalOverlay');
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-icon">${renderIconHTML(item.icon, '')}</div>
      <div class="modal-title">${item.title}</div>
      <div class="modal-desc">${item.desc}</div>
      <a href="${item.link}" target="_blank" rel="noopener" class="modal-link" onclick="incrementDownloadCount('${item.id}')">
        <span class="modal-link-main">⬇️ 立即下载</span>
        <span class="modal-download-count">
          <svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <span id="downloadCount-${item.id}">0次下载</span>
        </span>
      </a>
      ${item.link2 ? `<a href="${item.link2}" target="_blank" rel="noopener" class="modal-link-secondary">🔗 打开备用链接</a>` : ''}
      <button class="modal-link-secondary" onclick="copyLink('${item.link}')">📋 复制链接</button>
      <button class="modal-link-secondary" onclick="generateShareImage('${item.id}')" style="background:linear-gradient(135deg,#7c5cfc,#a855f7);color:#fff;font-weight:600;">📤 生成分享图片</button>
      <div class="modal-qq">
        <div class="modal-qq-title" style="text-align:center;">🎮 晚心游戏玩家交流群</div>
        <div class="modal-qq-notice">嫌麻烦的直接进群拿安装包</div>
        <div class="modal-qq-notice">闪退等问题进群</div>
        <div class="modal-qq-line" onclick="event.stopPropagation();copyQQ()">QQ群号：<b>865809461</b> <span class="modal-qq-tip">(点击复制)</span></div>
        <div class="modal-qq-line" onclick="event.stopPropagation();copyQQCode()">进群口令：<b>@@晚心游戏@</b> <span class="modal-qq-tip">(点击复制)</span></div>
      </div>
      <button class="modal-close" onclick="closeModal()">关闭</button>
    </div>`;
  overlay.classList.add('show');
  // 异步加载全局下载次数（所有访客共享）
  fetchDownloadCount(item.id).then(count => {
    const el = document.getElementById('downloadCount-' + item.id);
    if (el) el.textContent = count + '次下载';
  });
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

function copyLink(link) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(() => showToast('链接已复制'));
  } else {
    const area = document.createElement('textarea');
    area.value = link; area.style.position = 'fixed'; area.style.opacity = 0;
    document.body.appendChild(area); area.select();
    document.execCommand('copy'); document.body.removeChild(area);
    showToast('链接已复制');
  }
}

// 存储当前生成的分享图片 Canvas，供保存/复制按钮使用
let _shareCanvas = null;

// Canvas 圆角矩形
function _drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// 文字换行绘制
function _drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
  const lines = [];
  let currentLine = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const testLine = currentLine + char;
    if (ctx.measureText(testLine).width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + i * lineHeight);
  }
  return lines.length;
}

async function generateShareImage(itemId) {
  // 1. 查找 item
  let item = null;
  for (const c of state.categories) {
    const found = c.items.find(i => i.id === itemId);
    if (found) { item = found; break; }
  }
  if (!item) { showToast('资源未找到'); return; }

  showToast('正在生成分享图片...');

  const canvas = document.createElement('canvas');
  const w = 750, h = 1000;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  // ======= 背景渐变 =======
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#1a0533');
  grad.addColorStop(0.4, '#2d1b69');
  grad.addColorStop(1, '#1a0533');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // ======= 装饰光晕 =======
  ctx.fillStyle = 'rgba(147,51,234,0.07)';
  ctx.beginPath(); ctx.arc(120, 150, 250, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(630, 850, 200, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(236,72,153,0.05)';
  ctx.beginPath(); ctx.arc(375, 500, 220, 0, Math.PI * 2); ctx.fill();

  // ======= 顶部细线装饰 =======
  ctx.strokeStyle = 'rgba(147,51,234,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(200, 30); ctx.lineTo(550, 30); ctx.stroke();

  // ======= 顶部品牌标识 =======
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '20px "PingFang SC","Microsoft YaHei","Heiti SC",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('🌙 晚心游戏', w / 2, 48);

  // ======= 加载图标图片（如果是图片链接）=======
  let iconImg = null, iconLoaded = false;
  const isImgIcon = isImageIcon(item.icon);
  if (isImgIcon) {
    iconImg = new Image();
    iconImg.crossOrigin = 'anonymous';
    await new Promise(resolve => {
      iconImg.onload = () => { iconLoaded = true; resolve(true); };
      iconImg.onerror = () => resolve(false);
      iconImg.src = item.icon;
    });
  }

  // ======= 图标区域 =======
  const iconAreaY = 100;
  if (isImgIcon && iconLoaded) {
    const iconSize = 200;
    const ix = (w - iconSize) / 2;
    const iy = iconAreaY;
    // 背景光晕
    ctx.fillStyle = 'rgba(147,51,234,0.12)';
    ctx.beginPath(); ctx.arc(w / 2, iy + iconSize / 2, iconSize / 2 + 16, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    _drawRoundRect(ctx, ix, iy, iconSize, iconSize, 28);
    ctx.clip();
    ctx.drawImage(iconImg, ix, iy, iconSize, iconSize);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 3;
    _drawRoundRect(ctx, ix, iy, iconSize, iconSize, 28);
    ctx.stroke();
  } else if (item.icon) {
    // emoji 圆形容器
    const cx = w / 2, cy = iconAreaY + 100;
    ctx.fillStyle = 'rgba(147,51,234,0.12)';
    ctx.beginPath(); ctx.arc(cx, cy, 56, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '80px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Heiti SC",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.icon, cx, cy);
  }

  // ======= 标题 =======
  const titleY = isImgIcon && iconLoaded ? 340 : 320;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px "PingFang SC","Microsoft YaHei","Heiti SC",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  _drawWrappedText(ctx, item.title || '精彩内容', w / 2, titleY, 580, 54);

  // 标题下装饰短线
  const titleLines = item.title ? Math.ceil(ctx.measureText(item.title).width / 580) : 1;
  ctx.strokeStyle = 'rgba(147,51,234,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const shortLineY = titleY + titleLines * 54 + 16;
  ctx.moveTo(290, shortLineY);
  ctx.lineTo(460, shortLineY);
  ctx.stroke();

  // ======= 描述 =======
  const descY = shortLineY + 28;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '24px "PingFang SC","Microsoft YaHei","Heiti SC",sans-serif';
  const descLines = _drawWrappedText(ctx, item.desc || '精彩内容，等你来发现~', w / 2, descY, 540, 36);

  // ======= 网址卡片区域 =======
  const cardY = descY + descLines * 36 + 50;
  const cardH = 140;
  const cardX = 80;
  const cardW = w - 160;

  // 卡片背景
  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  cardGrad.addColorStop(0, 'rgba(124,58,237,0.25)');
  cardGrad.addColorStop(1, 'rgba(219,39,119,0.15)');
  ctx.fillStyle = cardGrad;
  _drawRoundRect(ctx, cardX, cardY, cardW, cardH, 20);
  ctx.fill();
  // 卡片边框
  ctx.strokeStyle = 'rgba(147,51,234,0.35)';
  ctx.lineWidth = 1.5;
  _drawRoundRect(ctx, cardX, cardY, cardW, cardH, 20);
  ctx.stroke();

  // 卡片内：标题
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '18px "PingFang SC","Microsoft YaHei","Heiti SC",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('🔗 访问网站', w / 2, cardY + 18);

  // 卡片内：大号网址
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px "PingFang SC","Microsoft YaHei","Heiti SC",sans-serif';
  ctx.fillText('wan123456.com', w / 2, cardY + 48);

  // 卡片内：小提示
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '18px "PingFang SC","Microsoft YaHei","Heiti SC",sans-serif';
  ctx.fillText('长按复制上方网址，浏览器打开即可访问', w / 2, cardY + 100);

  // ======= 底部提示 =======
  const bottomY = cardY + cardH + 50;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '16px "PingFang SC","Microsoft YaHei","Heiti SC",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('💡 保存图片后发送给好友即可分享', w / 2, bottomY);
  ctx.fillText('链接已自动复制到剪贴板，可一并粘贴发送', w / 2, bottomY + 30);

  // ======= 存储 canvas =======
  _shareCanvas = canvas;

  // ======= 同时复制分享链接到剪贴板 =======
  const shareUrl = 'https://wan123456.com/';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
  }

  // ======= 显示预览弹窗 =======
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    showShareImageModal(url);
  }, 'image/png', 0.92);
}

function showShareImageModal(imageUrl) {
  const modal = document.getElementById('shareImageModal');
  if (!modal) return;
  const preview = document.getElementById('shareImagePreview');
  if (preview) preview.src = imageUrl;
  modal.classList.add('show');
  // 弹窗打开后提示链接已自动复制
  setTimeout(() => showToast('🔗 链接已自动复制，发图后可一并粘贴'), 400);
}

function closeShareImageModal() {
  const modal = document.getElementById('shareImageModal');
  if (modal) modal.classList.remove('show');
  _shareCanvas = null;
}

function saveShareImage() {
  if (!_shareCanvas) return;
  _shareCanvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '晚心游戏_分享卡片.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('图片已保存');
  }, 'image/png', 0.9);
}

function copyShareImage() {
  if (!_shareCanvas) return;
  _shareCanvas.toBlob(blob => {
    navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]).then(() => {
      showToast('图片已复制，去微信/QQ粘贴发送即可');
    }).catch(() => {
      showToast('复制失败，请点击"保存图片"按钮');
    });
  }, 'image/png', 0.9);
}

function copyShareLink() {
  const url = 'https://wan123456.com/';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('🔗 链接已复制：' + url);
    }).catch(() => {
      showToast('复制失败，请手动复制：' + url);
    });
  } else {
    // 降级方案
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('🔗 链接已复制：' + url);
  }
}

// ============================================
// 10. QQ群复制
// ============================================

function copyQQ() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText('865809461').then(() => showToast('QQ群号已复制：865809461'));
  } else {
    showToast('晚心游戏QQ群：865809461');
  }
}

function copyQQCode() {
  const code = '@@晚心游戏@';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => showToast('进群口令已复制：' + code));
  } else {
    const ta = document.createElement('textarea');
    ta.value = code;
    ta.style.position = 'fixed';
    ta.style.opacity = 0;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('进群口令已复制：' + code);
  }
}

// ============================================
// 11. 搜索（始终可见）
// ============================================

let searchDebounce = null;

async function onSearchInput(value) {
  const res = document.getElementById('searchResults');
  if (!value.trim()) {
    if (res) { res.classList.remove('show'); res.innerHTML = ''; }
    // 清空搜索后回到当前分类的正常列表
    if (state.currentView === 'home') renderHomeItems(currentHomeCategoryId);
    return;
  }
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(async () => {
    const items = await searchItems(value.trim());
    if (!res) return;
    res.innerHTML = items.length === 0
      ? `<div class="empty-state" style="padding:30px;"><p>未找到相关资源</p></div>`
      : items.map(i => `
        <div class="search-result-item" onclick="openSearchResultModal('${i.categoryId}', '${i.id}', '${escHtml(i.title).replace(/'/g, "\\'")}')">
          <div class="search-result-icon">${renderIconHTML(i.icon, '')}</div>
          <div class="search-result-info">
            <div class="search-result-title">${i.title}</div>
            <div class="search-result-cat">${i.categoryName}</div>
          </div>
          <div class="item-arrow">›</div>
        </div>`).join('');
    res.classList.add('show');
  }, 300);
}

// 点击搜索结果直接打开详情弹窗
function openSearchResultModal(catId, itemId, title) {
  const res = document.getElementById('searchResults');
  if (res) { res.classList.remove('show'); res.innerHTML = ''; }
  const input = document.getElementById('searchInput');
  if (input) input.value = title || '';
  openItemModal(catId, itemId);
}

// 点击搜索按钮：在首页大卡片中过滤
function doSearch() {
  const input = document.getElementById('searchInput');
  const keyword = input ? input.value : '';
  if (state.currentView !== 'home') navigateTo('home');
  renderHomeItems(currentHomeCategoryId, keyword);
}

// ============================================
// 12. Toast 提示
// ============================================

function showToast(msg) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:12px 24px;border-radius:25px;font-size:0.9rem;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.15);animation:fadeIn 0.3s ease;white-space:nowrap;';
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 2000);
}

// ============================================
// 13. 确认弹窗
// ============================================

let confirmCallback = null;

function showConfirm(title, desc, cb) {
  confirmCallback = cb;
  let overlay = document.getElementById('confirmOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.id = 'confirmOverlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="confirm-card">
      <div class="confirm-title">${title}</div>
      <div class="confirm-desc">${desc}</div>
      <div class="confirm-actions">
        <button class="confirm-btn confirm-btn-cancel" onclick="closeConfirm()">取消</button>
        <button class="confirm-btn confirm-btn-ok" onclick="doConfirm()">确认</button>
      </div>
    </div>`;
  overlay.classList.add('show');
}

function closeConfirm() {
  confirmCallback = null;
  const o = document.getElementById('confirmOverlay');
  if (o) o.classList.remove('show');
}

function doConfirm() {
  if (confirmCallback) confirmCallback();
  confirmCallback = null;
  const o = document.getElementById('confirmOverlay');
  if (o) o.classList.remove('show');
}

// ============================================
// 14. 管理员登录（含 IP 限流锁定检测）
// ============================================

let loginLockTimer = null;

async function showAdminLogin() {
  const input = document.getElementById('adminPasswordInput');
  const errEl = document.getElementById('adminLoginError');
  const btnEl = document.getElementById('adminLoginBtn');

  // 先检查是否被锁定
  try {
    const resp = await fetch('/api/check-lock', { method: 'POST' });
    const lockData = await resp.json();
    if (lockData.locked) {
      input.value = '';
      input.disabled = true;
      input.placeholder = '设备已被锁定';
      btnEl.disabled = true;
      btnEl.textContent = '已锁定';
      errEl.style.display = 'block';
      errEl.textContent = '密码错误次数过多，该设备已被锁定';
      startLoginLockCountdown(lockData.remainingMs);
      document.getElementById('adminLoginModal').classList.add('show');
      return;
    }
  } catch (e) {
    // 检查失败（网络问题），允许继续尝试
  }

  input.value = '';
  input.disabled = false;
  input.placeholder = '请输入密码';
  btnEl.disabled = false;
  btnEl.textContent = '登 录';
  errEl.style.display = 'none';
  errEl.textContent = '';
  clearLoginLockCountdown();
  document.getElementById('adminLoginModal').classList.add('show');
  setTimeout(() => input.focus(), 200);
}

function closeAdminLogin() {
  clearLoginLockCountdown();
  document.getElementById('adminLoginModal').classList.remove('show');
}

// 锁定倒计时
function startLoginLockCountdown(remainingMs) {
  clearLoginLockCountdown();
  const errEl = document.getElementById('adminLoginError');
  const unlockAt = Date.now() + remainingMs;

  function tick() {
    const left = unlockAt - Date.now();
    if (left <= 0) {
      // 锁定时间已过，恢复
      errEl.textContent = '';
      errEl.style.display = 'none';
      clearLoginLockCountdown();
      // 恢复输入
      const input = document.getElementById('adminPasswordInput');
      const btnEl = document.getElementById('adminLoginBtn');
      if (input) { input.disabled = false; input.placeholder = '请输入密码'; }
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = '登 录'; }
      return;
    }
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    const s = Math.floor((left % 60000) / 1000);
    errEl.textContent = `密码错误次数过多，请在 ${h}小时${m}分${s}秒 后重试`;
    loginLockTimer = setTimeout(tick, 1000);
  }

  tick();
}

function clearLoginLockCountdown() {
  if (loginLockTimer) {
    clearTimeout(loginLockTimer);
    loginLockTimer = null;
  }
}

async function adminLogin() {
  const pw = document.getElementById('adminPasswordInput').value.trim();
  if (!pw) return;

  try {
    const resp = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    const json = await resp.json();
    if (json.success) {
      adminPassword = pw;
      closeAdminLogin();
      navigateTo('admin');
      showToast('登录成功');
    } else {
      const errEl = document.getElementById('adminLoginError');
      errEl.style.display = 'block';

      if (json.locked) {
        // 被锁定了
        const input = document.getElementById('adminPasswordInput');
        const btnEl = document.getElementById('adminLoginBtn');
        input.value = '';
        input.disabled = true;
        input.placeholder = '设备已被锁定';
        btnEl.disabled = true;
        btnEl.textContent = '已锁定';
        errEl.textContent = '密码错误次数过多，该设备已被锁定24小时';
        startLoginLockCountdown(json.remainingMs || 24 * 60 * 60 * 1000);
      } else {
        // 仅本次错误，显示剩余次数
        errEl.textContent = json.message || '密码错误，请重试';
      }

      document.getElementById('adminPasswordInput').value = '';
      document.getElementById('adminPasswordInput').focus();
    }
  } catch (e) {
    document.getElementById('adminLoginError').style.display = 'block';
    document.getElementById('adminLoginError').textContent = '无法连接服务器，请检查';
  }
}

// ============================================
// 15. 管理员后台 - 标签切换
// ============================================

function switchAdminTab(tab) {
  state.adminTab = tab;
  document.querySelectorAll('.admin-tab').forEach((t) => {
    const hasCategories = t.textContent.includes('分类');
    const hasItems = t.textContent.includes('链接');
    const hasPassword = t.textContent.includes('密码');
    t.classList.toggle('active',
      (tab === 'categories' && hasCategories) ||
      (tab === 'items' && hasItems) ||
      (tab === 'password' && hasPassword)
    );
  });
  document.getElementById('adminTabCategories').classList.toggle('active', tab === 'categories');
  document.getElementById('adminTabItems').classList.toggle('active', tab === 'items');
  document.getElementById('adminTabPassword').classList.toggle('active', tab === 'password');
  if (tab === 'categories') renderAdminCategoryList();
  if (tab === 'items') renderAdminItemList();
}

function refreshAllAdminViews() {
  renderAdminCategoryList();
  document.getElementById('adminCategoryForm').style.display = 'none';
  state.editingCategoryId = null;
  document.getElementById('adminItemForm').style.display = 'none';
  state.editingItemId = null;
  if (state.adminTab === 'categories') switchAdminTab('categories');
  if (state.adminTab === 'items') switchAdminTab('items');
  updateLastSaveTime();
}

function updateLastSaveTime() {
  const el = document.getElementById('adminLastSave');
  if (el) {
    const t = new Date();
    el.textContent = `上次保存: ${t.toLocaleTimeString()}（已同步到服务器）`;
  }
}

// ============================================
// 16. 管理员后台 - 分类管理
// ============================================

function renderAdminCategoryList() {
  const list = document.getElementById('adminCategoryList');
  list.innerHTML = state.categories.map(cat => `
    <div class="admin-list-item">
      <div class="admin-list-icon">${renderIconHTML(cat.icon, '')}</div>
      <div class="admin-list-info">
        <div class="admin-list-name">${cat.name} <span style="color:var(--text-muted);font-size:0.75rem;">(${cat.items.length}个)</span></div>
        <div class="admin-list-desc">${cat.desc}</div>
      </div>
      <div class="admin-list-actions">
        <button class="admin-btn-sm admin-btn-edit" onclick="editCategory('${cat.id}')">编辑</button>
        <button class="admin-btn-sm admin-btn-del" onclick="deleteCategory('${cat.id}')">删除</button>
      </div>
    </div>
  `).join('');
}

function showCategoryForm(catId) {
  const cat = catId ? state.categories.find(c => c.id === catId) : null;
  state.editingCategoryId = catId || null;
  const currentIcon = cat ? cat.icon : '';
  const isImg = isImageIcon(currentIcon);
  const form = document.getElementById('adminCategoryForm');
  form.style.display = 'block';
  form.innerHTML = `
    <h4 style="margin-bottom:14px;color:var(--text);">${cat ? '编辑分类' : '添加分类'}</h4>
    <div class="admin-form-group">
      <label>分类名称 *</label>
      <input type="text" id="catName" value="${cat ? escHtml(cat.name) : ''}" placeholder="如：游戏推荐">
    </div>
    <div class="admin-form-group">
      <label>图标（上传图片 或 输入emoji）</label>
      <div class="icon-upload-wrap">
        <img id="iconUploadPreview" class="icon-upload-preview" src="${isImg ? currentIcon : ''}" style="${isImg ? '' : 'display:none'}">
        <span id="iconEmojiPreview" style="font-size:2rem;${isImg ? 'display:none' : ''}">${!isImg && currentIcon ? currentIcon : ''}</span>
        <input type="file" id="iconFileInput" accept="image/*" style="display:none" onchange="handleIconFileSelect(event)">
        <button type="button" class="icon-upload-btn" onclick="document.getElementById('iconFileInput').click()">📷 选择图片</button>
        <button type="button" class="icon-upload-clear" onclick="clearIconUpload()" style="${isImg ? '' : 'display:none'}" id="iconClearBtn">清除图片</button>
      </div>
      <input type="text" id="catIcon" class="icon-emoji-input" value="${!isImg ? (currentIcon || '') : ''}" placeholder="或输入emoji：🎮（上传图片优先）" style="margin-top:8px;">
      <small style="color:var(--text-muted);font-size:0.75rem;">支持上传手机相册图片作为分类图标</small>
    </div>
    <div class="admin-form-group">
      <label>标识ID *</label>
      <input type="text" id="catId" value="${cat ? cat.id : ''}" placeholder="如：games（英文，唯一）" ${cat ? 'readonly' : ''}>
      <small style="color:var(--text-muted);font-size:0.75rem;">${cat ? '不可修改' : '唯一标识，创建后不可改'}</small>
    </div>
    <div class="admin-form-group">
      <label>描述</label>
      <textarea id="catDesc" placeholder="分类描述...">${cat ? escHtml(cat.desc) : ''}</textarea>
    </div>
    <div class="admin-form-actions">
      <button class="admin-btn admin-btn-primary" onclick="saveCategory()">保存</button>
      <button class="admin-btn admin-btn-secondary" onclick="cancelCategoryForm()">取消</button>
    </div>
  `;

  // 存储上传图片的数据（base64）
  window._iconUploadData = isImg ? currentIcon : null;

  form.scrollIntoView({ behavior: 'smooth' });
}

function handleIconFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  // 限制大小 2MB
  if (file.size > 2 * 1024 * 1024) {
    showToast('图片不能超过2MB');
    return;
  }

  const preview = document.getElementById('iconUploadPreview');
  const emojiPreview = document.getElementById('iconEmojiPreview');
  const clearBtn = document.getElementById('iconClearBtn');
  const emojiInput = document.getElementById('catIcon');

  // 立即显示本地预览
  const localPreviewUrl = URL.createObjectURL(file);
  if (preview) {
    preview.src = localPreviewUrl;
    preview.style.display = '';
  }
  if (emojiPreview) emojiPreview.style.display = 'none';
  if (clearBtn) clearBtn.style.display = '';
  if (emojiInput) emojiInput.value = '';

  // 1. base64 作为兜底数据（立即可用）
  const reader = new FileReader();
  reader.onload = function(e) {
    window._iconUploadData = e.target.result;
  };
  reader.readAsDataURL(file);

  // 2. 压缩后上传到服务器（优先使用 /uploads/xxx.png 路径）
  window._iconUploadPromise = compressImage(file).then(compressed => uploadImage(compressed));
}

function clearIconUpload() {
  window._iconUploadData = null;
  const preview = document.getElementById('iconUploadPreview');
  const emojiPreview = document.getElementById('iconEmojiPreview');
  const clearBtn = document.getElementById('iconClearBtn');
  const emojiInput = document.getElementById('catIcon');

  if (preview) { preview.src = ''; preview.style.display = 'none'; }
  if (emojiPreview) emojiPreview.style.display = '';
  if (clearBtn) clearBtn.style.display = 'none';
  if (emojiInput) emojiInput.value = '';
}

function cancelCategoryForm() {
  document.getElementById('adminCategoryForm').style.display = 'none';
  state.editingCategoryId = null;
  window._iconUploadData = null;
}

function handleItemIconFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('图片不能超过2MB'); return; }

  const preview = document.getElementById('itemIconUploadPreview');
  const emojiPreview = document.getElementById('itemIconEmojiPreview');
  const clearBtn = document.getElementById('itemIconClearBtn');
  const emojiInput = document.getElementById('itemIcon');

  // 立即显示本地预览
  const localPreviewUrl = URL.createObjectURL(file);
  if (preview) { preview.src = localPreviewUrl; preview.style.display = ''; }
  if (emojiPreview) emojiPreview.style.display = 'none';
  if (clearBtn) clearBtn.style.display = '';
  if (emojiInput) emojiInput.value = '';

  // 1. base64 兜底
  const reader = new FileReader();
  reader.onload = function(e) {
    window._itemIconUploadData = e.target.result;
  };
  reader.readAsDataURL(file);

  // 2. 压缩后上传到服务器
  window._itemIconUploadPromise = compressImage(file).then(compressed => uploadImage(compressed));
}

function clearItemIconUpload() {
  window._itemIconUploadData = null;
  const preview = document.getElementById('itemIconUploadPreview');
  const emojiPreview = document.getElementById('itemIconEmojiPreview');
  const clearBtn = document.getElementById('itemIconClearBtn');
  const emojiInput = document.getElementById('itemIcon');
  if (preview) { preview.src = ''; preview.style.display = 'none'; }
  if (emojiPreview) emojiPreview.style.display = '';
  if (clearBtn) clearBtn.style.display = 'none';
  if (emojiInput) emojiInput.value = '';
}

function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// 生成下拉框 option 的显示文本（base64 图片只显示名称，emoji 显示 emoji+名称）
function getCategoryOptionLabel(icon, name) {
  if (!icon) return name;
  if (isImageIcon(icon)) return name; // 图片图标不显示 base64 串
  return icon + ' ' + name;
}

async function saveCategory() {
  const name = document.getElementById('catName').value.trim();
  const id = document.getElementById('catId').value.trim();
  const desc = document.getElementById('catDesc').value.trim();

  // 等待图片上传完成，优先使用服务器 URL，失败则用 base64 兜底
  if (window._iconUploadPromise) {
    try {
      const uploadedUrl = await window._iconUploadPromise;
      if (uploadedUrl) {
        window._iconUploadData = uploadedUrl;
      }
    } catch (e) { /* 忽略上传错误，用 base64 兜底 */ }
    window._iconUploadPromise = null;
  }

  // 优先使用上传的图片，否则使用 emoji 输入
  let icon;
  if (window._iconUploadData) {
    icon = window._iconUploadData;
  } else {
    icon = document.getElementById('catIcon').value.trim();
  }

  if (!name || !icon || !id) { showToast('请填写名称、图标和ID'); return; }

  if (state.editingCategoryId) {
    const cat = state.categories.find(c => c.id === state.editingCategoryId);
    if (!cat) return;
    cat.name = name; cat.icon = icon; cat.desc = desc;
  } else {
    if (state.categories.find(c => c.id === id)) { showToast('该ID已存在，请换一个'); return; }
    state.categories.push({ id, name, icon, desc, items: [] });
  }
  const ok = await requestSave();
  if (!ok) return;
  cancelCategoryForm();
  renderAdminCategoryList();
  if (state.currentView === 'home') renderCategoryCards();
  showToast(state.editingCategoryId ? '分类已更新' : '分类已添加');
}

function editCategory(catId) {
  document.getElementById('adminItemForm').style.display = 'none';
  state.editingItemId = null;
  showCategoryForm(catId);
}

function deleteCategory(catId) {
  const cat = state.categories.find(c => c.id === catId);
  if (!cat) return;
  const catIndex = state.categories.indexOf(cat);
  showConfirm('删除分类', `确定删除「${cat.name}」及其下所有 ${cat.items.length} 个链接吗？`, async () => {
    state.categories.splice(catIndex, 1);
    const ok = await requestSave();
    if (!ok) return; // 失败由 flushSave 统一恢复并提示
    refreshAllAdminViews();
    if (state.currentView === 'home') renderCategoryCards();
    showToast('分类已删除');
  });
}

// ============================================
// 17. 管理员后台 - 链接管理
// ============================================

function renderAdminItemList() {
  const sel = document.getElementById('adminItemCategorySelect');
  const prevVal = sel.value;
  sel.innerHTML = state.categories.map(c => `<option value="${c.id}">${escHtml(getCategoryOptionLabel(c.icon, c.name))}</option>`).join('');
  // 保持之前选择的分类
  if (prevVal && state.categories.find(c => c.id === prevVal)) {
    sel.value = prevVal;
  } else {
    sel.value = state.categories.length ? state.categories[0].id : '';
  }
  renderItemCardsForCategory(sel.value);
}

function renderItemCardsForCategory(catId) {
  const cat = state.categories.find(c => c.id === catId);
  const list = document.getElementById('adminItemList');
  if (!cat) { list.innerHTML = '<div class="empty-state"><p>请先创建分类</p></div>'; return; }
  if (!cat.items.length) {
    list.innerHTML = '<div class="empty-state"><p>该分类下暂无链接</p></div>';
    return;
  }
  list.innerHTML = cat.items.map(item => `
    <div class="admin-list-item">
      <div class="admin-list-icon">${renderIconHTML(item.icon, '')}</div>
      <div class="admin-list-info">
        <div class="admin-list-name">${item.title}</div>
        <div class="admin-list-desc">${item.desc} ${item.tags ? item.tags.map(t => `[${t}]`).join(' ') : ''}</div>
      </div>
      <div class="admin-list-actions">
        <button class="admin-btn-sm admin-btn-edit" onclick="editItem('${catId}', '${item.id}')">编辑</button>
        <button class="admin-btn-sm admin-btn-del" onclick="deleteItem('${catId}', '${item.id}')">删除</button>
      </div>
    </div>
  `).join('');
}

function showItemForm(catId, itemId) {
  const cat = catId ? state.categories.find(c => c.id === catId) : null;
  const item = itemId && cat ? cat.items.find(i => i.id === itemId) : null;
  state.editingItemId = itemId || null;
  const isImgIcon = item ? isImageIcon(item.icon) : false;

  const selCatId = catId || document.getElementById('adminItemCategorySelect').value;
  const form = document.getElementById('adminItemForm');
  form.style.display = 'block';
  form.innerHTML = `
    <h4 style="margin-bottom:14px;color:var(--text);">${item ? '编辑链接' : '添加链接'}</h4>
    <div class="admin-form-group">
      <label>所属分类</label>
      <select id="itemCatId">${state.categories.map(c => `<option value="${c.id}" ${c.id === selCatId ? 'selected' : ''}>${escHtml(getCategoryOptionLabel(c.icon, c.name))}</option>`).join('')}</select>
    </div>
    <div class="admin-form-group">
      <label>标题 *</label>
      <input type="text" id="itemTitle" value="${item ? escHtml(item.title) : ''}" placeholder="如：原神">
    </div>
    <div class="admin-form-group">
      <label>描述</label>
      <textarea id="itemDesc" placeholder="简短描述...">${item ? escHtml(item.desc) : ''}</textarea>
    </div>
    <div class="admin-form-group">
      <label>图标（上传图片 或 输入emoji）</label>
      <div class="icon-upload-wrap">
        <img id="itemIconUploadPreview" class="icon-upload-preview" src="${isImgIcon ? item.icon : ''}" style="${isImgIcon ? '' : 'display:none'}">
        <span id="itemIconEmojiPreview" style="font-size:2rem;${isImgIcon ? 'display:none' : ''}">${!isImgIcon && item && item.icon ? item.icon : ''}</span>
        <input type="file" id="itemIconFileInput" accept="image/*" style="display:none" onchange="handleItemIconFileSelect(event)">
        <button type="button" class="icon-upload-btn" onclick="document.getElementById('itemIconFileInput').click()">📷 选择图片</button>
        <button type="button" class="icon-upload-clear" onclick="clearItemIconUpload()" style="${isImgIcon ? '' : 'display:none'}" id="itemIconClearBtn">清除图片</button>
      </div>
      <input type="text" id="itemIcon" class="icon-emoji-input" value="${!isImgIcon && item ? item.icon : ''}" placeholder="或输入emoji：🌟（上传图片优先）" style="margin-top:8px;">
      <small style="color:var(--text-muted);font-size:0.75rem;">支持上传手机相册图片作为链接图标</small>
    </div>
    <div class="admin-form-group">
      <label>主链接</label>
      <input type="text" id="itemLink" value="${item ? item.link : ''}" placeholder="https://...">
    </div>
    <div class="admin-form-group">
      <label>备用链接（可选）</label>
      <input type="text" id="itemLink2" value="${item ? (item.link2 || '') : ''}" placeholder="https://...">
    </div>
    <div class="admin-form-group">
      <label>标签（回车添加）</label>
      <div class="tag-input-wrap" id="tagInputWrap" onclick="document.getElementById('tagInputField').focus()">
        <span id="tagChips"></span>
        <input type="text" class="tag-input" id="tagInputField" placeholder="输入标签后按回车">
      </div>
    </div>
    <div class="admin-form-actions">
      <button class="admin-btn admin-btn-primary" onclick="saveItem('${itemId || ''}')">保存</button>
      <button class="admin-btn admin-btn-secondary" onclick="cancelItemForm()">取消</button>
    </div>
  `;

  let currentTags = item && item.tags ? [...item.tags] : [];
  renderTagChips(currentTags);

  const tagField = document.getElementById('tagInputField');
  tagField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = tagField.value.trim();
      if (v && !currentTags.includes(v)) {
        currentTags.push(v);
        renderTagChips(currentTags);
      }
      tagField.value = '';
    }
  });

  window._itemTags = currentTags;
  form.scrollIntoView({ behavior: 'smooth' });
}

function renderTagChips(tags) {
  const container = document.getElementById('tagChips');
  container.innerHTML = tags.map((t, i) => `
    <span class="tag-chip">${t}<span class="tag-chip-remove" onclick="removeTag(${i})">×</span></span>
  `).join('');
}

function removeTag(index) {
  if (window._itemTags) {
    window._itemTags.splice(index, 1);
    renderTagChips(window._itemTags);
  }
}

function cancelItemForm() {
  document.getElementById('adminItemForm').style.display = 'none';
  state.editingItemId = null;
  window._itemIconUploadData = null;
}

async function saveItem(originalItemId) {
  const catId = document.getElementById('itemCatId').value;
  const title = document.getElementById('itemTitle').value.trim();
  const desc = document.getElementById('itemDesc').value.trim();

  // 等待图片上传完成，优先使用服务器 URL
  if (window._itemIconUploadPromise) {
    try {
      const uploadedUrl = await window._itemIconUploadPromise;
      if (uploadedUrl) {
        window._itemIconUploadData = uploadedUrl;
      }
    } catch (e) { /* 忽略上传错误，用 base64 兜底 */ }
    window._itemIconUploadPromise = null;
  }

  let icon;
  if (window._itemIconUploadData) {
    icon = window._itemIconUploadData;
  } else {
    icon = document.getElementById('itemIcon').value.trim();
  }
  const link = document.getElementById('itemLink').value.trim();
  const link2 = document.getElementById('itemLink2').value.trim();
  const tags = window._itemTags || [];

  if (!title) { showToast('请填写标题'); return; }
  const cat = state.categories.find(c => c.id === catId);
  if (!cat) return;

  if (originalItemId) {
    let item = null;
    let oldCat = null;
    for (const c of state.categories) {
      const found = c.items.find(i => i.id === originalItemId);
      if (found) { item = found; oldCat = c; break; }
    }
    if (item) {
      item.title = title; item.desc = desc; item.icon = icon; item.link = link; item.link2 = link2; item.tags = tags;
      if (oldCat && oldCat.id !== catId) {
        oldCat.items = oldCat.items.filter(i => i.id !== originalItemId);
        cat.items.push(item);
      }
    }
  } else {
    const newId = 'it_' + Date.now();
    cat.items.push({ id: newId, title, desc, icon, link, link2, tags });
  }

  const ok = await requestSave();
  if (!ok) return;
  cancelItemForm();
  renderItemCardsForCategory(catId);
  if (state.currentView === 'home') {
    renderCategoryTabs();
    renderHomeItems(currentHomeCategoryId);
  }
  if (state.currentView === 'category' && state.currentCategoryId === catId) {
    renderCategoryDetail(cat);
  }
  showToast(originalItemId ? '链接已更新' : '链接已添加');
}

function editItem(catId, itemId) {
  document.getElementById('adminCategoryForm').style.display = 'none';
  state.editingCategoryId = null;
  showItemForm(catId, itemId);
}

function deleteItem(catId, itemId) {
  const cat = state.categories.find(c => c.id === catId);
  if (!cat) return;
  const item = cat.items.find(i => i.id === itemId);
  if (!item) return;
  const itemIndex = cat.items.indexOf(item);
  showConfirm('删除链接', `确定删除「${item.title}」吗？`, async () => {
    cat.items.splice(itemIndex, 1);
    const ok = await requestSave();
    if (!ok) return; // 失败由 flushSave 统一恢复并提示
    renderItemCardsForCategory(catId);
    if (state.currentView === 'home') renderCategoryCards();
    if (state.currentView === 'category' && state.currentCategoryId === catId) renderCategoryDetail(cat);
    showToast('链接已删除');
  });
}

// ============================================
// 18. 修改密码
// ============================================

async function changePassword() {
  const oldPwd = document.getElementById('adminOldPwd').value.trim();
  const newPwd = document.getElementById('adminNewPwd').value.trim();
  const newPwd2 = document.getElementById('adminNewPwd2').value.trim();
  const msg = document.getElementById('adminPwdMsg');

  if (!oldPwd || !newPwd) {
    msg.style.display = 'block'; msg.className = 'admin-msg admin-msg-error'; msg.textContent = '请填写所有字段';
    return;
  }
  if (newPwd !== newPwd2) {
    msg.style.display = 'block'; msg.className = 'admin-msg admin-msg-error'; msg.textContent = '两次密码不一致';
    return;
  }
  if (newPwd.length < 4) {
    msg.style.display = 'block'; msg.className = 'admin-msg admin-msg-error'; msg.textContent = '新密码至少4位';
    return;
  }

  try {
    const resp = await fetch('/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
    });
    const json = await resp.json();
    if (json.success) {
      adminPassword = newPwd;
      document.getElementById('adminOldPwd').value = '';
      document.getElementById('adminNewPwd').value = '';
      document.getElementById('adminNewPwd2').value = '';
      msg.style.display = 'block'; msg.className = 'admin-msg admin-msg-success'; msg.textContent = '密码修改成功！';
    } else {
      msg.style.display = 'block'; msg.className = 'admin-msg admin-msg-error'; msg.textContent = json.message || '修改失败';
    }
  } catch (e) {
    msg.style.display = 'block'; msg.className = 'admin-msg admin-msg-error'; msg.textContent = '无法连接服务器';
  }
}

// ============================================
// 19. 初始化（localStorage 缓存加速）
// ============================================

async function init() {
  // 第1步：从 localStorage 瞬间渲染（< 1ms）
  const cached = _loadLocalCache();
  if (cached) {
    state.categories = cached;
    renderCategoryTabs();
    renderHomeItems('all');
    bindEvents();
    updateLastSaveTime();
    console.log('[init] 从本地缓存瞬间渲染完成，后台同步最新数据...');
  }

  // 第2步：后台从服务器拉取最新数据（不阻塞页面）
  try {
    const fresh = await loadData();
    const cachedCount = cached ? _countAllItems(cached) : -1;
    const freshCount = _countAllItems(fresh);

    // 检查是否刚刚保存过（60s 内）。Cloudflare KV 有最多 60s 的延迟，
    // 刚保存完立即刷新可能读到旧数据，此时应信任本地缓存
    let justSaved = false;
    try {
      const savedAt = localStorage.getItem('wx_saved_at');
      if (savedAt && (Date.now() - parseInt(savedAt)) < 60000) {
        justSaved = true;
      }
    } catch (e) { /* ignore */ }

    const dataChanged = !cached || JSON.stringify(fresh) !== JSON.stringify(cached);
    const isKVStale = justSaved && freshCount < cachedCount;
    const needsUpdate = dataChanged && !isKVStale;

    if (needsUpdate) {
      state.categories = fresh;
      renderCategoryTabs();
      renderHomeItems('all');
      updateLastSaveTime();
      console.log('[init] 服务器数据已更新，页面已刷新');
    } else if (isKVStale) {
      console.log('[init] 刚保存过，服务器数据可能滞后于 KV（条目数 ' + freshCount + ' < 缓存 ' + cachedCount + '），保留缓存');
    } else {
      console.log('[init] 缓存数据为最新，无需更新');
    }
  } catch (e) {
    console.warn('[init] 后台同步失败，继续使用缓存:', e.message);
    if (!cached) {
      // 首次访问+网络失败：用默认数据兜底
      state.categories = JSON.parse(JSON.stringify(defaultData.categories));
      renderCategoryTabs();
      renderHomeItems('all');
    }
  }

  // 只当还没有绑定事件时才绑定（避免重复）
  if (!cached) {
    bindEvents();
    updateLastSaveTime();
  }

  handleShareLink();
}

// 统计所有分类下的 item 总数（用于判断服务器数据是否过期）
function _countAllItems(categories) {
  let count = 0;
  for (const cat of categories) {
    if (cat.items && Array.isArray(cat.items)) count += cat.items.length;
  }
  return count;
}

// 处理 /share/{itemId} 分享链接：自动打开对应游戏的详情弹窗
function handleShareLink() {
  const path = window.location.pathname || '';
  const match = path.match(/^\/share\/(.+?)\/?$/);
  if (!match) return;
  const itemId = match[1];
  // 在所有分类中查找该 item
  let foundCat = null, foundItem = null;
  for (const cat of state.categories) {
    const it = cat.items.find(i => i.id === itemId);
    if (it) { foundCat = cat; foundItem = it; break; }
  }
  if (!foundItem) {
    showToast('该分享链接已失效');
    return;
  }
  // 自动打开详情弹窗
  openItemModal(foundCat.id, foundItem.id);
  // 修改 URL 为首页（不影响当前页面，但让"返回"更友好）
  try {
    history.replaceState(null, '', '/');
  } catch (e) { /* 忽略 */ }
}

function bindEvents() {
  document.getElementById('logoBtn').addEventListener('click', () => navigateTo('home'));
  document.getElementById('searchInput').addEventListener('input', e => onSearchInput(e.target.value));

  document.getElementById('modalOverlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      closeAdminLogin();
      closeConfirm();
    }
  });

  document.querySelectorAll('[data-view="about"]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); switchView('about'); });
  });

  document.getElementById('adminLoginModal').addEventListener('click', function(e) {
    if (e.target === this) closeAdminLogin();
  });

  document.getElementById('adminPasswordInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') adminLogin();
  });
}

document.addEventListener('DOMContentLoaded', init);
