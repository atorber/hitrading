// 市场量能：沪深京三市日成交额（亿元）+ 主要指数当日涨跌幅。
// 数据源：东方财富 push2his 指数日 K（f57=成交额，f59=涨跌幅），免费接口。
import { fetchJson } from './http.js';
import { TtlCache } from './cache.js';

const EM_KLINE = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';
const SECIDS = {
  sh: '1.000001',   // 上证指数 —— 沪市全市场
  sz: '0.399106',   // 深证综指 —— 深市全市场
  bj: '0.899050',   // 北证50 —— 京市（成分股口径，北交所无全市场指数）
  cyb: '0.399006',  // 创业板指
  kc: '1.000688',   // 科创50
};
const FIELDS2 = 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61';
const YI = 1e8;
const TTL_MS = 3 * 60_000;
const cache = new TtlCache();

/** 取单个指数最近 limit 根日K：[{date, close, amount(亿), pct}]。 */
async function indexBars(secid, limit) {
  const url = `${EM_KLINE}?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=${FIELDS2}` +
    `&klt=101&fqt=0&end=20500101&lmt=${limit}`;
  const data = await fetchJson(url, { timeoutMs: 9000 });
  const rows = data?.data?.klines;
  if (!Array.isArray(rows)) throw new Error(`指数 ${secid} 无数据`);
  return rows.map((line) => {
    const f = String(line).split(',');
    return {
      date: f[0],
      close: Number(f[2]),
      amount: Number(f[6]) / YI,   // 成交额，亿元
      pct: Number(f[8]),           // 涨跌幅，%
    };
  });
}

/** 最近 n 个交易日的滚动均值；不足 n 的返回 null。 */
function rollingMean(values, n) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i] ?? 0;
    if (i >= n) sum -= values[i - n] ?? 0;
    out.push(i >= n - 1 ? sum / n : null);
  }
  return out;
}

const round1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const round2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);

/**
 * 量能序列。
 * @param {{days?: number}} opts days: 20/40/60，默认 20
 */
export async function getMarketEnergy({ days = 20 } = {}) {
  const n = [20, 40, 60].includes(Number(days)) ? Number(days) : 20;
  const key = `energy:${n}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const want = n + 6; // 多取几根用于计算 MA5 与"较前日"
  const results = await Promise.allSettled(
    Object.entries(SECIDS).map(async ([k, secid]) => [k, await indexBars(secid, want)]),
  );
  const map = new Map();
  for (const r of results) if (r.status === 'fulfilled') map.set(r.value[0], r.value[1]);
  if (!map.has('sh') || !map.has('sz')) {
    const err = results.find((r) => r.status === 'rejected');
    throw new Error(`量能数据获取失败：${err?.reason?.message || '东财接口无响应'}`);
  }

  // 以沪市交易日为基准对齐（深市同交易日历）
  const shBars = map.get('sh');
  const byDate = (k) => new Map((map.get(k) || []).map((b) => [b.date, b]));
  const szMap = byDate('sz'), bjMap = byDate('bj'), cybMap = byDate('cyb'), kcMap = byDate('kc');

  const all = shBars.map((b) => {
    const sz = szMap.get(b.date);
    const bj = bjMap.get(b.date);
    const cyb = cybMap.get(b.date);
    const kc = kcMap.get(b.date);
    const shAmt = b.amount;
    const szAmt = sz ? sz.amount : null;
    const bjAmt = bj ? bj.amount : null;
    const total = szAmt != null ? shAmt + szAmt + (bjAmt ?? 0) : null;
    return {
      date: b.date,
      sh: round1(shAmt),
      sz: round1(szAmt),
      bj: round1(bjAmt),
      total: round1(total),
      pctSh: round2(b.pct),
      pctCyb: cyb ? round2(cyb.pct) : null,
      pctKc: kc ? round2(kc.pct) : null,
    };
  });

  const totals = all.map((r) => r.total).filter((v) => v != null);
  const ma5All = rollingMean(all.map((r) => r.total), 5);
  const series = all.slice(-n).map((r, i) => {
    const idx = all.length - n + i;
    const prev = idx > 0 ? all[idx - 1].total : null;
    return {
      ...r,
      delta: r.total != null && prev != null ? round1(r.total - prev) : null,
      ma5: ma5All[idx] != null ? round1(ma5All[idx]) : null,
    };
  });

  const latest = all[all.length - 1];
  const lastTotal = latest.total;
  const ma5 = ma5All[ma5All.length - 1];
  const prevTotal = all.length > 1 ? all[all.length - 2].total : null;
  const windowTotals = series.map((r) => r.total).filter((v) => v != null);
  const vsMa5 = lastTotal != null && ma5 ? round2((lastTotal / ma5 - 1) * 100) : null;
  const status = vsMa5 == null ? '-' : vsMa5 >= 10 ? '放量' : vsMa5 <= -10 ? '缩量' : '平量';

  const value = {
    days: n,
    series,
    stats: {
      date: latest.date,
      total: round1(lastTotal),
      delta: lastTotal != null && prevTotal != null ? round1(lastTotal - prevTotal) : null,
      ma5: ma5 != null ? round1(ma5) : null,
      rangeAvg: windowTotals.length ? round1(windowTotals.reduce((a, b) => a + b, 0) / windowTotals.length) : null,
      rangeMax: windowTotals.length ? round1(Math.max(...windowTotals)) : null,
      rangeMin: windowTotals.length ? round1(Math.min(...windowTotals)) : null,
      pctSh: latest.pctSh,
      pctCyb: latest.pctCyb,
      pctKc: latest.pctKc,
      vsMa5Pct: vsMa5,
      status,
    },
    // 口径说明：北交所无全市场指数，京市取北证50成分股成交额（通常占北交所成交额一半以上）
    notes: {
      sh: '上证指数成交额（沪市全市场）',
      sz: '深证综指成交额（深市全市场）',
      bj: '北证50成交额（京市口径，北交所无全市场指数）',
      total: '沪市 + 深市 + 京市',
      status: `最新交易日合计较 5 日均额 ${vsMa5 == null ? '-' : (vsMa5 >= 0 ? '+' : '') + vsMa5 + '%'}，±10% 记为放量/缩量`,
    },
    total: totals.length,
    source: 'eastmoney',
    fetchedAt: new Date().toISOString(),
  };
  cache.set(key, value, TTL_MS);
  return value;
}
