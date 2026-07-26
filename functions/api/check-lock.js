/**
 * POST /api/check-lock - 检查当前 IP 是否被锁定
 */
import { getClientIP, checkLoginLock } from '../_shared';

export async function onRequestPost(context) {
  const ip = getClientIP(context.request);
  const locked = await checkLoginLock(context.env, ip);
  return Response.json({ locked, remainingMs: locked ? 86400000 : 0 });
}
