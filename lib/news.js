// 资讯/公告/龙虎榜：东方财富公开接口。
import { fetchJson } from './http.js';

const UA_REFERER = 'https://data.eastmoney.com/';

/** 全市场快讯（东财 fast news）。 */
export async function getNews({ count = 20 } = {}) {
  const url =
    `https://np-listapi.eastmoney.com/comm/web/getFastNewsList` +
    `?client=web&biz=web_724&fastColumn=102&sortEnd=&pageIndex=1&pageSize=${count}&req_trace=1`;
  const data = await fetchJson(url, { timeoutMs: 8000 });
  const list = data?.data?.fastNewsList ?? [];
  return list.map((n) => ({
    title: n.title || n.summary,
    summary: n.summary,
    showTime: n.showTime,
    code: n.code,
    url: n.url,
  }));
}

/** 个股公告（np-anotice）。symbol 为 6 位代码，可省（省则查全部 A 股公告）。 */
export async function getAnnouncements({ symbol, count = 20 } = {}) {
  const base = 'https://np-anotice-stock.eastmoney.com/api/security/ann';
  const qs = `sr=-1&page_size=${count}&page_index=1&ann_type=A&client_source=web`;
  const url = symbol ? `${base}?${qs}&stock_list=${symbol}` : `${base}?${qs}`;
  const data = await fetchJson(url, { headers: { Referer: UA_REFERER }, timeoutMs: 8000 });
  const list = data?.data?.list ?? [];
  return list.map((a) => ({
    code: a.codes?.[0]?.stock_code ?? null,
    name: a.codes?.[0]?.short_name ?? null,
    title: a.title_ch || a.title,
    noticeDate: a.notice_date,
    artCode: a.art_code,
  }));
}

/** 龙虎榜（东财 datacenter，最近交易日）。 */
export async function getLhb({ count = 50 } = {}) {
  const url =
    `https://datacenter-web.eastmoney.com/api/data/v1/get` +
    `?reportName=RPT_ORGANIZATION_TRADE_DETAILS&columns=ALL&pageSize=${count}` +
    `&sortColumns=TRADE_DATE,NET_BUY_AMT&sortTypes=-1,-1`;
  const data = await fetchJson(url, { headers: { Referer: UA_REFERER }, timeoutMs: 8000 });
  const rows = (data?.result?.data ?? []).filter((r) => r.TRADE_DATE);
  return rows.map((r) => ({
    date: String(r.TRADE_DATE).slice(0, 10),
    code: r.SECURITY_CODE,
    name: r.SECURITY_NAME_ABBR,
    close: r.CLOSE_PRICE,
    changeRate: r.CHANGE_RATE,
    netBuyAmt: r.NET_BUY_AMT, // 净买额，元
    buyAmt: r.BUY_AMT,
    sellAmt: r.SELL_AMT,
    reason: r.EXPLANATION,
    turnover: r.TURNOVERRATE,
  }));
}