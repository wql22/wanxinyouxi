/**
 * 晚心游戏 - 本地服务器（支持数据持久化）
 * 
 * 功能：
 * 1. 提供静态文件服务（HTML/CSS/JS）
 * 2. 数据持久化到 data.json，管理员修改后所有访问者同步
 * 3. 管理员认证与密码管理
 * 4. 监听 0.0.0.0，同一 WiFi 下手机可直接访问
 * 
 * 启动方式：node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');

const PORT = 5501;
const DATA_FILE = path.join(__dirname, 'data.json');

// 默认数据
const defaultData = {
  adminPassword: 'admin123',
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

// 运行时数据（从 data.json 加载）
let appData = null;

/**
 * 加载数据（data.json 不存在时使用默认数据）
 */
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.categories && Array.isArray(parsed.categories)) {
        appData = {
          adminPassword: parsed.adminPassword || defaultData.adminPassword,
          categories: parsed.categories,
        };
        return;
      }
    }
  } catch (e) {
    console.error('读取 data.json 失败，使用默认数据:', e.message);
  }
  // 回退到默认数据
  appData = JSON.parse(JSON.stringify(defaultData));
  saveDataFile();
}

/**
 * 保存数据到 data.json
 */
function saveDataFile() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(appData, null, 2), 'utf-8');
  } catch (e) {
    console.error('写入 data.json 失败:', e.message);
  }
}

// ==========================================
// IP 登录限流（同 IP 连续输错 5 次锁定 24 小时）
// ==========================================

const MAX_FAILURES = 5;
const LOCK_DURATION = 24 * 60 * 60 * 1000; // 24 小时（毫秒）
const loginFailures = {}; // { ip: { count: number, lockedUntil: number | null } }

function getClientIP(req) {
  return req.headers['cf-connecting-ip'] ||
         (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
         req.socket.remoteAddress || '127.0.0.1';
}

function checkLoginLock(ip) {
  const record = loginFailures[ip];
  if (!record || !record.lockedUntil) return { locked: false };
  if (Date.now() > record.lockedUntil) {
    delete loginFailures[ip];
    return { locked: false };
  }
  return { locked: true, remainingMs: record.lockedUntil - Date.now() };
}

// 每小时清理过期记录
setInterval(() => {
  const now = Date.now();
  for (const ip of Object.keys(loginFailures)) {
    if (loginFailures[ip].lockedUntil && now > loginFailures[ip].lockedUntil) {
      delete loginFailures[ip];
    }
  }
}, 60 * 60 * 1000);

// ==========================================
// 解析请求体
// ==========================================

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let settled = false;

    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        if (chunks.length === 0) {
          resolve({});
          return;
        }
        const buffer = Buffer.concat(chunks);
        let raw = buffer;
        // 如果客户端发送的是 gzip 压缩数据，先解压
        const enc = req.headers['content-encoding'] || '';
        if (enc.includes('gzip')) {
          raw = zlib.gunzipSync(buffer);
        }
        resolve(JSON.parse(raw.toString('utf-8')));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', (e) => {
      if (!settled) { settled = true; reject(e); }
    });
    req.on('aborted', () => {
      console.warn('[parseBody] 请求被客户端/代理中断');
    });
  });
}

// ==========================================
// MIME 类型映射
// ==========================================

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
};

/**
 * 发送 JSON 响应
 */
function sendJSON(res, code, data) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.end(JSON.stringify(data));
}

/**
 * 获取本机局域网 IP 地址列表
 */
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

/**
 * 静态文件服务
 */
function serveStatic(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404 - 页面未找到</h1>');
      } else {
        res.writeHead(500);
        res.end('500 - 服务器错误');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// ==========================================
// API 路由处理
// ==========================================

async function handleAPI(req, res, pathname) {
  // ===== GET /api/data =====
  // 获取分类数据（所有访问者均可访问）
  if (req.method === 'GET' && pathname === '/api/data') {
    console.log('[GET /api/data] 返回分类数据，分类数:', appData.categories.length);
    sendJSON(res, 200, { categories: appData.categories });
    return;
  }

  // ===== POST /api/auth =====
  // 验证管理员密码（含 IP 限流）
  if (req.method === 'POST' && pathname === '/api/auth') {
    const ip = getClientIP(req);
    try {
      const body = await parseBody(req);

      // 先检查是否已被锁定
      const lockCheck = checkLoginLock(ip);
      if (lockCheck.locked) {
        sendJSON(res, 429, {
          success: false,
          message: '密码错误次数过多，该设备已被锁定24小时',
          locked: true,
          remainingMs: lockCheck.remainingMs,
        });
        return;
      }

      if (body.password === appData.adminPassword) {
        // 登录成功，清除失败记录
        delete loginFailures[ip];
        sendJSON(res, 200, { success: true });
      } else {
        // 登录失败，记录失败次数
        if (!loginFailures[ip]) loginFailures[ip] = { count: 0, lockedUntil: null };
        loginFailures[ip].count++;
        const isNowLocked = loginFailures[ip].count >= MAX_FAILURES;
        if (isNowLocked) {
          loginFailures[ip].lockedUntil = Date.now() + LOCK_DURATION;
        }
        sendJSON(res, 401, {
          success: false,
          message: isNowLocked ? '密码错误次数过多，该设备已被锁定24小时' : `密码错误，还剩 ${MAX_FAILURES - loginFailures[ip].count} 次尝试机会`,
          locked: isNowLocked,
          remainingMs: isNowLocked ? LOCK_DURATION : 0,
          attemptsLeft: MAX_FAILURES - loginFailures[ip].count,
        });
      }
    } catch (e) {
      sendJSON(res, 400, { success: false, message: '请求格式错误' });
    }
    return;
  }

  // ===== POST /api/check-lock =====
  // 检查当前 IP 是否被锁定
  if (req.method === 'POST' && pathname === '/api/check-lock') {
    const ip = getClientIP(req);
    const lock = checkLoginLock(ip);
    sendJSON(res, 200, { locked: lock.locked, remainingMs: lock.remainingMs || 0 });
    return;
  }

  // ===== POST /api/save =====
  // 保存分类数据（需密码验证），支持 gzip 压缩传输
  if (req.method === 'POST' && pathname === '/api/save') {
    try {
      const body = await parseBody(req);
      const catCount = body.categories ? body.categories.length : 0;
      const bodySize = Math.round(JSON.stringify(body).length / 1024);
      console.log('[POST /api/save] 收到保存请求，分类数:', catCount, '数据大小:', bodySize + 'KB');
      if (body.password !== appData.adminPassword) {
        console.log('[POST /api/save] 密码错误');
        sendJSON(res, 401, { success: false, message: '密码错误，无权限修改' });
        return;
      }
      if (!body.categories || !Array.isArray(body.categories)) {
        sendJSON(res, 400, { success: false, message: '数据格式错误' });
        return;
      }
      // 先更新内存中的分类数据
      appData.categories = body.categories;
      // 异步写入文件（避免阻塞响应）
      try { saveDataFile(); } catch (writeErr) {
        console.error('[POST /api/save] 写入文件失败:', writeErr.message);
      }
      console.log('[POST /api/save] 保存成功，当前分类数:', appData.categories.length);
      sendJSON(res, 200, { success: true, message: '保存成功' });
    } catch (e) {
      console.error('[POST /api/save] 异常:', e.message);
      // 如果已经解析到数据，尝试保存
      sendJSON(res, 400, { success: false, message: '请求格式错误: ' + e.message });
    }
    return;
  }

  // ===== POST /api/change-password =====
  // 修改管理员密码
  if (req.method === 'POST' && pathname === '/api/change-password') {
    try {
      const body = await parseBody(req);
      if (body.oldPassword !== appData.adminPassword) {
        sendJSON(res, 401, { success: false, message: '当前密码错误' });
        return;
      }
      if (!body.newPassword || body.newPassword.length < 4) {
        sendJSON(res, 400, { success: false, message: '新密码至少4位' });
        return;
      }
      appData.adminPassword = body.newPassword;
      saveDataFile();
      sendJSON(res, 200, { success: true, message: '密码修改成功' });
    } catch (e) {
      sendJSON(res, 400, { success: false, message: '请求格式错误' });
    }
    return;
  }

  // ===== POST /api/reset =====
  // 恢复默认数据（需密码验证）
  if (req.method === 'POST' && pathname === '/api/reset') {
    try {
      const body = await parseBody(req);
      if (body.password !== appData.adminPassword) {
        sendJSON(res, 401, { success: false, message: '密码错误' });
        return;
      }
      appData.categories = JSON.parse(JSON.stringify(defaultData.categories));
      saveDataFile();
      sendJSON(res, 200, { success: true, message: '已恢复默认数据' });
    } catch (e) {
      sendJSON(res, 400, { success: false, message: '请求格式错误' });
    }
    return;
  }

  // 未知 API
  sendJSON(res, 404, { message: 'API 不存在' });
}

// ==========================================
// 创建 HTTP 服务器
// ==========================================

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = parsedUrl.pathname;

  // API 请求
  if (pathname.startsWith('/api/')) {
    await handleAPI(req, res, pathname);
    return;
  }

  // 静态文件
  if (pathname === '/') {
    pathname = '/index.html';
  }

  // 安全检查：防止目录穿越
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  // 确保文件在项目目录内
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('403 - 禁止访问');
    return;
  }

  serveStatic(req, res, filePath);
});

// ==========================================
// 启动服务器
// ==========================================

loadData(); // 启动时加载数据

server.listen(PORT, '0.0.0.0', () => {
  const localIPs = getLocalIPs();

  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║        🌙  晚心游戏 服务器已启动        ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log('║                                          ║');
  console.log(`║  本机访问:  http://localhost:${PORT}          ║`);

  localIPs.forEach(ip => {
    const url = `http://${ip}:${PORT}`;
    const label = '局域网访问:';
    const padding = ' '.repeat(Math.max(0, 26 - label.length - url.length));
    console.log(`║  ${label} ${url}${padding}║`);
  });

  console.log('║                                          ║');
  console.log('║  📱 手机端：确保手机与电脑在同一 WiFi    ║');
  console.log('║     用手机浏览器打开上面的局域网地址即可  ║');
  console.log('║                                          ║');
  console.log('║  💾 数据存储: data.json（自动同步）      ║');
  console.log('║  🔑 管理员可在页面底部「管理」登录修改    ║');
  console.log('║                                          ║');
  console.log('║  按 Ctrl+C 停止服务器                    ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});
