/**
 * GET /img/:key - 从 KV 读取图片并返回，带 1 年浏览器缓存
 * 
 * Cloudflare Pages 动态路由：/img/xxx → 此函数处理
 */
export async function onRequestGet(context) {
  // 从 URL 中提取图片 key（路径格式：/img/img_xxx）
  const pathname = new URL(context.request.url).pathname;
  const imgKey = pathname.replace('/img/', '').trim();

  if (!imgKey) {
    return new Response('图片不存在', { status: 404 });
  }

  try {
    const raw = await context.env.SITE_DATA.get(imgKey);
    if (!raw) {
      return new Response('图片不存在', { status: 404 });
    }

    const { mime, data } = JSON.parse(raw);
    const binary = Uint8Array.from(atob(data), c => c.charCodeAt(0));

    return new Response(binary, {
      status: 200,
      headers: {
        'Content-Type': mime || 'image/png',
        // 缓存 1 年（图片 key 唯一，内容不变）
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response('图片加载失败', { status: 500 });
  }
}
