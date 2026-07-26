/**
 * POST /api/reset - 恢复默认分类数据（需密码）
 */
import { getSiteData, saveSiteData } from '../_shared';

const defaultCategories = [
  {
    id: 'games',
    name: '晚心游戏',
    icon: '🎮',
    desc: '精品游戏资源与攻略',
    items: [],
  },
];

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const data = await getSiteData(context.env);

    if (body.password !== data.adminPassword) {
      return Response.json({ success: false, message: '密码错误' }, { status: 401 });
    }

    data.categories = JSON.parse(JSON.stringify(defaultCategories));
    await saveSiteData(context.env, data);

    return Response.json({ success: true, message: '已恢复默认数据' });
  } catch (e) {
    return Response.json({ success: false, message: '请求格式错误' }, { status: 400 });
  }
}
