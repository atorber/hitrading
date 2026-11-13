// 市场量能：沪深京三市日成交额（亿元）+ 主要指数当日涨跌幅。
// 数据源：东方财富 push2his 指数日 K（f57=成交额，f59=涨跌幅），免费接口。
import { fetchJson, fetchText } from './http.js';
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

// ===== 量能回退源（腾讯）：指数成交量（手）做趋势代理 =====
const QQ_KLINE = 'https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=';
/** 腾讯指数日K：[{date, volume(手), close}]。 */
async function qqIndexBars(code, limit) {
  // newfqkline：day 数组第 6 列成交量（手）、第 9 列成交额（万元）——真实历史成交额
  const t = await fetchText(`https://proxy.finance.qq.com/ifzqgtimg/appstock/app/newfqkline/get?param=${code},day,,,${limit},qfq`, { timeoutMs: 9000 });
  const d = JSON.parse(t);
  const key = Object.keys(d.data || {})[0];
  const arr = d.data?.[key]?.day || d.data?.[key]?.qfqday || [];
  return arr.map((row) => ({
    date: row[0],
    volume: Number(row[5]) || 0,
    close: Number(row[2]) || null,
    amountYi: row[8] != null && Number(row[8]) > 0 ? round1(Number(row[8]) / 1e4) : null,
  }));
}

/** 由收盘序列计算每日涨跌幅（%）：[{date, pct}]，首日为 null。 */
function pctFromCloses(bars) {
  const map = new Map(bars.map((b) => [b.date, b.close]));
  const out = new Map();
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].close;
    if (prev && bars[i].close != null) out.set(bars[i].date, round2((bars[i].close / prev - 1) * 100));
  }
  return { map, out };
}


/**
 * 腾讯回退：沪深指数成交量 × 系数 = 近似成交额（亿）。
 * 趋势形态与放量/缩量判定保真；绝对金额为近似值（notes 标注）。
 */
async function energyFromQQ(days) {
  const want = days + 6;
  const [sh, sz, bj, cyb, kc] = await Promise.all([
    qqIndexBars('sh000001', want),
    qqIndexBars('sz399106', want),
    qqIndexBars('bj899050', Math.min(want, 30)).catch(() => []),
    qqIndexBars('sz399006', want).catch(() => []),   // 创业板指
    qqIndexBars('sh000688', want).catch(() => []),   // 科创50
  ]);
  const bjMap = new Map(bj.map((b) => [b.date, b.amountYi]));
  const { out: pctShMap } = pctFromCloses(sh);
  const { out: pctCybMap } = pctFromCloses(cyb);
  const { out: pctKcMap } = pctFromCloses(kc);

  // 全历史真实成交额（腾讯 newfqkline 第 9 列，万元）。个别日期缺额时按该指数
  // 近 5 日「额/量」比 × 当日量补齐，仅在数据源缺失时兜底。
  const ratioOf = (bars) => {
    const pairs = bars.filter((b) => b.amountYi != null && b.volume > 0).slice(-5);
    if (!pairs.length) return null;
    return pairs.reduce((a, b) => a + b.amountYi / (b.volume / 1e8), 0) / pairs.length;
  };
  const fillYi = (b, ratio) => (b.amountYi != null ? b.amountYi : b.volume > 0 && ratio ? round1((b.volume / 1e8) * ratio) : null);
  const shRatio = ratioOf(sh);
  const szRatio = ratioOf(sz);
  const bjRatio = ratioOf(bj);

  const all = sh.map((b) => {
    const shYi = fillYi(b, shRatio);
    const szYi = fillYi(sz.find((x) => x.date === b.date) || { volume: 0, amountYi: null }, szRatio);
    const bjYi = fillYi(bj.find((x) => x.date === b.date) || { volume: 0, amountYi: null }, bjRatio);
    return {
      date: b.date, sh: shYi, sz: szYi, bj: bjYi, total: shYi != null && szYi != null ? round1(shYi + szYi + (bjYi || 0)) : null,
      pctSh: pctShMap.get(b.date) ?? null,
      pctCyb: pctCybMap.get(b.date) ?? null,
      pctKc: pctKcMap.get(b.date) ?? null,
    };
  });
  const totals = all.map((r) => r.total).filter((v) => v != null);
  const ma5All = rollingMean(all.map((r) => r.total), 5);
  const series = all.slice(-days).map((r, i) => {
    const idx = all.length - days + i;
    const prev = idx > 0 ? all[idx - 1].total : null;
    return {
      ...r,
      delta: r.total != null && prev != null ? round1(r.total - prev) : null,
      ma5: ma5All[idx] != null ? round1(ma5All[idx]) : null,
    };
  });

  const latest = all[all.length - 1];
  const lastTotal = series[series.length - 1].total;
  const ma5 = series[series.length - 1].ma5 ?? null;
  const prevTotal = series.length > 1 ? series[series.length - 2].total : null;
  const windowTotals = series.map((r) => r.total).filter((v) => v != null);
  const vsMa5 = lastTotal != null && ma5 ? round2((lastTotal / ma5 - 1) * 100) : null;
  const status = vsMa5 == null ? '-' : vsMa5 >= 10 ? '放量' : vsMa5 <= -10 ? '缩量' : '平量';

  return {
    days,
    series,
    stats: {
      date: latest.date,
      total: round1(lastTotal),
      delta: lastTotal != null && prevTotal != null ? round1(lastTotal - prevTotal) : null,
      ma5: ma5 != null ? round1(ma5) : null,
      rangeAvg: windowTotals.length ? round1(windowTotals.reduce((a, b) => a + b, 0) / windowTotals.length) : null,
      rangeMax: windowTotals.length ? round1(Math.max(...windowTotals)) : null,
      rangeMin: windowTotals.length ? round1(Math.min(...windowTotals)) : null,
      pctSh: latest.pctSh ?? null,
      pctCyb: latest.pctCyb ?? null,
      pctKc: latest.pctKc ?? null,
      vsMa5Pct: vsMa5,
      status,
    },
    notes: {
      sh: '上证指数真实成交额（腾讯日K）',
      sz: '深证综指真实成交额（腾讯日K）',
      bj: '北证50真实成交额（腾讯日K）',
      total: '沪 + 深 + 京（真实值）',
      status: `最新交易日合计较 5 日均额 ${vsMa5 == null ? '-' : (vsMa5 >= 0 ? '+' : '') + vsMa5 + '%'}，±10% 记为放量/缩量`,
      proxy: '东财数据源暂不可用，当前为腾讯日K真实成交额（沪+深+京）：与东财口径基本一致，极早期个别日期可能因数据源缺额而按「额/量」比兜底',
    },
    total: totals.length,
    source: 'tencent-real',
    fetchedAt: new Date().toISOString(),
  };
}

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

/** 腾讯涨跌幅降序页（回退数据源）：{values(zdf), total}。 */
async function qqF3Page(offset) {
  const url = `https://proxy.finance.qq.com/cgi/cgi-bin/rank/hs/getBoardRankList?board_code=aStock&sort_type=PriceRatio&direct=down&offset=${offset}&count=100`;
  const t = await fetchText(url, { timeoutMs: 10_000 });
  const d = JSON.parse(t);
  const list = d?.data?.rank_list || [];
  return {
    total: Number(d?.data?.total) || null,
    values: list.map((r) => (r.zdf !== undefined && r.zdf !== null && r.zdf !== '' ? Number(r.zdf) : null)),
  };
}

/**
 * 当日涨跌家数分布。
 * 主源：东财 clist（精确涨停池口径）；东财限流时自动回退腾讯 rank（涨停/跌停用 ±9.9% 近似，口径标注）。
 */
export async function getBreadth() {
  const hit = breadthCache.get('today');
  if (hit) return hit;
  try {
    return await breadthFromEM();
  } catch {
    return await breadthFromQQ();
  }
}

/** 东财源（原实现）。 */
async function breadthFromEM() {
  const hit = breadthCache.get('em');
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
  value.source = 'eastmoney';
  breadthCache.set('em', value, BREADTH_TTL);
  return value;
}

/** 腾讯回退源：PriceRatio 降序翻页，越过零轴后用 total 反推。 */
async function breadthFromQQ() {
  const hit = breadthCache.get('qq');
  if (hit) return hit;
  let up = 0;
  let flat = 0;
  let down = 0;
  let marketTotal = null;
  let seen = 0;
  let limitUp = 0;
  let limitDown = 0;
  for (let pn = 0; pn < 60; pn++) {
    const page = await qqF3Page(pn * 100);
    const { values, total } = page;
    if (marketTotal == null && total) marketTotal = total;
    if (!values.length) break;
    let crossed = false;
    for (const v of values) {
      seen += 1;
      if (v == null) continue;
      if (v > 9.9) limitUp += 1;
      if (v < -9.9) limitDown += 1;
      if (v > 0) up += 1;
      else if (v === 0) flat += 1;
      else { down += 1; crossed = true; }
    }
    if (crossed) {
      if (marketTotal) down += Math.max(0, marketTotal - seen);
      break;
    }
  }
  const date = new Date(Date.now() + (8 * 60 + new Date().getTimezoneOffset()) * 60_000)
    .toISOString().slice(0, 10);
  const value = {
    date,
    up,
    down,
    flat,
    limitUp: limitUp || null,
    limitDown: limitDown || null,
    total: up + down + flat,
    upRatio: up + down > 0 ? Math.round((up / (up + down)) * 100) : null,
    source: 'tencent',
    note: '涨停/跌停为 ±9.9% 近似口径（腾讯源）',
    fetchedAt: new Date().toISOString(),
  };
  breadthCache.set('qq', value, BREADTH_TTL);
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
  let results = await Promise.allSettled(
    Object.entries(SECIDS).map(async ([k, secid]) => [k, await indexBars(secid, want)]),
  );
  let map = new Map();
  for (const r of results) if (r.status === 'fulfilled') map.set(r.value[0], r.value[1]);
  if (!map.has('sh') || !map.has('sz')) {
    // 东财不可用：腾讯成交量近似回退（叠加腾讯广度+情绪），功能不中断
    const proxy = await energyFromQQ(n);
    try {
      proxy.breadth = await getBreadth();
      proxy.sentiment = evaluateSentiment({ series: proxy.series, breadth: proxy.breadth });
      // 情绪的量能分基于近似金额，标注
      if (proxy.sentiment) proxy.sentiment.note = '量能分基于腾讯成交量近似口径';
    } catch { /* 广度也失败则纯量能代理 */ }
    proxy.cacheKeyNote = 'qq-proxy';
    return proxy;
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
