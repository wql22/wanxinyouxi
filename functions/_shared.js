/**
 * 晚心游戏 - Cloudflare Pages Functions 共享模块
 * 数据存储于 Cloudflare KV 中
 */

// 当前 data.json 中的实际数据作为默认值
const defaultData = {
  adminPassword: 'WXC021015',
  categories: [
    {
      id: 'games',
      name: '晚心游戏',
      icon: '🎮',
      desc: '精品游戏资源与攻略',
      items: [],
    },
  ],
};

/**
 * 读取站点数据，KV 不存在时自动初始化
 */
export async function getSiteData(env) {
  const raw = await env.SITE_DATA.get('site_data', 'json');
  if (!raw || !raw.categories) {
    await env.SITE_DATA.put('site_data', JSON.stringify(defaultData));
    return JSON.parse(JSON.stringify(defaultData));
  }
  return raw;
}

/**
 * 保存站点数据到 KV
 */
export async function saveSiteData(env, data) {
  await env.SITE_DATA.put('site_data', JSON.stringify(data));
}

/**
 * 获取客户端真实 IP（Cloudflare 代理后）
 */
export function getClientIP(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    '127.0.0.1'
  );
}

// ========== 登录 IP 限流（基于 KV） ==========

const MAX_FAILURES = 5;
const LOCK_DURATION_SEC = 24 * 60 * 60; // 24 小时

/**
 * 检查 IP 是否被锁定
 */
export async function checkLoginLock(env, ip) {
  const count = await env.SITE_DATA.get(`lock:${ip}`);
  return count !== null && parseInt(count) >= MAX_FAILURES;
}

/**
 * 记录一次登录失败，返回 { locked, count, attemptsLeft }
 */
export async function recordLoginFailure(env, ip) {
  const raw = await env.SITE_DATA.get(`lock:${ip}`);
  const count = (raw ? parseInt(raw) : 0) + 1;
  await env.SITE_DATA.put(`lock:${ip}`, String(count), {
    expirationTtl: LOCK_DURATION_SEC,
  });
  return {
    locked: count >= MAX_FAILURES,
    count,
    attemptsLeft: Math.max(0, MAX_FAILURES - count),
  };
}

/**
 * 登录成功，清除锁定记录
 */
export async function clearLoginRecord(env, ip) {
  await env.SITE_DATA.delete(`lock:${ip}`);
}

/**
 * 解析请求体（支持 gzip 解压）
 */
export async function readBody(request) {
  const ce = (request.headers.get('content-encoding') || '').toLowerCase();
  if (ce.includes('gzip')) {
    const buf = await request.arrayBuffer();
    const ds = new DecompressionStream('gzip');
    const rs = new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(new Uint8Array(buf));
        ctrl.close();
      },
    });
    const text = await new Response(rs.pipeThrough(ds)).text();
    return JSON.parse(text);
  }
  return request.json();
}
