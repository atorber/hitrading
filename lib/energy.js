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

// ===== 涨跌家数（东财 clist 分页统计）=====
const EM_CLIST = 'https://push2.eastmoney.com/api/qt/clist/get';
const EM_ZT = 'https://push2ex.eastmoney.com/getTopicZTPool';
const EM_DT = 'https://push2ex.eastmoney.com/getTopicDTPool';
const EM_UT = '7eea3edcaed734bea9cbfc24409ed989';
const FS_ALL = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048';
const breadthCache = new TtlCache();
const BREADTH_TTL = 5 * 60_000;   // 广度翻页 ~31 次请求，缓存拉长降低频次

/** clist 单页（f3 涨跌幅降序）。返回 {values, total}；total 为全市场证券数。 */
async function clistF3Page(pn) {
  const url = `${EM_CLIST}?pn=${pn}&pz=100&po=1&np=1&fltt=2&invt=2&fid=f3` +
    `&fs=${encodeURIComponent(FS_ALL)}&fields=f3`;
  const data = await fetchJson(url, { timeoutMs: 10_000 });
  const rows = data?.data?.diff;
  return {
    total: Number(data?.data?.total) || null,
    values: Array.isArray(rows) ? rows.map((r) => (typeof r.f3 === 'number' ? r.f3 : null)) : [],
  };
}

/** 涨停/跌停家数（东财涨停池/跌停池）。 */
async function limitCounts(date) {
  const key = date.replace(/-/g, '');
  const get = async (base) => {
    try {
      const url = `${base}?ut=${EM_UT}&dpt=wz.ztzt&Pageindex=0&pagesize=1000&sort=fbt%3Aasc&date=${key}`;
      const data = await fetchJson(url, { timeoutMs: 10_000 });
      return (data?.data?.pool || []).length;
    } catch { return null; }
  };
  const [zt, dt] = await Promise.all([get(EM_ZT), get(EM_DT)]);
  return { limitUp: zt, limitDown: dt };
}

/**
 * 当日涨跌家数分布：clist 按涨跌幅降序翻页，越过 0 后停止；跌的只统计总数（用 total-涨-平 推不出，需翻到负值页）。
 * 策略：降序翻页直到出现 <=0 的行；负值行数用 (total - 已见非负数) 反推精确值，无需继续翻页。
 */
export async function getBreadth() {
  const hit = breadthCache.get('today');
  if (hit) return hit;
  let up = 0;
  let flat = 0;
  let marketTotal = null;
  let seen = 0;
  let down = 0;
  for (let pn = 1; pn <= 60; pn++) {
    let page;
    try {
      page = await clistF3Page(pn);
    } catch (e) {
      if (pn === 1) throw e;
      break; // 中途失败：用已统计部分 + 市场总数推断
    }
    const { values, total } = page;
    if (marketTotal == null && total) marketTotal = total;
    if (!values.length) break;
    let crossed = false;
    for (const v of values) {
      seen += 1;
      if (v == null) continue;
      if (v > 0) up += 1;
      else if (v === 0) flat += 1;
      else { down += 1; crossed = true; }
    }
    // 已越过零轴：剩余页全为下跌，用市场总数 - 已见数 一次算出，无需继续翻页
    if (crossed) {
      if (marketTotal) down += Math.max(0, marketTotal - seen);
      break;
    }
  }
  const date = new Date(Date.now() + (8 * 60 + new Date().getTimezoneOffset()) * 60_000)
    .toISOString().slice(0, 10);
  const { limitUp, limitDown } = await limitCounts(date);
  const value = {
    date,
    up,
    down,
    flat,
    limitUp,
    limitDown,
    total: up + down + flat,
    upRatio: up + down > 0 ? Math.round((up / (up + down)) * 100) : null,
    fetchedAt: new Date().toISOString(),
  };
  breadthCache.set('today', value, BREADTH_TTL);
  return value;
}

// ===== 情绪评估 =====
/** 量能档位（用户定义）：1万以下谨慎区；1.5万以上适度参与/强力做多。单位：亿元。 */
export function amountZone(yi) {
  if (yi == null) return { key: 'unknown', label: '-', hint: '量能数据不足' };
  if (yi < 10_000) return { key: 'caution', label: '谨慎区', hint: '日均成交额 1 万亿以下，尽量减少仓位' };
  if (yi >= 15_000) return { key: 'active', label: '参与区', hint: '1.5 万亿以上，赛道股结构性行情' };
  return { key: 'neutral', label: '过渡区', hint: '1 ~ 1.5 万亿之间，控制仓位观察' };
}

/**
 * 综合情绪评估（0-100）：
 *  - 量能分（40%）：档位 + 持续性（近3日均额 ≥1.5 万亿 视为持续）
 *  - 广度分（35%）：涨跌家数比
 *  - 涨停情绪（25%）：涨停/跌停家数比
 */
export function evaluateSentiment({ series = [], breadth = null } = {}) {
  const totals = series.map((r) => r.total).filter((v) => v != null);
  const latest = totals[totals.length - 1] ?? null;
  const ma5 = totals.length >= 5 ? totals.slice(-5).reduce((a, b) => a + b, 0) / 5 : latest;
  const last3 = totals.slice(-3);
  const zone = amountZone(latest);
  const sustained = last3.length === 3 && last3.every((v) => v >= 15_000);

  // 量能分：谨慎 20 / 过渡 55 / 参与 70 / （参与+持续=强力）85；跌破 5 日均额再打折
  let amountScore;
  if (zone.key === 'caution') amountScore = 20;
  else if (zone.key === 'neutral') amountScore = 55;
  else amountScore = sustained ? 85 : 70;
  if (latest != null && ma5 != null && latest < ma5 * 0.9) amountScore = Math.max(10, amountScore - 15);

  // 广度分：涨跌比 0~1 映射 0~100
  const upDownRatio = breadth && breadth.up + breadth.down > 0 ? breadth.up / (breadth.up + breadth.down) : null;
  const breadthScore = upDownRatio == null ? null : Math.round(upDownRatio * 100);

  // 涨停情绪：涨停 vs 跌停（跌停为 0 时给 90 上限）
  let limitScore = null;
  if (breadth && breadth.limitUp != null && breadth.limitDown != null) {
    const lu = breadth.limitUp;
    const ld = breadth.limitDown;
    if (lu + ld === 0) limitScore = 50;
    else limitScore = Math.round((lu / (lu + ld)) * 100);
  }

  const parts = [[amountScore, 0.4], breadthScore != null ? [breadthScore, 0.35] : null, limitScore != null ? [limitScore, 0.25] : null].filter(Boolean);
  const score = Math.round(parts.reduce((a, [v, w]) => a + v * w, 0) / parts.reduce((a, [, w]) => a + w, 0));
  const label = score >= 80 ? '亢奋' : score >= 60 ? '活跃' : score >= 40 ? '中性' : score >= 20 ? '低迷' : '冰点';
  const zoneHint = zone.key === 'active'
    ? (sustained ? '1.5 万亿以上且能持续——强力做多区' : '1.5 万亿以上但不能持续——警惕短期头部')
    : zone.hint;

  return {
    score,
    label,
    zone: { ...zone, sustained, hint: zoneHint },
    parts: { amount: amountScore, breadth: breadthScore, limit: limitScore },
    latestAmount: latest != null ? Math.round(latest) : null,
    ma5Amount: ma5 != null ? Math.round(ma5) : null,
    vsMa5Pct: latest != null && ma5 ? Math.round((latest / ma5 - 1) * 100) : null,
    upDownRatio: upDownRatio != null ? Math.round(upDownRatio * 100) / 100 : null,
  };
}

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
  // 广度与情绪（独立数据源，失败不阻塞量能主数据）
  let breadth = null;
  let sentiment = null;
  try {
    breadth = await getBreadth();
    sentiment = evaluateSentiment({ series: all, breadth });
  } catch { /* 东财 clist 被限流时仍返回量能主数据 */ }
  if (breadth) value.breadth = breadth;
  if (sentiment) value.sentiment = sentiment;

  cache.set(key, value, TTL_MS);
  return value;
}
