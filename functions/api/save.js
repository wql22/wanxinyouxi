/**
 * POST /api/save - 保存分类数据（需密码）
 * 支持 gzip 压缩数据
 */
import { getSiteData, saveSiteData, readBody } from '../_shared';

export async function onRequestPost(context) {
  try {
    const body = await readBody(context.request);
    const data = await getSiteData(context.env);

    if (body.password !== data.adminPassword) {
      return Response.json(
        { success: false, message: '密码错误，无权限修改' },
        { status: 401 }
      );
    }

    if (!body.categories || !Array.isArray(body.categories)) {
      return Response.json({ success: false, message: '数据格式错误' }, { status: 400 });
    }

    data.categories = body.categories;
    await saveSiteData(context.env, data);

    return Response.json({ success: true, message: '保存成功' });
  } catch (e) {
    return Response.json(
      { success: false, message: '请求格式错误: ' + e.message },
      { status: 400 }
    );
  }
}
