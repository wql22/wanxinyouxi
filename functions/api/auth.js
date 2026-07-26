/**
 * POST /api/auth - 管理员登录（含 IP 限流）
 */
import {
  getSiteData,
  getClientIP,
  checkLoginLock,
  recordLoginFailure,
  clearLoginRecord,
} from '../_shared';

export async function onRequestPost(context) {
  const ip = getClientIP(context.request);

  try {
    const body = await context.request.json();

    // 先检查是否已锁定
    if (await checkLoginLock(context.env, ip)) {
      return Response.json(
        { success: false, message: '密码错误次数过多，该设备已被锁定24小时', locked: true },
        { status: 429 }
      );
    }

    const data = await getSiteData(context.env);

    if (body.password === data.adminPassword) {
      await clearLoginRecord(context.env, ip);
      return Response.json({ success: true });
    }

    // 记录失败
    const result = await recordLoginFailure(context.env, ip);
    if (result.locked) {
      return Response.json(
        { success: false, message: '密码错误次数过多，该设备已被锁定24小时', locked: true },
        { status: 401 }
      );
    }

    return Response.json(
      {
        success: false,
        message: `密码错误，还剩 ${result.attemptsLeft} 次尝试机会`,
        locked: false,
        attemptsLeft: result.attemptsLeft,
      },
      { status: 401 }
    );
  } catch (e) {
    return Response.json({ success: false, message: '请求格式错误' }, { status: 400 });
  }
}
