// 全市场列表/选股：新浪 Market Center（含 PE/PB/市值/换手，可用于排序与本地过滤）。
import { fetchJson } from './http.js';

const SINA_REFERER = 'https://finance.sina.com.cn/';
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function normalizeRow(r) {
  return {
    code: r.code,
    symbol: r.symbol,
    name: r.name,
    price: num(r.trade),
    change: num(r.pricechange),
    pctChange: num(r.changepercent),
    prevClose: num(r.settlement),
    open: num(r.open),
    high: num(r.high),
    low: num(r.low),
    volume: num(r.volume), // 股
    amount: num(r.amount), // 元
    pe: num(r.per),
    pb: num(r.pb),
    totalMcapYi: r.mktcap != null ? +(r.mktcap / 10000).toFixed(2) : null, // 万元 → 亿元
    floatMcapYi: r.nmc != null ? +(r.nmc / 10000).toFixed(2) : null,
    turnover: num(r.turnoverratio), // 换手率 %
  };
}

/**
 * 拉取一页全市场列表。
 * sort 可选：changepercent(涨跌幅) amount(成交额) turnoverratio(换手率) mktcap(总市值) per(市盈率) 等。
 */
export async function getMarketList({ sort = 'amount', asc = 0, page = 1, num = 100 } = {}) {
  const url =
    `https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData` +
    `?page=${page}&num=${Math.min(100, Math.max(1, num))}&sort=${sort}&asc=${asc}&node=hs_a&_s_r_a=init`;
  const data = await fetchJson(url, { headers: { Referer: SINA_REFERER }, timeoutMs: 10000 });
  return (Array.isArray(data) ? data : []).map(normalizeRow);
}

/** 多页拉取，直到凑够 limit 条或没有更多。 */
export async function getMarketTop({ sort = 'amount', asc = 0, limit = 50 } = {}) {
  const out = [];
  for (let page = 1; out.length < limit && page <= 55; page++) {
    const pageRows = await getMarketList({ sort, asc, page, num: 100 });
    if (pageRows.length === 0) break;
    for (const r of pageRows) {
      if (out.length < limit) out.push(r);
    }
  }
  return out;
}