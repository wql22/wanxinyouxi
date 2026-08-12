/**
 * POST /api/upload - 上传图片（Cloudflare Pages Functions 版本）
 * 
 * 将压缩后的缩略图存储到 KV 中，通过 /img/:key 端点提供访问。
 * 缩略图通常只有 5-20KB，KV 存储完全可行。
 */
export async function onRequestPost(context) {
  const ct = context.request.headers.get('content-type') || '';
  if (!ct.includes('multipart/form-data')) {
    return Response.json({ success: false, message: '需要 multipart/form-data 格式' }, { status: 400 });
  }

  try {
    const formData = await context.request.formData();
    const file = formData.get('image');

    if (!file || typeof file === 'string') {
      return Response.json({ success: false, message: '没有上传文件' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const sizeKB = (arrayBuffer.byteLength / 1024).toFixed(1);

    if (arrayBuffer.byteLength > 3 * 1024 * 1024) {
      return Response.json({ success: false, message: '文件不能超过3MB' }, { status: 400 });
    }

    // 将图片转为 base64 存入 KV
    const base64 = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuffer))
    );
    const mimeType = file.type || 'image/png';

    // 生成唯一 key
    const imgKey = 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    
    // 存入 KV（图片数据 + MIME 类型）
    await context.env.SITE_DATA.put(imgKey, JSON.stringify({ mime: mimeType, data: base64 }));

    // 返回图片服务 URL
    const url = '/img/' + imgKey;
    console.log('[POST /api/upload] ✓ KV 已存储:', url, '(' + sizeKB + 'KB)');
    return Response.json({ success: true, url });
  } catch (e) {
    console.error('[POST /api/upload] 错误:', e.message);
    return Response.json({ success: false, message: '上传失败: ' + e.message }, { status: 500 });
  }
}
