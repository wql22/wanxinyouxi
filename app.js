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
// 2. 服务端数据层
// ============================================

async function loadData() {
  try {
    const resp = await fetch('/api/data?_t=' + Date.now(), { cache: 'no-store' });
    if (resp.ok) {
      const json = await resp.json();
      if (json && json.categories && Array.isArray(json.categories)) {
        console.log('[loadData] 服务端返回分类数:', json.categories.length);
        return json.categories;
      }
    }
  } catch (e) {
    console.warn('从服务端加载数据失败，使用默认数据:', e.message);
  }
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
      // 验证读取
      try {
        const checkResp = await fetch('/api/data?_t=' + Date.now(), { cache: 'no-store' });
        if (checkResp.ok) {
          const checkData = await checkResp.json();
          if (checkData.categories && checkData.categories.length === state.categories.length) {
            console.log('[saveData] ✓ 验证通过');
          } else {
            console.warn('[saveData] ⚠ 验证异常！');
            if (retriesLeft > 1) throw new Error('验证失败，重试');
          }
        }
      } catch (checkErr) {
        if (retriesLeft > 1) throw checkErr;
      }
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
// 3. 图片上传到服务器
// ============================================

async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  try {
    const resp = await fetch('/api/upload', { method: 'POST', body: formData });
    const json = await resp.json();
    if (json.success) return json.url;
    showToast('图片上传失败: ' + (json.message || ''));
    return null;
  } catch (e) {
    showToast('图片上传失败，请检查服务器连接');
    return null;
  }
}

// ============================================
// 4. 图标渲染辅助函数
// ============================================

function isImageIcon(icon) {
  return icon && (icon.startsWith('data:image/') || icon.startsWith('/uploads/') || icon.startsWith('http'));
}

function renderIconHTML(icon, cssClass) {
  if (!icon) return '';
  if (isImageIcon(icon)) {
    const style = 'max-width:64px;max-height:64px;width:auto;height:auto;object-fit:cover;border-radius:8px;vertical-align:middle;display:inline-block;';
    return `<img src="${escHtml(icon)}" class="${cssClass || ''}" alt="" style="${style}" onerror="this.style.display='none'">`;
  }
  return icon;
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

// ============================================
// 7. 前台 UI 渲染
// ============================================

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
  // 搜索栏在所有视图都可见，但清空搜索结果
  const results = document.getElementById('searchResults');
  const input = document.getElementById('searchInput');
  if (results) { results.classList.remove('show'); results.innerHTML = ''; }
  if (input) input.value = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function navigateTo(viewName) {
  switchView(viewName);
  if (viewName === 'home') renderCategoryCards();
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
      <a href="${item.link}" target="_blank" rel="noopener" class="modal-link">🔗 打开主链接</a>
      ${item.link2 ? `<a href="${item.link2}" target="_blank" rel="noopener" class="modal-link-secondary">🔗 打开备用链接</a>` : ''}
      <button class="modal-link-secondary" onclick="copyLink('${item.link}')">📋 复制链接</button>
      <button class="modal-link-secondary" onclick="copyShareLink('${item.id}')" style="background:linear-gradient(135deg,#7c5cfc,#a855f7);color:#fff;font-weight:600;">📤 复制分享卡片链接</button>
      <button class="modal-close" onclick="closeModal()">关闭</button>
    </div>`;
  overlay.classList.add('show');
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

function copyShareLink(itemId) {
  const shareUrl = 'https://wanxinyouxi.com/share/' + itemId;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(shareUrl).then(() => showToast('分享链接已复制！发送到微信/QQ即可显示卡片'));
  } else {
    const area = document.createElement('textarea');
    area.value = shareUrl; area.style.position = 'fixed'; area.style.opacity = 0;
    document.body.appendChild(area); area.select();
    document.execCommand('copy'); document.body.removeChild(area);
    showToast('分享链接已复制！发送到微信/QQ即可显示卡片');
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

// ============================================
// 11. 搜索（始终可见）
// ============================================

let searchDebounce = null;

async function onSearchInput(value) {
  const res = document.getElementById('searchResults');
  if (!value.trim()) { res.classList.remove('show'); res.innerHTML = ''; return; }
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(async () => {
    const items = await searchItems(value.trim());
    res.innerHTML = items.length === 0
      ? `<div class="empty-state" style="padding:30px;"><p>未找到相关资源</p></div>`
      : items.map(i => `
        <div class="search-result-item" onclick="navigateToCategory('${i.categoryId}')">
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

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result;
    window._iconUploadData = base64;

    const preview = document.getElementById('iconUploadPreview');
    const emojiPreview = document.getElementById('iconEmojiPreview');
    const clearBtn = document.getElementById('iconClearBtn');
    const emojiInput = document.getElementById('catIcon');

    if (preview) {
      preview.src = base64;
      preview.style.display = '';
    }
    if (emojiPreview) emojiPreview.style.display = 'none';
    if (clearBtn) clearBtn.style.display = '';
    if (emojiInput) emojiInput.value = '';
  };
  reader.readAsDataURL(file);
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
  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result;
    window._itemIconUploadData = base64;
    const preview = document.getElementById('itemIconUploadPreview');
    const emojiPreview = document.getElementById('itemIconEmojiPreview');
    const clearBtn = document.getElementById('itemIconClearBtn');
    const emojiInput = document.getElementById('itemIcon');
    if (preview) { preview.src = base64; preview.style.display = ''; }
    if (emojiPreview) emojiPreview.style.display = 'none';
    if (clearBtn) clearBtn.style.display = '';
    if (emojiInput) emojiInput.value = '';
  };
  reader.readAsDataURL(file);
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
  const ok = await saveData();
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
    const deletedCat = state.categories.splice(catIndex, 1)[0];
    const ok = await saveData();
    if (!ok) {
      state.categories.splice(catIndex, 0, deletedCat); // 保存失败，回滚
      alert('❌ 保存到服务器失败！\n\n可能原因：云隧道连接不稳定，请稍后重试。\n\n数据已恢复到删除前状态。');
      refreshAllAdminViews();
      if (state.currentView === 'home') renderCategoryCards();
      return;
    }
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

  const ok = await saveData();
  if (!ok) return;
  cancelItemForm();
  renderItemCardsForCategory(catId);
  if (state.currentView === 'home') renderCategoryCards();
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
    const deletedItem = cat.items.splice(itemIndex, 1)[0];
    const ok = await saveData();
    if (!ok) {
      cat.items.splice(itemIndex, 0, deletedItem); // 保存失败，回滚
      alert('❌ 保存到服务器失败！\n\n可能原因：云隧道连接不稳定，请稍后重试。\n\n数据已恢复到删除前状态。');
      renderItemCardsForCategory(catId);
      return;
    }
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
// 19. 初始化
// ============================================

async function init() {
  state.categories = await loadData();
  renderCategoryCards();
  bindEvents();
  updateLastSaveTime();
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
