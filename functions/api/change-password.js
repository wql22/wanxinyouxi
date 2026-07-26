/**
 * POST /api/change-password - 修改管理员密码
 */
import { getSiteData, saveSiteData } from '../_shared';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const data = await getSiteData(context.env);

    if (body.oldPassword !== data.adminPassword) {
      return Response.json({ success: false, message: '当前密码错误' }, { status: 401 });
    }

    if (!body.newPassword || body.newPassword.length < 4) {
      return Response.json({ success: false, message: '新密码至少4位' }, { status: 400 });
    }

    data.adminPassword = body.newPassword;
    await saveSiteData(context.env, data);

    return Response.json({ success: true, message: '密码修改成功' });
  } catch (e) {
    return Response.json({ success: false, message: '请求格式错误' }, { status: 400 });
  }
}
