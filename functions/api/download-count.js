/**
 * 全局下载次数统计（所有访问者共享，存储于 Cloudflare KV）
 * GET  /api/download-count?id=xxx  - 获取某游戏的下载次数
 * POST /api/download-count          - 某游戏下载次数 +1（body: { id }）
 */
export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    if (!id) return Response.json({ count: 0 }, { status: 400 });
    const raw = await context.env.SITE_DATA.get(`dl:${id}`);
    const count = raw ? parseInt(raw, 10) : 0;
    return Response.json({ count: isNaN(count) || count < 0 ? 0 : count });
  } catch (e) {
    return Response.json({ count: 0 }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const id = body.id;
    if (!id) return Response.json({ count: 0 }, { status: 400 });
    const raw = await context.env.SITE_DATA.get(`dl:${id}`);
    const count = (raw ? parseInt(raw, 10) : 0) + 1;
    await context.env.SITE_DATA.put(`dl:${id}`, String(count));
    return Response.json({ count });
  } catch (e) {
    return Response.json({ count: 0 }, { status: 500 });
  }
}
