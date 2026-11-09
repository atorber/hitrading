// 强势股：按交易日展示全市场当日涨幅 > 7% 的股票（最近 10 个交易日）。
// 数据源（免费）：
//   - 东方财富 push2 clist：全市场沪深京 A股列表（实时涨幅排序 / 代码表）
//   - 东方财富 push2his kline：个股前复权日K（历史日期的当日涨幅由相邻收盘价计算）
//   - 东方财富涨停看板 ZTPool：按日涨停池（连板数、首封时间、封单、行业板块）
// 历史日期首次访问需扫描全市场日K（约半分钟），结果按日缓存进 SQLite，之后秒出。
import { fetchJson } from './http.js';
import { TtlCache } from './cache.js';
import { normalizeSymbols } from './symbol.js';
import { getQuotes } from './quotes.js';

/** 强势阈值：当日涨幅超过该值（%）。 */
export const POWER_PCT = 7;
/** 支持的交易日窗口。 */
export const WINDOW_DAYS = 10;

const CLIST = 'https://push2.eastmoney.com/api/qt/clist/get';
const KLINE = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';
const ZTPOOL = 'https://push2ex.eastmoney.com/getTopicZTPool';
const UT = '7eea3edcaed734bea9cbfc24409ed989';
/** 沪深京 A股：深主板 + 创业板 + 沪主板 + 科创板 + 北交所 */
const FS = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048';
const PAGE = 100;

const universeCache = new TtlCache(); // 代码表：24h
const liveCache = new TtlCache();     // 最新交易日实时强势列表：60s
const datesCache = new TtlCache();    // 交易日历：5min
const ztCache = new TtlCache();       // 涨停池：10min
let scanInflight = null;              // 全市场扫描去重（同进程）

const cacheKey = (date) => `pct${POWER_PCT}:${date}`;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

/** 北京时间。 */
function bjNow() {
  return new Date(Date.now() + (8 * 60 + new Date().getTimezoneOffset()) * 60_000);
}
/** 实时数据是否已是收盘定稿（可缓存为当日最终名单）。 */
function isFinal(latestDate) {
  const bj = bjNow();
  const today = `${bj.getFullYear()}-${String(bj.getMonth() + 1).padStart(2, '0')}-${String(bj.getDate()).padStart(2, '0')}`;
  if (latestDate < today) return true;   // 已收市的交易日
  return bj.getHours() > 15 || (bj.getHours() === 15 && bj.getMinutes() >= 5);
}

/** clist 一页。sort=f3 按实时涨跌幅降序，sort=f12 按代码。返回 {rows, total}。 */
async function clistPage(pn, sort) {
  const url = `${CLIST}?pn=${pn}&pz=${PAGE}&po=1&np=1&fltt=2&invt=2&fid=${sort}` +
    `&fs=${encodeURIComponent(FS)}&fields=f2,f3,f12,f13,f14,f100`;
  const data = await fetchJson(url, { timeoutMs: 10_000 });
  const d = data?.data;
  if (!d) throw new Error(`东财列表第 ${pn} 页无数据`);
  const rows = (Array.isArray(d.diff) ? d.diff : []).map((r) => ({
    code: String(r.f12), market: r.f13, name: r.f14,
    price: num(r.f2), pctChange: num(r.f3), industry: r.f100 || null,
  }));
  return { rows, total: num(d.total) || 0 };
}

/** 全市场代码表（含行业），TTL 24h。 */
async function getUniverse() {
  const hit = universeCache.get('all');
  if (hit) return hit;
  const out = [];
  let pn = 1;
  let total = 0;
  for (;;) {
    const { rows, total: t } = await clistPage(pn, 'f12');
    if (pn === 1) total = t;
    if (!rows.length) break;
    out.push(...rows);
    if (rows.length < PAGE) break;
    pn++;
    if (pn > 100 || (total && out.length >= total)) break;
  }
  if (out.length < 1000) throw new Error(`全市场代码表获取不完整（仅 ${out.length} 只）`);
  universeCache.set('all', out, 24 * 3600_000);
  return out;
}

/** 最近交易日历（升序，多取 2 根冗余），以沪市指数为准。 */
async function getTradeDates() {
  const hit = datesCache.get('dates');
  if (hit) return hit;
  const url = `${KLINE}?secid=1.000001&klt=101&fqt=0&lmt=${WINDOW_DAYS + 2}&end=20500101` +
    `&fields1=f1,f2,f3&fields2=f51,f53`;
  const data = await fetchJson(url, { timeoutMs: 10_000 });
  const rows = data?.data?.klines;
  if (!Array.isArray(rows) || rows.length < 2) throw new Error('交易日历获取失败');
  const dates = rows.map((line) => String(line).split(',')[0]);
  const value = dates.slice(-WINDOW_DAYS);
  datesCache.set('dates', value, 5 * 60_000);
  return value;
}

/** 最新交易日的实时强势列表（涨幅降序翻页，翻到 ≤ 阈值即停），TTL 60s。 */
async function getLiveList() {
  const hit = liveCache.get('live');
  if (hit) return hit;
  const items = [];
  for (let pn = 1; pn <= 10; pn++) {
    const { rows } = await clistPage(pn, 'f3');
    let below = false;
    for (const r of rows) {
      if (r.pctChange != null && r.pctChange > POWER_PCT) {
        items.push({ code: r.code, name: r.name, pct: r.pctChange, close: r.price, industry: r.industry });
      }
      if (r.pctChange == null || r.pctChange <= POWER_PCT) below = true;
    }
    if (below || rows.length < PAGE) break;
  }
  items.sort((a, b) => b.pct - a.pct);
  liveCache.set('live', items, 60_000);
  return items;
}

/** 个股前复权日K收盘：[{date, close}]。 */
async function klineCloses(market, code) {
  const url = `${KLINE}?secid=${market}.${code}&klt=101&fqt=1&lmt=${WINDOW_DAYS + 2}&end=20500101` +
    `&fields1=f1,f2,f3&fields2=f51,f53`;
  const data = await fetchJson(url, { timeoutMs: 8000 });
  const rows = data?.data?.klines;
  if (!Array.isArray(rows) || !rows.length) return [];
  return rows.map((line) => {
    const f = String(line).split(',');
    return { date: f[0], close: num(f[1]) };
  });
}

/** 简单并发池。 */
async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= list.length) return;
      out[i] = await fn(list[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * 全市场扫描：一次拉取所有个股近 WINDOW_DAYS+2 根日K，
 * 用相邻前复权收盘计算每个交易日的涨幅，>阈值即收录，并按日写入缓存。
 * 同进程内并发去重（预热与用户请求共享同一次扫描）。
 */
async function scanWindow(windowDates, tables) {
  const uncached = windowDates.filter((d) => {
    try { return !tables.powerful.get(cacheKey(d)); } catch { return true; }
  });
  if (!uncached.length) return;
  if (scanInflight) return scanInflight;
  scanInflight = (async () => {
    const universe = await getUniverse();
    const targetSet = new Map(uncached.map((d) => [d, []]));
    let fails = 0;
    await mapLimit(universe, 16, async (s) => {
      let bars;
      try {
        bars = await klineCloses(s.market, s.code);
      } catch {
        try { bars = await klineCloses(s.market, s.code); } catch { fails++; return; }
      }
      for (let i = 1; i < bars.length; i++) {
        const bucket = targetSet.get(bars[i].date);
        if (!bucket) continue;
        const prev = bars[i - 1].close;
        if (prev == null || bars[i].close == null) continue;
        const pct = round2(((bars[i].close / prev) - 1) * 100);
        if (pct != null && pct > POWER_PCT) {
          bucket.push({ code: s.code, name: s.name, pct, close: bars[i].close, industry: s.industry });
        }
      }
    });
    if (fails > universe.length * 0.05) {
      throw new Error(`全市场扫描失败过多（${fails}/${universe.length}），请稍后重试`);
    }
    for (const [d, items] of targetSet) {
      items.sort((a, b) => b.pct - a.pct);
      tables.powerful.put(cacheKey(d), { pct: POWER_PCT, items, scannedAt: new Date().toISOString() });
    }
  })().finally(() => { scanInflight = null; });
  return scanInflight;
}

/** 按日涨停池：{code: {lbc, fbt, fund, zbc, hybk, zttj}}。历史日期可用。 */
async function getZtPool(date) {
  const key = date.replace(/-/g, '');
  const hit = ztCache.get(key);
  if (hit) return hit;
  const url = `${ZTPOOL}?ut=${UT}&dpt=wz.ztzt&Pageindex=0&pagesize=1000&sort=fbt%3Aasc&date=${key}`;
  const map = new Map();
  try {
    const data = await fetchJson(url, { timeoutMs: 10_000 });
    for (const p of data?.data?.pool || []) {
      map.set(String(p.c), {
        lbc: p.lbc ?? null,          // 连板数
        fbt: p.fbt ?? null,          // 首次封板时间 hhmmss
        fund: p.fund ?? null,         // 封单资金（元）
        zbc: p.zbc ?? null,           // 炸板次数
        hybk: p.hybk ?? null,         // 行业板块
        zttj: p.zttj ?? null,         // {days, ct}：days 天 ct 板
      });
    }
  } catch { /* 涨停池为增强信息，失败不影响主数据 */ }
  ztCache.set(key, map, 10 * 60_000);
  return map;
}

const fmtTime = (t) => (t == null ? null : String(t).padStart(6, '0').replace(/^(\d{2})(\d{2})(\d{2})$/, '$1:$2:$3'));

/**
 * 强势股主入口。
 * @param {{date?: string}} opts date：YYYY-MM-DD，缺省为最新交易日
 * @param {{powerful: any}} tables kv 表（按日缓存）
 */
export async function getPowerful({ date } = {}, tables) {
  if (!tables?.powerful) throw new Error('强势股缓存表未初始化');
  const windowDates = await getTradeDates();          // 升序
  const latest = windowDates[windowDates.length - 1];
  const target = date || latest;
  if (!windowDates.includes(target)) {
    throw new Error(`仅支持最近 ${WINDOW_DAYS} 个交易日（${windowDates[0]} ~ ${latest}）`);
  }

  // 1) 目标日期数据：实时（最新交易日）或缓存/扫描（历史日期）
  let baseItems;
  let fromScan = false;
  if (target === latest) {
    baseItems = (await getLiveList()).map((r) => ({ ...r }));
    if (isFinal(latest)) {
      try {
        tables.powerful.put(cacheKey(latest), { pct: POWER_PCT, items: baseItems, scannedAt: new Date().toISOString() });
      } catch { /* 缓存失败不影响返回 */ }
    }
  } else {
    let hit;
    try { hit = tables.powerful.get(cacheKey(target)); } catch { hit = null; }
    if (!hit) {
      await scanWindow(windowDates.slice(0, -1), tables);
      hit = tables.powerful.get(cacheKey(target));
      fromScan = true;
    }
    if (!hit) throw new Error('强势股扫描未完成，请重试');
    baseItems = hit.items.map((r) => ({ ...r }));
  }

  // 2) 侧栏各日数量：缓存的读缓存，最新交易日用实时列表
  const live = target === latest ? baseItems : await getLiveList().catch(() => null);
  const datesDesc = [...windowDates].reverse().map((d) => {
    if (d === latest) return { date: d, count: live ? live.length : null, isLatest: true };
    try {
      const c = tables.powerful.get(cacheKey(d));
      return { date: d, count: c ? c.items.length : null, isLatest: false };
    } catch {
      return { date: d, count: null, isLatest: false };
    }
  });

  // 3) 增强：涨停池（连板/首封/封单/行业）+ 最新行情
  const zt = await getZtPool(target);
  const codes = baseItems.map((r) => r.code);
  const qmap = new Map();
  if (codes.length) {
    try {
      const { quotes } = await getQuotes(normalizeSymbols(codes));
      for (const q of quotes) qmap.set(q.code, q);
    } catch { /* 行情增强失败不影响 */ }
  }
  const items = baseItems.map((r) => {
    const z = zt.get(r.code) || null;
    const q = qmap.get(r.code);
    return {
      code: r.code,
      name: r.name,
      pct: r.pct,
      close: r.close,
      industry: r.industry || (z && z.hybk) || null,
      zt: z ? { lbc: z.lbc, fbt: fmtTime(z.fbt), fund: z.fund, zbc: z.zbc, zttj: z.zttj } : null,
      latestPct: (q && q.pctChange != null) ? q.pctChange : null,
      latestPrice: (q && q.price != null) ? q.price : null,
    };
  });

  const ztCount = items.filter((r) => r.zt).length;
  const lbcs = items.map((r) => (r.zt?.lbc ?? 0)).filter((v) => v > 0);
  return {
    pct: POWER_PCT,
    date: target,
    dates: datesDesc,
    items,
    stats: {
      count: items.length,
      ztCount,
      maxLbc: lbcs.length ? Math.max(...lbcs) : null,
      avgPct: items.length ? round2(items.reduce((a, b) => a + (b.pct ?? 0), 0) / items.length) : null,
    },
    note: target === latest
      ? '最新交易日为实时数据（盘中持续变化）；收盘后自动定稿缓存'
      : '历史日期由前复权日K计算（收盘价为前复权口径），已缓存',
    fromScan,
    source: 'eastmoney',
    fetchedAt: new Date().toISOString(),
  };
}
