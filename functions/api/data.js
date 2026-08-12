/**
 * GET /api/data - 获取分类数据
 */
import { getSiteData } from '../_shared';

export async function onRequestGet(context) {
  try {
    const data = await getSiteData(context.env);
    return Response.json(
      { categories: data.categories },
      {
        headers: {
          'Cache-Control': 'public, max-age=0, must-revalidate',
          Pragma: 'public',
          Expires: '0',
        },
      }
    );
  } catch (e) {
    return Response.json({ categories: [] }, { status: 500 });
  }
}
