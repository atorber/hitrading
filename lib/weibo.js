// 微博监控数据：来自本地 Weibo Crawler 服务（默认 127.0.0.1:15001）。
import { fetchJson } from './http.js';

const BASE = process.env.WEIBO_CRAWLER_BASE || 'http://127.0.0.1:15001';
const TTL_MS = 60_000;

/**
 * 拉取已入库微博（按时间倒序）。
 * @param {{page?: number, pageSize?: number, userId?: string, keyword?: string, days?: number}} opts
 */
export async function getWeibos({ page = 1, pageSize = 30, userId, keyword, days } = {}) {
  const qs = new URLSearchParams();
  qs.set('page', String(Math.max(1, Number(page) || 1)));
  qs.set('page_size', String(Math.min(50, Math.max(1, Number(pageSize) || 30))));
  if (userId) qs.set('user_id', String(userId));
  if (keyword) qs.set('keyword', String(keyword));
  if (days && Number(days) > 0) {
    const start = new Date(Date.now() - Number(days) * 86_400_000);
    const pad = (n) => String(n).padStart(2, '0');
    qs.set('start_date', `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`);
  }
  const url = `${BASE}/api/data/weibos?${qs}`;
  const raw = await fetchJson(url, { timeoutMs: 8000 });
  if (raw?.code !== 200) throw new Error(`微博服务响应异常：code=${raw?.code}`);
  const data = raw.data || {};
  const items = (data.items || []).map((w) => ({
    id: w.id,
    bid: w.bid,
    userId: w.user_id,
    screenName: w.screen_name,
    text: w.text,
    createdAt: w.created_at,
    attitudes: Number(w.attitudes_count) || 0,
    comments: Number(w.comments_count) || 0,
    reposts: Number(w.reposts_count) || 0,
    source: w.source,
    topics: w.topics || '',
    atUsers: w.at_users || '',
  }));
  return {
    items,
    total: data.total ?? items.length,
    page: data.page ?? 1,
    pageSize: data.page_size ?? 30,
    bloggers: (data.available_users || []).map((u) => ({ userId: u.user_id, name: u.screen_name })),
  };
}
