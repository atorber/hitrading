// 单一真相源：12 个 A股操作，Agent 工具与 HTTP 路由（客户端面板）共用。
import { randomUUID } from 'node:crypto';
import { normalizeSymbols } from './symbol.js';
import { getQuotes } from './quotes.js';
import { getKline } from './kline.js';
import { TtlCache } from './cache.js';
import { ma, macd, rsi, kdj, last } from './indicators.js';
import { getMarketTop } from './market.js';
import { suggestStocks } from './suggest.js';
import { getNews, getAnnouncements, getLhb } from './news.js';
import { runBacktest, strategies } from './backtest.js';
import { getMarketEnergy } from './energy.js';
import { getPowerful } from './powerful.js';
import { getWeibos } from './weibo.js';

/** T-n 涨跌幅的周期集合：T-n = 最新价较 T-(n+1) 日收盘的累计涨跌幅（持有 n+1 个交易日）。 */
export const PCT_N = [1, 2, 3, 4, 5, 10, 15, 20, 30];

/** 日K收盘缓存：T-n 基准为已收盘价，日内不变，缓存 5 分钟即可。 */
const klineCache = new TtlCache();
const KLINE_TTL_MS = 5 * 60_000;

/** 取最近 31 根日K（带缓存）；失败返回 []。 */
async function closeBars(code) {
  const cached = klineCache.get(code);
  if (cached) return cached;
  try {
    const n = normalizeSymbols([code])[0];
    if (!n) return [];
    const { bars } = await getKline(n, { period: 'day', limit: PCT_N[PCT_N.length - 1] + 2 });
    klineCache.set(code, bars, KLINE_TTL_MS);
    return bars;
  } catch {
    return [];
  }
}

/** T-n 涨跌幅（%）：最新价较 T-(n+1) 收盘（近 n+1 个交易日累计）；bars 最后一根为最新交易日 T。 */
function pctNOf(price, bars, n) {
  if (price == null || !bars.length) return null;
  const idx = bars.length - 2 - n; // 基准 = T-(n+1) 收盘
  if (idx < 0) return null;
  const base = bars[idx].close;
  if (!base) return null;
  return +(((price - base) / base) * 100).toFixed(2);
}

/** 小并发批量执行（避免把数据源打限流）。 */
async function mapLimited(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

const SORT_MAP = { amount: '成交额', changepercent: '涨跌幅', turnoverratio: '换手率', mktcap: '总市值' };

/** 自选股关注度分级。 */
export const TIERS = { basic: '基础股', selected: '精选股', trading: '交易股' };
/** 未知/缺失一律视为基础股（兼容旧数据）。 */
export const normalizeTier = (t) => (t && Object.prototype.hasOwnProperty.call(TIERS, t) ? t : 'basic');

/** 领域分类（单选，可空）：大金融 / 消费 / 周期 / 科技。 */
export const DOMAINS = { finance: '大金融', consumer: '消费', cyclical: '周期', tech: '科技' };
/** 空/未知 → ''（未分类）。 */
export const normalizeDomain = (d) => (d && Object.prototype.hasOwnProperty.call(DOMAINS, d) ? d : '');

/** 标签规范化：接受数组或逗号/空格分隔字符串；去空白、去重、单个≤12字、每只≤10个。 */
export function normalizeTags(raw) {
  const list = Array.isArray(raw) ? raw : raw == null ? [] : String(raw).split(/[,，;；、\s]+/);
  const out = [];
  for (const t of list) {
    const s = String(t).trim().slice(0, 12);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= 10) break;
  }
  return out;
}
/** 工具输出要求无损 JSON：丢掉 undefined 字段。 */
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function namesFor(codes) {
  const syms = normalizeSymbols(codes);
  if (!syms.length) return new Map();
  try {
    const { quotes } = await getQuotes(syms);
    return new Map(quotes.map((q) => [q.code, q.name]));
  } catch {
    return new Map();
  }
}

/** 给记录补上实时价格与涨跌幅（写入类响应也用得上）。 */
async function enrichWithQuotes(items) {
  if (!items.length) return items;
  const quotes = await getQuotes(normalizeSymbols(items.map((i) => i.symbol))).catch(() => ({ quotes: [] }));
  const qmap = new Map(quotes.quotes.map((q) => [q.code, q]));
  return items.map((r) => {
    const q = qmap.get(r.symbol);
    return compact({ ...r, price: q?.price ?? null, pctChange: q?.pctChange ?? null });
  });
}

/**
 * @param {string} op 操作名
 * @param {object} args 参数
 * @param {{watchlist:any, positions:any, alerts:any}} tables domain 表
 */
export async function runOp(op, args = {}, tables) {
  switch (op) {
    case 'suggest': {
      // 名称/拼音/代码模糊搜索 A股（添加自选时用）
      const q = String(args.q ?? args.keyword ?? '').trim();
      if (!q) throw new Error('请提供搜索关键词');
      return { items: await suggestStocks(q, { count: Math.min(10, Math.max(1, num(args.count) || 8)) }) };
    }

    case 'quote': {
      const syms = normalizeSymbols(args.symbols || []);
      if (syms.length === 0) throw new Error('未提供有效的 A股代码');
      const { quotes, source } = await getQuotes(syms);
      return { quotes, source, fetchedAt: new Date().toISOString() };
    }

    case 'kline': {
      const n = normalizeSymbols([args.symbol])[0];
      if (!n) throw new Error(`无效的 A股代码：${args.symbol}`);
      const period = args.period || 'day';
      const limit = args.limit || 60;
      const { bars } = await getKline(n, { period, limit });
      return { symbol: n.code, period, bars };
    }

    case 'analysis': {
      const n = normalizeSymbols([args.symbol])[0];
      if (!n) throw new Error(`无效的 A股代码：${args.symbol}`);
      const [quoteResult, klineResult] = await Promise.all([
        getQuotes([n]),
        getKline(n, { period: 'day', limit: 120 }),
      ]);
      const quote = quoteResult.quotes[0];
      const bars = klineResult.bars;
      if (!bars.length) throw new Error('无法获取 K线数据');
      const closes = bars.map((b) => b.close);
      const highs = bars.map((b) => b.high);
      const lows = bars.map((b) => b.low);
      const { dif, dea, hist } = macd(closes);
      const rsi14 = last(rsi(closes, 14));
      const { k, d, j } = kdj(highs, lows, closes, 9);
      const macdDif = last(dif);
      const macdDea = last(dea);
      const macdHist = last(hist);
      const kLast = last(k);
      const dLast = last(d);
      const jLast = last(j);
      const latest = closes[closes.length - 1];
      return {
        symbol: n.code,
        quote: quote ?? null,
        indicators: {
          ma5: last(ma(closes, 5)), ma10: last(ma(closes, 10)),
          ma20: last(ma(closes, 20)), ma60: last(ma(closes, 60)),
          dif: macdDif, dea: macdDea, hist: macdHist,
          macdSignal: macdDif != null && macdDea != null ? (macdHist > 0 ? '多头' : '空头') : '-',
          rsi14,
          rsiSignal: rsi14 != null ? (rsi14 > 70 ? '超买' : rsi14 < 30 ? '超卖' : '中性') : '-',
          k: kLast, d: dLast, j: jLast,
          kdjSignal: jLast != null ? (jLast > 100 ? '超买' : jLast < 0 ? '超卖' : '-') : '-',
          close: latest,
        },
        bars: bars.slice(-250),
        barCount: bars.length,
        at: new Date().toISOString(),
      };
    }

    case 'screen': {
      const sort = args.sort || 'amount';
      const limit = Math.min(300, Math.max(1, num(args.limit) || 30));
      const rows = await getMarketTop({ sort, asc: 0, limit: Math.max(300, limit * 10) });
      const f = (r) => {
        if (args.peMin != null && (r.pe == null || r.pe < num(args.peMin))) return false;
        if (args.peMax != null && (r.pe == null || r.pe > num(args.peMax))) return false;
        if (args.mcapMinYi != null && (r.totalMcapYi == null || r.totalMcapYi < num(args.mcapMinYi))) return false;
        if (args.mcapMaxYi != null && (r.totalMcapYi == null || r.totalMcapYi > num(args.mcapMaxYi))) return false;
        if (args.pctMin != null && (r.pctChange == null || r.pctChange < num(args.pctMin))) return false;
        if (args.pctMax != null && (r.pctChange == null || r.pctChange > num(args.pctMax))) return false;
        if (args.turnoverMin != null && (r.turnover == null || r.turnover < num(args.turnoverMin))) return false;
        return true;
      };
      const matched = rows.filter(f).slice(0, limit);
      return { rows: matched, sortLabel: SORT_MAP[sort] || sort, count: matched.length };
    }

    case 'energy': {
      // 沪深京三市日成交额（亿）+ 主要指数涨跌幅，用于量能趋势判断
      return getMarketEnergy({ days: num(args.days) || 20 });
    }

    case 'powerful': {
      // 强势股：按交易日展示全市场当日涨幅>7%的股票（最近10个交易日）
      return getPowerful({ date: args.date ? String(args.date) : undefined }, tables);
    }

    case 'weibo': {
      // 微博监控（Weibo Crawler 本地服务）
      return getWeibos({
        page: num(args.page) || 1,
        pageSize: num(args.pageSize) || 30,
        userId: args.userId ? String(args.userId) : undefined,
        keyword: args.keyword ? String(args.keyword) : undefined,
        days: num(args.days) || undefined,
      }, tables);   // 传入 tables 以附带「已提取」标记
    }

    case 'watchlist.list': {
      const codes = [...tables.watchlist.keys()];
      const quotes = await getQuotes(normalizeSymbols(codes)).catch(() => ({ quotes: [] }));
      const qmap = new Map(quotes.quotes.map((q) => [q.code, q]));
      let items = codes.map((code) => {
        const rec = tables.watchlist.get(code) ?? {};
        const q = qmap.get(code);
        return compact({
          symbol: code,
          name: rec.name ?? q?.name ?? code,
          price: q?.price ?? null,
          pctChange: q?.pctChange ?? null,
          tier: normalizeTier(rec.tier),
          domain: normalizeDomain(rec.domain),
          tags: normalizeTags(rec.tags),
          note: rec.note,
          addedAt: rec.addedAt,
        });
      });
      // T-n 涨跌幅：最新价 vs T-n 收盘（K线基准带缓存，小并发拉取）
      if (items.length) {
        const barsList = await mapLimited(items, 5, (it) => closeBars(it.symbol));
        items = items.map((it, i) => {
          const bars = barsList[i] || [];
          const pctN = {};
          for (const n of PCT_N) pctN[n] = pctNOf(it.price, bars, n);
          return { ...it, pctN };
        });
      }
      if (args.tier) items = items.filter((i) => i.tier === normalizeTier(args.tier));
      if (args.domain) {
        const d = String(args.domain).trim();
        items = d === 'none' ? items.filter((i) => !i.domain) : items.filter((i) => i.domain === normalizeDomain(d));
      }
      // 标签云（当前关注度筛选范围内）
      const tagCount = new Map();
      for (const i of items) for (const t of i.tags) tagCount.set(t, (tagCount.get(t) || 0) + 1);
      const tagCloud = [...tagCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([tag, count]) => ({ tag, count }));
      if (args.tag) items = items.filter((i) => i.tags.includes(String(args.tag).trim()));
      const counts = { basic: 0, selected: 0, trading: 0 };
      for (const i of items) counts[i.tier] += 1;
      return { items, tiers: TIERS, counts, tagCloud };
    }

    case 'watchlist.add': {
      const syms = normalizeSymbols(args.symbols || []);
      if (!syms.length) throw new Error('请提供有效的 A股代码');
      const tier = normalizeTier(args.tier);
      const tags = normalizeTags(args.tags);
      const names = await namesFor(syms.map((s) => s.code));
      const added = [];
      const existed = [];
      for (const s of syms) {
        const cur = tables.watchlist.get(s.code);
        const name = names.get(s.code) ?? cur?.name ?? s.code;
        if (cur) {
          // 已存在：保留原关注度与标签，仅用更准的名称刷新（若此前名称缺失）
          if (!cur.name || cur.name === cur.symbol) tables.watchlist.put(s.code, { ...cur, name });
          existed.push(compact({ symbol: s.code, name, tier: normalizeTier(cur.tier), domain: normalizeDomain(cur.domain), tags: normalizeTags(cur.tags) }));
        } else {
          const domain = normalizeDomain(args.domain);
          tables.watchlist.put(s.code, { symbol: s.code, name, tier, domain, tags, addedAt: new Date().toISOString() });
          added.push(compact({ symbol: s.code, name, tier, domain, tags }));
        }
      }
      return { items: await enrichWithQuotes([...added, ...existed]), added, existed };
    }

    case 'watchlist.setTags': {
      const list = args.symbols ?? (args.symbol ? [args.symbol] : []);
      const syms = normalizeSymbols(list);
      if (!syms.length) throw new Error('请提供有效的 A股代码');
      const tags = normalizeTags(args.tags);
      const items = [];
      for (const s of syms) {
        const cur = tables.watchlist.get(s.code);
        if (!cur) throw new Error(`${s.code} 不在自选中`);
        const next = { ...cur, tags };
        tables.watchlist.put(s.code, next);
        items.push(compact(next));
      }
      return { items: await enrichWithQuotes(items) };
    }

    case 'watchlist.setTier': {
      const list = args.symbols ?? (args.symbol ? [args.symbol] : []);
      const syms = normalizeSymbols(list);
      if (!syms.length) throw new Error('请提供有效的 A股代码');
      const tier = args.tier;
      if (!tier || !Object.prototype.hasOwnProperty.call(TIERS, tier)) {
        throw new Error(`无效的关注度：${tier}（可选 basic/selected/trading）`);
      }
      const items = [];
      for (const s of syms) {
        const cur = tables.watchlist.get(s.code);
        if (!cur) throw new Error(`${s.code} 不在自选中`);
        const next = { ...cur, tier };
        tables.watchlist.put(s.code, next);
        items.push(compact(next));
      }
      return { items: await enrichWithQuotes(items) };
    }

    case 'watchlist.setDomain': {
      const list = args.symbols ?? (args.symbol ? [args.symbol] : []);
      const syms = normalizeSymbols(list);
      if (!syms.length) throw new Error('请提供有效的 A股代码');
      const domain = normalizeDomain(args.domain);
      if (args.domain && !domain) {
        throw new Error(`无效的领域分类：${args.domain}（可选 finance/consumer/cyclical/tech，或空清除）`);
      }
      const items = [];
      for (const s of syms) {
        const cur = tables.watchlist.get(s.code);
        if (!cur) throw new Error(`${s.code} 不在自选中`);
        const next = { ...cur, domain };
        tables.watchlist.put(s.code, next);
        items.push(compact(next));
      }
      return { items: await enrichWithQuotes(items) };
    }

    case 'watchlist.remove': {
      const syms = normalizeSymbols(args.symbols || []);
      for (const s of syms) await tables.watchlist.delete(s.code);
      return { items: [] };
    }

    case 'portfolio.list': {
      const codes = [...tables.positions.keys()];
      const quotes = await getQuotes(normalizeSymbols(codes)).catch(() => ({ quotes: [] }));
      const qmap = new Map(quotes.quotes.map((q) => [q.code, q]));
      const items = [];
      let totalPnl = 0;
      let totalValue = 0;
      for (const code of codes) {
        const rec = tables.positions.get(code);
        const q = qmap.get(code);
        const price = q?.price ?? null;
        const marketValue = price != null && rec ? +(price * rec.shares).toFixed(2) : null;
        const pnl = price != null && rec ? +((price - rec.costPrice) * rec.shares).toFixed(2) : null;
        const pnlPct = rec?.costPrice ? +(((price - rec.costPrice) / rec.costPrice) * 100).toFixed(2) : null;
        if (pnl != null) totalPnl += pnl;
        if (marketValue != null) totalValue += marketValue;
        items.push({ symbol: code, name: rec?.name ?? q?.name ?? code, shares: rec?.shares, costPrice: rec?.costPrice, price, pctChange: q?.pctChange ?? null, marketValue, pnl, pnlPct });
      }
      return { items, totalPnl: +totalPnl.toFixed(2), totalValue: +totalValue.toFixed(2) };
    }

    case 'portfolio.add': {
      const n = normalizeSymbols([args.symbol])[0];
      if (!n) throw new Error('请提供有效的 A股代码');
      const shares = num(args.shares);
      const costPrice = num(args.costPrice);
      if (!shares || shares <= 0 || !costPrice || costPrice <= 0) throw new Error('请提供有效的持股数与成本价');
      const names = await namesFor([n.code]);
      await tables.positions.put(n.code, { symbol: n.code, name: names.get(n.code) ?? n.code, shares, costPrice, openedAt: new Date().toISOString() });
      return { items: [{ symbol: n.code, name: names.get(n.code) ?? n.code, shares, costPrice }] };
    }

    case 'portfolio.remove': {
      const n = normalizeSymbols([args.symbol])[0];
      if (!n) throw new Error('请提供有效的 A股代码');
      await tables.positions.delete(n.code);
      return { items: [] };
    }

    case 'news': {
      const type = args.type || 'news';
      const n = Math.min(50, Math.max(1, num(args.count) || 20));
      if (type === 'news') return { title: 'A股快讯', items: await getNews({ count: n }) };
      if (type === 'announcement') {
        const code = args.symbol ? normalizeSymbols([args.symbol])[0]?.code : undefined;
        const items = await getAnnouncements({ symbol: code, count: n });
        return { title: code ? `${code} 公告` : 'A股公告', items: items.map((i) => ({ ...i, date: i.noticeDate })) };
      }
      if (type === 'lhb') {
        const items = await getLhb({ count: n });
        return { title: '龙虎榜', items: items.map((i) => ({ ...i, title: `${i.code} ${i.name} 净买额 ${i.netBuyAmt != null ? (i.netBuyAmt / 10000).toFixed(0) : '-'} 万` })) };
      }
      throw new Error(`未知资讯类型：${type}`);
    }

    case 'backtest': {
      const n = normalizeSymbols([args.symbol])[0];
      if (!n) throw new Error(`无效的 A股代码：${args.symbol}`);
      const { bars } = await getKline(n, { period: 'day', limit: num(args.limit) || 250 });
      const params = {};
      if (args.fast) params.fast = num(args.fast);
      if (args.slow) params.slow = num(args.slow);
      if (args.rsiLow) params.low = num(args.rsiLow);
      if (args.rsiHigh) params.high = num(args.rsiHigh);
      const result = runBacktest(bars, args.strategy || 'ma_cross', params, { initial: num(args.initial) || 100000 });
      return { symbol: n.code, ...result };
    }

    case 'alerts.list': {
      const items = [];
      for (const [, rec] of tables.alerts.entries()) items.push(rec);
      return { items };
    }

    case 'alerts.create': {
      const n = normalizeSymbols([args.symbol])[0];
      if (!n) throw new Error('请提供有效的 A股代码');
      if (!args.condition || args.value == null) throw new Error('请提供有效的条件与阈值');
      const names = await namesFor([n.code]);
      const rec = {
        id: randomUUID(), symbol: n.code, name: names.get(n.code) ?? n.code,
        condition: args.condition, value: num(args.value), enabled: true,
        createdAt: new Date().toISOString(),
      };
      await tables.alerts.put(rec.id, rec);
      return { items: [rec] };
    }

    case 'alerts.delete': {
      if (!args.id) throw new Error('请提供要删除的规则 ID');
      await tables.alerts.delete(args.id);
      return { items: [] };
    }

    default:
      throw new Error(`未知操作：${op}`);
  }
}

export { strategies, SORT_MAP };