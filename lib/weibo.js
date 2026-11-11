// 微博监控数据：来自本地 Weibo Crawler 服务（默认 127.0.0.1:15001）。
// 附带「提取股票」能力：把微博正文交给大模型解析出 A股标的，写入自选并标记已提取。
import { fetchJson } from './http.js';
import { normalizeSymbols } from './symbol.js';
import { suggestStocks } from './suggest.js';

const BASE = process.env.WEIBO_CRAWLER_BASE || 'http://127.0.0.1:15001';
const TTL_MS = 60_000;

/** 提取标记的键名前缀（存于 powerful kv 表的 weibo 分区）。 */
const XKEY = (id) => `extract:${id}`;
/** 单条微博交给模型的最大字符数。 */
const MAX_TEXT = 360;

/**
 * 拉取已入库微博（按时间倒序）。
 * @param {{page?: number, pageSize?: number, userId?: string, keyword?: string, days?: number}} opts
 * @param {{weibo?: any}} [tables] 提供时附带每条微博的提取状态
 */
export async function getWeibos({ page = 1, pageSize = 30, userId, keyword, days } = {}, tables) {
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
  const items = (data.items || []).map((w) => {
    const rec = readMark(tables, w.id);
    return {
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
      extracted: rec ? { at: rec.at, stocks: rec.stocks || [] } : null,
    };
  });
  return {
    items,
    total: data.total ?? items.length,
    page: data.page ?? 1,
    pageSize: data.page_size ?? 30,
    bloggers: (data.available_users || []).map((u) => ({ userId: u.user_id, name: u.screen_name })),
  };
}

function readMark(tables, id) {
  if (!tables?.weibo || !id) return null;
  try {
    return tables.weibo.get(XKEY(id)) || null;
  } catch {
    return null;
  }
}

/**
 * 未提取的微博：逐页往下扫，直到凑够 want 条待提取或达到 maxPages 上限，
 * 结果按时间**倒序**（最新优先）——保证用户在当前列表里立刻能看到「已提取」标记，
 * 同时因为会继续向更早的页扫描，历史积压也不会被新微博饿死。
 */
export async function pendingWeibos({ want = 200, maxPages = 10, tables } = {}) {
  const found = [];
  for (let page = 1; page <= maxPages; page++) {
    const list = await getWeibos({ page, pageSize: 50 }, tables);
    for (const w of list.items) if (!w.extracted) found.push(w);
    if (found.length >= want) break;
    if (list.items.length < 50) break;
  }
  return found
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, want);
}

/** 把模型输出里可能包裹的代码块/解释剥掉，取第一个 JSON 值。 */
function parseJsonLoose(text) {
  const s = String(text || '').trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : s;
  const start = body.search(/[[{]/);
  if (start < 0) throw new Error('模型未返回 JSON');
  const end = Math.max(body.lastIndexOf(']'), body.lastIndexOf('}'));
  if (end <= start) throw new Error('模型未返回完整 JSON');
  return JSON.parse(body.slice(start, end + 1));
}

/** 归一化模型给出的股票条目：{name, code?} → {code, name}；代码缺失时用搜索补全。 */
async function resolveStock(entry) {
  const name = String(entry?.name || entry?.stock || '').trim().slice(0, 20);
  let code = String(entry?.code || entry?.symbol || '').replace(/[^0-9]/g, '');
  if (code.length === 6) {
    try {
      const sym = normalizeSymbols([code])[0];
      if (sym) {
        let resolvedName = name;
        if (!resolvedName) {
          // 只给了代码：补一次名称，避免自选里显示成代码
          try {
            const hits = await suggestStocks(sym.code, { count: 1 });
            resolvedName = hits[0]?.name || '';
          } catch { /* 名称补全失败就用代码 */ }
        }
        return { code: sym.code, name: resolvedName || sym.code };
      }
    } catch { /* 代码非法则走名称搜索 */ }
  }
  if (name) {
    try {
      const hits = await suggestStocks(name, { count: 3 });
      const exact = hits.find((h) => h.name === name);
      const pick = exact || hits[0];
      if (pick) return { code: pick.code, name: pick.name || name };
    } catch { /* 搜索失败则该条丢弃 */ }
  }
  return null;
}

/**
 * 提取股票：把未标记的微博交给大模型解析，写入自选（已存在则只更新最后提及时间），并打上已提取标记。
 * @param {{batch?: number, tables: any, analyze: (payload: {items: Array<{id: string, text: string}>, pending: number}) => Promise<any>}} opts
 *   analyze 由 Host 注入（负责真正的模型调用），返回 [{id, stocks:[{name, code?}]}]
 */
export async function extractStocksFromWeibos({ batch = 20, tables, analyze } = {}) {
  if (!tables?.weibo) throw new Error('微博提取存储未初始化');
  const limit = Math.min(50, Math.max(1, Number(batch) || 20));
  const pending = await pendingWeibos({ want: 200, tables });
  if (!pending.length) {
    return { processed: 0, added: [], updated: [], message: '没有新的微博需要提取' };
  }
  const take = pending.slice(0, limit).map((w) => ({
    id: String(w.id),
    text: String(w.text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT),
    screenName: w.screenName,
  }));

  const result = await analyze({ items: take, pending: pending.length });
  // analyze 可能返回字符串（模型原文）或已解析对象
  const parsedRaw = typeof result === 'string' ? parseJsonLoose(result) : result;
  const parsed = Array.isArray(parsedRaw) ? parsedRaw : parsedRaw?.items || [];
  const byId = new Map(parsed.map((r) => [String(r?.id ?? ''), r]));

  const added = [];
  const updated = [];
  const now = new Date().toISOString();
  const seenCodes = new Set();

  for (const w of take) {
    const row = byId.get(w.id);
    const stocks = [];
    for (const entry of row?.stocks || []) {
      const hit = await resolveStock(entry);
      if (!hit || seenCodes.has(`${w.id}:${hit.code}`)) continue;
      seenCodes.add(`${w.id}:${hit.code}`);
      stocks.push(hit);
      const cur = tables.watchlist.get(hit.code);
      if (cur) {
        tables.watchlist.put(hit.code, { ...cur, lastMentionedAt: now, mentionCount: (cur.mentionCount || 0) + 1 });
        updated.push({ code: hit.code, name: cur.name || hit.name });
      } else {
        tables.watchlist.put(hit.code, {
          symbol: hit.code, name: hit.name, tier: 'basic', domain: '', tags: [],
          addedAt: now, lastMentionedAt: now, mentionCount: 1, source: 'weibo',
        });
        added.push({ code: hit.code, name: hit.name });
      }
    }
    tables.weibo.put(XKEY(w.id), { at: now, stocks, screenName: w.screenName });
  }

  // 去重（同一代码可能出现在多条微博里）
  const uniq = (arr) => {
    const m = new Map();
    for (const x of arr) if (!m.has(x.code)) m.set(x.code, x);
    return [...m.values()];
  };
  return {
    processed: take.length,
    pendingLeft: Math.max(0, pending.length - take.length),
    added: uniq(added),
    updated: uniq(updated),
    withStocks: take.filter((w) => (byId.get(w.id)?.stocks || []).length > 0).length,
    message: `已处理 ${take.length} 条微博，新增 ${uniq(added).length} 只、更新 ${uniq(updated).length} 只`,
  };
}

/** 提取进度统计：已提取/未提取条数。 */
export async function weiboExtractStats({ tables, sample = 50 } = {}) {
  const list = await getWeibos({ pageSize: Math.min(50, Math.max(1, sample)) }, tables);
  const done = list.items.filter((w) => w.extracted).length;
  return { sampled: list.items.length, extracted: done, pending: list.items.length - done, total: list.total };
}
